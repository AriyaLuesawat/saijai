"use client";
import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Home() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // ดึงข้อมูลจากฐานข้อมูลจำลอง (LocalStorage)
  useEffect(() => {
    const saved = localStorage.getItem("saijai_database");
    if (saved) setTransactions(JSON.parse(saved));
  }, []);

  const saveToDB = (newData: any[]) => {
    const updated = [...newData, ...transactions];
    setTransactions(updated);
    localStorage.setItem("saijai_database", JSON.stringify(updated));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles(selected);
      setPreviews(selected.map(f => ({ url: URL.createObjectURL(f), name: f.name })));
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    const results: any[] = [];
    await Promise.all(files.map(async (file, i) => {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("http://localhost:8000/analyze-slip/", { method: "POST", body: fd });
        const data = await res.json();
        if (data.status === "success") {
          results.push({ 
            id: Date.now() + i, 
            preview: previews[i].url, 
            date: new Date().toLocaleDateString('th-TH'), 
            ...data.data 
          });
        }
      } catch (e) { console.error(e); }
    }));
    saveToDB(results);
    setFiles([]); setPreviews([]); setLoading(false);
    setActiveMenu("dashboard");
  };

  // 📊 ฟังก์ชันเตรียมข้อมูลสำหรับกราฟโดนัท
  const getChartData = () => {
    const categoryTotals: { [key: string]: number } = {};
    let totalAll = 0;

    transactions.forEach((item) => {
      const amountNum = parseFloat(item.amount.replace(/,/g, ""));
      let cat = item.category === "ทำบุญ/บริจาค" ? "บริจาค" : item.category;
      if (!isNaN(amountNum)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amountNum;
        totalAll += amountNum;
      }
    });

    return Object.keys(categoryTotals).map((key) => ({
      name: key,
      value: categoryTotals[key],
      percent: totalAll > 0 ? ((categoryTotals[key] / totalAll) * 100).toFixed(0) : "0"
    }));
  };

  const chartData = getChartData();
  
  // 🎨 แก้ไขชุดสีตรงนี้: ใช้สีที่แตกต่างกันชัดเจน (High Contrast) เพื่อให้แยกหมวดหมู่ง่ายขึ้น
  const COLORS = [
    '#10B981', // เขียว Emerald (สีหลัก)
    '#F59E0B', // เหลืองอำพัน (Amber)
    '#3B82F6', // ฟ้า (Blue)
    '#F43F5E', // แดงอมชมพู (Rose)
    '#8B5CF6', // ม่วง (Violet)
    '#06B6D4', // ฟ้าอมเขียว (Cyan)
    '#EC4899', // ชมพู (Pink)
    '#64748B'  // เทา (Slate)
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* 🌲 แถบเมนูด้านข้าง (Sidebar) */}
      <aside className="w-72 bg-[#064E3B] text-white flex flex-col shadow-2xl">
        <div className="p-6">
          <div className="mb-8 flex items-center justify-center bg-white/10 p-6 rounded-[2rem] backdrop-blur-sm border border-white/10 shadow-inner">
            <img 
              src="/image_74b13d.png" 
              alt="โลโก้ใสใจ" 
              className="h-20 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300" 
            />
          </div>
          
          <nav className="space-y-3">
            <button onClick={() => setActiveMenu("dashboard")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold ${activeMenu === "dashboard" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/50" : "text-emerald-100/50 hover:bg-white/5 hover:text-white"}`}>
              <span className="text-xl">📊</span> แผงควบคุม
            </button>
            <button onClick={() => setActiveMenu("upload")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold ${activeMenu === "upload" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/50" : "text-emerald-100/50 hover:bg-white/5 hover:text-white"}`}>
              <span className="text-xl">📥</span> อัปโหลดสลิป
            </button>
          </nav>
        </div>
        
        {/* ข้อมูลโปรไฟล์ */}
        <div className="mt-auto p-6">
          <div className="bg-[#022C22] rounded-3xl p-5 border border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-black text-emerald-950 text-xs">AR</div>
              <div>
                <p className="text-sm font-bold">อริยะ ลือสวัสดิ์</p>
                <p className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">6730614023</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ส่วนหัวของหน้า (Header) */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-12">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {activeMenu === "dashboard" ? "ภาพรวมค่าใช้จ่าย" : "จัดการไฟล์เอกสาร"}
          </h2>
          <button onClick={() => { localStorage.removeItem("saijai_database"); setTransactions([]); }} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-5 py-2 rounded-xl text-xs font-bold transition-all border border-rose-100">
            ล้างข้อมูลทั้งหมด 🗑️
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-12">
          {activeMenu === "dashboard" && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
              {/* ส่วนสรุปตัวเลข (Stats Cards) */}
              <div className="grid grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-emerald-500 transition-all">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">ยอดใช้จ่ายรวม</p>
                  <p className="text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">฿{transactions.reduce((s,t)=>s+parseFloat(t.amount.replace(/,/g,"")),0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">รายการทั้งหมด</p>
                  <p className="text-4xl font-black text-slate-900">{transactions.length} <span className="text-lg font-medium text-slate-300">รายการ</span></p>
                </div>
                <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-200">
                   <p className="font-bold text-xl mb-1">ระบบวิเคราะห์ AI</p>
                   <p className="text-emerald-100 text-sm italic">พร้อมใช้งานและทำงานปกติ</p>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-8">
                {/* 🎯 ส่วนของกราฟ */}
                <div className="col-span-5 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                  <h3 className="font-black text-xs text-slate-400 mb-4 uppercase tracking-widest text-center">สัดส่วนตามหมวดหมู่</h3>
                  <div className="flex-1 relative min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={80} 
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                          animationBegin={0}
                          animationDuration={1200}
                        >
                          {/* สีจะถูกดึงมาจาก COLORS ที่เปลี่ยนใหม่ */}
                          {chartData.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [`฿${value.toLocaleString()}`, 'ยอดใช้จ่าย']}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* ข้อความยอดรวมตรงกลางวงกลม */}
                    {transactions.length > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-15px' }}>
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ทั้งหมด</span>
                        <span className="text-2xl font-black text-slate-800">
                          ฿{transactions.reduce((s,t)=>s+parseFloat(t.amount.replace(/,/g,"")),0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ส่วนแสดงรายการล่าสุด */}
                <div className="col-span-7 space-y-4">
                  <h3 className="font-black text-xs text-slate-400 mb-2 uppercase tracking-widest">ความเคลื่อนไหวล่าสุด</h3>
                  {transactions.map((tx, index) => (
                    <div key={`${tx.id}-${index}`} className="bg-white p-5 rounded-[2rem] border border-slate-50 flex items-center gap-6 hover:shadow-xl hover:scale-[1.01] transition-all group">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                        <img src={tx.preview} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                            {tx.category === "ทำบุญ/บริจาค" ? "บริจาค" : tx.category}
                          </span>
                          <span className="text-[10px] text-slate-300">{tx.date}</span>
                        </div>
                        <h4 clas
                        sName="font-bold text-slate-800 text-lg">{tx.memo}</h4>
                      </div>
                      <div className="text-right px-4">
                        <p className="text-2xl font-black text-slate-900">฿{tx.amount}</p>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
                      ยังไม่มีข้อมูลความเคลื่อนไหว
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMenu === "upload" && (
            <div className="max-w-2xl mx-auto py-10 animate-in zoom-in-95 duration-500">
              <div className="bg-white p-14 rounded-[3.5rem] shadow-2xl border border-slate-50 text-center">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">📥</div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">อัปโหลดสลิป</h2>
                <div className="relative border-4 border-dashed border-emerald-100 rounded-[2.5rem] p-20 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer group">
                  <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <p className="text-emerald-700/50 font-black uppercase tracking-widest group-hover:text-emerald-700 transition-colors">คลิกหรือลากไฟล์มาวางที่นี่</p>
                </div>
                {previews.length > 0 && (
                  <button onClick={handleUpload} disabled={loading} className="mt-10 w-full bg-[#064E3B] text-white py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest hover:bg-emerald-800 shadow-2xl transition-all active:scale-95 disabled:bg-slate-300">
                    {loading ? "กำลังประมวลผล AI..." : `เริ่มวิเคราะห์สลิป (${files.length} รายการ) ➔`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}