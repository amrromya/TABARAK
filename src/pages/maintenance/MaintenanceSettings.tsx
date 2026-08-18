import { useEffect, useState } from "react";
import { api } from "../../api";
import { Field, confirmDialog, useToast } from "../../components/ui";
import type { DeviceType, DeviceBrand, MaintenanceSettings as MaintenanceSettingsType } from "../../types";

const MAINTENANCE_PERMISSIONS: { key: string; label: string }[] = [
  { key: "maintenance.view", label: "عرض أورдерات الصيانة" },
  { key: "maintenance.create", label: "إنشاء أوردر صيانة" },
  { key: "maintenance.edit", label: "تعديل أوردر صيانة" },
  { key: "maintenance.delete", label: "حذف أوردر صيانة" },
  { key: "maintenance.receive", label: "استلام جهاز صيانة" },
  { key: "maintenance.diagnose", label: "تشخيص العطل" },
  { key: "maintenance.assign", label: "إسناد لأحد الفنيين" },
  { key: "maintenance.parts", label: "إضافة قطع غيار" },
  { key: "maintenance.approve", label: "موافقة العميل" },
  { key: "maintenance.deliver", label: "تسليم الجهاز" },
  { key: "maintenance.reports", label: "تقارير الصيانة" },
  { key: "maintenance.financial", label: "البيانات المالية للصيانة" },
  { key: "maintenance.settings", label: "إعدادات الصيانة" },
];

