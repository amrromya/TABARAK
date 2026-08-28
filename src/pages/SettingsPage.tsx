import { useEffect, useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { api } from "../api";
import { Field, useToast } from "../components/ui";
import { isNotifEnabled, setNotifEnabled as saveNotifEnabled, getNotifSoundPath, setNotifSoundPath as saveNotifSoundPath, playNotifSound, getSuccessSoundPath, setSuccessSoundPath as saveSuccessSoundPath, getErrorSoundPath, setErrorSoundPath as saveErrorSoundPath, playSuccessSound, playErrorSound } from "../utils/notifications";
import type { Account, Branch, Permission, Settings, SyncConfig, SyncStatus, Warehouse } from "../types";
import { t } from "../i18n";

const ACCOUNTS_KEY = "tabarak_accounts";

const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "view_dashboard", label: "perm_view_dashboard", group: "groupMenus" },
  { key: "view_inventory", label: "perm_view_inventory", group: "groupMenus" },
  { key: "view_warehouses", label: "perm_view_warehouses", group: "groupMenus" },
  { key: "view_sales", label: "perm_view_sales", group: "groupMenus" },
  { key: "view_purchases", label: "perm_view_purchases", group: "groupMenus" },
  { key: "view_suppliers", label: "perm_view_suppliers", group: "groupMenus" },
  { key: "view_customers", label: "perm_view_customers", group: "groupMenus" },
  { key: "view_employees", label: "perm_view_employees", group: "groupMenus" },
  { key: "view_expenses", label: "perm_view_expenses", group: "groupMenus" },
  { key: "view_reports", label: "perm_view_reports", group: "groupMenus" },
  { key: "view_settings", label: "perm_view_settings", group: "groupMenus" },
  { key: "view_receipt_vouchers", label: "perm_view_receipt_vouchers", group: "groupMenus" },
  { key: "view_payment_vouchers", label: "perm_view_payment_vouchers", group: "groupMenus" },
  { key: "view_warehouse_transfers", label: "perm_view_warehouse_transfers", group: "groupMenus" },
  { key: "view_cash_register", label: "perm_view_cash_register", group: "groupMenus" },
  { key: "create_sale", label: "perm_create_sale", group: "groupSales" },
  { key: "edit_sale", label: "perm_edit_sale", group: "groupSales" },
  { key: "delete_sale", label: "perm_delete_sale", group: "groupSales" },
  { key: "create_purchase", label: "perm_create_purchase", group: "groupPurchases" },
  { key: "edit_purchase", label: "perm_edit_purchase", group: "groupPurchases" },
  { key: "delete_purchase", label: "perm_delete_purchase", group: "groupPurchases" },
  { key: "create_customer", label: "perm_create_customer", group: "groupCustomers" },
  { key: "edit_customer", label: "perm_edit_customer", group: "groupCustomers" },
  { key: "delete_customer", label: "perm_delete_customer", group: "groupCustomers" },
  { key: "create_employee", label: "perm_create_employee", group: "groupEmployees" },
  { key: "edit_employee", label: "perm_edit_employee", group: "groupEmployees" },
  { key: "delete_employee", label: "perm_delete_employee", group: "groupEmployees" },
  { key: "manage_accounts", label: "perm_manage_accounts", group: "groupSystem" },
  { key: "maintenance.view", label: "perm_maintenance_view", group: "groupMaintenance" },
  { key: "maintenance.create", label: "perm_maintenance_create", group: "groupMaintenance" },
  { key: "maintenance.edit", label: "perm_maintenance_edit", group: "groupMaintenance" },
  { key: "maintenance.delete", label: "perm_maintenance_delete", group: "groupMaintenance" },
  { key: "maintenance.receive", label: "perm_maintenance_receive", group: "groupMaintenance" },
  { key: "maintenance.diagnose", label: "perm_maintenance_diagnose", group: "groupMaintenance" },
  { key: "maintenance.assign", label: "perm_maintenance_assign", group: "groupMaintenance" },
  { key: "maintenance.parts", label: "perm_maintenance_parts", group: "groupMaintenance" },
  { key: "maintenance.approve", label: "perm_maintenance_approve", group: "groupMaintenance" },
  { key: "maintenance.deliver", label: "perm_maintenance_deliver", group: "groupMaintenance" },
  { key: "maintenance.reports", label: "perm_maintenance_reports", group: "groupMaintenance" },
  { key: "maintenance.financial", label: "perm_maintenance_financial", group: "groupMaintenance" },
  { key: "maintenance.settings", label: "perm_maintenance_settings", group: "groupMaintenance" },
];

const ALL_MENUS: { key: string; label: string; icon: string }[] = [
  { key: "dashboard", label: "dashboard", icon: "🏠" },
  { key: "inventory", label: "inventory", icon: "📦" },
  { key: "warehouses", label: "warehouses", icon: "🏬" },
  { key: "purchases", label: "purchases", icon: "📥" },
  { key: "suppliers", label: "suppliers", icon: "🚚" },
  { key: "customers", label: "customers", icon: "🤝" },
  { key: "employees", label: "employees", icon: "👥" },
  { key: "attendance", label: "attendance", icon: "🕐" },
  { key: "expenses", label: "expenses", icon: "🧾" },
  { key: "sales", label: "salesLabel", icon: "💰" },
  { key: "receipt_vouchers", label: "receiptVouchers", icon: "💵" },
  { key: "payment_vouchers", label: "paymentVouchers", icon: "💳" },
  { key: "warehouse_transfers", label: "warehouseTransfers", icon: "🔄" },
  { key: "reports", label: "reports", icon: "📈" },
  { key: "cash_register", label: "cashRegister", icon: "🏧" },
  { key: "maintenance", label: "maintenance", icon: "🔧" },
  { key: "settings", label: "settings", icon: "⚙️" },
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

function getFeatures(): { maintenance: boolean; attendance: boolean; dark_mode: boolean; language: boolean; sync: boolean; branches: boolean; attendance_url: boolean; notifications: boolean; cash_register: boolean } {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (raw) return { maintenance: false, attendance: false, dark_mode: false, language: false, sync: false, branches: false, attendance_url: false, notifications: false, cash_register: false, ...JSON.parse(raw) };
  } catch {}
  return { maintenance: false, attendance: false, dark_mode: false, language: false, sync: false, branches: false, attendance_url: false, notifications: false, cash_register: false };
}

