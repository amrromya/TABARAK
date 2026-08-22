interface Props {
  onNavigate: (page: string) => void;
  onBack: () => void;
}

export function MaintenanceHome({ onNavigate, onBack }: Props) {
  return (
    <div className="page">
      <div className="page-head">
        <button className="btn sm" onClick={onBack}>→ رجوع</button>
        <h1>🔧 الصيانة</h1>
      </div>
      <div className="maintenance-grid">
        <button className="maintenance-card mc-dashboard" onClick={() => onNavigate("maint_dashboard")}>
          <div className="mc-icon-wrap">📊</div>
          <div className="mc-info">
            <span className="mc-title">لوحة تحكم الصيانة</span>
            <span className="mc-desc">نظرة عامة على حالة الطلبات</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-new" onClick={() => onNavigate("maint_new")}>
          <div className="mc-icon-wrap">➕</div>
          <div className="mc-info">
            <span className="mc-title">أمر صيانة جديد</span>
            <span className="mc-desc">إنشاء طلب صيانة جديد</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-orders" onClick={() => onNavigate("maint_orders")}>
          <div className="mc-icon-wrap">📋</div>
          <div className="mc-info">
            <span className="mc-title">أوامر الصيانة</span>
            <span className="mc-desc">قائمة جميع أوامر الصيانة</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-customers" onClick={() => onNavigate("maint_customers")}>
          <div className="mc-icon-wrap">🤝</div>
          <div className="mc-info">
            <span className="mc-title">عملاء الصيانة</span>
            <span className="mc-desc">إدارة عملاء الصيانة</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-techs" onClick={() => onNavigate("maint_techs")}>
          <div className="mc-icon-wrap">👥</div>
          <div className="mc-info">
            <span className="mc-title">موظفو الصيانة</span>
            <span className="mc-desc">إدارة الفنيين وحملات العمل</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-reports" onClick={() => onNavigate("maint_reports")}>
          <div className="mc-icon-wrap">📈</div>
          <div className="mc-info">
            <span className="mc-title">تقارير الصيانة</span>
            <span className="mc-desc">إحصائيات وتقارير الصيانة</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
        <button className="maintenance-card mc-settings" onClick={() => onNavigate("maint_settings")}>
          <div className="mc-icon-wrap">⚙️</div>
          <div className="mc-info">
            <span className="mc-title">إعدادات الصيانة</span>
            <span className="mc-desc">ضبط إعدادات نظام الصيانة</span>
          </div>
          <span className="mc-arrow">←</span>
        </button>
      </div>
    </div>
  );
}
