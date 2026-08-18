import { useCallback, useEffect, useMemo, useState, useRef } from "react";

import { api } from "../api";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  today,
  useToast,
} from "../components/ui";
import { showDesktopNotif, setNotifToast } from "../utils/notifications";
import type { Employee, Shift, NewShift, EmployeeShift, NewEmployeeShift, ShiftReport } from "../types";
import type { SyncConfig } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AttRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  type: string;
  notes: string | null;
  location: string | null;
}

const ATTENDANCE_TYPES = [
  { value: "manual", label: "تسجيل يدوي" },
];

type Tab = "attendance" | "shifts" | "assignments" | "report";

function parseLocation(notes: string | null): { location: string | null; cleanNotes: string | null } {
  if (!notes || !notes.includes("|loc:")) return { location: null, cleanNotes: notes };
  const match = notes.match(/\|loc:([0-9.-]+),([0-9.-]+)/);
  if (match) {
    return {
      location: JSON.stringify({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) }),
      cleanNotes: notes.replace(/\s*\|loc:[0-9.-]+,[0-9.-]+/, "").trim() || null,
    };
  }
  return { location: null, cleanNotes: notes };
}

export function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttRecord[]>([]);
  const [search, setSearch] = useState("");
  const [_loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(today());
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "ok" | "error">("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"in" | "out">("in");
  const [editing, setEditing] = useState<AttRecord | null>(null);
  const [form, setForm] = useState({
    employee_id: 0,
    date: today(),
    check_in: "",
    check_out: "",
    type: "manual",
    notes: "",
  });


  const syncCfgRef = useRef<SyncConfig | null>(null);
  const [syncCfg, setSyncCfg] = useState<SyncConfig | null>(null);
  const loadingRef = useRef(false);
  const prevAttendanceRef = useRef<AttRecord[]>([]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [empShifts, setEmpShifts] = useState<EmployeeShift[]>([]);
  const [shiftReport, setShiftReport] = useState<ShiftReport[]>([]);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<NewShift>({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    grace_minutes: 15,
    is_active: true,
  });
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState<NewEmployeeShift>({
    employee_id: 0,
    shift_id: 0,
    effective_date: today(),
  });
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(today());
  const reportPrintRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const notify = useToast();

  useEffect(() => {
    setNotifToast(notify);
  }, [notify]);

  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {
    const loadSyncCfg = async () => {
      try {
        const raw = localStorage.getItem("tabarak_sync_config");
        if (raw) {
          const cfg = JSON.parse(raw);
          if (cfg?.supabase_url && cfg?.supabase_key) {
            syncCfgRef.current = cfg;
            setSyncCfg(cfg);
            return;
          }
        }
      } catch {}
      try {
        const status = await api.getSyncStatus();
        if (status?.config?.supabase_url && status?.config?.supabase_key) {
          syncCfgRef.current = status.config;
          setSyncCfg(status.config);
          localStorage.setItem("tabarak_sync_config", JSON.stringify(status.config));
        }
      } catch {}
    };
    loadSyncCfg();
  }, []);



  const getHeaders = useCallback(() => {
    const cfg = syncCfgRef.current;
    if (!cfg?.supabase_url || !cfg?.supabase_key) return null;
    return {
      apikey: cfg.supabase_key,
      Authorization: `Bearer ${cfg.supabase_key}`,
      "Content-Type": "application/json" as const,
    };
  }, []);

  const getSupabaseUrl = useCallback(() => syncCfgRef.current?.supabase_url || "", []);

  const fetchRemote = useCallback(async (): Promise<AttRecord[]> => {
    const headers = getHeaders();
    const url = getSupabaseUrl();
    if (!headers || !url) {
      throw new Error("إعدادات الاتصال غير مُعدّة — اذهب إلى الإعدادات وأعد حفظ بيانات Supabase");
    }
    const res = await fetch(
      `${url}/rest/v1/attendance?select=*&order=date.desc,check_in.desc&limit=500`,
      { headers }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`خطأ ${res.status}: ${errText || res.statusText}`);
    }
    const rows: any[] = await res.json();
    const empRes = await fetch(
      `${url}/rest/v1/employees?select=id,name,phone`,
      { headers }
    );
    const supaEmps: any[] = empRes.ok ? await empRes.json() : [];
    const localEmps = await api.listEmployees();
    const phoneToLocal = new Map(localEmps.filter((e) => e.phone).map((e) => [e.phone!, e.name]));
    const supaIdToLocalName = new Map<number, string>();
    for (const se of supaEmps) {
      const localName = phoneToLocal.get(se.phone) || se.name;
      supaIdToLocalName.set(se.id, localName);
    }
    return rows.map((r) => {
      const { location, cleanNotes } = parseLocation(r.notes || null);
      return {
        id: r.id,
        employee_id: r.employee_id,
        employee_name: supaIdToLocalName.get(r.employee_id) || `موظف #${r.employee_id}`,
        date: r.date,
        check_in: r.check_in || null,
        check_out: r.check_out || null,
        type: r.type || "qr",
        notes: cleanNotes,
        location,
      };
    });
  }, [getHeaders, getSupabaseUrl]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const isFirstLoad = prevAttendanceRef.current.length === 0;
    setLoading(true);
    setLastError(null);
    try {
      const emp = await api.listEmployees();
      setEmployees(emp);
      try {
        await api.getSettings();
      } catch {}
      try {
        const remote = await fetchRemote();
        if (!isFirstLoad) {
          const oldIds = new Set(prevAttendanceRef.current.map((r) => r.id));
          const newRecords = remote.filter((r) => !oldIds.has(r.id));
          for (const nr of newRecords) {
            const empName = emp.find((e) => e.id === nr.employee_id)?.name ?? `#${nr.employee_id}`;
            if (nr.check_in && !nr.check_out) {
              showDesktopNotif({ id: nr.id, employee_name: empName, type: "check_in", time: nr.check_in });
            } else if (nr.check_out) {
              showDesktopNotif({ id: nr.id, employee_name: empName, type: "check_out", time: nr.check_out });
            }
          }
        }
        prevAttendanceRef.current = remote;
        setAttendance(remote);
        setConnectionStatus("ok");
        setLastFetchTime(new Date().toLocaleTimeString("ar-EG"));
      } catch (e) {
        const msg = String(e);
        setConnectionStatus("error");
        setLastError(msg);
      }
    } catch (e) {
      setConnectionStatus("error");
      setLastError(String(e));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetchRemote]);

  const loadShifts = useCallback(async () => {
    try {
      const [s, es] = await Promise.all([api.listShifts(), api.listEmployeeShifts()]);
      setShifts(s);
      setEmpShifts(es);
    } catch {}
  }, []);

  const loadShiftReport = useCallback(async () => {
    try {
      const r = await api.getShiftReport(reportFrom, reportTo);
      setShiftReport(r);
    } catch {}
  }, [reportFrom, reportTo]);

  const handleDeleteAttendance = useCallback(async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل نهائياً؟")) return;
    try {
      await api.deleteAttendance(id);
      setShiftReport((prev) => prev.filter((r) => r.id !== id));
      notify("تم الحذف نهائياً", "success");
    } catch {
      notify("فشل الحذف", "error");
    }
  }, [notify]);

  const handlePrintReport = () => {
    const content = reportPrintRef.current;
    if (!content) return;
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);
    const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!doc) { document.body.removeChild(printFrame); return; }
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الفترات</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #1f2937; margin: 0; }
          h2 { color: #0f8a5f; border-bottom: 2px solid #0f8a5f; padding-bottom: 6px; font-size: 18px; text-align: center; }
          .date-range { text-align: center; color: #6b7280; margin-bottom: 16px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; font-size: 12px; }
          th { background: #f3f4f6; font-weight: 700; }
          .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #d1fae5; color: #065f46; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-yellow { background: #fef3c7; color: #92400e; }
          .badge-blue { background: #ebf5fb; color: #1a73e8; }
          .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; text-align: center; }
          .card-val { font-size: 20px; font-weight: 800; }
          .card-lbl { font-size: 11px; color: #6b7280; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h2>تبارك — تقرير الفترات</h2>
        <div class="date-range">من ${fmtDate(reportFrom)} إلى ${fmtDate(reportTo)}</div>
        <div class="cards">
          <div class="card"><div class="card-val">${shiftReport.length}</div><div class="card-lbl">إجمالي السجلات</div></div>
          <div class="card"><div class="card-val">${shiftReport.filter((r) => r.is_late).length}</div><div class="card-lbl">متأخرين</div></div>
          <div class="card"><div class="card-val">${shiftReport.filter((r) => r.is_early_leave).length}</div><div class="card-lbl">مدرعين مبكراً</div></div>
          <div class="card"><div class="card-val">${shiftReport.length > 0 ? (shiftReport.reduce((s, r) => s + r.work_hours, 0) / shiftReport.length).toFixed(1) : 0}</div><div class="card-lbl">متوسط ساعات العمل</div></div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>التاريخ</th><th>الموظف</th><th>الفترة</th><th>من-إلى</th><th>الحضور</th><th>الانصراف</th><th>ساعات</th><th>ضمن الفترة</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            ${shiftReport.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${fmtDate(r.date)}</td>
                <td><strong>${r.employee_name}</strong></td>
                <td>${r.shift_name ? `<span class="badge badge-blue">${r.shift_name}</span>` : '<span style="color:#999">—</span>'}</td>
                <td>${r.shift_start && r.shift_end ? `${r.shift_start} — ${r.shift_end}` : '—'}</td>
                <td style="color:${r.is_late ? '#dc2626' : '#16a34a'}">${r.check_in || '—'}${r.is_late ? ` ⏰ ${r.late_minutes} دقيقة` : ''}</td>
                <td style="color:${r.is_early_leave ? '#dc2626' : '#16a34a'}">${r.check_out || '—'}${r.is_early_leave ? ` 🏃 ${r.early_minutes} دقيقة` : ''}</td>
                <td>${r.check_in && r.check_out ? `${r.work_hours} س` : '—'}</td>
                <td>${!r.check_in ? '—' : r.has_shift ? (r.is_within_shift ? '<span class="badge badge-green">ضمن الفترة</span>' : '<span class="badge badge-yellow">خارج الفترة</span>') : '<span class="badge" style="background:#f3f4f6;color:#6b7280">بدون فترة</span>'}</td>
                <td>${!r.check_in ? '<span class="badge badge-red">غائب</span>' : r.has_shift ? (r.is_late ? '<span class="badge badge-yellow">متأخر</span>' : '<span class="badge badge-green">حاضر</span>') : '<span class="badge badge-blue">سجل يدوي</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body></html>
    `);
    doc.close();
    printFrame.contentWindow?.focus();
    setTimeout(() => { printFrame.contentWindow?.print(); }, 300);
  };

  const handleExportShiftPDF = async () => {
    setPdfBusy(true);
    try {
      const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      doc.setFont("helvetica");
      doc.setFontSize(16);
      doc.text("Tabarak - Shift Report", 148, 12, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`From: ${reportFrom}  To: ${reportTo}`, 148, 18, { align: "center" });
      doc.setTextColor(0);

      const lateCount = shiftReport.filter((r) => r.is_late).length;
      const earlyCount = shiftReport.filter((r) => r.is_early_leave).length;
      const avgHours = shiftReport.length > 0 ? (shiftReport.reduce((s, r) => s + r.work_hours, 0) / shiftReport.length).toFixed(1) : "0";

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total: ${shiftReport.length}  |  Late: ${lateCount}  |  Early Leave: ${earlyCount}  |  Avg Hours: ${avgHours}`, 148, 25, { align: "center" });
      doc.setFont("helvetica", "normal");

      autoTable(doc, {
        startY: 30,
        head: [["#", "Date", "Employee", "Shift", "Start", "End", "Check In", "Check Out", "Hours", "In Shift", "Status"]],
        body: shiftReport.map((r, i) => [
          String(i + 1),
          r.date,
          r.employee_name,
          r.shift_name || "-",
          r.shift_start || "-",
          r.shift_end || "-",
          r.check_in || "-",
          r.check_out || "-",
          r.check_in && r.check_out ? `${r.work_hours}` : "-",
          !r.check_in ? "-" : r.has_shift ? (r.is_within_shift ? "Yes" : "No") : "No Shift",
          !r.check_in ? "Absent" : r.has_shift ? (r.is_late ? `Late ${r.late_minutes}m` : "Present") : "Manual",
        ]),
        theme: "grid",
        headStyles: { fillColor: [15, 138, 95] },
        styles: { fontSize: 9, halign: "center" },
        columnStyles: { 2: { halign: "right" } },
      });

      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Save Shift Report as PDF",
        defaultPath: `shift_report_${reportFrom}_to_${reportTo}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (path) {
        const bytes = doc.output("arraybuffer");
        await api.writeBinaryFile(path, Array.from(new Uint8Array(bytes)));
        notify("تم حفظ PDF بنجاح");
      }
    } catch (e) {
      notify("فشل التصدير: " + String(e), "error");
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    if (activeTab === "report") loadShiftReport();
  }, [activeTab, loadShiftReport]);

  useEffect(() => {
    if (!syncCfg?.supabase_url || !syncCfg?.supabase_key) return;
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [syncCfg, load]);

  const filteredAttendance = useMemo(() => {
    if (!dateFilter) return attendance;
    return attendance.filter((a) => a.date === dateFilter);
  }, [attendance, dateFilter]);

  const todayStr = today();
  const todayRecords = filteredAttendance.filter((a) => a.date === todayStr);
  const presentCount = new Set(todayRecords.filter((a) => a.check_in).map((a) => a.employee_id)).size;
  const absentCount = employees.length - presentCount;

  const openCheckIn = () => {
    setFormMode("in");
    setEditing(null);
    setForm({
      employee_id: employees[0]?.id || 0,
      date: today(),
      check_in: new Date().toTimeString().slice(0, 5),
      check_out: "",
      type: "manual",
      notes: "",
    });
    setShowForm(true);
  };

  const openCheckOut = () => {
    setFormMode("out");
    setEditing(null);
    const todayRec = todayRecords.filter((a) => a.check_in && !a.check_out);
    setForm({
      employee_id: todayRec[0]?.employee_id || employees[0]?.id || 0,
      date: today(),
      check_in: "",
      check_out: new Date().toTimeString().slice(0, 5),
      type: "manual",
      notes: "",
    });
    setShowForm(true);
  };

  const openEdit = (a: AttRecord) => {
    setEditing(a);
    setFormMode(a.check_in && !a.check_out ? "out" : "in");
    setForm({
      employee_id: a.employee_id,
      date: a.date,
      check_in: a.check_in || "",
      check_out: a.check_out || "",
      type: a.type,
      notes: a.notes || "",
    });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) {
      notify("اختر الموظف", "error");
      return;
    }
    const headers = getHeaders();
    const url = getSupabaseUrl();
    if (!headers || !url) {
      notify("إعدادات الاتصال غير مُعدّة", "error");
      return;
    }
    try {
      const payload: any = {
        employee_id: form.employee_id,
        date: form.date,
        check_in: form.check_in || null,
        check_out: form.check_out || null,
        type: form.type,
        notes: form.notes || null,
      };

      if (editing) {
        const res = await fetch(`${url}/rest/v1/attendance?id=eq.${editing.id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("فشل التعديل");
        notify("تم تعديل الحضور");
      } else {
        const res = await fetch(`${url}/rest/v1/attendance`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("فشل التسجيل");
        notify(formMode === "in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف");
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (a: AttRecord) => {
    if (!confirmDialog(`حذف سجل حضور ${a.employee_name}؟`)) return;
    const headers = getHeaders();
    const url = getSupabaseUrl();
    if (!headers || !url) {
      notify("إعدادات الاتصال غير مُعدّة", "error");
      return;
    }
    try {
      const res = await fetch(`${url}/rest/v1/attendance?id=eq.${a.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("فشل الحذف");
      notify("تم الحذف");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) {
      notify("اسم الفترة مطلوب", "error");
      return;
    }
    try {
      if (editingShift) {
        await api.updateShift(editingShift.id, shiftForm);
        notify("تم تعديل الفترة");
      } else {
        await api.createShift(shiftForm);
        notify("تم إنشاء الفترة");
      }
      setShowShiftForm(false);
      setEditingShift(null);
      loadShifts();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeShift = async (s: Shift) => {
    if (!confirmDialog(`حذف الفترة "${s.name}"؟`)) return;
    try {
      await api.deleteShift(s.id);
      notify("تم الحذف");
      loadShifts();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.employee_id || !assignForm.shift_id) {
      notify("اختر الموظف والفترة", "error");
      return;
    }
    try {
      await api.createEmployeeShift(assignForm);
      notify("تم تعيين الفترة");
      setShowAssignForm(false);
      loadShifts();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeAssign = async (es: EmployeeShift) => {
    if (!confirmDialog(`إلغاء تعيين الفترة لـ ${es.employee_name}؟`)) return;
    try {
      await api.deleteEmployeeShift(es.id);
      notify("تم الإلغاء");
      loadShifts();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const title = editing
    ? "تعديل حضور"
    : formMode === "in"
    ? "تسجيل حضور"
    : "تسجيل انصراف";

  const hasConfig = !!(syncCfg?.supabase_url && syncCfg?.supabase_key);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "attendance", label: "الحضور والانصراف", icon: "📋" },
    { key: "shifts", label: "الفترات", icon: "🕐" },
    { key: "assignments", label: "تعيين الفترات", icon: "👥" },
    { key: "report", label: "تقرير الفترات", icon: "📊" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>الحضور والانصراف</h1>
      </div>

      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 20,
        background: "var(--card-bg, #f8f9fa)",
        borderRadius: 12,
        padding: 4,
        border: "1px solid var(--border, #e5e7eb)",
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: activeTab === t.key ? "var(--primary, #0f8a5f)" : "transparent",
              color: activeTab === t.key ? "#fff" : "var(--text, #374151)",
              transition: "all 0.2s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {!hasConfig && activeTab === "attendance" && (
        <div style={{
          padding: "14px 18px",
          marginBottom: 16,
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: 12,
          fontSize: 14,
          color: "#92400e",
          fontWeight: 600,
        }}>
          ⚠️ لم يتم الاتصال بـ Supabase — اذهب إلى الإعدادات وأدخل بيانات Supabase ثم اضغط "حفظ"
        </div>
      )}

      {activeTab === "attendance" && (
        <>
          {hasConfig && connectionStatus === "error" && (
            <div style={{
              padding: "14px 18px",
              marginBottom: 16,
              background: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: 12,
              fontSize: 14,
              color: "#991b1b",
              fontWeight: 600,
            }}>
              ❌ خطأ في الاتصال: {lastError}
            </div>
          )}

          {hasConfig && connectionStatus === "ok" && (
            <div style={{
              padding: "8px 14px",
              marginBottom: 16,
              background: "#d1fae5",
              border: "1px solid #a7f3d0",
              borderRadius: 8,
              fontSize: 12,
              color: "#065f46",
              display: "inline-block",
            }}>
              ✅ متصل — آخر تحديث: {lastFetchTime || "—"} — يتحدث تلقائي كل 8 ثوانٍ
            </div>
          )}

          <div className="page-head">
            <div className="head-actions">
              <input
                className="search"
                placeholder="بحث باسم الموظف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="search"
                style={{ width: 180 }}
              />
              <button className="btn" onClick={load} title="تحديث">
                🔄 تحديث
              </button>
              <button className="btn primary" onClick={openCheckIn}>
                ✅ تسجيل حضور
              </button>
              <button className="btn" onClick={openCheckOut} style={{ background: "#e53e3e", color: "#fff" }}>
                🔴 تسجيل انصراف
              </button>
            </div>
          </div>

          <div className="cards-grid" style={{ marginBottom: 20 }}>
            <div className="card blue">
              <div className="card-icon">👥</div>
              <div>
                <div className="card-value">{employees.length}</div>
                <div className="card-label">إجمالي الموظفين</div>
              </div>
            </div>
            <div className="card green">
              <div className="card-icon">✅</div>
              <div>
                <div className="card-value">{presentCount}</div>
                <div className="card-label">حاضرين اليوم</div>
              </div>
            </div>
            <div className="card red">
              <div className="card-icon">❌</div>
              <div>
                <div className="card-value">{absentCount}</div>
                <div className="card-label">غائبين اليوم</div>
              </div>
            </div>
            <div className="card amber">
              <div className="card-icon">📝</div>
              <div>
                <div className="card-value">{todayRecords.filter((a) => a.type === "manual").length}</div>
                <div className="card-label">تسجيل يدوي</div>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الموظف</th>
                  <th>التاريخ</th>
                  <th>وقت الحضور</th>
                  <th>وقت الانصراف</th>
                  <th>النوع</th>
                  <th>الموقع</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center" style={{ padding: 30 }}>
                      {hasConfig ? "لا توجد سجلات حضور" : "لم يتم الاتصال بقاعدة البيانات"}
                    </td>
                  </tr>
                ) : (
                  filteredAttendance
                    .filter((a) => !search || a.employee_name.includes(search))
                    .map((a, idx) => {
                      let locData: { lat: number; lng: number; accuracy?: number } | null = null;
                      try { if (a.location) locData = JSON.parse(a.location); } catch {}
                      const mapUrl = locData ? `https://www.google.com/maps?q=${locData.lat},${locData.lng}` : null;
                      return (
                      <tr key={a.id}>
                        <td className="text-center">{idx + 1}</td>
                        <td>{a.employee_name}</td>
                        <td>{fmtDate(a.date)}</td>
                        <td style={{ color: a.check_in ? "#16a34a" : "#999", fontWeight: a.check_in ? 600 : 400 }}>
                          {a.check_in || "—"}
                        </td>
                        <td style={{ color: a.check_out ? "#e53e3e" : "#999", fontWeight: a.check_out ? 600 : 400 }}>
                          {a.check_out || "—"}
                        </td>
                        <td>
                          <span className={`stmt-type-badge ${a.type === "manual" ? "type-payment" : "type-sale"}`}>
                            {a.type === "manual" ? "يدوي" : "QR"}
                          </span>
                        </td>
                        <td>
                          {mapUrl ? (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                background: "#ebf5fb",
                                color: "#1a73e8",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              📍 خريطة
                            </a>
                          ) : (
                            <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td className="actions">
                          <button className="btn sm" onClick={() => openEdit(a)}>
                            تعديل
                          </button>
                          <button className="btn sm danger" onClick={() => remove(a)}>
                            حذف
                          </button>
                        </td>
                      </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "shifts" && (
        <>
          <div className="page-head">
            <h2>إدارة الفترات</h2>
            <div className="head-actions">
              <button className="btn primary" onClick={() => {
                setEditingShift(null);
                setShiftForm({ name: "", start_time: "08:00", end_time: "16:00", grace_minutes: 15, is_active: true });
                setShowShiftForm(true);
              }}>
                ➕ إضافة فترة
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الفترة</th>
                  <th>وقت البداية</th>
                  <th>وقت النهاية</th>
                  <th>ساعات العمل</th>
                  <th>السماح بالتأخير</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center" style={{ padding: 30 }}>
                      لا توجد فترات بعد — أضف فترة جديدة
                    </td>
                  </tr>
                ) : (
                  shifts.map((s, idx) => {
                    const startMin = parseInt(s.start_time.split(":")[0]) * 60 + parseInt(s.start_time.split(":")[1]);
                    const endMin = parseInt(s.end_time.split(":")[0]) * 60 + parseInt(s.end_time.split(":")[1]);
                    const durationMins = endMin >= startMin ? endMin - startMin : endMin + 24 * 60 - startMin;
                    const hours = (durationMins / 60).toFixed(1);
                    return (
                    <tr key={s.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: "#16a34a", fontWeight: 600 }}>{s.start_time}</td>
                      <td style={{ color: "#e53e3e", fontWeight: 600 }}>{s.end_time}</td>
                      <td>{hours} ساعة</td>
                      <td>{s.grace_minutes} دقيقة</td>
                      <td>
                        <span style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: s.is_active ? "#d1fae5" : "#fee2e2",
                          color: s.is_active ? "#065f46" : "#991b1b",
                        }}>
                          {s.is_active ? "نشطة" : "غير نشطة"}
                        </span>
                      </td>
                      <td className="actions">
                        <button className="btn sm" onClick={() => {
                          setEditingShift(s);
                          setShiftForm({
                            name: s.name,
                            start_time: s.start_time,
                            end_time: s.end_time,
                            grace_minutes: s.grace_minutes,
                            is_active: s.is_active,
                          });
                          setShowShiftForm(true);
                        }}>تعديل</button>
                        <button className="btn sm danger" onClick={() => removeShift(s)}>حذف</button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "assignments" && (
        <>
          <div className="page-head">
            <h2>تعيين الفترات للموظفين</h2>
            <div className="head-actions">
              <button className="btn primary" onClick={() => {
                setAssignForm({
                  employee_id: employees[0]?.id || 0,
                  shift_id: shifts[0]?.id || 0,
                  effective_date: today(),
                });
                setShowAssignForm(true);
              }}>
                ➕ تعيين فترة
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الموظف</th>
                  <th>الفترة</th>
                  <th>وقت البداية</th>
                  <th>وقت النهاية</th>
                  <th>تاريخ السريان</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {empShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center" style={{ padding: 30 }}>
                      لم يتم تعيين فترات بعد
                    </td>
                  </tr>
                ) : (
                  empShifts.map((es, idx) => (
                    <tr key={es.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{es.employee_name}</td>
                      <td>
                        <span style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: "#ebf5fb",
                          color: "#1a73e8",
                        }}>
                          {es.shift_name}
                        </span>
                      </td>
                      <td style={{ color: "#16a34a", fontWeight: 600 }}>{es.start_time}</td>
                      <td style={{ color: "#e53e3e", fontWeight: 600 }}>{es.end_time}</td>
                      <td>{fmtDate(es.effective_date)}</td>
                      <td className="actions">
                        <button className="btn sm danger" onClick={() => removeAssign(es)}>إلغاء</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "report" && (
        <>
          <div className="page-head">
            <h2>تقرير الفترات اليومي</h2>
            <div className="head-actions">
              <label style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>من:</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="search"
                style={{ width: 160 }}
              />
              <label style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>إلى:</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="search"
                style={{ width: 160 }}
              />
              <button className="btn primary" onClick={loadShiftReport}>
                🔍 بحث
              </button>
              <button className="btn" onClick={handlePrintReport} title="طباعة">
                🖨️ طباعة
              </button>
              <button className="btn primary" onClick={handleExportShiftPDF} disabled={pdfBusy}>
                {pdfBusy ? "⏳ جاري..." : "📥 تصدير PDF"}
              </button>
            </div>
          </div>

          <div className="cards-grid" style={{ marginBottom: 20 }}>
            <div className="card blue">
              <div className="card-icon">👥</div>
              <div>
                <div className="card-value">{shiftReport.length}</div>
                <div className="card-label">إجمالي السجلات</div>
              </div>
            </div>
            <div className="card red">
              <div className="card-icon">⏰</div>
              <div>
                <div className="card-value">{shiftReport.filter((r) => r.is_late).length}</div>
                <div className="card-label">متأخرين</div>
              </div>
            </div>
            <div className="card amber">
              <div className="card-icon">🏃</div>
              <div>
                <div className="card-value">{shiftReport.filter((r) => r.is_early_leave).length}</div>
                <div className="card-label">مدرعين مبكراً</div>
              </div>
            </div>
            <div className="card green">
              <div className="card-icon">⏱️</div>
              <div>
                <div className="card-value">
                  {shiftReport.length > 0
                    ? (shiftReport.reduce((sum, r) => sum + r.work_hours, 0) / shiftReport.length).toFixed(1)
                    : "0"}
                </div>
                <div className="card-label">متوسط ساعات العمل</div>
              </div>
            </div>
          </div>

          <div ref={reportPrintRef}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ</th>
                  <th>الموظف</th>
                  <th>الفترة</th>
                  <th>من - إلى</th>
                  <th>الحضور</th>
                  <th>الانصراف</th>
                  <th>ساعات العمل</th>
                  <th>ضمن الفترة</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {shiftReport.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center" style={{ padding: 30 }}>
                      لا توجد سجلات حضور في هذا النطاق
                    </td>
                  </tr>
                ) : (
                  shiftReport.map((r, idx) => (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                      <td>
                        {r.shift_name ? (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#ebf5fb",
                            color: "#1a73e8",
                          }}>
                            {r.shift_name}
                          </span>
                        ) : (
                          <span style={{ color: "#999", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {r.shift_start && r.shift_end ? (
                          <>
                            <span style={{ color: "#16a34a" }}>{r.shift_start}</span>
                            {" — "}
                            <span style={{ color: "#e53e3e" }}>{r.shift_end}</span>
                          </>
                        ) : (
                          <span style={{ color: "#999" }}>—</span>
                        )}
                      </td>
                      <td style={{
                        color: r.check_in ? (r.is_late ? "#e53e3e" : "#16a34a") : "#999",
                        fontWeight: 600,
                      }}>
                        {r.check_in || "—"}
                        {r.is_late && (
                          <span style={{ fontSize: 11, display: "block", color: "#e53e3e" }}>
                            ⏰ تأخر {r.late_minutes} دقيقة
                          </span>
                        )}
                      </td>
                      <td style={{
                        color: r.check_out ? (r.is_early_leave ? "#e53e3e" : "#16a34a") : "#999",
                        fontWeight: 600,
                      }}>
                        {r.check_out || "—"}
                        {r.is_early_leave && (
                          <span style={{ fontSize: 11, display: "block", color: "#e53e3e" }}>
                            🏃 انصراف مبكر {r.early_minutes} دقيقة
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.check_in && r.check_out ? `${r.work_hours} س` : "—"}</td>
                      <td>
                        {!r.check_in ? (
                          <span style={{ color: "#999", fontSize: 12 }}>—</span>
                        ) : r.has_shift ? (
                          r.is_within_shift ? (
                            <span style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#d1fae5",
                              color: "#065f46",
                            }}>
                              ✅ ضمن الفترة
                            </span>
                          ) : (
                            <span style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#fef3c7",
                              color: "#92400e",
                            }}>
                              ⚠️ خارج الفترة
                            </span>
                          )
                        ) : (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#f3f4f6",
                            color: "#6b7280",
                          }}>
                            بدون فترة
                          </span>
                        )}
                      </td>
                      <td>
                        {!r.check_in ? (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#fee2e2",
                            color: "#991b1b",
                          }}>
                            غائب
                          </span>
                        ) : r.has_shift ? (
                          r.is_late ? (
                            <span style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#fef3c7",
                              color: "#92400e",
                            }}>
                              متأخر
                            </span>
                          ) : (
                            <span style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#d1fae5",
                              color: "#065f46",
                            }}>
                              حاضر
                            </span>
                          )
                        ) : (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#ebf5fb",
                            color: "#1a73e8",
                          }}>
                            سجل يدوي
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteAttendance(r.id)}
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                          title="حذف نهائي"
                        >
                          🗑️ حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {showShiftForm && (
        <Modal
          title={editingShift ? "تعديل الفترة" : "إضافة فترة جديدة"}
          onClose={() => { setShowShiftForm(false); setEditingShift(null); }}
          width="500px"
        >
          <form onSubmit={saveShift}>
            <div className="form-grid">
              <Field label="اسم الفترة *">
                <input
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  placeholder="مثال: الفترة الصباحية"
                />
              </Field>
              <Field label="وقت البداية">
                <input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                />
              </Field>
              <Field label="وقت النهاية">
                <input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                />
              </Field>
              <Field label="السماح بالتأخير (دقيقة)">
                <input
                  type="number"
                  min="0"
                  value={shiftForm.grace_minutes}
                  onChange={(e) => setShiftForm({ ...shiftForm, grace_minutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="الحالة">
                <select
                  value={shiftForm.is_active ? "1" : "0"}
                  onChange={(e) => setShiftForm({ ...shiftForm, is_active: e.target.value === "1" })}
                >
                  <option value="1">نشطة</option>
                  <option value="0">غير نشطة</option>
                </select>
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editingShift ? "💾 حفظ التعديل" : "➕ إضافة"}
              </button>
              <button type="button" className="btn" onClick={() => { setShowShiftForm(false); setEditingShift(null); }}>
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAssignForm && (
        <Modal
          title="تعيين فترة لموظف"
          onClose={() => setShowAssignForm(false)}
          width="500px"
        >
          <form onSubmit={saveAssign}>
            <div className="form-grid">
              <Field label="الموظف *">
                <select
                  value={assignForm.employee_id}
                  onChange={(e) => setAssignForm({ ...assignForm, employee_id: Number(e.target.value) })}
                >
                  <option value={0}>— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="الفترة *">
                <select
                  value={assignForm.shift_id}
                  onChange={(e) => setAssignForm({ ...assignForm, shift_id: Number(e.target.value) })}
                >
                  <option value={0}>— اختر الفترة —</option>
                  {shifts.filter((s) => s.is_active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                  ))}
                </select>
              </Field>
              <Field label="تاريخ السريان من">
                <input
                  type="date"
                  value={assignForm.effective_date}
                  onChange={(e) => setAssignForm({ ...assignForm, effective_date: e.target.value })}
                />
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                ➤ تعيين الفترة
              </button>
              <button type="button" className="btn" onClick={() => setShowAssignForm(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showForm && (
        <Modal title={title} onClose={() => setShowForm(false)} width="600px">
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="الموظف *">
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: Number(e.target.value) })}
                >
                  <option value={0}>— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="التاريخ">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              {formMode === "in" && (
                <Field label="وقت الحضور">
                  <input
                    type="time"
                    value={form.check_in}
                    onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                  />
                </Field>
              )}
              {formMode === "out" && (
                <Field label="وقت الانصراف">
                  <input
                    type="time"
                    value={form.check_out}
                    onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                  />
                </Field>
              )}
              <Field label="النوع">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {ATTENDANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="ملاحظات">
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                {formMode === "in" ? "✅ تسجيل الحضور" : "🔴 تسجيل الانصراف"}
              </button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