function saveFeatures(f: { maintenance: boolean; attendance: boolean; dark_mode: boolean; language: boolean; sync: boolean; branches: boolean; attendance_url: boolean; notifications: boolean; cash_register: boolean }) {
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

const SECTIONS: { key: SectionKey; icon: string; title: string; color: string; gradient: string; locked?: boolean }[] = [
  { key: "store", icon: "🏪", title: "storeInfo", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { key: "warehouses", icon: "📦", title: "warehouses", color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { key: "sync", icon: "☁️", title: "syncSettings", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", locked: true },
  { key: "branches", icon: "🏬", title: "branches", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", locked: true },
  { key: "notifications", icon: "🔔", title: "attendanceNotifications", color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
  { key: "attendance_url", icon: "📍", title: "attendanceUrlLabel", color: "#14b8a6", gradient: "linear-gradient(135deg, #14b8a6, #0d9488)", locked: true },
  { key: "printing", icon: "🖨️", title: "printSettings", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)" },
  { key: "license", icon: "🔑", title: "updateLicense", color: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { key: "update", icon: "📦", title: "updateProgram", color: "#0ea5e9", gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)" },
  { key: "backup", icon: "💾", title: "backup", color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { key: "reset", icon: "⚠️", title: "resetSystem", color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { key: "accounts", icon: "👥", title: "manageAccounts", color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)" },
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
  const [successSoundName, setSuccessSoundName] = useState<string | null>(getSuccessSoundPath);
  const [errorSoundName, setErrorSoundName] = useState<string | null>(getErrorSoundPath);

  const [appVersion, setAppVersion] = useState("");
  const [updating, setUpdating] = useState(false);

  const [onlineUpdate, setOnlineUpdate] = useState<OnlineUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [downloadPercent, setDownloadPercent] = useState(0);
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
    invoicePrinter: string;
    invoiceLogo: string;
    warrantyText: string;
    receiptPrinter: string;
    barcodePrinter: string;
    barcodeWidth: number;
    barcodeHeight: number;
    barcodeFontSize: number;
    barcodeShowName: boolean;
    barcodeShowPrice: boolean;
    barcodeShowBarcode: boolean;
    barcodeShowStoreName: boolean;
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
      invoicePrinter: "",
      invoiceLogo: "",
      warrantyText: "",
      barcodePrinter: "",
      barcodeWidth: 50,
      barcodeHeight: 25,
      barcodeFontSize: 10,
      barcodeShowName: true,
      barcodeShowPrice: true,
      barcodeShowBarcode: true,
      barcodeShowStoreName: true,
      barcodeCustomSizes: [] as { name: string; width: number; height: number }[],
      receiptPrinter: "A4" as string,
    };
  });
  const [selectedBarcodeSize, setSelectedBarcodeSize] = useState<string>("default");
  const [newSizeName, setNewSizeName] = useState("");
  const [newSizeW, setNewSizeW] = useState(50);
  const [newSizeH, setNewSizeH] = useState(25);

  const [passModal, setPassModal] = useState<{ section: SectionKey } | null>(null);
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

  const verifyFeaturesPass = async () => {
    try {
      const ok = await api.verifySectionPassword(featuresPass);
      if (ok) {
        setFeaturesPassOk(true);
      } else if (featuresPass.length > 0) {
        notify(t("wrongPassword"), "error");
      }
    } catch {
      if (featuresPass.length > 0) notify(t("wrongPassword"), "error");
    }
  };

  const toggleFeature = async (key: "maintenance" | "attendance" | "dark_mode" | "language" | "sync" | "branches" | "attendance_url" | "notifications" | "cash_register") => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    saveFeatures(next);

    try {
      const accs = getAccounts();
      const updated = accs.map((a) => {
        let menus = [...(a.visibleMenus || [])];
        let perms = [...(a.permissions || [])];
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
        if (key === "cash_register") {
          if (next.cash_register) {
            if (!menus.includes("cash_register")) menus.push("cash_register");
            if (!perms.includes("view_cash_register")) perms.push("view_cash_register");
          } else {
            menus = menus.filter((m) => m !== "cash_register");
            perms = perms.filter((p) => p !== "view_cash_register");
          }
        }
        return { ...a, visibleMenus: [...new Set(menus)], permissions: [...new Set(perms)] };
      });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      setAccounts(updated);
      const labelMap: Record<string, { enabled: string; disabled: string }> = {
        maintenance: { enabled: t("maintenanceEnabled"), disabled: t("maintenanceDisabled") },
        attendance: { enabled: t("attendanceEnabled"), disabled: t("attendanceDisabled") },
        dark_mode: { enabled: t("darkModeEnabled"), disabled: t("darkModeDisabled") },
        language: { enabled: t("languageEnabled"), disabled: t("languageDisabled") },
        notifications: { enabled: t("notificationsEnabled"), disabled: t("notificationsDisabled") },
        cash_register: { enabled: t("cashRegisterEnabled"), disabled: t("cashRegisterDisabled") },
      };
      notify(next[key] ? labelMap[key].enabled : labelMap[key].disabled);
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
    if (section?.locked) {
      setPassModal({ section: s });
      setPassInput("");
    } else {
      setActiveSection(s);
    }
  };

  const verifyPass = async () => {
    if (!passModal) return;
    try {
      const ok = await api.verifySectionPassword(passInput);
      if (ok) {
        setActiveSection(passModal.section);
        setPassModal(null);
      } else if (passInput.length > 0) {
        notify(t("wrongPassword"), "error");
      }
    } catch {
      if (passInput.length > 0) notify(t("wrongPassword"), "error");
    }
  };

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveSettings(form);
      notify(t("settingsSaved"));
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
    if (!window.confirm(t("deleteWarehouseConfirm"))) return;
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
    if (!window.confirm(t("deleteBranchConfirm"))) return;
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
        filters: [{ name: t("soundFilter"), extensions: ["mp3", "wav", "ogg"] }],
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected;
      saveNotifSoundPath(path as string);
      setNotifSoundName(path as string);
      notify(t("soundSaved"));
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const clearNotifSound = () => {
    saveNotifSoundPath("");
    setNotifSoundName(null);
    notify(t("customSoundDeleted"));
  };

  const testNotifSound = () => {
    playNotifSound();
  };

  const pickSuccessSound = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: t("soundFilter"), extensions: ["mp3", "wav", "ogg"] }],
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected;
      saveSuccessSoundPath(path as string);
      setSuccessSoundName(path as string);
      notify(t("soundSaved"));
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const clearSuccessSound = () => {
    saveSuccessSoundPath("");
    setSuccessSoundName(null);
    notify(t("customSoundDeleted"));
  };

  const testSuccessSound = () => {
    playSuccessSound();
  };

  const pickErrorSound = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: t("soundFilter"), extensions: ["mp3", "wav", "ogg"] }],
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected;
      saveErrorSoundPath(path as string);
      setErrorSoundName(path as string);
      notify(t("soundSaved"));
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const clearErrorSound = () => {
    saveErrorSoundPath("");
    setErrorSoundName(null);
    notify(t("customSoundDeleted"));
  };

  const testErrorSound = () => {
    playErrorSound();
  };

  const backup = async () => {
    try {
      const path = await save({
        defaultPath: "tabarak_backup.db",
        filters: [{ name: t("databaseFilter"), extensions: ["db"] }],
      });
      if (!path) return;
      setBusy(true);
      await api.exportBackup(path);
      notify(t("backupCreated"));
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
        filters: [{ name: t("databaseFilter"), extensions: ["db"] }],
      });
      if (!selected) return;
      if (!window.confirm(t("confirmRestore"))) return;
      setBusy(true);
      const path = typeof selected === "string" ? selected : selected;
      await api.importBackup(path as string);
      notify(t("dataRestored"));
      window.location.reload();
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setBusy(false);
    }
  };

  // Auto-backup settings
  const [autoBackup, setAutoBackup] = useState<{ enabled: boolean; interval: string; path: string }>(() => {
    try {
      const raw = localStorage.getItem("tabarak_auto_backup");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: false, interval: "24", path: "" };
  });

  const selectBackupFolder = async () => {
    try {
      const selected = await open({ directory: true });
      if (selected) {
        setAutoBackup((prev) => ({ ...prev, path: selected as string }));
      }
    } catch {}
  };

  const saveAutoBackup = () => {
    localStorage.setItem("tabarak_auto_backup", JSON.stringify(autoBackup));
    notify(t("autoBackupSaved"));
  };

  const saveSyncConfig = async () => {
    try {
      await api.saveSyncConfig(syncConfig);
      notify(t("syncSettingsSaved"));
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
      setSyncResult(t("connectionSuccess"));
    } catch (err) {
      setSyncResult(t("errorPrefix") + String(err));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const r = await api.syncNow();
      setSyncResult(`${t("syncComplete")}: ${r.pushed} ${t("pushedLabel")}, ${r.pulled} ${t("pulledLabel")}`);
      loadSync();
    } catch (err) {
      setSyncResult(t("errorPrefix") + String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInitialSync = async () => {
    if (!window.confirm(t("confirmInitialSync"))) return;
    setIsSyncing(true);
    try {
      const r = await api.initialSync();
      setSyncResult(`${t("initialSyncComplete")}: ${r.pushed} ${t("recordsLabel")}`);
      loadSync();
    } catch (err) {
      setSyncResult(t("errorPrefix") + String(err));
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
    if (!window.confirm(t("confirmDeleteAccount"))) return;
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
      notify(t("accountEdited"));
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
      notify(t("accountCreated"));
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
        notify(t("latestVersionUsed"));
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
    setDownloadProgress(t("downloadingFile"));
    setDownloadPercent(0);
    const unlisten = await listen<{ downloaded: number; total: number; percent: number }>("update-download-progress", (e) => {
      setDownloadPercent(e.payload.percent);
      setDownloadProgress(`${t("downloadingFile")} ${e.payload.percent}%`);
    });
    try {
      const filePath = await api.downloadOnlineUpdate(onlineUpdate.download_url, onlineUpdate.file_name);
      unlisten();
      setDownloadProgress(t("installing"));
      if (!window.confirm(t("confirmInstall"))) {
        setDownloadingUpdate(false);
        setDownloadProgress("");
        setDownloadPercent(0);
        return;
      }
      const msg = await api.applyOnlineUpdate(filePath);
      notify(msg);
    } catch (err) {
      setUpdateError(String(err));
      setDownloadingUpdate(false);
      setDownloadProgress("");
      setDownloadPercent(0);
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "store":
        return (
          <form onSubmit={saveAll} className="form-grid">
            <Field label={t("storeNameLabel")}>
              <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
            </Field>
            <Field label={t("phoneNumber")}>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t("address")}>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label={t("currencyLabel")}>
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder={t("currencyPlaceholder")} />
            </Field>
            <Field label={t("openingBalance")}>
              <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
            </Field>
            <Field label={t("invoiceFooterLabel")}>
              <input value={form.invoice_footer} onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} placeholder={t("invoiceFooterPlaceholder")} />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">{t("saveSettingsBtn")}</button>
            </div>
          </form>
        );

      case "warehouses":
        return (
          <>
            <p className="settings-hint">{t("warehousesHint")}</p>
            <div className="wh-row">
              <input value={whName} placeholder={t("warehouseNamePlaceholder")} onChange={(e) => setWhName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWarehouse(); }} />
              <button className="btn primary" onClick={addWarehouse}>{t("addBtn")}</button>
            </div>
            <div className="wh-list">
              {warehouses.length === 0 && <p className="settings-note">{t("noWarehousesYet")}</p>}
              {warehouses.map((w) => (
                <div key={w.id} className="wh-item">
                  <span>{w.name}</span>
                  <button className="btn sm danger" onClick={() => removeWarehouse(w.id)}>{t("delete")}</button>
                </div>
              ))}
            </div>
          </>
        );

      case "sync":
        return (
          <>
            <p className="settings-hint">{t("syncHint")}</p>
            <div className="sync-fields">
              <Field label={t("supabaseUrl")}>
                <input value={syncConfig.supabase_url} onChange={(e) => setSyncConfig({ ...syncConfig, supabase_url: e.target.value })} placeholder="https://xxxxx.supabase.co" dir="ltr" className="sync-input-ltr" />
              </Field>
              <Field label={t("supabaseAnonKey")}>
                <input value={syncConfig.supabase_key} onChange={(e) => setSyncConfig({ ...syncConfig, supabase_key: e.target.value })} placeholder="eyJhbGciOiJIUzI1NiIs..." dir="ltr" className="sync-input-ltr" />
              </Field>
              <Field label={t("branchNumber")}>
                <select value={syncConfig.branch_id} onChange={(e) => setSyncConfig({ ...syncConfig, branch_id: Number(e.target.value) })}>
                  {branches.map((b) => (<option key={b.id} value={b.id}>{b.name} (#{b.id})</option>))}
                </select>
              </Field>
            </div>
            <div className="sync-actions">
              <button className="btn" onClick={testConnection} disabled={isTesting}>{isTesting ? t("testing") : t("testConnectionBtn")}</button>
              <button className="btn primary" onClick={saveSyncConfig}>{t("saveSettingsBtn")}</button>
              <button className="btn primary" onClick={handleInitialSync} disabled={isSyncing} style={{ background: "#7c3aed" }}>{isSyncing ? t("syncing") : t("initialSyncBtn")}</button>
              <button className="btn" onClick={handleSync} disabled={isSyncing}>{isSyncing ? t("syncingNow") : t("normalSyncBtn")}</button>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label className="checkbox-label" style={{ gap: 6 }}>
                <input type="checkbox" checked={syncConfig.auto_sync} onChange={(e) => setSyncConfig({ ...syncConfig, auto_sync: e.target.checked })} />
                {t("autoSync")}
              </label>
              {syncConfig.auto_sync && (
                <Field label={t("intervalSeconds")}>
                  <input type="number" min={10} step={5} value={syncConfig.sync_interval_secs} onChange={(e) => setSyncConfig({ ...syncConfig, sync_interval_secs: Math.max(Number(e.target.value) || 30, 10) })} style={{ width: 80 }} />
                </Field>
              )}
            </div>
            {syncResult && <div className={`sync-result ${syncResult.startsWith(t("errorPrefix")) ? "error" : "ok"}`}>{syncResult}</div>}
            {syncStatus?.last_sync && <p className="settings-note">{t("lastSyncPrefix")} {syncStatus.last_sync}</p>}
            {syncStatus && syncStatus.pending_push > 0 && <p className="settings-note" style={{ color: "#f59e0b" }}>{syncStatus.pending_push} {t("recordsPendingPush")}</p>}
          </>
        );

      case "branches":
        return (
          <>
            <p className="settings-hint">{t("branchesHint")}</p>
            <div className="wh-row">
              <input value={newBranchName} placeholder={t("newBranchPlaceholder")} onChange={(e) => setNewBranchName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBranch(); }} />
              <button className="btn primary" onClick={addBranch}>{t("addBranchBtn")}</button>
            </div>
            <div className="wh-list">
              {branches.map((b) => (
                <div key={b.id} className="wh-item">
                  <span>{b.name}<span className="settings-note" style={{ marginInlineStart: 8 }}>(#{b.id})</span></span>
                  {b.id !== 1 && <button className="btn sm danger" onClick={() => removeBranch(b.id)}>{t("delete")}</button>}
                </div>
              ))}
            </div>
          </>
        );

      case "notifications":
        return (
          <>
            <p className="settings-hint">{t("notifHint")}</p>
            <div style={{ marginBottom: 12 }}>
              <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={notifOn} onChange={toggleNotif} style={{ width: 18, height: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{notifOn ? t("notifEnabledLabel") : t("notifDisabledLabel")}</span>
              </label>
            </div>

            {/* General notification sound */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>🔔 {t("notifSound")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn primary" onClick={pickNotifSound}>{t("uploadCustomSound")}</button>
                <button className="btn" onClick={testNotifSound}>{t("testSoundBtn")}</button>
                {notifSoundName && <button className="btn danger" onClick={clearNotifSound}>{t("deleteSoundBtn")}</button>}
              </div>
              {notifSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("customSoundSaved")}</p>}
              {!notifSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("defaultSoundNote")}</p>}
            </div>

            {/* Success sound */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>✅ {t("successSound")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn primary" onClick={pickSuccessSound}>{t("uploadCustomSound")}</button>
                <button className="btn" onClick={testSuccessSound}>{t("testSoundBtn")}</button>
                {successSoundName && <button className="btn danger" onClick={clearSuccessSound}>{t("deleteSoundBtn")}</button>}
              </div>
              {successSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("customSoundSaved")}</p>}
              {!successSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("defaultSuccessSoundNote")}</p>}
            </div>

            {/* Error sound */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>❌ {t("errorSound")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn primary" onClick={pickErrorSound}>{t("uploadCustomSound")}</button>
                <button className="btn" onClick={testErrorSound}>{t("testSoundBtn")}</button>
                {errorSoundName && <button className="btn danger" onClick={clearErrorSound}>{t("deleteSoundBtn")}</button>}
              </div>
              {errorSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("customSoundSaved")}</p>}
              {!errorSoundName && <p className="settings-note" style={{ marginTop: 4 }}>{t("defaultErrorSoundNote")}</p>}
            </div>
          </>
        );

      case "attendance_url":
        return (
          <>
            <p className="settings-hint">{t("attendanceUrlHint")}</p>
            <Field label={t("attendanceUrlFieldLabel")}>
              <input value={form.attendance_url} onChange={(e) => setForm({ ...form, attendance_url: e.target.value })} placeholder="https://your-domain.com/attendance.html" />
            </Field>
            <div className="form-actions">
              <button type="button" className="btn primary" onClick={async () => { try { await api.saveSettings(form); notify(t("saved")); } catch (err) { notify(String(err), "error"); } }}>{t("save")}</button>
            </div>
          </>
        );

      case "license":
        return (
          <>
            {licenseInfo && (() => {
              const raw = licenseInfo.expiry_date;
              const expiry = raw.includes(" ")
                ? new Date(raw.replace(" ", "T"))
                : new Date(raw + "T23:59:59");
              const isLifetime = expiry.getFullYear() >= 2099;
              const diffMs = expiry.getTime() - Date.now();
              const isExpired = diffMs <= 0;
              const absDiffMs = Math.abs(diffMs);
              const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
              const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
              const parts: string[] = [];
              if (days > 0) parts.push(`${days} ${t("dayUnit")}`);
              if (hours > 0) parts.push(`${hours} ${t("hourUnit")}`);
              if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${t("minuteUnit")}`);
              const timeText = parts.join(" ");
              return (
                <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "#ecfdf5", color: "#065f46", fontSize: 13 }}>
                  <div style={{ fontWeight: 700 }}>{isLifetime ? t("activatedForever") : isExpired ? `${t("licenseExpired")} — ${timeText}` : `${t("expiresIn")} ${timeText}`} — {licenseInfo.expiry_date}</div>
                </div>
              );
            })()}
            <p className="settings-hint">{t("licenseHint")}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={newLicenseKey} onChange={(e) => setNewLicenseKey(e.target.value)} placeholder="TABARAK-XXXX-XXXX-XXXX-..." style={{ flex: 1, direction: "ltr", textAlign: "left" }} />
              <button className="btn primary" onClick={async () => {
                if (!newLicenseKey.trim()) { alert(t("enterLicenseCode")); return; }
                try { await api.activateLicense(newLicenseKey.trim()); const info = await api.getLicenseInfo(); setLicenseInfo(info); setNewLicenseKey(""); alert(t("licenseUpdated")); } catch (err) { alert(String(err)); }
              }}>{t("updateLicenseBtn")}</button>
            </div>
          </>
        );

      case "update":
        return (
          <>
            <p className="settings-hint">{t("currentVersionLabel")} <strong>{appVersion || "—"}</strong></p>

            <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🌐</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t("onlineUpdateTitle")}</span>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{t("onlineUpdateDesc")}</p>

              {onlineUpdate && onlineUpdate.has_update && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #86efac" }}>
                  <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14, marginBottom: 4 }}>
                    {t("newVersionAvailable")} {onlineUpdate.latest_version}
                  </div>
                  {onlineUpdate.body && (
                    <div style={{ fontSize: 12, color: "#065f46", marginBottom: 8, maxHeight: 80, overflow: "auto" }}>
                      {onlineUpdate.body}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {t("currentVersionPrefix")} {onlineUpdate.current_version} → {t("newVersionPrefix")} {onlineUpdate.latest_version}
                  </div>
                </div>
              )}

              {onlineUpdate && !onlineUpdate.has_update && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#065f46", fontSize: 13 }}>
                  {t("latestVersion")} ({onlineUpdate.current_version})
                </div>
              )}

              {updateError && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13 }}>
                  ❌ {updateError}
                </div>
              )}

              {downloadProgress && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: downloadingUpdate && downloadPercent > 0 ? 8 : 0 }}>
                    {downloadingUpdate && downloadPercent > 0 ? (
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span>⏳ {t("downloadingFile")}</span>
                          <span style={{ fontWeight: 700 }}>{downloadPercent}%</span>
                        </div>
                        <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${downloadPercent}%`, height: "100%", background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 4, transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                    ) : (
                      <span>⏳ {downloadProgress}</span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={checkOnlineUpdate} disabled={checkingUpdate || downloadingUpdate}>
                  {checkingUpdate ? t("checkingUpdate") : t("checkUpdateBtn")}
                </button>
                {onlineUpdate?.has_update && onlineUpdate.download_url && (
                  <button className="btn primary" onClick={downloadAndApplyUpdate} disabled={downloadingUpdate}>
                    {downloadingUpdate ? t("downloading") : t("downloadAndApply")}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>💾</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t("manualUpdateTitle")}</span>
              </div>
              <p className="settings-hint" style={{ marginBottom: 10 }}>{t("manualUpdateDesc")}</p>
              <div className="settings-actions">
                <button className="btn" disabled={updating} onClick={async () => {
                  try {
                    const selected = await open({ multiple: false, filters: [{ name: t("updateFilter"), extensions: ["msi", "exe"] }] });
                    if (!selected) return;
                    if (!window.confirm(t("confirmInstall"))) return;
                    setUpdating(true);
                    const msg = await api.installUpdate(selected as string);
                    notify(msg);
                  } catch (err) { notify(String(err), "error"); setUpdating(false); }
                }}>{updating ? t("updating") : t("updateFromFile")}</button>
              </div>
            </div>
            <p className="settings-note" style={{ marginTop: 10 }}>{t("backupBeforeUpdate")}</p>
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
              <h3>{t("invoicePrinterSettings")}</h3>
              <div className="print-fields">
                <div className="print-field">
                  <label>{t("receiptPrinterType")}</label>
                  <select value={printSettings.receiptPrinter || "A4"} onChange={(e) => setPrintSettings({ ...printSettings, receiptPrinter: e.target.value })}>
                    <option value="A4">A4 — {t("standardA4")}</option>
                    <option value="A5">A5 — {t("standardA5")}</option>
                    <option value="80mm">80mm — {t("thermal80")}</option>
                    <option value="58mm">58mm — {t("thermal58")}</option>
                  </select>
                </div>
                <div className="print-field">
                  <label>{t("invoiceDefaultPrinter")}</label>
                  <select value={printSettings.invoicePrinter || ""} onChange={(e) => setPrintSettings({ ...printSettings, invoicePrinter: e.target.value })}>
                    <option value="">{t("systemDefaultPrinter")}</option>
                    {availablePrinters.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="print-field">
                  <label>{t("paperSize")}</label>
                  <select value={printSettings.invoicePaper} onChange={(e) => setPrintSettings({ ...printSettings, invoicePaper: e.target.value })}>
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="80mm">80mm (termal)</option>
                    <option value="58mm">58mm (termal)</option>
                  </select>
                </div>
                <div className="print-field">
                  <label>{t("orientationLabel")}</label>
                  <select value={printSettings.invoiceLandscape ? "landscape" : "portrait"} onChange={(e) => setPrintSettings({ ...printSettings, invoiceLandscape: e.target.value === "landscape" })}>
                    <option value="portrait">{t("portrait")}</option>
                    <option value="landscape">{t("landscape")}</option>
                  </select>
                </div>
                <div className="print-field">
                  <label>{t("margins")}</label>
                  <input type="number" min={0} max={30} value={printSettings.invoiceMargins} onChange={(e) => setPrintSettings({ ...printSettings, invoiceMargins: Number(e.target.value) })} />
                </div>
              </div>
              <div className="print-toggles">
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.invoiceHeader} onChange={(e) => setPrintSettings({ ...printSettings, invoiceHeader: e.target.checked })} />
                  {t("showHeader")}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.invoiceFooter} onChange={(e) => setPrintSettings({ ...printSettings, invoiceFooter: e.target.checked })} />
                  {t("showFooter")}
                </label>
              </div>

              {/* Logo upload */}
              <div className="print-section" style={{ marginTop: 16 }}>
                <h3>{t("invoiceLogo")}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="logoUpload"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) { notify(t("logoTooLarge"), "error"); return; }
                        const reader = new FileReader();
                        reader.onload = () => setPrintSettings({ ...printSettings, invoiceLogo: reader.result as string });
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button className="btn" onClick={() => document.getElementById("logoUpload")?.click()}>
                      📷 {t("uploadLogo")}
                    </button>
                  </div>
                  {printSettings.invoiceLogo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={printSettings.invoiceLogo} alt="logo" style={{ maxWidth: 120, maxHeight: 60, border: "1px solid #e5e7eb", borderRadius: 8, padding: 4, background: "#fff" }} />
                      <button className="btn danger sm" onClick={() => setPrintSettings({ ...printSettings, invoiceLogo: "" })}>{t("removeLogo")}</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Warranty text */}
              <div className="print-section" style={{ marginTop: 16 }}>
                <h3>{t("warrantyTitle")}</h3>
                <textarea
                  value={printSettings.warrantyText}
                  onChange={(e) => setPrintSettings({ ...printSettings, warrantyText: e.target.value })}
                  placeholder={t("warrantyPlaceholder")}
                  rows={4}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, resize: "vertical", fontFamily: "inherit", direction: "rtl" }}
                />
              </div>
            </div>

            {/* Barcode print settings */}
            <div className="print-section">
              <h3>{t("barcodePrinterSettings")}</h3>
              <div className="print-fields">
                <div className="print-field" style={{ minWidth: 200 }}>
                  <label>{t("defaultPrinter")}</label>
                  <select value={printSettings.barcodePrinter} onChange={(e) => setPrintSettings({ ...printSettings, barcodePrinter: e.target.value })}>
                    <option value="">{t("choosePrinter")}</option>
                    {availablePrinters.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="print-fields">
                <div className="print-field">
                  <label>{t("widthLabel")}</label>
                  <input type="number" min={20} max={150} value={activeSize.width} onChange={(e) => {
                    const v = Number(e.target.value);
                    if (selectedBarcodeSize === "افتراضي") setPrintSettings({ ...printSettings, barcodeWidth: v });
                    else setPrintSettings({ ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.map((sz) => sz.name === selectedBarcodeSize ? { ...sz, width: v } : sz) });
                  }} />
                </div>
                <div className="print-field">
                  <label>{t("heightLabel")}</label>
                  <input type="number" min={10} max={100} value={activeSize.height} onChange={(e) => {
                    const v = Number(e.target.value);
                    if (selectedBarcodeSize === "افتراضي") setPrintSettings({ ...printSettings, barcodeHeight: v });
                    else setPrintSettings({ ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.map((sz) => sz.name === selectedBarcodeSize ? { ...sz, height: v } : sz) });
                  }} />
                </div>
                <div className="print-field">
                  <label>{t("fontSize")}</label>
                  <input type="number" min={6} max={18} value={printSettings.barcodeFontSize} onChange={(e) => setPrintSettings({ ...printSettings, barcodeFontSize: Number(e.target.value) })} />
                </div>
              </div>
              <div className="print-toggles">
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowName} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowName: e.target.checked })} />
                  {t("showItemName")}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowPrice} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowPrice: e.target.checked })} />
                  {t("showPriceLabel")}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowBarcode} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowBarcode: e.target.checked })} />
                  {t("showBarcodeLabel")}
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={printSettings.barcodeShowStoreName ?? true} onChange={(e) => setPrintSettings({ ...printSettings, barcodeShowStoreName: e.target.checked })} />
                  {t("showStoreNameLabel")}
                </label>
              </div>

              {/* Size selector */}
              <div className="print-sizes">
                <label>{t("savedSizes")}</label>
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
                <input value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)} placeholder={t("sizeName")} style={{ flex: 1 }} />
                <input type="number" min={20} max={150} value={newSizeW} onChange={(e) => setNewSizeW(Number(e.target.value))} style={{ width: 70 }} placeholder={t("widthLabel")} />
                <span>×</span>
                <input type="number" min={10} max={100} value={newSizeH} onChange={(e) => setNewSizeH(Number(e.target.value))} style={{ width: 70 }} placeholder={t("heightLabel")} />
                <button type="button" className="btn primary sm" onClick={() => {
                  if (!newSizeName.trim()) { notify(t("enterSizeName"), "error"); return; }
                  if (printSettings.barcodeCustomSizes.some((sz) => sz.name === newSizeName.trim())) { notify(t("sizeExists"), "error"); return; }
                  const updated = { ...printSettings, barcodeCustomSizes: [...printSettings.barcodeCustomSizes, { name: newSizeName.trim(), width: newSizeW, height: newSizeH }] };
                  setPrintSettings(updated);
                  setSelectedBarcodeSize(newSizeName.trim());
                  setNewSizeName("");
                  notify(t("sizeAdded"));
                }}>{t("addSizeBtn")}</button>
                {selectedBarcodeSize !== "افتراضي" && (
                  <button type="button" className="btn danger sm" onClick={() => {
                    const updated = { ...printSettings, barcodeCustomSizes: printSettings.barcodeCustomSizes.filter((sz) => sz.name !== selectedBarcodeSize) };
                    setPrintSettings(updated);
                    setSelectedBarcodeSize("افتراضي");
                    notify(t("sizeDeleted"));
                  }}>{t("deleteSizeBtn")}</button>
                )}
              </div>

              {/* Preview */}
              <div className="print-preview">
                <h4>{t("barcodePreview")}</h4>
                <div className="barcode-preview-box" style={{ width: Math.min(activeSize.width * 2.5, 300), minHeight: activeSize.height * 2.5, border: "2px dashed #cbd5e1", borderRadius: 8, padding: 10, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {printSettings.barcodeShowName && (
                    <div style={{ fontSize: printSettings.barcodeFontSize + 2, fontWeight: 700, color: "#1e293b" }}>{t("itemName")}</div>
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
                <p className="settings-note" style={{ marginTop: 6 }}>{t("actualSize")} {activeSize.width}mm × {activeSize.height}mm</p>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn primary" onClick={() => {
                localStorage.setItem("tabarak_print_settings", JSON.stringify(printSettings));
                notify(t("syncSettingsSaved"));
              }}>{t("savePrintSettings")}</button>
            </div>
          </div>
        );

      case "backup":
        return (
          <>
            <p className="settings-hint">{t("backupHint")}</p>
            <div className="settings-actions">
              <button className="btn primary" disabled={busy} onClick={backup}>{t("createBackupBtn")}</button>
              <button className="btn" disabled={busy} onClick={restore}>{t("restoreDataBtn")}</button>
            </div>
            <p className="settings-note">{t("dataLocationNote")}</p>
            <hr style={{ margin: "20px 0", borderTop: "1px solid #e2e8f0" }} />
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>{t("autoBackupSettings")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoBackup.enabled}
                  onChange={(e) => setAutoBackup((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                <span>{t("autoBackupEnable")}</span>
              </label>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>{t("autoBackupInterval")}</label>
                <select
                  value={autoBackup.interval}
                  onChange={(e) => setAutoBackup((prev) => ({ ...prev, interval: e.target.value }))}
                  disabled={!autoBackup.enabled}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                >
                  <option value="6">{t("interval6h")}</option>
                  <option value="12">{t("interval12h")}</option>
                  <option value="24">{t("interval24h")}</option>
                  <option value="168">{t("intervalWeekly")}</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>{t("autoBackupLocation")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={autoBackup.path}
                    readOnly
                    placeholder={t("autoBackupSelectFolder")}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc" }}
                  />
                  <button className="btn sm" onClick={selectBackupFolder} disabled={!autoBackup.enabled}>
                    📁 {t("autoBackupSelectFolder")}
                  </button>
                </div>
              </div>
              <button
                className="btn primary"
                onClick={saveAutoBackup}
                style={{ alignSelf: "flex-start" }}
              >
                💾 {t("saveChanges")}
              </button>
            </div>
          </>
        );

      case "reset":
        return (
          <>
            <p className="settings-hint">{t("resetHint")}</p>
            <p className="settings-hint" style={{ color: "#e53e3e", fontWeight: 600 }}>{t("backupWarning")}</p>
            <div className="settings-actions">
              <button className="btn danger" onClick={async () => {
                if (!window.confirm(t("confirmResetAll"))) return;
                if (!window.confirm(t("confirmResetFinal"))) return;
                try { await api.resetSystem(); localStorage.removeItem("tabarak_activation"); notify(t("systemResetSuccess")); window.location.reload(); } catch (err) { notify(String(err), "error"); }
              }}>{t("deleteAllDataBtn")}</button>
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
                    <span className="account-perms">{a.permissions.length} {t("permCount")} | {a.visibleMenus.length} {t("menuCount")}</span>
                  </div>
                  <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); deleteAccount(a.id); }} disabled={accounts.length <= 1}>{t("delete")}</button>
                </div>
              ))}
            </div>
            <form onSubmit={saveAccount} className="account-form">
              <h4>{editingAccount ? t("editAccountTitle") : t("newAccount")}</h4>
              <Field label={t("accountNameLabel")}><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("accountNamePlaceholder")} /></Field>
              <Field label={t("password")}><input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t("password")} /></Field>

              <Field label={t("visibleMenus")}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_MENUS.map((m) => (
                    <label key={m.key} className="checkbox-label" style={{ background: selectedMenus.includes(m.key) ? "#eef2ff" : "#f9fafb", border: `1px solid ${selectedMenus.includes(m.key) ? "#6366f1" : "#e5e7eb"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                      <input type="checkbox" checked={selectedMenus.includes(m.key)} onChange={(e) => { if (e.target.checked) setSelectedMenus([...selectedMenus, m.key]); else setSelectedMenus(selectedMenus.filter((x) => x !== m.key)); }} style={{ display: "none" }} />
                      <span>{m.icon}</span>
                      <span>{t(m.label)}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {permGroups.map((group) => (
                <Field key={group} label={`${t("permissionsLabel")} — ${t(group)}`}>
                  <div className="checkboxes-grid">
                    {ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => (
                      <label key={p.key} className="checkbox-label">
                        <input type="checkbox" checked={selectedPerms.includes(p.key)} onChange={(e) => { if (e.target.checked) setSelectedPerms([...selectedPerms, p.key]); else setSelectedPerms(selectedPerms.filter((x) => x !== p.key)); }} />
                        {t(p.label)}
                      </label>
                    ))}
                  </div>
                </Field>
              ))}

              <div className="form-actions">
                <button type="submit" className="btn primary">{editingAccount ? t("saveChanges") : t("createAccountBtn")}</button>
                {editingAccount && <button type="button" className="btn" onClick={startNewAccount}>{t("cancel")}</button>}
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
        <h1>{t("settings")}</h1>
      </div>

      <div className="settings-cards-grid">
        {SECTIONS.filter((s) => {
          if (s.key === "sync" && !features.sync) return false;
          if (s.key === "branches" && !features.branches) return false;
          if (s.key === "attendance_url" && !features.attendance_url) return false;
          if (s.key === "notifications" && !features.notifications) return false;
          return true;
        }).map((s) => (
          <div key={s.key} className="settings-tile" style={{ background: s.gradient }} onClick={() => openSection(s.key)}>
            <div className="settings-tile-icon">{s.icon}</div>
            <div className="settings-tile-title">{t(s.title)}</div>
            {s.locked && <div className="settings-tile-lock">🔒</div>}
          </div>
        ))}
      </div>

      {activeSection && activeMeta && (
        <div className="settings-modal-overlay" onClick={() => setActiveSection(null)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header" style={{ background: activeMeta.gradient }}>
              <span className="settings-modal-icon">{activeMeta.icon}</span>
              <h2>{t(activeMeta.title)}</h2>
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
              <h2>{t("enterAccessCode")}</h2>
              <button className="settings-modal-close" onClick={() => setPassModal(null)}>✕</button>
            </div>
            <div className="settings-modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <p style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>{t("accessTo")} "{t(SECTIONS.find((x) => x.key === passModal.section)?.title || "")}"</p>
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
                <button className="btn primary" onClick={verifyPass}>{t("confirm")}</button>
                <button className="btn" onClick={() => setPassModal(null)}>{t("cancel")}</button>
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
              <h2>{t("featuresTitle")}</h2>
              <button className="settings-modal-close" onClick={() => { setShowFeatures(false); setFeaturesPassOk(false); }}>✕</button>
            </div>
            <div className="settings-modal-body">
              {!featuresPassOk ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ marginBottom: 16, fontSize: 14, color: "#6b7280" }}>{t("enterPasswordForFeatures")}</p>
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
                    <button className="btn primary" onClick={verifyFeaturesPass}>{t("confirm")}</button>
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
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("maintenanceItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("maintenanceItemDesc")}</div>
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
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("attendanceItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("attendanceItemDesc")}</div>
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

                  {/* Dark Mode toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.dark_mode ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.dark_mode ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🌙</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("darkModeItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("darkModeItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("dark_mode")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.dark_mode ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.dark_mode ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Language toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.language ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.language ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🌐</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("languageItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("languageItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("language")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.language ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.language ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Sync toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.sync ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.sync ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>☁️</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("syncItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("syncItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("sync")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.sync ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.sync ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Branches toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.branches ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.branches ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🏬</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("branchesItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("branchesItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("branches")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.branches ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.branches ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Attendance URL toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.attendance_url ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.attendance_url ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>📍</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("attendanceUrlItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("attendanceUrlItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("attendance_url")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.attendance_url ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.attendance_url ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Notifications toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.notifications ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.notifications ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🔔</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("notificationsItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("notificationsItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("notifications")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.notifications ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.notifications ? 24 : 2,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  {/* Cash Register toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: features.cash_register ? "#ecfdf5" : "#f9fafb",
                      border: `1px solid ${features.cash_register ? "#86efac" : "#e5e7eb"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🏧</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t("cashRegisterItem")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t("cashRegisterItemDesc")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature("cash_register")}
                      style={{
                        width: 50,
                        height: 28,
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        background: features.cash_register ? "#10b981" : "#d1d5db",
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: features.cash_register ? 24 : 2,
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
                    {t("pressF10Hint")}
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
