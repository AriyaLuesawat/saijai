"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: number;
  preview: string;
  date: string;
  bank_name: string;
  amount: string;
  memo: string;
  recipient: string;
  category: string;
  confidence: number;
}

type Menu = "dashboard" | "upload" | "history";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DB_KEY = "saijai_database";

const CATEGORY_COLORS: Record<string, string> = {
  "ค่าอาหาร":       "#10B981",
  "ค่าเดินทาง":     "#F59E0B",
  "ค่าสาธารณูปโภค": "#3B82F6",
  "ค่าของใช้":      "#F43F5E",
  "โอนเงิน":        "#8B5CF6",
  "ทำบุญ/บริจาค":   "#06B6D4",
  "ความบันเทิง":    "#EC4899",
  "สุขภาพ/ความงาม": "#84CC16",
  "อื่นๆ":          "#64748B",
};
const FALLBACK_COLOR = "#94A3B8";

const CATEGORIES = Object.keys(CATEGORY_COLORS);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(raw: string): string {
  const n = parseFloat(raw.replace(/,/g, ""));
  return isNaN(n) ? "0.00" : n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function totalAmount(list: Transaction[]): number {
  return list.reduce((s, t) => s + parseFloat(t.amount.replace(/,/g, "") || "0"), 0);
}

function getChartData(list: Transaction[]) {
  const totals: Record<string, number> = {};
  let grand = 0;
  list.forEach((t) => {
    const n = parseFloat(t.amount.replace(/,/g, ""));
    if (!isNaN(n)) {
      totals[t.category] = (totals[t.category] ?? 0) + n;
      grand += n;
    }
  });
  return Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value,
      percent: grand > 0 ? ((value / grand) * 100).toFixed(0) : "0",
    }))
    .sort((a, b) => b.value - a.value);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-50 bg-rose-500 text-white px-6 py-4 rounded-2xl
                 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300"
    >
      <span className="text-lg">⚠️</span>
      <p className="font-semibold text-sm max-w-xs">{msg}</p>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-xl leading-none">×</button>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    pct >= 50 ? "bg-amber-100 text-amber-700 border-amber-200" :
               "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${color}`}>
      AI {pct}%
    </span>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const color = CATEGORY_COLORS[cat] ?? FALLBACK_COLOR;
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
      style={{ color, backgroundColor: color + "18", borderColor: color + "40" }}
    >
      {cat === "ทำบุญ/บริจาค" ? "บริจาค" : cat}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold italic">
      {label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [activeMenu, setActiveMenu] = useState<Menu>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Persistence ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DB_KEY);
      if (saved) setTransactions(JSON.parse(saved));
    } catch { /* corrupted data – start fresh */ }
  }, []);

  const persistAndMerge = useCallback((newItems: Transaction[]) => {
    setTransactions((prev) => {
      const merged = [...newItems, ...prev];
      localStorage.setItem(DB_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const clearAll = () => {
    localStorage.removeItem(DB_KEY);
    setTransactions([]);
  };

  // ── File handling ──
  const addFiles = useCallback((selected: File[]) => {
    const valid = selected.filter((f) => f.type.startsWith("image/"));
    if (valid.length < selected.length)
      setToast("บางไฟล์ไม่ใช่รูปภาพ ระบบข้ามไฟล์นั้น");
    setFiles(valid);
    setPreviews(valid.map((f) => ({ url: URL.createObjectURL(f), name: f.name })));
    setActiveMenu("upload");
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  // Drag & Drop
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  // ── Upload & Analyze ──
  const handleUpload = async () => {
    setLoading(true);
    const results: Transaction[] = [];
    const errors: string[] = [];

    await Promise.all(
      files.map(async (file, i) => {
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch(`https://goofiness-clapping-elevator.ngrok-free.dev/analyze-slip/`, { method: "POST", body: fd });
          const data = await res.json();
          if (data.status === "success") {
            results.push({
              id: Date.now() + i,
              preview: previews[i].url,
              date: new Date().toLocaleDateString("th-TH", {
                day: "numeric", month: "short", year: "numeric",
              }),
              ...data.data,
            });
          } else {
            errors.push(`${file.name}: ${data.detail ?? data.message}`);
          }
        } catch {
          errors.push(`${file.name}: ไม่สามารถเชื่อมต่อ API ได้`);
        }
      })
    );

    if (results.length > 0) persistAndMerge(results);
    if (errors.length > 0) setToast(errors[0]);

    setFiles([]);
    setPreviews([]);
    setLoading(false);
    if (results.length > 0) setActiveMenu("dashboard");
  };

  // ── Filtered / Searched list ──
  const displayedTransactions = transactions.filter((t) => {
    const matchCat = filterCat === "ทั้งหมด" || t.category === filterCat;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      t.memo.toLowerCase().includes(q) ||
      t.recipient.toLowerCase().includes(q) ||
      t.bank_name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const chartData = getChartData(transactions);
  const grandTotal = totalAmount(transactions);

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen bg-[#F0F4F8] text-slate-900 font-sans overflow-hidden">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* ── Sidebar ── */}
      <aside className="w-72 bg-[#064E3B] text-white flex flex-col shadow-2xl shrink-0">
        <div className="p-6 flex flex-col gap-6 flex-1">
          {/* Logo */}
          <div className="flex items-center justify-center bg-white/10 p-5 rounded-[2rem] border border-white/10 shadow-inner">
            <img
              src="/image_74b13d.png"
              alt="โลโก้ใสใจ"
              className="h-20 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Nav */}
          <nav className="space-y-2">
            {(
              [
                { id: "dashboard", icon: "📊", label: "แผงควบคุม" },
                { id: "upload",    icon: "📥", label: "อัปโหลดสลิป" },
                { id: "history",   icon: "🕒", label: "ประวัติรายการ" },
              ] as { id: Menu; icon: string; label: string }[]
            ).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveMenu(id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-left
                  ${activeMenu === id
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/50"
                    : "text-emerald-100/50 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="text-xl">{icon}</span> {label}
              </button>
            ))}
          </nav>

          {/* Quick stats */}
          <div className="mt-auto bg-[#022C22] rounded-3xl p-5 border border-emerald-900 space-y-3">
            <p className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">ยอดรวมทั้งหมด</p>
            <p className="text-2xl font-black text-white">฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-emerald-600">{transactions.length} รายการ</p>
          </div>
        </div>

        {/* Profile */}
        <div className="p-6 pt-0">
          <div className="bg-[#022C22] rounded-3xl p-5 border border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-black text-emerald-950 text-xs select-none">
                AR
              </div>
              <div>
                <p className="text-sm font-bold">อริยะ ลือสวัสดิ์</p>
                <p className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">6730614023</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            {activeMenu === "dashboard" && "ภาพรวมค่าใช้จ่าย"}
            {activeMenu === "upload"    && "อัปโหลดสลิปใหม่"}
            {activeMenu === "history"   && "ประวัติรายการทั้งหมด"}
          </h2>
          <button
            onClick={clearAll}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-5 py-2 rounded-xl text-xs font-bold transition-all border border-rose-100"
          >
            ล้างข้อมูลทั้งหมด 🗑️
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10">

          {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
          {activeMenu === "dashboard" && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-emerald-400 transition-all">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">ยอดใช้จ่ายรวม</p>
                  <p className="text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                    ฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">รายการทั้งหมด</p>
                  <p className="text-4xl font-black text-slate-900">
                    {transactions.length}{" "}
                    <span className="text-lg font-medium text-slate-300">รายการ</span>
                  </p>
                </div>
                <div className="bg-emerald-600 p-8 rounded-[2rem] text-white shadow-xl shadow-emerald-200">
                  <p className="font-bold text-xl mb-1">ระบบวิเคราะห์ AI</p>
                  <p className="text-emerald-100 text-sm">
                    {transactions.length > 0
                      ? `หมวดยอดนิยม: ${chartData[0]?.name ?? "-"}`
                      : "พร้อมใช้งานปกติ"}
                  </p>
                </div>
              </div>

              {/* Charts + Recent */}
              <div className="grid grid-cols-12 gap-8">

                {/* Donut Chart */}
                <div className="col-span-5 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
                  <h3 className="font-black text-xs text-slate-400 mb-4 uppercase tracking-widest text-center">
                    สัดส่วนตามหมวดหมู่
                  </h3>
                  {chartData.length > 0 ? (
                    <div className="relative flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                            animationBegin={0}
                            animationDuration={1000}
                          >
                            {chartData.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={CATEGORY_COLORS[entry.name] ?? FALLBACK_COLOR}
                                className="hover:opacity-80 transition-opacity outline-none"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: "15px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                            formatter={(v: number) => [`฿${v.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`, "ยอดใช้จ่าย"]}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: "-16px" }}>
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ทั้งหมด</span>
                        <span className="text-2xl font-black text-slate-800">
                          ฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState label="ยังไม่มีข้อมูล" />
                  )}
                </div>

                {/* Bar Chart */}
                <div className="col-span-7 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="font-black text-xs text-slate-400 mb-4 uppercase tracking-widest">ยอดใช้จ่ายแยกหมวด</h3>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)" }}
                          formatter={(v: number) => [`฿${v.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`, "ยอด"]}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {chartData.map((entry, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[entry.name] ?? FALLBACK_COLOR} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState label="ยังไม่มีข้อมูลกราฟ" />
                  )}
                </div>
              </div>

              {/* Recent Transactions (latest 5) */}
              <div>
                <h3 className="font-black text-xs text-slate-400 mb-4 uppercase tracking-widest">ความเคลื่อนไหวล่าสุด</h3>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx, i) => (
                    <TransactionRow key={`${tx.id}-${i}`} tx={tx} />
                  ))}
                  {transactions.length === 0 && <EmptyState label="ยังไม่มีข้อมูลความเคลื่อนไหว" />}
                  {transactions.length > 5 && (
                    <button
                      onClick={() => setActiveMenu("history")}
                      className="w-full py-3 text-sm font-bold text-emerald-600 hover:underline"
                    >
                      ดูทั้งหมด {transactions.length} รายการ →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ UPLOAD ═════════════════════════════════════════════════════════ */}
          {activeMenu === "upload" && (
            <div className="max-w-2xl mx-auto py-8 animate-in zoom-in-95 duration-500">
              <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50 text-center">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">
                  📥
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-6">อัปโหลดสลิป</h2>

                {/* Drop Zone */}
                <div
                  ref={dropRef}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`relative border-4 border-dashed rounded-[2rem] p-16 transition-all cursor-pointer
                    ${isDragging
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50/50"}`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInput}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <p className="text-emerald-700/60 font-black uppercase tracking-widest group-hover:text-emerald-700">
                    {isDragging ? "วางไฟล์ที่นี่ ✨" : "คลิกหรือลากไฟล์มาวางที่นี่"}
                  </p>
                  <p className="text-slate-400 text-xs mt-2">รองรับ JPG, PNG, WebP</p>
                </div>

                {/* Previews */}
                {previews.length > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {previews.map((p, i) => (
                      <div key={i} className="relative group rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square">
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <p className="text-white text-[9px] font-bold truncate w-full">{p.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {previews.length > 0 && (
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="mt-8 w-full bg-[#064E3B] text-white py-5 rounded-[1.5rem] font-black text-lg
                               uppercase tracking-widest hover:bg-emerald-800 shadow-2xl transition-all
                               active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? "⏳ กำลังประมวลผล AI..."
                      : `เริ่มวิเคราะห์ ${files.length} สลิป ➔`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ══ HISTORY ════════════════════════════════════════════════════════ */}
          {activeMenu === "history" && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  placeholder="🔍 ค้นหา memo / ผู้รับ / ธนาคาร..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[220px] px-5 py-3 rounded-2xl border border-slate-200 bg-white text-sm
                             outline-none focus:border-emerald-400 transition shadow-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {["ทั้งหมด", ...CATEGORIES].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCat(cat)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                        ${filterCat === cat
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"}`}
                    >
                      {cat === "ทำบุญ/บริจาค" ? "บริจาค" : cat}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-400 font-semibold">
                แสดง {displayedTransactions.length} จาก {transactions.length} รายการ
              </p>

              <div className="space-y-3">
                {displayedTransactions.map((tx, i) => (
                  <TransactionRow key={`${tx.id}-${i}`} tx={tx} showRecipient />
                ))}
                {displayedTransactions.length === 0 && (
                  <EmptyState label="ไม่พบรายการที่ตรงกับเงื่อนไข" />
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── TransactionRow ───────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  showRecipient = false,
}: {
  tx: Transaction;
  showRecipient?: boolean;
}) {
  return (
    <div className="bg-white p-5 rounded-[2rem] border border-slate-50 flex items-center gap-5 hover:shadow-lg hover:scale-[1.005] transition-all group">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
        <img
          src={tx.preview}
          alt="slip"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <CategoryBadge cat={tx.category} />
          {tx.confidence != null && <ConfidenceBadge score={tx.confidence} />}
          <span className="text-[10px] text-slate-300 ml-auto">{tx.date}</span>
        </div>
        <p className="font-bold text-slate-800 truncate">{tx.memo}</p>
        {showRecipient && tx.recipient && tx.recipient !== "ไม่ระบุ" && (
          <p className="text-xs text-slate-400 truncate">ผู้รับ: {tx.recipient}</p>
        )}
        <p className="text-xs text-slate-400">{tx.bank_name}</p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0 px-2">
        <p className="text-xl font-black text-slate-900">฿{formatAmount(tx.amount)}</p>
      </div>
    </div>
  );
}
