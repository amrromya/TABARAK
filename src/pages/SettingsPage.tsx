import { useEffect, useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { Field, useToast } from "../components/ui";
import { isNotifEnabled, setNotifEnabled as saveNotifEnabled, getNotifSoundPath, setNotifSoundPath as saveNotifSoundPath, playNotifSound } from "../utils/notifications";
import type { Account, Branch, Permission, Settings, SyncConfig, SyncStatus, Warehouse } from "../types";

const ACCOUNTS_KEY = "tabarak_accounts";

const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "view_dashboard", label: "عرض لوحة التحكم", group: "القوائم" },
  { key: "view_inventory", label: "عرض المخزون", group: "القوائم" },
  { key: "view_warehouses", label: "عرض المستودعات", group: "القوائم" },
  { key: "view_sales", label: "عرض المبيعات", group: "القوائم" },
  { key: "view_purchases", label: "عرض المشتريات", group: "القوائم" },
  { key: "view_suppliers", label: "عرض الموردين", group: "القوائم" },
  { key: "view_customers", label: "عرض العملاء", group: "القوائم" },
  { key: "view_employees", label: "عرض الموظفين", group: "القوائم" },
  { key: "view_expenses", label: "عرض المصروفات", group: "القوائم" },
  { key: "view_reports", label: "عرض التقارير", group: "القوائم" },
  { key: "view_settings", label: "عرض الإعدادات", group: "القوائم" },
  { key: "view_receipt_vouchers", label: "عرض سندات القبض", group: "القوائم" },
  { key: "view_payment_vouchers", label: "عرض سندات الصرف", group: "القوائم" },
  { key: "view_warehouse_transfers", label: "عرض تحويلات المستودعات", group: "القوائم" },
  { key: "create_sale", label: "إنشاء فاتورة بيع", group: "المبيعات" },
  { key: "edit_sale", label: "تعديل فاتورة بيع", group: "المبيعات" },
  { key: "delete_sale", label: "حذف فاتورة بيع", group: "المبيعات" },
  { key: "create_purchase", label: "إنشاء فاتورة شراء", group: "المشتريات" },
  { key: "edit_purchase", label: "تعديل فاتورة شراء", group: "المشتريات" },
  { key: "delete_purchase", label: "حذف فاتورة شراء", group: "المشتريات" },
  { key: "create_customer", label: "إضافة عميل", group: "العملاء" },
  { key: "edit_customer", label: "تعديل بيانات عميل", group: "العملاء" },
  { key: "delete_customer", label: "حذف عميل", group: "العملاء" },
  { key: "create_employee", label: "إضافة موظف", group: "الموظفين" },
  { key: "edit_employee", label: "تعديل بيانات موظف", group: "الموظفين" },
  { key: "delete_employee", label: "حذف موظف", group: "الموظفين" },
  { key: "manage_accounts", label: "إدارة الحسابات", group: "نظام" },
  { key: "maintenance.view", label: "عرض طلبات الصيانة", group: "الصيانة" },
  { key: "maintenance.create", label: "إنشاء طلب صيانة", group: "الصيانة" },
  { key: "maintenance.edit", label: "تعديل طلب صيانة", group: "الصيانة" },
  { key: "maintenance.delete", label: "حذف طلب صيانة", group: "الصيانة" },
  { key: "maintenance.receive", label: "استلام أجهزة", group: "الصيانة" },
  { key: "maintenance.diagnose", label: "تشخيص الأعطال", group: "الصيانة" },
  { key: "maintenance.assign", label: "تعيين فني", group: "الصيانة" },
  { key: "maintenance.parts", label: "إدارة القطع", group: "الصيانة" },
  { key: "maintenance.approve", label: "اعتماد التكاليف", group: "الصيانة" },
  { key: "maintenance.deliver", label: "تسليم الأجهزة", group: "الصيانة" },
  { key: "maintenance.reports", label: "تقارير الصيانة", group: "الصيانة" },
  { key: "maintenance.financial", label: "البيانات المالية", group: "الصيانة" },
  { key: "maintenance.settings", label: "إعدادات الصيانة", group: "الصيانة" },
];

const ALL_MENUS: { key: string; label: string; icon: string }[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: "🏠" },
  { key: "inventory", label: "المخزون", icon: "📦" },
  { key: "warehouses", label: "المستودعات", icon: "🏬" },
  { key: "purchases", label: "المشتريات", icon: "📥" },
  { key: "suppliers", label: "الموردين", icon: "🚚" },
  { key: "customers", label: "العملاء والديون", icon: "🤝" },
  { key: "employees", label: "الموظفين", icon: "👥" },
  { key: "attendance", label: "الحضور والانصراف", icon: "🕐" },
  { key: "expenses", label: "المصروفات", icon: "🧾" },
  { key: "sales", label: "المبيعات", icon: "💰" },
  { key: "receipt_vouchers", label: "سندات القبض", icon: "💵" },
  { key: "payment_vouchers", label: "سندات الصرف", icon: "💳" },
  { key: "warehouse_transfers", label: "تحويلات المستودعات", icon: "🔄" },
  { key: "reports", label: "التقارير", icon: "📈" },
  { key: "maintenance", label: "الصيانة", icon: "🔧" },
  { key: "settings", label: "الإعدادات", icon: "⚙️" },
];

function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

type SectionKey = "store" | "warehouses" | "sync" | "branches" | "notifications" | "attendance_url" | "printing" | "update" | "backup" | "reset" | "accounts" | "license";

const FEATURES_KEY = "tabarak_features";

function getFeatures(): { maintenance: boolean; attendance: boolean } {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { maintenance: false, attendance: false };
}

