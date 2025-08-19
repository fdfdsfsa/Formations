
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { Plus, Trash2, Download, Upload, CheckCircle2, RefreshCw, Calendar, AlertTriangle, Search, Filter, Bell, Eraser, Moon, Sun } from "lucide-react";
import { t, type Lang } from "./i18n";
import { palette } from "./palette";

type ID = string;
type Category = "Safety" | "Quality" | "Technical";
type Delivery = "Workday" | "In-person";

type TrainingTemplate = { id: ID; name: string; renewalMonths?: number; description?: string; category?: Category; delivery?: Delivery; };
type Employee = { id: ID; name: string; department: string; };
type TrainingRecord = {
  id: ID; employeeId: ID; templateId?: ID; trainingName: string;
  completionDate?: string; dueDate?: string; renewalMonths?: number; notes?: string;
};
type Status = "overdue" | "due-soon" | "ok" | "unscheduled";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
function daysUntil(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00").getTime();
  const now = new Date();
  const diff = Math.floor((target - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}
function nextDueFor(record: TrainingRecord, template?: TrainingTemplate): string | null {
  const renewal = (record.renewalMonths ?? template?.renewalMonths) || 0;
  if (record.completionDate && renewal > 0) return addMonths(record.completionDate, renewal);
  if (record.dueDate) return record.dueDate;
  return null;
}
function statusFor(record: TrainingRecord, template?: TrainingTemplate, soonWindowDays = 30): Status {
  const nextDue = nextDueFor(record, template);
  const d = daysUntil(nextDue);
  if (!nextDue) return "unscheduled";
  if (d !== null && d < 0) return "overdue";
  if (d !== null && d <= soonWindowDays) return "due-soon";
  return "ok";
}
function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso!; }
}