export function MaintenanceSettings() {
  const notify = useToast();

  // Section 1 - General Settings
  const [settings, setSettings] = useState<MaintenanceSettingsType>({
    next_order_number: "1001",
    late_days: "7",
    sticker_width: "50",
    sticker_height: "30",
    receipt_footer: "",
    agreement_text: "",
  });

  // Section 2 - Device Types
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [newDeviceType, setNewDeviceType] = useState("");

  // Section 3 - Brands
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [newBrand, setNewBrand] = useState("");

  // Section 4 - Checklist Templates
  const [templateDeviceType, setTemplateDeviceType] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [s, dt, br] = await Promise.all([
        api.getMaintenanceSettings(),
        api.getDeviceTypes(),
        api.getDeviceBrands(),
      ]);
      setSettings(s);
      setDeviceTypes(dt);
      setBrands(br);
    } catch (err) {
      notify(String(err), "error");
    }
  }

  // ---- General Settings ----
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveMaintenanceSettings(settings);
      notify("تم حفظ الإعدادات");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  // ---- Device Types ----
  const addDeviceType = async () => {
    const name = newDeviceType.trim();
    if (!name) return;
    try {
      const created = await api.createDeviceType(name);
      setDeviceTypes([...deviceTypes, created]);
      setNewDeviceType("");
      notify("تم إضافة نوع الجهاز");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const deleteDeviceType = async (id: number) => {
    if (!confirmDialog("هل أنت متأكد من حذف نوع الجهاز؟")) return;
    try {
      await api.deleteDeviceType(id);
      setDeviceTypes(deviceTypes.filter((d) => d.id !== id));
      notify("تم حذف نوع الجهاز");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  // ---- Brands ----
  const addBrand = async () => {
    const name = newBrand.trim();
    if (!name) return;
    try {
      const created = await api.createDeviceBrand(name);
      setBrands([...brands, created]);
      setNewBrand("");
      notify("تم إضافة الماركة");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const deleteBrand = async (id: number) => {
    if (!confirmDialog("هل أنت متأكد من حذف الماركة؟")) return;
    try {
      await api.deleteDeviceBrand(id);
      setBrands(brands.filter((b) => b.id !== id));
      notify("تم حذف الماركة");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  // ---- Checklist Templates ----
  const loadTemplate = async (deviceType: string) => {
    setTemplateDeviceType(deviceType);
    if (!deviceType) {
      setChecklistItems([]);
      return;
    }
    try {
      const items = await api.getChecklistTemplate(deviceType);
      setChecklistItems(items);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveTemplate = async () => {
    if (!templateDeviceType) return;
    try {
      await api.saveChecklistTemplate(templateDeviceType, checklistItems);
      notify("تم حفظ القالب");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const addChecklistItem = () => {
    const name = newChecklistItem.trim();
    if (!name) return;
    setChecklistItems([...checklistItems, name]);
    setNewChecklistItem("");
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>إعدادات الصيانة</h1>
      </div>

      {/* ===== Section 1: General Settings ===== */}
      <div className="settings-card">
        <h3>إعدادات الصيانة العامة</h3>
        <form onSubmit={saveSettings} className="form-grid">
          <Field label="رقم الأوردر التالي">
            <input value={settings.next_order_number} readOnly disabled />
          </Field>
          <Field label="عدد أيام التأخير">
            <input
              type="number"
              value={settings.late_days}
              onChange={(e) =>
                setSettings({ ...settings, late_days: e.target.value })
              }
            />
          </Field>
          <Field label="عرض الملصق (مم)">
            <input
              type="number"
              value={settings.sticker_width}
              onChange={(e) =>
                setSettings({ ...settings, sticker_width: e.target.value })
              }
            />
          </Field>
          <Field label="ارتفاع الملصق (مم)">
            <input
              type="number"
              value={settings.sticker_height}
              onChange={(e) =>
                setSettings({ ...settings, sticker_height: e.target.value })
              }
            />
          </Field>
          <Field label="تذييل الإيصال">
            <textarea
              value={settings.receipt_footer}
              onChange={(e) =>
                setSettings({ ...settings, receipt_footer: e.target.value })
              }
              placeholder="شكرًا لثقتكم بنا"
              rows={3}
            />
          </Field>
          <Field label="نص اتفاقية الصيانة">
            <textarea
              value={settings.agreement_text}
              onChange={(e) =>
                setSettings({ ...settings, agreement_text: e.target.value })
              }
              placeholder="نص الاتفاقية..."
              rows={5}
            />
          </Field>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </div>

      {/* ===== Section 2: Device Types ===== */}
      <div className="settings-card">
        <h3>أنواع الأجهزة</h3>
        <div className="wh-row">
          <input
            value={newDeviceType}
            placeholder="اسم نوع الجهاز..."
            onChange={(e) => setNewDeviceType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addDeviceType();
            }}
          />
          <button className="btn primary" onClick={addDeviceType}>
            + إضافة
          </button>
        </div>
        <div className="wh-list">
          {deviceTypes.length === 0 && (
            <p className="settings-note">لا توجد أنواع أجهزة بعد.</p>
          )}
          {deviceTypes.map((dt) => (
            <div key={dt.id} className="wh-item">
              <span>{dt.name}</span>
              <button
                className="btn sm danger"
                onClick={() => deleteDeviceType(dt.id)}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section 3: Brands ===== */}
      <div className="settings-card">
        <h3>الماركات</h3>
        <div className="wh-row">
          <input
            value={newBrand}
            placeholder="اسم الماركة..."
            onChange={(e) => setNewBrand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addBrand();
            }}
          />
          <button className="btn primary" onClick={addBrand}>
            + إضافة
          </button>
        </div>
        <div className="wh-list">
          {brands.length === 0 && (
            <p className="settings-note">لا توجد ماركات بعد.</p>
          )}
          {brands.map((b) => (
            <div key={b.id} className="wh-item">
              <span>{b.name}</span>
              <button
                className="btn sm danger"
                onClick={() => deleteBrand(b.id)}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section 4: Checklist Templates ===== */}
      <div className="settings-card">
        <h3>قوالب الفحص</h3>
        <div className="wh-row">
          <Field label="نوع الجهاز">
            <select
              value={templateDeviceType}
              onChange={(e) => loadTemplate(e.target.value)}
            >
              <option value="">اختر نوع الجهاز...</option>
              {deviceTypes.map((dt) => (
                <option key={dt.id} value={dt.name}>
                  {dt.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {templateDeviceType && (
          <>
            <div className="wh-row">
              <input
                value={newChecklistItem}
                placeholder="عنصر الفحص..."
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addChecklistItem();
                }}
              />
              <button className="btn primary" onClick={addChecklistItem}>
                + إضافة
              </button>
            </div>
            <div className="wh-list">
              {checklistItems.length === 0 && (
                <p className="settings-note">لا توجد عناصر فحص.</p>
              )}
              {checklistItems.map((item, i) => (
                <div key={i} className="wh-item">
                  <span>{item}</span>
                  <button
                    className="btn sm danger"
                    onClick={() => removeChecklistItem(i)}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={saveTemplate}>
                حفظ القالب
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Section 5: Permissions ===== */}
      <div className="settings-card">
        <h3>الصلاحيات</h3>
        <p className="settings-hint">
          الصلاحيات المخصصة لوحدة الصيانة (للتعرض فقط).
        </p>
        <div className="wh-list">
          {MAINTENANCE_PERMISSIONS.map((p) => (
            <div key={p.key} className="wh-item">
              <span>{p.label}</span>
              <span className="settings-note" style={{ fontSize: "0.85em" }}>
                {p.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