function saveFeatures(f: { maintenance: boolean; attendance: boolean }) {
  localStorage.setItem(FEATURES_KEY, JSON.stringify(f));
}

interface OnlineUpdateInfo {
  has_update: boolean;
  latest_version: string;
  current_version: string;
  download_url: string;
  file_name: string;
  body: string;
  published_at: string;
}

const SECTIONS: { key: SectionKey; icon: string; title: string; color: string; gradient: string; password?: string }[] = [
  { key: "store", icon: "🏪", title: "بيانات المحل", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { key: "warehouses", icon: "📦", title: "المستودعات", color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { key: "sync", icon: "☁️", title: "المزامنة", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", password: "5506" },
  { key: "branches", icon: "🏬", title: "الفروع", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", password: "5506" },
  { key: "notifications", icon: "🔔", title: "اشعارات الحضور", color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
  { key: "attendance_url", icon: "📍", title: "رابط صفحة الحضور", color: "#14b8a6", gradient: "linear-gradient(135deg, #14b8a6, #0d9488)", password: "5506" },
  { key: "printing", icon: "🖨️", title: "إعدادات الطباعة", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)" },
  { key: "license", icon: "🔑", title: "تحديث التفعيل", color: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { key: "update", icon: "📦", title: "تحديث البرنامج", color: "#0ea5e9", gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)" },
  { key: "backup", icon: "💾", title: "النسخ الاحتياطي", color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { key: "reset", icon: "⚠️", title: "اعادة تهيئة النظام", color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { key: "accounts", icon: "👥", title: "ادارة الحسابات", color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)" },
];

export function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    store_name: "",
    phone: "",
    address: "",
    currency: "ج.م",
    invoice_footer: "",
    opening_balance: 0,
    attendance_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whName, setWhName] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Permission[]>([]);
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);

  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    supabase_url: "",
    supabase_key: "",
    branch_id: 1,
    device_id: "",
    auto_sync: false,
    sync_interval_secs: 30,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranchName, setNewBranchName] = useState("");

  const [notifOn, setNotifOn] = useState(isNotifEnabled());
  const [notifSoundName, setNotifSoundName] = useState<string | null>(getNotifSoundPath);

  const [appVersion, setAppVersion] = useState("");
  const [updating, setUpdating] = useState(false);

  const [onlineUpdate, setOnlineUpdate] = useState<OnlineUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [licenseInfo, setLicenseInfo] = useState<{ expiry_date: string; customer_name: string } | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState("");

  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);

  // Print settings
  const [printSettings, setPrintSettings] = useState<{
    invoicePaper: string;
    invoiceLandscape: boolean;
    invoiceMargins: number;
    invoiceHeader: boolean;
    invoiceFooter: boolean;
    barcodePrinter: string;
    barcodeWidth: number;
    barcodeHeight: number;
    barcodeFontSize: number;
    barcodeShowName: boolean;
    barcodeShowPrice: boolean;
    barcodeShowBarcode: boolean;
    barcodeCustomSizes: { name: string; width: number; height: number }[];
  }>(() => {
    try {
      const raw = localStorage.getItem("tabarak_print_settings");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      invoicePaper: "A4",
      invoiceLandscape: false,
      invoiceMargins: 10,
      invoiceHeader: true,
      invoiceFooter: true,
      barcodePrinter: "",
      barcodeWidth: 50,
      barcodeHeight: 25,
      barcodeFontSize: 10,
      barcodeShowName: true,
      barcodeShowPrice: true,
      barcodeShowBarcode: true,
      barcodeCustomSizes: [] as { name: string; width: number; height: number }[],
    };
  });
  const [selectedBarcodeSize, setSelectedBarcodeSize] = useState<string>("default");
  const [newSizeName, setNewSizeName] = useState("");
  const [newSizeW, setNewSizeW] = useState(50);
  const [newSizeH, setNewSizeH] = useState(25);

  const [passModal, setPassModal] = useState<{ section: SectionKey; password: string } | null>(null);
  const [passInput, setPassInput] = useState("");

  const [showFeatures, setShowFeatures] = useState(false);
  const [featuresPass, setFeaturesPass] = useState("");
  const [featuresPassOk, setFeaturesPassOk] = useState(false);
  const [features, setFeatures] = useState(getFeatures());

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        setShowFeatures(true);
        setFeaturesPass("");
        setFeaturesPassOk(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const verifyFeaturesPass = () => {
    if (featuresPass === "5506") {
      setFeaturesPassOk(true);
    } else if (featuresPass.length > 0) {
      notify("الرمز خاطئ", "error");
    }
  };

  const toggleFeature = async (key: "maintenance" | "attendance") => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    saveFeatures(next);

    try {
      const accs = getAccounts();
      const updated = accs.map((a) => {
        let menus = [...(a.visibleMenus || [])];
        if (key === "maintenance") {
          if (next.maintenance) {
            if (!menus.includes("maintenance")) menus.push("maintenance");
          } else {
            menus = menus.filter((m) => m !== "maintenance");
          }
        }
        if (key === "attendance") {
          if (next.attendance) {
            if (!menus.includes("attendance")) menus.push("attendance");
          } else {
            menus = menus.filter((m) => m !== "attendance");
          }
        }
        return { ...a, visibleMenus: [...new Set(menus)] };
      });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      setAccounts(updated);
      notify(next[key] ? `تم تفعيل ${key === "maintenance" ? "الصيانة" : "الحضور والانصراف"}` : `تم إخفاء ${key === "maintenance" ? "الصيانة" : "الحضور والانصراف"}`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const notify = useToast();

  const loadWh = () => {
    api.listWarehouses().then(setWarehouses).catch((e) => notify(String(e), "error"));
  };

  const loadSync = useCallback(async () => {
    try {
      const s = await api.getSyncStatus();
      setSyncStatus(s);
      setSyncConfig(s.config);
    } catch {}
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const b = await api.listBranches();
      setBranches(b);
    } catch {}
  }, []);

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => notify(String(e), "error"));
    loadWh();
    setAccounts(getAccounts());
    loadSync();
    loadBranches();
    api.getAppVersion().then(setAppVersion).catch(() => {});
    api.getLicenseInfo().then(setLicenseInfo).catch(() => {});
    api.listPrinters().then(setAvailablePrinters).catch(() => {});
  }, [notify, loadSync, loadBranches]);

  const openSection = (s: SectionKey) => {
    const section = SECTIONS.find((x) => x.key === s);
    if (section?.password) {
      setPassModal({ section: s, password: section.password });
      setPassInput("");
    } else {
      setActiveSection(s);
    }
  };

  const verifyPass = () => {
    if (!passModal) return;
    if (passInput === passModal.password) {
      setActiveSection(passModal.section);
      setPassModal(null);
    } else if (passInput.length > 0) {
      notify("الرمز خاطئ", "error");
    }
  };

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveSettings(form);
      notify("تم حفظ الإعدادات");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const addWarehouse = async () => {
    if (!whName.trim()) return;
    try {
      await api.createWarehouse(whName.trim());
      setWhName("");
      loadWh();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeWarehouse = async (id: number) => {
    if (!window.confirm("حذف المستودع؟")) return;
    try {
      await api.deleteWarehouse(id);
      loadWh();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const addBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      await api.createBranch(newBranchName.trim(), "", "");
      setNewBranchName("");
      loadBranches();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeBranch = async (id: number) => {
    if (!window.confirm("حذف الفرع؟")) return;
    try {
      await api.deleteBranch(id);
      loadBranches();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const toggleNotif = () => {
    const next = !notifOn;
    setNotifEnabled(next);
    setNotifOn(next);
  };

  const setNotifEnabled = (on: boolean) => {
    saveNotifEnabled(on);
  };

  const pickNotifSound = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "صوت", extensions: ["mp3", "wav", "ogg"] }],
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected;
      saveNotifSoundPath(path as string);
      setNotifSoundName(path as string);
      notify("تم حفظ النغمة");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const clearNotifSound = () => {
    saveNotifSoundPath("");
    setNotifSoundName(null);
    notify("تم حذف النغمة المخصصة");
  };

  const testNotifSound = () => {
    playNotifSound();
  };

  const backup = async () => {
    try {
      const path = await save({
        defaultPath: "tabarak_backup.db",
        filters: [{ name: "قاعدة البيانات", extensions: ["db"] }],
      });
      if (!path) return;
      setBusy(true);
      await api.exportBackup(path);
      notify("تم إنشاء النسخة الاحتياطية");
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "قاعدة البيانات", extensions: ["db"] }],
      });
      if (!selected) return;
      if (!window.confirm("استعادة البيانات ستحذف جميع البيانات الحالية. هل أنت متأكد؟")) return;
      setBusy(true);
      const path = typeof selected === "string" ? selected : selected;
      await api.importBackup(path as string);
      notify("تمت استعادة البيانات");
      window.location.reload();
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveSyncConfig = async () => {
    try {
      await api.saveSyncConfig(syncConfig);
      notify("تم حفظ إعدادات المزامنة");
      loadSync();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setSyncResult(null);
    try {
      await api.testSupabaseConnection(syncConfig.supabase_url, syncConfig.supabase_key);
      setSyncResult("✅ الاتصال ناجح");
    } catch (err) {
      setSyncResult("خطأ: " + String(err));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const r = await api.syncNow();
      setSyncResult(`تمت المزامنة: ${r.pushed} رفع، ${r.pulled} سحب`);
      loadSync();
    } catch (err) {
      setSyncResult("خطأ: " + String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInitialSync = async () => {
    if (!window.confirm("ستُرفع جميع البيانات المحلية إلى السحابة. هل تريد المتابعة؟")) return;
    setIsSyncing(true);
    try {
      const r = await api.initialSync();
      setSyncResult(`تمت المزامنة الأولية: ${r.pushed} سجل`);
      loadSync();
    } catch (err) {
      setSyncResult("خطأ: " + String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const startNewAccount = () => {
    setEditingAccount(null);
    setNewName("");
    setNewPass("");
    setSelectedPerms([]);
    setSelectedMenus([]);
  };

  const startEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setNewName(acc.name);
    setNewPass(acc.password);
    setSelectedPerms([...acc.permissions]);
    setSelectedMenus([...(acc.visibleMenus || [])]);
  };

  const deleteAccount = (id: string) => {
    if (accounts.length <= 1) return;
    if (!window.confirm("حذف هذا الحساب؟")) return;
    const next = accounts.filter((a) => a.id !== id);
    saveAccounts(next);
    setAccounts(next);
  };

  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (editingAccount) {
      const updated = accounts.map((a) =>
        a.id === editingAccount.id
          ? { ...a, name: newName, password: newPass, permissions: selectedPerms, visibleMenus: selectedMenus }
          : a
      );
      saveAccounts(updated);
      setAccounts(updated);
      notify("تم تعديل الحساب");
    } else {
      const acc: Account = {
        id: Date.now().toString(),
        name: newName,
        password: newPass,
        permissions: selectedPerms,
        visibleMenus: selectedMenus,
      };
      const next = [...accounts, acc];
      saveAccounts(next);
      setAccounts(next);
      notify("تم إنشاء الحساب");
    }
    startNewAccount();
  };

  const checkOnlineUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const info = await api.checkOnlineUpdate();
      setOnlineUpdate(info);
      if (!info.has_update) {
        notify("أنت تستخدم أحدث إصدار");
      }
    } catch (err) {
      setUpdateError(String(err));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const downloadAndApplyUpdate = async () => {
    if (!onlineUpdate || !onlineUpdate.download_url) return;
    setDownloadingUpdate(true);
    setDownloadProgress("جاري تحميل الملف...");
    try {
      const filePath = await api.downloadOnlineUpdate(onlineUpdate.download_url, onlineUpdate.file_name);
      setDownloadProgress("جاري التثبيت...");
      if (!window.confirm("سيتم إغلاق البرنامج وتشغيل المُثبّت.\nهل تريد المتابعة؟")) {
        setDownloadingUpdate(false);
        setDownloadProgress("");
        return;
      }
      const msg = await api.applyOnlineUpdate(filePath);
      notify(msg);
    } catch (err) {
      setUpdateError(String(err));
      setDownloadingUpdate(false);
      setDownloadProgress("");
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "store":
        return (
          <form onSubmit={saveAll} className="form-grid">
            <Field label="اسم المحل">
              <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
            </Field>
            <Field label="رقم الهاتف">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="العنوان">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="العملة">
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="مثال: ج.م" />
            </Field>
            <Field label="الرصيد الافتتاحي للصندوق">
              <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
            </Field>
            <Field label="تذييل الفاتورة">
              <input value={form.invoice_footer} onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} placeholder="شكرًا لزيارتكم" />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">حفظ الإعدادات</button>
            </div>
          </form>
        );

      case "warehouses":
        return (
          <>
            <p className="settings-hint">أضف مستودعات متعددة واختر المستودع المناسب لكل فاتورة بيع أو شراء.</p>
            <div className="wh-row">
              <input value={whName} placeholder="اسم المستودع..." onChange={(e) => setWhName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWarehouse(); }} />
              <button className="btn primary" onClick={addWarehouse}>+ إضافة</button>
            </div>
            <div className="wh-list">
              {warehouses.length === 0 && <p className="settings-note">لا توجد مستودعات بعد.</p>}
              {warehouses.map((w) => (
                <div key={w.id} className="wh-item">
                  <span>{w.name}</span>
                  <button className="btn sm danger" onClick={() => removeWarehouse(w.id)}>حذف</button>
                </div>
              ))}
            </div>
          </>
        );

      case "sync":
        return (
          <>
            <p className="settings-hint">اربط البرنامج بـ Supabase للمزامنة بين الأجهزة والفروع.</p>
            <div className="sync-fields">
              <Field label="Supabase URL">
                <input value={syncConfig.supabase_url} onChange={(e) => setSyncConfig({ ...syncConfig, supabase_url: e.target.value })} placeholder="https://xxxxx.supabase.co" dir="ltr" className="sync-input-ltr" />
              </Field>
              <Field label="Supabase Anon Key">
                <input value={syncConfig.supabase_key} onChange={(e) => setSyncConfig({ ...syncConfig, supabase_key: e.target.value })} placeholder="eyJhbGciOiJIUzI1NiIs..." dir="ltr" className="sync-input-ltr" />
              </Field>
              <Field label="رقم الفرع">
                <select value={syncConfig.branch_id} onChange={(e) => setSyncConfig({ ...syncConfig, branch_id: Number(e.target.value) })}>
                  {branches.map((b) => (<option key={b.id} value={b.id}>{b.name} (#{b.id})</option>))}
                </select>
              </Field>
            </div>
            <div className="sync-actions">
              <button className="btn" onClick={testConnection} disabled={isTesting}>{isTesting ? "جاري الاختبار..." : "🔌 اختبار الاتصال"}</button>
              <button className="btn primary" onClick={saveSyncConfig}>💾 حفظ الإعدادات</button>
              <button className="btn primary" onClick={handleInitialSync} disabled={isSyncing} style={{ background: "#7c3aed" }}>{isSyncing ? "جاري..." : "🚀 مزامنة أولية"}</button>
              <button className="btn" onClick={handleSync} disabled={isSyncing}>{isSyncing ? "جاري المزامنة..." : "🔄 مزامنة عادية"}</button>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label className="checkbox-label" style={{ gap: 6 }}>
                <input type="checkbox" checked={syncConfig.auto_sync} onChange={(e) => setSyncConfig({ ...syncConfig, auto_sync: e.target.checked })} />
                مزامنة تلقائية
              </label>
              {syncConfig.auto_sync && (
                <Field label="المدة (ثانية)">
                  <input type="number" min={10} step={5} value={syncConfig.sync_interval_secs} onChange={(e) => setSyncConfig({ ...syncConfig, sync_interval_secs: Math.max(Number(e.target.value) || 30, 10) })} style={{ width: 80 }} />
                </Field>
              )}
            </div>
            {syncResult && <div className={`sync-result ${syncResult.startsWith("خطأ") ? "error" : "ok"}`}>{syncResult}</div>}
            {syncStatus?.last_sync && <p className="settings-note">آخر مزامنة: {syncStatus.last_sync}</p>}
            {syncStatus && syncStatus.pending_push > 0 && <p className="settings-note" style={{ color: "#f59e0b" }}>{syncStatus.pending_push} سجل في انتظار الرفع</p>}
          </>
        );

      case "branches":
        return (
          <>
            <p className="settings-hint">أنشئ فروع متعددة لكل فرع رقم فرع مختلف.</p>
            <div className="wh-row">
              <input value={newBranchName} placeholder="اسم الفرع الجديد..." onChange={(e) => setNewBranchName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBranch(); }} />
              <button className="btn primary" onClick={addBranch}>+ إضافة فرع</button>
            </div>
            <div className="wh-list">
              {branches.map((b) => (
                <div key={b.id} className="wh-item">
                  <span>{b.name}<span className="settings-note" style={{ marginInlineStart: 8 }}>(#{b.id})</span></span>
                  {b.id !== 1 && <button className="btn sm danger" onClick={() => removeBranch(b.id)}>حذف</button>}
                </div>
              ))}
            </div>
          </>
        );

      case "notifications":
        return (
          <>
            <p className="settings-hint">فعّل الإشعارات والصوت عند تسجيل حضور أو انصراف جديد عبر QR Code.</p>
            <div style={{ marginBottom: 12 }}>
              <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={notifOn} onChange={toggleNotif} style={{ width: 18, height: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{notifOn ? "✅ الاشعارات مفعلة" : "❌ الاشعارات معطلة"}</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn primary" onClick={pickNotifSound}>🎵 رفع نغمة مخصصة</button>
              <button className="btn" onClick={testNotifSound}>🔊 اختبار</button>
              {notifSoundName && <button className="btn danger" onClick={clearNotifSound}>🗑️ حذف النغمة</button>}
            </div>
            {notifSoundName && <p className="settings-note" style={{ marginTop: 8 }}>✅ نغمة مخصصة محفوظة</p>}
            {!notifSoundName && <p className="settings-note" style={{ marginTop: 8 }}>💡 بدون نغمة مخصصة سيتم تشغيل نغمة افتراضية.</p>}
          </>
        );

      case "attendance_url":
        return (
          <>
            <p className="settings-hint">ارفع ملف attendance.html على استضافة وأدخل الرابط هنا لكي يعمل QR Code من الموبايل.</p>
            <Field label="رابط صفحة الحضور (URL)">
              <input value={form.attendance_url} onChange={(e) => setForm({ ...form, attendance_url: e.target.value })} placeholder="https://your-domain.com/attendance.html" />
            </Field>
            <div className="form-actions">
              <button type="button" className="btn primary" onClick={async () => { try { await api.saveSettings(form); notify("تم الحفظ"); } catch (err) { notify(String(err), "error"); } }}>حفظ</button>
            </div>
          </>
        );

      case "license":
        return (
          <>
            {licenseInfo && (() => {
              const expiry = new Date(licenseInfo.expiry_date);
              const now = new Date();
              const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft <= 0;
              return (
                <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: isExpired ? "#fef2f2" : daysLeft <= 30 ? "#fffbeb" : "#ecfdf5", color: isExpired ? "#991b1b" : daysLeft <= 30 ? "#92400e" : "#065f46", fontSize: 13 }}>
                  <div style={{ fontWeight: 700 }}>{isExpired ? "انتهت الصلاحية" : `متبقي ${daysLeft} يوم`} — ينتهي {licenseInfo.expiry_date}</div>
                </div>
              );
            })()}
            <p className="settings-hint">أدخل كود التفعيل الجديد لتمديد المدة</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={newLicenseKey} onChange={(e) => setNewLicenseKey(e.target.value)} placeholder="TABARAK-XXXX-XXXX-XXXX-..." style={{ flex: 1, direction: "ltr", textAlign: "left" }} />
              <button className="btn primary" onClick={async () => {
                if (!newLicenseKey.trim()) { alert("أدخل كود التفعيل"); return; }
                try { await api.activateLicense(newLicenseKey.trim()); const info = await api.getLicenseInfo(); setLicenseInfo(info); setNewLicenseKey(""); alert("تم تحديث التفعيل بنجاح"); } catch (err) { alert(String(err)); }
              }}>تحديث</button>
            </div>
          </>
        );

      case "update":
        return (
          <>
            <p className="settings-hint">الإصدار الحالي: <strong>{appVersion || "—"}</strong></p>

            <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🌐</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>تحديث أونلاين</span>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>تحقق من وجود إصدار جديد وحمّله مباشرة من الإنترنت</p>

              {onlineUpdate && onlineUpdate.has_update && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #86efac" }}>
                  <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14, marginBottom: 4 }}>
                    ✅ إصدار جديد متاح: {onlineUpdate.latest_version}
                  </div>
                  {onlineUpdate.body && (
                    <div style={{ fontSize: 12, color: "#065f46", marginBottom: 8, maxHeight: 80, overflow: "auto" }}>
                      {onlineUpdate.body}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    الإصدار الحالي: {onlineUpdate.current_version} → الجديد: {onlineUpdate.latest_version}
                  </div>
                </div>
              )}

              {onlineUpdate && !onlineUpdate.has_update && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#065f46", fontSize: 13 }}>
                  ✅ أنت تستخدم أحدث إصدار ({onlineUpdate.current_version})
                </div>
              )}

              {updateError && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13 }}>
                  ❌ {updateError}
                </div>
              )}

              {downloadProgress && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
                  ⏳ {downloadProgress}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={checkOnlineUpdate} disabled={checkingUpdate || downloadingUpdate}>
                  {checkingUpdate ? "⏳ جاري الفحص..." : "🔍 فحص التحديث"}
                </button>
                {onlineUpdate?.has_update && onlineUpdate.download_url && (
                  <button className="btn primary" onClick={downloadAndApplyUpdate} disabled={downloadingUpdate}>
                    {downloadingUpdate ? "⏳ جاري التحميل..." : "⬇️ تحميل وتطبيق"}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>💾</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>تحديث يدوي</span>
              </div>
              <p className="settings-hint" style={{ marginBottom: 10 }}>قم بتنزيل ملف التحديث يدوياً ثم اضغط الزر لاختياره وتطبيقه.</p>
              <div className="settings-actions">
                <button className="btn" disabled={updating} onClick={async () => {
                  try {
                    const selected = await open({ multiple: false, filters: [{ name: "تحديث تبارك", extensions: ["msi", "exe"] }] });
                    if (!selected) return;
                    if (!window.confirm("سيتم إغلاق البرنامج وتشغيل المُثبّت.\nهل تريد المتابعة؟")) return;
                    setUpdating(true);
                    const msg = await api.installUpdate(selected as string);
                    notify(msg);
                  } catch (err) { notify(String(err), "error"); setUpdating(false); }
                }}>{updating ? "⏳ جاري التحديث..." : "🔄 تحديث من ملف"}</button>
              </div>
            </div>
            <p className="settings-note" style={{ marginTop: 10 }}>يُفضل إنشاء نسخة احتياطية قبل التحديث.</p>
          </>
        );

      case "printing":
        const allBarcodeSizes = [
          { name: "افتراضي", width: printSettings.barcodeWidth, height: printSettings.barcodeHeight },
          ...printSettings.barcodeCustomSizes,
        ];
        const activeSize = allBarcodeSizes.find((s) => s.name === selectedBarcodeSize) || allBarcodeSizes[0];
        return (
          <div className="print-settings">
            {/* Invoice print settings */}
            <div className="print-section">
              <h3>🧾 إعدادات طابعة الفواتير</h3>
              <div className="print-fields">
                <div className="print-field">
                  <label>مقاس الورق</label>
                  <select value={printSettings.invoicePaper} onChange={(e) => setPrintSettings({ ...printSettings, invoicePaper: e.target.value })}>
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="80mm">80mm (termal)</option>
                    <option value="58mm">58mm (termal)</option>
                  </select>
                </div>
                <div className="print-field">
                  <label>الاتجاه</label>
                  <select value={printSettings.invoiceLandscape ? "landscape" : "portrait"} onChange={(e) => setPrintSettings({ ...printSettings, invoiceLandscape: e.target.value === "landscape" })}>
                    <option value="portrait">عمودي</option>
                    <option value="landscape">أفقي</option>
                  </select>
                </div>
                <div className="print-field">
                  <label>الهوامش (mm)</label>
                  <input type="number" min={0} max={30} value={printSettings.invoiceMargins} onChange={(e) => setPrintSettings({ ...printSettings, invoiceMargins: Number(e.target.value) })} />
                </div>
              </div>
              <div className="print-toggles">
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.invoiceHeader} onChange={(e) => setPrintSettings({ ...printSettings, invoiceHeader: e.target.checked })} />
                  عرض الهيدر
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.invoiceFooter} onChange={(e) => setPrintSettings({ ...printSettings, invoiceFooter: e.target.checked })} />
                  عرض الفوتر
                </label>
              </div>
            </div>

            {/* Barcode print settings */}
            <div className="print-section">
              <h3>🏷️ إعدادات طابعة الباركود</h3>
              <div className="print-fields">
                <div className="print-field" style={{ minWidth: 200 }}>
                  <label>الطابعة الافتراضية</label>
                  <select value={printSettings.barcodePrinter} onChange={(e) => setPrintSettings({ ...printSettings, barcodePrinter: e.target.value })}>
                    <option value="">— اختر طابعة —</option>
                    {availablePrinters.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="print-fields">
                <div className="print-field">
                  <label>العرض (mm)</label>
                  <input type="number" min={20} max={150} value={activeSize.width} onChange={(e) => {
                    const v = Number(e.target.value);
                    if (selectedBarcodeSize === "افتراضي") setPrintSettings({ ...printSettings, barcodeWidth: v });
                    else setPrintSettings({ ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.map((sz) => sz.name === selectedBarcodeSize ? { ...sz, width: v } : sz) });
                  }} />
                </div>
                <div className="print-field">
                  <label>الارتفاع (mm)</label>
                  <input type="number" min={10} max={100} value={activeSize.height} onChange={(e) => {
                    const v = Number(e.target.value);
                    if (selectedBarcodeSize === "افتراضي") setPrintSettings({ ...printSettings, barcodeHeight: v });
                    else setPrintSettings({ ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.map((sz) => sz.name === selectedBarcodeSize ? { ...sz, height: v } : sz) });
                  }} />
                </div>
                <div className="print-field">
                  <label>حجم الخط (pt)</label>
                  <input type="number" min={6} max={18} value={printSettings.barcodeFontSize} onChange={(e) => setPrintSettings({ ...printSettings, barcodeFontSize: Number(e.target.value) })} />
                </div>
              </div>
              <div className="print-toggles">
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowName} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowName: e.target.checked })} />
                  عرض اسم الصنف
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowPrice} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowPrice: e.target.checked })} />
                  عرض السعر
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowBarcode} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowBarcode: e.target.checked })} />
                  عرض الباركود
                </label>
              </div>

              {/* Size selector */}
              <div className="print-sizes">
                <label>المقاسات المحفوظة:</label>
                <div className="print-size-chips">
                  {allBarcodeSizes.map((s) => (
                    <button key={s.name} type="button" className={`print-size-chip ${selectedBarcodeSize === s.name ? "active" : ""}`} onClick={() => setSelectedBarcodeSize(s.name)}>
                      {s.name} ({s.width}×{s.height})
                    </button>
                  ))}
                </div>
              </div>

              {/* Add new size */}
              <div className="print-add-size">
                <input value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)} placeholder="اسم المقاس" style={{ flex: 1 }} />
                <input type="number" min={20} max={150} value={newSizeW} onChange={(e) => setNewSizeW(Number(e.target.value))} style={{ width: 70 }} placeholder="العرض" />
                <span>×</span>
                <input type="number" min={10} max={100} value={newSizeH} onChange={(e) => setNewSizeH(Number(e.target.value))} style={{ width: 70 }} placeholder="الارتفاع" />
                <button type="button" className="btn primary sm" onClick={() => {
                  if (!newSizeName.trim()) { notify("أدخل اسم المقاس", "error"); return; }
                  if (printSettings.barcodeCustomSizes.some((sz) => sz.name === newSizeName.trim())) { notify("المقاس موجود بالفعل", "error"); return; }
                  const updated = { ...printSettings, barcodeCustomSizes: [...printSettings.barcodeCustomSizes, { name: newSizeName.trim(), width: newSizeW, height: newSizeH }] };
                  setPrintSettings(updated);
                  setSelectedBarcodeSize(newSizeName.trim());
                  setNewSizeName("");
                  notify("تم إضافة المقاس");
                }}>+ إضافة</button>
                {selectedBarcodeSize !== "افتراضي" && (
                  <button type="button" className="btn danger sm" onClick={() => {
                    const updated = { ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.filter((sz) => sz.name !== selectedBarcodeSize) };
                    setPrintSettings(updated);
                    setSelectedBarcodeSize("افتراضي");
                    notify("تم حذف المقاس");
                  }}>حذف</button>
                )}
              </div>

              {/* Preview */}
              <div className="print-preview">
                <h4>معاينة الباركود</h4>
                <div className="barcode-preview-box" style={{ width: Math.min(activeSize.width * 2.5, 300), minHeight: activeSize.height * 2.5, border: "2px dashed #cbd5e1", borderRadius: 8, padding: 10, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {printSettings.barcodeShowName && (
                    <div style={{ fontSize: printSettings.barcodeFontSize + 2, fontWeight: 700, color: "#1e293b" }}>اسم الصنف</div>
                  )}
                  {printSettings.barcodeShowBarcode && (
                    <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 30 }}>
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} style={{ width: Math.max(1, Math.floor(activeSize.width / 30)), height: `${50 + Math.random() * 50}%`, background: "#1e293b", borderRadius: 1 }} />
                      ))}
                    </div>
                  )}
                  {printSettings.barcodeShowBarcode && (
                    <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 2 }}>1234567890</div>
                  )}
                  {printSettings.barcodeShowPrice && (
                    <div style={{ fontSize: printSettings.barcodeFontSize, fontWeight: 700, color: "#0f8a5f" }}>150.00 ج.م</div>
                  )}
                </div>
                <p className="settings-note" style={{ marginTop: 6 }}>المقاس الفعلي: {activeSize.width}mm × {activeSize.height}mm</p>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn primary" onClick={() => {
                localStorage.setItem("tabarak_print_settings", JSON.stringify(printSettings));
                notify("تم حفظ إعدادات الطباعة");
              }}>💾 حفظ الإعدادات</button>
            </div>
          </div>
        );

      case "backup":
        return (
          <>
            <p className="settings-hint">احفظ نسخة من قاعدة البيانات على جهازك، أو استعدها لاحقًا على أي جهاز.</p>
            <div className="settings-actions">
              <button className="btn primary" disabled={busy} onClick={backup}>💾 إنشاء نسخة احتياطية</button>
              <button className="btn" disabled={busy} onClick={restore}>📂 استعادة البيانات</button>
            </div>
            <p className="settings-note">مكان البيانات الحالي: بياناتك محفوظة محليًا على جهازك فقط.</p>
          </>
        );

      case "reset":
        return (
          <>
            <p className="settings-hint">حذف جميع البيانات من جميع الأقسام: المنتجات، الفواتير، العملاء، الموردين، الموظفين، الحضور والانصراف، المصروفات، الرواتب، الإجازات، جرد المخزون، المرتجعات، سندات القبض والصرف، تحويلات المستودعات، الصيانة، الفروع، المزامنة، الإعدادات.</p>
            <p className="settings-hint" style={{ color: "#e53e3e", fontWeight: 600 }}>يُنصح بإنشاء نسخة احتياطية قبل المتابعة.</p>
            <div className="settings-actions">
              <button className="btn danger" onClick={async () => {
                if (!window.confirm("هل أنت متأكد من حذف جميع البيانات؟\n\nسيتم حذف جميع البيانات من جميع الأقسام.\n\nلا يمكن التراجع عن هذا الإجراء!")) return;
                if (!window.confirm("تأكيد أخير: ستُحذف جميع البيانات نهائياً. هل أنت متأكد؟")) return;
                try { await api.resetSystem(); localStorage.removeItem("tabarak_activation"); notify("تم إعادة تهيئة النظام بنجاح"); window.location.reload(); } catch (err) { notify(String(err), "error"); }
              }}>🗑️ حذف جميع البيانات</button>
            </div>
          </>
        );

      case "accounts":
        const permGroups = [...new Set(ALL_PERMISSIONS.map((p) => p.group))];
        return (
          <div className="accounts-manage">
            <div className="accounts-list">
              {accounts.map((a) => (
                <div key={a.id} className={`account-item ${editingAccount?.id === a.id ? "active" : ""}`} onClick={() => startEditAccount(a)}>
                  <div>
                    <strong>{a.name}</strong>
                    <span className="account-perms">{a.permissions.length} صلاحية | {a.visibleMenus.length} قائمة</span>
                  </div>
                  <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); deleteAccount(a.id); }} disabled={accounts.length <= 1}>حذف</button>
                </div>
              ))}
            </div>
            <form onSubmit={saveAccount} className="account-form">
              <h4>{editingAccount ? "تعديل الحساب" : "حساب جديد"}</h4>
              <Field label="اسم الحساب"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم الحساب" /></Field>
              <Field label="الرقم السري"><input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="الرقم السري" /></Field>

              <Field label="القوائم المرئية">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_MENUS.map((m) => (
                    <label key={m.key} className="checkbox-label" style={{ background: selectedMenus.includes(m.key) ? "#eef2ff" : "#f9fafb", border: `1px solid ${selectedMenus.includes(m.key) ? "#6366f1" : "#e5e7eb"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                      <input type="checkbox" checked={selectedMenus.includes(m.key)} onChange={(e) => { if (e.target.checked) setSelectedMenus([...selectedMenus, m.key]); else setSelectedMenus(selectedMenus.filter((x) => x !== m.key)); }} style={{ display: "none" }} />
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {permGroups.map((group) => (
                <Field key={group} label={`الصلاحيات — ${group}`}>
                  <div className="checkboxes-grid">
                    {ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => (
                      <label key={p.key} className="checkbox-label">
                        <input type="checkbox" checked={selectedPerms.includes(p.key)} onChange={(e) => { if (e.target.checked) setSelectedPerms([...selectedPerms, p.key]); else setSelectedPerms(selectedPerms.filter((x) => x !== p.key)); }} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </Field>
              ))}

              <div className="form-actions">
                <button type="submit" className="btn primary">{editingAccount ? "حفظ التعديلات" : "إنشاء الحساب"}</button>
                {editingAccount && <button type="button" className="btn" onClick={startNewAccount}>إلغاء</button>}
              </div>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  const activeMeta = SECTIONS.find((s) => s.key === activeSection);

  return (
    <div className="page">
      <div className="page-head">
        <h1>الإعدادات</h1>
      </div>

      <div className="settings-cards-grid">
        {SECTIONS.map((s) => (
          <div key={s.key} className="settings-tile" style={{ background: s.gradient }} onClick={() => openSection(s.key)}>
            <div className="settings-tile-icon">{s.icon}</div>
            <div className="settings-tile-title">{s.title}</div>
            {s.password && <div className="settings-tile-lock">🔒</div>}
          </div>
        ))}
      </div>

      {activeSection && activeMeta && (
        <div className="settings-modal-overlay" onClick={() => setActiveSection(null)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header" style={{ background: activeMeta.gradient }}>
              <span className="settings-modal-icon">{activeMeta.icon}</span>
              <h2>{activeMeta.title}</h2>
              <button className="settings-modal-close" onClick={() => setActiveSection(null)}>✕</button>
            </div>
            <div className="settings-modal-body">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      )}

      {passModal && (
        <div className="settings-modal-overlay" onClick={() => setPassModal(null)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="settings-modal-header" style={{ background: SECTIONS.find((x) => x.key === passModal.section)?.gradient || "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <span className="settings-modal-icon">🔒</span>
              <h2>أدخل رمز الدخول</h2>
              <button className="settings-modal-close" onClick={() => setPassModal(null)}>✕</button>
            </div>
            <div className="settings-modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <p style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>للوصول إلى "{SECTIONS.find((x) => x.key === passModal.section)?.title}"</p>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") verifyPass(); }}
                placeholder="••••"
                maxLength={10}
                autoFocus
                style={{
                  width: 180,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "2px solid #e5e7eb",
                  fontSize: 20,
                  letterSpacing: 10,
                  textAlign: "center",
                  outline: "none",
                  textAlignLast: "center",
                  direction: "ltr",
                }}
              />
              <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn primary" onClick={verifyPass}>تأكيد</button>
                <button className="btn" onClick={() => setPassModal(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFeatures && (
        <div className="settings-modal-overlay" onClick={() => { setShowFeatures(false); setFeaturesPassOk(false); }}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="settings-modal-header" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
              <span className="settings-modal-icon">⚡</span>
              <h2>المميزات</h2>
              <button className="settings-modal-close" onClick={() => { setShowFeatures(false); setFeaturesPassOk(false); }}>✕</button>
            </div>
            <div className="settings-modal-body">
              {!featuresPassOk ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ marginBottom: 16, fontSize: 14, color: "#6b7280" }}>أدخل الرمز السري لعرض المميزات</p>
                  <input
                    type="password"
                    value={featuresPass}
                    onChange={(e) => setFeaturesPass(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") verifyFeaturesPass(); }}
                    placeholder="••••"
                    maxLength={10}
                    autoFocus
                    style={{
                      width: 160,
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "2px solid #e5e7eb",
                      fontSize: 18,
                      letterSpacing: 8,
                      textAlign: "center",
                      outline: "none",
                      textAlignLast: "center",
                    }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <button className="btn primary" onClick={verifyFeaturesPass}>تأكيد</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.maintenance ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.maintenance ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🔧</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>بند الصيانة</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>إدارةطلبات الصيانة والأجهزة</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("maintenance")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.maintenance ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.maintenance ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.attendance ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.attendance ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🕐</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>بند الحضور والانصراف</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>نظام تسجيل الحضور والانصراف</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("attendance")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.attendance ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.attendance ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 4 }}>
                    اضغط F10 لإظهار هذه القائمة
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