const STORAGE_KEY = "training-tracker.vite.v2";
type Store = { employees: Employee[]; templates: TrainingTemplate[]; records: TrainingRecord[]; soonWindowDays: number; lang: Lang; theme: "light"|"dark"; };
function loadStore(): Store | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as Store) : null; } catch { return null; }
}
function saveStore(s: Store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

const SAMPLE_EMPLOYEES: Employee[] = [
  { id: uid(), name: "Avery Chen", department: "Operations" },
  { id: uid(), name: "Maya Singh", department: "Engineering" },
  { id: uid(), name: "Leo Garcia", department: "HR" },
];
const SAMPLE_TEMPLATES: TrainingTemplate[] = [
  { id: uid(), name: "First Aid / CPR", renewalMonths: 24, description: "Standard first aid and CPR level C", category: "Safety", delivery: "In-person" },
  { id: uid(), name: "WHMIS", renewalMonths: 12, category: "Safety", delivery: "Workday" },
  { id: uid(), name: "Forklift Certification", renewalMonths: 36, category: "Technical", delivery: "In-person" },
];
const SAMPLE_RECORDS: Omit<TrainingRecord, "employeeId">[] = [
  { id: uid(), templateId: "", trainingName: "First Aid / CPR", completionDate: "2024-11-15" },
  { id: uid(), templateId: "", trainingName: "WHMIS", completionDate: "2025-08-01" },
  { id: uid(), templateId: "", trainingName: "Forklift Certification", dueDate: "2025-09-30" },
];

function seededData() {
  const employees = SAMPLE_EMPLOYEES.map((e) => ({ ...e, id: uid() }));
  const templates = SAMPLE_TEMPLATES.map((t) => ({ ...t, id: uid() }));
  const findTemplateId = (name: string) => templates.find((t) => t.name === name)?.id;
  const [a, b, c] = employees.map((e) => e.id);
  const records: TrainingRecord[] = [
    { ...(SAMPLE_RECORDS[0] as any), id: uid(), employeeId: a!, templateId: findTemplateId("First Aid / CPR") },
    { ...(SAMPLE_RECORDS[1] as any), id: uid(), employeeId: b!, templateId: findTemplateId("WHMIS") },
    { ...(SAMPLE_RECORDS[2] as any), id: uid(), employeeId: c!, templateId: findTemplateId("Forklift Certification") },
  ];
  return { employees, templates, records };
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [soonWindowDays, setSoonWindowDays] = useState<number>(30);
  const [tab, setTab] = useState<"dashboard" | "data">("dashboard");
  const [autosave, setAutosave] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"light"|"dark">("light");

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState("90");
  const [chartType, setChartType] = useState<"bar"|"area"|"pie"|"donut">("bar");

  useEffect(() => {
    const s = loadStore();
    if (s) {
      setEmployees(s.employees || []);
      setTemplates(s.templates || []);
      setRecords(s.records || []);
      setSoonWindowDays(s.soonWindowDays || 30);
      setLang(s.lang || "en");
      setTheme(s.theme || "light");
      document.documentElement.classList.toggle("dark", (s.theme || "light") === "dark");
    }
  }, []);

  useEffect(() => {
    if (!autosave) return;
    saveStore({ employees, templates, records, soonWindowDays, lang, theme });
  }, [employees, templates, records, soonWindowDays, autosave, lang, theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  const recordsEnriched = useMemo(() => {
    return records.map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      const tmpl = templates.find((t) => t.id === r.templateId) || templates.find((t) => t.name === r.trainingName);
      const nd = nextDueFor(r, tmpl);
      const st = statusFor(r, tmpl, soonWindowDays);
      return { ...r, employee: emp, template: tmpl, nextDue: nd, status: st, nextDueDays: daysUntil(nd) } as any;
    });
  }, [records, employees, templates, soonWindowDays]);

  const filtered = useMemo(() => {
    let rows = [...recordsEnriched];
    if (departmentFilter !== "all") rows = rows.filter((r) => r.employee?.department === departmentFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => (r.template?.category || "—") === categoryFilter);
    if (deliveryFilter !== "all") rows = rows.filter((r) => (r.template?.delivery || "—") === deliveryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.employee?.name.toLowerCase().includes(q) || r.trainingName.toLowerCase().includes(q) || r.employee?.department.toLowerCase().includes(q));
    }
    const range = parseInt(rangeFilter, 10);
    if (!Number.isNaN(range)) rows = rows.filter((r) => r.nextDueDays === null || r.nextDueDays <= range);
    return rows.sort((a, b) => {
      const ad = a.nextDue ? new Date(a.nextDue).getTime() : Infinity;
      const bd = b.nextDue ? new Date(b.nextDue).getTime() : Infinity;
      return ad - bd;
    });
  }, [recordsEnriched, departmentFilter, statusFilter, categoryFilter, deliveryFilter, searchQuery, rangeFilter]);

  const kpis = useMemo(() => {
    const withDue = recordsEnriched.filter((r:any) => !!r.nextDue);
    const compliant = withDue.filter((r:any)=> r.status !== "overdue").length;
    const compliancePct = withDue.length ? Math.round((compliant / withDue.length) * 100) : 100;
    const within = (days:number) => withDue.filter((r:any)=> typeof r.nextDueDays === "number" && r.nextDueDays >= 0 && r.nextDueDays <= days).length;
    return {
      compliancePct,
      next3: within(90),
      next24m: within(24*30),
      next36m: within(36*30),
    };
  }, [recordsEnriched]);

  const expByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    for (let i=0;i<12;i++){
      const d = new Date(start); d.setMonth(d.getMonth()+i);
      const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      map[key] = 0;
    }
    for (const r of recordsEnriched as any[]) {
      if (!r.nextDue) continue;
      const d = new Date(r.nextDue+"T00:00:00");
      const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      if (key in map) map[key]++;
    }
    return Object.entries(map).map(([key,count])=>{
      const [y,m] = key.split("-").map(Number);
      const label = new Date(y, m-1, 1).toLocaleDateString(undefined,{month:"short", year:"numeric"});
      return { key, label, count };
    });
  }, [recordsEnriched]);

  const statusCounts = useMemo(() => {
    const counts: Record<Status, number> = { overdue: 0, "due-soon": 0, ok: 0, unscheduled: 0 };
    for (const r of recordsEnriched as any[]) counts[r.status]++;
    return [
      { status: t(lang,"overdue"), key: "overdue", count: counts.overdue, color: "#ef4444" },
      { status: t(lang,"due_soon"), key: "due-soon", count: counts["due-soon"], color: "#f59e0b" },
      { status: t(lang,"ok"), key: "ok", count: counts.ok, color: "#22c55e" },
      { status: t(lang,"unscheduled"), key: "unscheduled", count: counts.unscheduled, color: "#64748b" },
    ];
  }, [recordsEnriched, lang]);

  function addEmployee(name: string, department: string) {
    setEmployees((prev) => [...prev, { id: uid(), name, department }]);
  }
  function removeEmployee(id: ID) {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setRecords((prev) => prev.filter((r) => r.employeeId !== id));
  }
  function addTemplate(name: string, renewalMonths?: number, description?: string, category?: Category, delivery?: Delivery) {
    setTemplates((prev) => [...prev, { id: uid(), name, renewalMonths, description, category, delivery }]);
  }
  function removeTemplate(id: ID) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setRecords((prev) => prev.filter((r) => r.templateId !== id));
  }
  function assignTraining(data: Partial<TrainingRecord> & { employeeId: ID; trainingName: string }) {
    setRecords((prev) => [...prev, {
      id: uid(),
      employeeId: data.employeeId,
      templateId: data.templateId,
      trainingName: data.trainingName,
      completionDate: data.completionDate || undefined,
      dueDate: data.dueDate || undefined,
      renewalMonths: data.renewalMonths || undefined,
      notes: data.notes || "",
    }]);
  }
  function updateRecord(id: ID, patch: Partial<TrainingRecord>) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRecord(id: ID) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  function exportCSV() {
    const header = ["employee","department","training","completionDate","dueDate","renewalMonths","nextDue","status","category","delivery"];
    const rows = (recordsEnriched as any[]).map((r) => [
      r.employee?.name || "", r.employee?.department || "", r.trainingName,
      r.completionDate || "", r.dueDate || "", r.renewalMonths ?? r.template?.renewalMonths ?? "",
      r.nextDue || "", r.status, r.template?.category || "", r.template?.delivery || ""
    ]);
    const csv = [header.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `training_export_${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function importCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const lines = text.split(/\\r?\\n/).filter(Boolean);
        if (lines.length < 2) return;
        const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
        const iEmp = idx("employee"), iDept = idx("department"), iTrain = idx("training"), iComp = idx("completionDate"), iDue = idx("dueDate"), iRenew = idx("renewalMonths");
        const newEmployees: Record<string, Employee> = {};
        const ensureEmp = (name: string, dept: string) => {
          const key = `${name}||${dept}`;
          if (!newEmployees[key]) {
            const existing = employees.find((e) => e.name === name && e.department === dept);
            if (existing) return (newEmployees[key] = existing);
            const created: Employee = { id: uid(), name, department: dept };
            newEmployees[key] = created;
          }
          return newEmployees[key];
        };
        const addRecs: TrainingRecord[] = [];
        for (let i = 1; i < lines.length; i++) {
          const raw = lines[i];
          const cols = raw.split(/,(?=(?:[^\\"]*\\"[^\\"]*\\")*[^\\"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ""));
          const empName = cols[iEmp] || ""; const dept = cols[iDept] || "General";
          const training = cols[iTrain] || "Training"; const comp = cols[iComp] || "";
          const due = cols[iDue] || ""; const renew = cols[iRenew] ? Number(cols[iRenew]) : undefined;
          const emp = ensureEmp(empName, dept);
          addRecs.push({ id: uid(), employeeId: emp.id, trainingName: training, completionDate: comp || undefined, dueDate: due || undefined, renewalMonths: renew });
        }
        const empList = Object.values(newEmployees).filter((e) => !employees.some((ex) => ex.id === e.id));
        if (empList.length) setEmployees((prev) => [...prev, ...empList]);
        if (addRecs.length) setRecords((prev) => [...prev, ...addRecs]);
      } catch (e) {
        console.error("CSV import failed", e);
      }
    };
    reader.readAsText(file);
  }
  function clearAll() {
    setEmployees([]); setTemplates([]); setRecords([]);
    localStorage.removeItem(STORAGE_KEY);
  }
  function loadSample() {
    const { employees: e, templates: t, records: r } = seededData();
    setEmployees(e); setTemplates(t); setRecords(r); setTab("dashboard");
  }

  function StatusBadge({ status }: { status: Status }) {
    const map: Record<Status, string> = {
      overdue: "badge badge-overdue",
      "due-soon": "badge badge-due",
      ok: "badge badge-ok",
      unscheduled: "badge badge-unscheduled",
    };
    const label: Record<Status, string> = {
      overdue: t(lang,"overdue"),
      "due-soon": t(lang,"due_soon"),
      ok: t(lang,"ok"),
      unscheduled: t(lang,"unscheduled")
    };
    return <span className={map[status]}>{label[status]}</span>;
  }

  function RecordsTable({ rows }: { rows: any[] }) {
    return (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <div className="card-title flex items-center gap-2"><span>{t(lang,"all_assignments")}</span></div>
            <div className="card-sub">{t(lang,"sortable_hint")}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={exportCSV}><Download size={16}/> {t(lang,"export_csv")}</button>
            <label className="btn cursor-pointer">
              <Upload size={16}/> {t(lang,"import_csv")}
              <input type="file" accept=".csv" hidden onChange={(e)=>{const f=e.target.files?.[0]; if(f) importCSV(f); (e.target as HTMLInputElement).value="";}}/>
            </label>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t(lang,"employee")}</th><th>{t(lang,"department")}</th><th>{t(lang,"training")}</th><th>{t(lang,"completed")}</th><th>{t(lang,"renewal_due")}</th><th>{t(lang,"next_due")}</th><th>{t(lang,"status")}</th><th className="text-right">{t(lang,"actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.employee?.name || "—"}</td>
                  <td>{r.employee?.department || "—"}</td>
                  <td>{r.trainingName} <span className="text-xs text-slate-500">({r.template?.category || "—"}/{r.template?.delivery || "—"})</span></td>
                  <td>{formatDate(r.completionDate)}</td>
                  <td>{(r.renewalMonths ?? r.template?.renewalMonths) ? `${r.renewalMonths ?? r.template?.renewalMonths} mo` : formatDate(r.dueDate)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Calendar size={16}/> <span>{formatDate(r.nextDue)}</span>
                      {typeof r.nextDueDays === "number" && <span className="text-xs text-slate-500">({r.nextDueDays} d)</span>}
                    </div>
                  </td>
                  <td><StatusBadge status={r.status}/></td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button className="btn" onClick={()=>updateRecord(r.id, { completionDate: todayISO(), dueDate: undefined })}><CheckCircle2 size={16}/> {t(lang,"mark_done")}</button>
                      <button className="btn" onClick={()=>{const nd=r.nextDue||todayISO(); const d=new Date(nd+"T00:00:00"); d.setDate(d.getDate()+30); updateRecord(r.id,{ dueDate: d.toISOString().slice(0,10) });}}><Bell size={16}/> {t(lang,"plus_30")}</button>
                      <button className="btn" onClick={()=>updateRecord(r.id, { completionDate: undefined })}><RefreshCw size={16}/> {t(lang,"clear")}</button>
                      <button className="btn" onClick={()=>removeRecord(r.id)}><Trash2 size={16}/> {t(lang,"delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={8} className="text-center text-slate-500 py-10">{t(lang,"no_records")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function KPI({ value, label, color}:{ value: string|number, label:string, color:string }){
    return (
      <div className="kpi">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    )
  }

  function ComplianceDonut(){
    const pct = kpis.compliancePct;
    const data = [{name:"Compliant", value: pct},{name:"Other", value: 100-pct}];
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" startAngle={90} endAngle={-270} innerRadius={50} outerRadius={80}>
            <Cell fill="#22c55e" /><Cell fill="#ef4444" />
          </Pie>
          <Legend />
          <ReTooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-2">
        <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="text-2xl md:text-3xl font-bold tracking-tight">
          {t(lang,"app_title")}
        </motion.h1>
        <div className="flex items-center gap-2">
          <div className="toggle">
            <span>Lang:</span>
            <select value={lang} onChange={(e)=>setLang(e.target.value as Lang)} className="rounded-md border border-slate-300 dark:border-slate-700">
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </div>
          <button className="toggle" onClick={()=>setTheme(theme==="light"?"dark":"light")}>
            {theme==="light"? <><Sun size={16}/> Light</> : <><Moon size={16}/> Dark</>}
          </button>
        </div>
      </div>
      <p className="text-slate-600 dark:text-slate-300 mb-6">{t(lang,"tagline")}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={loadSample}><RefreshCw size={16}/> {t(lang,"load_sample")}</button>
        <button className="btn" onClick={clearAll}><Eraser size={16}/> {t(lang,"clear_all")}</button>
        <label className="inline-flex items-center gap-2 text-sm ml-auto">
          <input type="checkbox" checked={autosave} onChange={(e)=>setAutosave(e.target.checked)} />
          <span>{t(lang,"autosave")}</span>
        </label>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab==="dashboard"?"primary":""}`} onClick={()=>setTab("dashboard")}>{t(lang,"dashboard")}</button>
        <button className={`btn ${tab==="data"?"primary":""}`} onClick={()=>setTab("data")}>{t(lang,"data_entry")}</button>
      </div>

      {tab==="dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card">
            <div className="card-header">
              <div className="flex items-center gap-2 card-title"><AlertTriangle size={18}/> {t(lang,"upcoming_exp")}</div>
              <div className="card-sub">{t(lang,"filters_hint")}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <Search size={16}/>
                  <input placeholder={t(lang,"search_placeholder")} value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-56"/>
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16}/>
                  <select value={departmentFilter} onChange={(e)=>setDepartmentFilter(e.target.value)} className="w-40">
                    <option value="all">{t(lang,"all_departments")}</option>
                    {departments.map((d)=> <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="w-40">
                    <option value="all">{t(lang,"all_statuses")}</option>
                    <option value="overdue">{t(lang,"overdue")}</option>
                    <option value="due-soon">{t(lang,"due_soon")}</option>
                    <option value="ok">{t(lang,"ok")}</option>
                    <option value="unscheduled">{t(lang,"unscheduled")}</option>
                  </select>
                  <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)} className="w-40">
                    <option value="all">Category: {t(lang,"all_statuses")}</option>
                    <option value="Safety">{t(lang,"safety")}</option>
                    <option value="Quality">{t(lang,"quality")}</option>
                    <option value="Technical">{t(lang,"technical")}</option>
                  </select>
                  <select value={deliveryFilter} onChange={(e)=>setDeliveryFilter(e.target.value)} className="w-40">
                    <option value="all">Delivery: {t(lang,"all_statuses")}</option>
                    <option value="Workday">{t(lang,"workday")}</option>
                    <option value="In-person">{t(lang,"in_person")}</option>
                  </select>
                  <select value={rangeFilter} onChange={(e)=>setRangeFilter(e.target.value)} className="w-40">
                    <option value="30">{t(lang,"next_30")}</option>
                    <option value="60">{t(lang,"next_60")}</option>
                    <option value="90">{t(lang,"next_90")}</option>
                    <option value="180">{t(lang,"next_180")}</option>
                    <option value="10000">{t(lang,"all_upcoming")}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body">
              <RecordsTable rows={filtered}/>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="kpi-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KPI value={`${kpis.compliancePct}%`} label={t(lang,"kpi_compliant")} color="#14b8a6"/>
              <KPI value={kpis.next3} label={t(lang,"kpi_3mo")} color="#f59e0b"/>
              <KPI value={kpis.next24m} label={t(lang,"kpi_24mo")} color="#8b5cf6"/>
              <KPI value={kpis.next36m} label={t(lang,"kpi_36mo")} color="#2563eb"/>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{t(lang,"status_breakdown")}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="card-sub">Overdue / Due soon / OK / Unscheduled</div>
                  <div className="text-sm flex items-center gap-2">
                    <span>{t(lang,"soon_window")}</span>
                    <input className="w-20" type="number" min={1} value={soonWindowDays} onChange={(e)=>setSoonWindowDays(Math.max(1, Number(e.target.value || 30)))} />
                    <span>{t(lang,"days")}</span>
                  </div>
                </div>
              </div>
              <div className="card-body h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusCounts}>
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Bar dataKey="count">
                      {statusCounts.map((s, i)=>(<Cell key={i} fill={s.color}/>))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="card-title">{t(lang,"exp_monthly")}</div>
                    <div className="card-sub">Next 12 months</div>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <span>{t(lang,"chart_type")}</span>
                    <select value={chartType} onChange={(e)=>setChartType(e.target.value as any)}>
                      <option value="bar">{t(lang,"bar")}</option>
                      <option value="area">{t(lang,"area")}</option>
                      <option value="pie">{t(lang,"pie")}</option>
                      <option value="donut">{t(lang,"donut")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="card-body h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType==="bar" && (
                    <BarChart data={expByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <ReTooltip />
                      <Bar dataKey="count">
                        {expByMonth.map((_, i)=>(<Cell key={i} fill={palette[i % palette.length]}/>))}
                      </Bar>
                    </BarChart>
                  )}
                  {chartType==="area" && (
                    <AreaChart data={expByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <ReTooltip />
                      <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#93c5fd" />
                    </AreaChart>
                  )}
                  {(chartType==="pie" || chartType==="donut") && (
                    <PieChart>
                      <ReTooltip />
                      <Pie data={expByMonth} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} innerRadius={chartType==="donut"?60:0}>
                        {expByMonth.map((_, i)=>(<Cell key={i} fill={palette[i % palette.length]} />))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{t(lang,"next_12_weeks")}</div>
                <div className="card-sub">{t(lang,"counts_due")}</div>
              </div>
              <div className="card-body h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(function(){
                    const weeks = 12;
                    const start = new Date(); start.setHours(0,0,0,0);
                    const buckets: { label: string; count: number }[] = [];
                    for (let i = 0; i < weeks; i++) {
                      const d = new Date(start); d.setDate(d.getDate() + i * 7);
                      const e = new Date(d); e.setDate(e.getDate() + 6);
                      const label = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
                      buckets.push({ label, count: 0 });
                    }
                    for (const r of (recordsEnriched as any[])) {
                      if (!r.nextDue) continue;
                      const due = new Date(r.nextDue + "T00:00:00");
                      const diffDays = Math.floor((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) continue;
                      const idx = Math.floor(diffDays / 7);
                      if (idx >= 0 && idx < weeks) buckets[idx].count++;
                    }
                    return buckets;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" interval={1} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} />
                    <ReTooltip />
                    <Line type="monotone" dataKey="count" stroke="#06b6d4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">{t(lang,"status")}</div>
                <div className="card-sub">{t(lang,"counts_due")}</div>
              </div>
              <div className="card-body">
                <ComplianceDonut />
              </div>
            </div>

          </div>
        </div>
      )}

      {tab==="data" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">{t(lang,"add_employee")}</div>
              <div className="card-sub">{t(lang,"name")} & {t(lang,"department")}</div>
            </div>
            <AddEmployeeForm lang={lang} onAdd={addEmployee} employees={employees} onRemove={removeEmployee}/>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">{t(lang,"add_template")}</div>
              <div className="card-sub">{t(lang,"renewal_every")}</div>
            </div>
            <AddTemplateForm lang={lang} onAdd={addTemplate} templates={templates} onRemove={removeTemplate}/>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">{t(lang,"assign_training")}</div>
              <div className="card-sub">{t(lang,"training_template")}</div>
            </div>
            <AssignTrainingForm lang={lang} employees={employees} templates={templates} onAssign={assignTraining} count={records.length}/>
          </div>
        </div>
      )}
      <footer className="mt-10 text-xs text-slate-500 dark:text-slate-400">
        Tip: A completion date + renewal months will auto-calc the next due date. You can also set a one-time due date.
      </footer>
    </div>
  );
}

function AddEmployeeForm({ onAdd, employees, onRemove, lang }:{ onAdd:(name:string, dept:string)=>void, employees:Employee[], onRemove:(id:ID)=>void, lang:Lang }){
  const [name,setName]=useState(""); const [dept,setDept]=useState("");
  return (
    <div className="card-body space-y-3">
      <div className="grid gap-2">
        <label>{t(lang,"name")}</label>
        <input placeholder="e.g., Jamie Doe" value={name} onChange={(e)=>setName(e.target.value)} />
        <label>{t(lang,"department")}</label>
        <input placeholder="e.g., Operations" value={dept} onChange={(e)=>setDept(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <button className="btn primary" onClick={()=>{ if(!name.trim()) return; onAdd(name.trim(), dept.trim()||"General"); setName(""); setDept(""); }}><Plus size={16}/> Add</button>
        <small className="text-slate-500">{employees.length} {t(lang,"total")}</small>
      </div>
      <div className="pt-2 border-t mt-2 max-h-40 overflow-auto text-sm">
        {employees.map((e)=>(
          <div key={e.id} className="flex items-center justify-between py-1.5">
            <div><span className="font-medium">{e.name}</span><span className="text-slate-500"> — {e.department}</span></div>
            <button className="btn" onClick={()=>onRemove(e.id)}><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddTemplateForm({ onAdd, templates, onRemove, lang }:{ onAdd:(name:string, months?:number, desc?:string, cat?:Category, del?:Delivery)=>void, templates:TrainingTemplate[], onRemove:(id:ID)=>void, lang:Lang }){
  const [name,setName]=useState(""); const [renewal,setRenewal]=useState<string>("12"); const [desc,setDesc]=useState("");
  const [cat,setCat]=useState<Category>("Safety"); const [del,setDel]=useState<Delivery>("Workday");
  return (
    <div className="card-body space-y-3">
      <div className="grid gap-2">
        <label>{t(lang,"training")}</label>
        <input placeholder="e.g., WHMIS" value={name} onChange={(e)=>setName(e.target.value)} />
        <label>{t(lang,"renewal_every")}</label>
        <input type="number" min={0} placeholder="e.g., 12" value={renewal} onChange={(e)=>setRenewal(e.target.value)} />
        <label>{t(lang,"description")}</label>
        <input placeholder="Short note" value={desc} onChange={(e)=>setDesc(e.target.value)} />
        <label>{t(lang,"category")}</label>
        <select value={cat} onChange={(e)=>setCat(e.target.value as Category)}>
          <option value="Safety">{t(lang,"safety")}</option>
          <option value="Quality">{t(lang,"quality")}</option>
          <option value="Technical">{t(lang,"technical")}</option>
        </select>
        <label>{t(lang,"delivery")}</label>
        <select value={del} onChange={(e)=>setDel(e.target.value as Delivery)}>
          <option value="Workday">{t(lang,"workday")}</option>
          <option value="In-person">{t(lang,"in_person")}</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <button className="btn primary" onClick={()=>{ if(!name.trim()) return; onAdd(name.trim(), renewal===""?undefined:Number(renewal), desc.trim()||undefined, cat, del); setName(""); setRenewal("12"); setDesc(""); }}><Plus size={16}/> Add</button>
        <small className="text-slate-500">{templates.length} templates</small>
      </div>
      <div className="pt-2 border-t mt-2 max-h-40 overflow-auto text-sm">
        {templates.map((t)=>(
          <div key={t.id} className="flex items-center justify-between py-1.5">
            <div><span className="font-medium">{t.name}</span><span className="text-slate-500"> — {(typeof t.renewalMonths==="number" ? ` ${t.renewalMonths} mo` : " one-time")} · {t.category || "—"}/{t.delivery || "—"}</span></div>
            <button className="btn" onClick={()=>onRemove(t.id)}><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssignTrainingForm({ employees, templates, onAssign, count, lang }:{ employees:Employee[], templates:TrainingTemplate[], onAssign:(data:any)=>void, count:number, lang:Lang }){
  const [empId,setEmpId]=useState(""); const [tmplId,setTmplId]=useState(""); const [customName,setCustomName]=useState("");
  const [completion,setCompletion]=useState(""); const [due,setDue]=useState(""); const [renewal,setRenewal]=useState(""); const [notes,setNotes]=useState("");
  const effectiveName = useMemo(()=> customName.trim() || (templates.find(t=>t.id===tmplId)?.name || ""), [customName, tmplId, templates]);
  return (
    <div className="card-body space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <label>{t(lang,"employee")}</label>
          <select value={empId} onChange={(e)=>setEmpId(e.target.value)}>
            <option value="">{t(lang,"employee")}</option>
            {employees.map((e)=>(<option key={e.id} value={e.id}>{e.name} — {e.department}</option>))}
          </select>
        </div>
        <div className="grid gap-2">
          <label>{t(lang,"training_template")}</label>
          <select value={tmplId} onChange={(e)=>setTmplId(e.target.value)}>
            <option value="">{t(lang,"training_template")}</option>
            {templates.map((t)=>(<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <input className="mt-2" placeholder={t(lang,"or_custom")} value={customName} onChange={(e)=>setCustomName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <label>{t(lang,"completion_date")}</label>
          <input type="date" value={completion} onChange={(e)=>setCompletion(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <label>{t(lang,"due_date")}</label>
          <input type="date" value={due} onChange={(e)=>setDue(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <label>{t(lang,"renewal_override")}</label>
          <input type="number" min={0} placeholder="e.g., 24" value={renewal} onChange={(e)=>setRenewal(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <label>{t(lang,"notes")}</label>
          <input placeholder="optional" value={notes} onChange={(e)=>setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button className="btn primary" onClick={()=>{
          if(!empId || !effectiveName) return;
          onAssign({
            employeeId: empId,
            templateId: tmplId || undefined,
            trainingName: effectiveName,
            completionDate: completion || undefined,
            dueDate: due || undefined,
            renewalMonths: renewal ? Number(renewal) : undefined,
            notes: notes || undefined,
          });
          setEmpId(""); setTmplId(""); setCustomName(""); setCompletion(""); setDue(""); setRenewal(""); setNotes("");
        }}><Plus size={16}/> {t(lang,"assign")}</button>
        <small className="text-slate-500">{count} {t(lang,"assignments")}</small>
      </div>
    </div>
  )
}
