from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
import easyocr
import numpy as np
import cv2
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. เตรียมสมอง AI สำหรับจัดหมวดหมู่ (Training - เวอร์ชันแก้คำกำกวม N-Gram)
# ==========================================
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from pythainlp.tokenize import word_tokenize

def thai_tokenize(text):
    return word_tokenize(text, engine='newmm', keep_whitespace=False)

words = [
    # หมวด: ค่าอาหาร
    "ค่าข้าว", "กินข้าว", "ก๋วยเตี๋ยว", "ชาบู", "หมูกระทะ", "น้ำ", "ขนม", "กาแฟ", "เครื่องดื่ม", "อาหาร", "สุกี้", "ข้าว",
    "ผัด", "ทอด", "ต้ม", "แกง", "ยำ", "ตำ", "ไก่", "หมู", "เนื้อ", "ปลา", "กุ้ง", "ปลาหมึก", "ไข่", "กะเพรา", "คะน้า", "บุฟเฟ่ต์",
    
    # หมวด: ค่าเดินทาง
    "ค่ารถ", "รถเมล์", "แท็กซี่", "bts", "mrt", "วิน", "มอไซค์", "รถตู้", "เติมน้ำมัน", "ค่าน้ำมัน", "ทางด่วน", "grab", "bolt", "ค่าเดินทาง",
    
    # หมวด: ค่าสาธารณูปโภค
    "ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "ค่าโทรศัพท์", "ค่าหอ", "ค่าเช่าหอ", "บิล", "ais", "true", "dtac", "3bb", "ค่าไฟหอ",
    
    # หมวด: ค่าของใช้
    "ของใช้", "สบู่", "แชมพู", "ยาสีฟัน", "ซักผ้า", "เซเว่น", "7-11", "โลตัส", "บิ๊กซี", "watson", "สกินแคร์", "ช้อปปิ้ง", "เสื้อผ้า",
    
    # หมวด: โอนเงิน
    "โอนเงิน", "ให้เพื่อน", "คืนเงิน", "ฝากเงิน", "จ่ายหนี้", "ค่าแชร์", "โอนให้", "ให้แม่", "ให้พ่อ",
    
    # หมวด: ใบเสร็จ
    "ใบเสร็จ", "จ่ายบิล", "ชำระเงิน", "ซื้อของ", "ยอดรวม",
    
    # หมวด: ทำบุญ/บริจาค
    "ทำบุญ", "ทอดกฐิน", "ทำบุญทอดกฐิน", "ผ้าป่า", "บริจาค", "มูลนิธิ", "ใส่บาตร", "ถวาย", "วัด",
    
    # หมวด: ความบันเทิง
    "ดูหนัง", "ตั๋วหนัง", "เกม", "เติมเกม", "netflix", "spotify", "คอนเสิร์ต", "ค่าเหล้า", "เที่ยว",
    
    # หมวด: สุขภาพ/ความงาม
    "หาหมอ", "ซื้อยา", "ทำฟัน", "คลินิก", "โรงพยาบาล", "ตัดผม", "ทำเล็บ", "นวด",
    
    # หมวด: อื่นๆ
    "ค่าจิปาถะ", "อื่นๆ", "ค่าปรับ", "ภาษี"
]

categories = (
    ["ค่าอาหาร"] * 28 +
    ["ค่าเดินทาง"] * 14 +
    ["ค่าสาธารณูปโภค"] * 12 +
    ["ค่าของใช้"] * 13 +
    ["โอนเงิน"] * 9 +
    ["ใบเสร็จ"] * 5 +
    ["ทำบุญ/บริจาค"] * 9 +  # เพิ่มจำนวนคำให้ตรงกัน
    ["ความบันเทิง"] * 9 +
    ["สุขภาพ/ความงาม"] * 8 +
    ["อื่นๆ"] * 4
)

# พระเอกของงานนี้คือ ngram_range=(1, 2) ทำให้ AI วิเคราะห์กลุ่มคำ 2 คำติดกันได้
vectorizer = TfidfVectorizer(tokenizer=thai_tokenize, token_pattern=None, ngram_range=(1, 2))
X_train = vectorizer.fit_transform(words)
model = MultinomialNB()
model.fit(X_train, categories)

# ==========================================
# 2. เตรียมสมอง AI สำหรับอ่านตัวอักษร (EasyOCR)
# ==========================================
# หมายเหตุ: รันครั้งแรกจะใช้เวลาโหลดโมเดล OCR สักพักนะครับ
reader = easyocr.Reader(['th', 'en'])

@app.post("/analyze-slip/")
async def analyze_slip(file: UploadFile = File(...)):
    try:
        # --- ก. แปลงไฟล์รูปภาพให้อยู่ในรูปแบบที่อ่านได้ ---
        image_bytes = await file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # --- ข. ให้ EasyOCR กวาดอ่านข้อความทั้งหมดในรูป ---
        ocr_results = reader.readtext(img, detail=0) 
        full_text = " ".join(ocr_results).lower()

        # ==========================================
        # ฟีเจอร์ที่ 1: ตรวจจับว่าเป็นสลิปหรือไม่ (Document Verification)
        # ==========================================
        # เช็คว่ามีคำสำคัญบังคับหรือไม่ เช่น "โอนเงินสำเร็จ" หรือ "รหัสอ้างอิง"
        is_slip = any(keyword in full_text for keyword in ["โอนเงิน", "สำเร็จ", "รหัสอ้างอิง", "transfer", "รายการ"])
        
        if not is_slip:
            return {
                "status": "error",
                "message": "ภาพนี้ไม่ใช่สลิปโอนเงิน กรุณาอัปโหลดรูปภาพสลิปธนาคารที่ถูกต้อง"
            }

        # ==========================================
        # ฟีเจอร์ที่ 2: จำแนกธนาคารต้นทาง (Bank Classification)
        # ==========================================
        bank_name = "ไม่ทราบธนาคาร"
        if any(k in full_text for k in ["scb", "ไทยพาณิชย์"]):
            bank_name = "SCB (ไทยพาณิชย์)"
        elif any(k in full_text for k in ["kbank", "กสิกร", "k plus"]):
            bank_name = "KBank (กสิกรไทย)"
        elif any(k in full_text for k in ["ktb", "กรุงไทย", "krungthai"]):
            bank_name = "KTB (กรุงไทย)"
        elif any(k in full_text for k in ["bbl", "กรุงเทพ", "bangkok"]):
            bank_name = "BBL (ธนาคารกรุงเทพ)"

        # ==========================================
        # ฟีเจอร์ที่ 3 & 4: สกัดข้อมูลและคาดเดาหมวดหมู่ (แบบ Hybrid)
        # ==========================================
        memo = "ไม่ได้ระบุบันทึกช่วยจำ"
        amount = "0.00"

        # หาราคาคร่าวๆ (ดึงตัวเลขที่มีจุดทศนิยม)
        amounts = re.findall(r'\b\d{1,3}(?:,\d{3})*\.\d{2}\b', full_text)
        if amounts:
            amount = amounts[-1]

        # หาบันทึกช่วยจำ
        for i, text in enumerate(ocr_results):
            if "บันทึกช่วยจำ" in text or "memo" in text.lower():
                if i + 1 < len(ocr_results):
                    memo = ocr_results[i+1]
                    break

        # ----------------------------------------------------
        # 🧠 ระบบ AI อัจฉริยะ (Hybrid Classification)
        # ----------------------------------------------------
        category = "โอนเงิน" # ค่าเริ่มต้นถ้าไม่มีบันทึกช่วยจำ

        if memo != "ไม่ได้ระบุบันทึกช่วยจำ":
            # 1. ระบบ Rule-Based (กฎตายตัว แม่นยำ 100%)
            # ถ้าเจอคำเหล่านี้ในบันทึกช่วยจำ ให้จัดหมวดหมู่ทันทีไม่ต้องให้ AI เดา
            if any(word in memo for word in ["ทำบุญ", "กฐิน", "ผ้าป่า", "บริจาค", "ใส่บาตร"]):
                category = "ทำบุญ/บริจาค"
            elif any(word in memo for word in ["เซเว่น", "7-11", "โลตัส", "lotus", "ของใช้"]):
                category = "ค่าของใช้"
            elif any(word in memo for word in ["ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "บิล"]):
                category = "ค่าสาธารณูปโภค"
            elif any(word in memo for word in ["รถเมล์", "bts", "mrt", "วิน", "แท็กซี่", "grab"]):
                category = "ค่าเดินทาง"
                
            # 2. ระบบ Machine Learning (ถ้ากฎข้างบนเอาไม่อยู่ ค่อยให้ AI เดาจากความน่าจะเป็น)
            else:
                text_vector = vectorizer.transform([memo])
                category = model.predict(text_vector)[0]

        return {
            "status": "success",
            "data": {
                "bank_name": bank_name,
                "amount": amount,
                "memo": memo,
                "category": category
            }
        }

    except Exception as e:
        return {"status": "error", "message": f"ระบบประมวลผลขัดข้อง: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)