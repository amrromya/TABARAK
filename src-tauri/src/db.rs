use rusqlite::{Connection, params};
use std::fs;
use tauri::{App, Manager};

pub fn init_db(app: &App) -> Result<Connection, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("فشل الحصول على مسار البيانات: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("فشل إنشاء مجلد البيانات: {e}"))?;
    let db_path = dir.join("tabarak.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("فشل فتح قاعدة البيانات: {e}"))?;
    migrate(&conn)?;
    Ok(conn)
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), String> {
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let exists = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .iter()
        .any(|n| n == column);
    if !exists {
        let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}");
        conn.execute(&sql, []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_default INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
            unit TEXT,
            cost_price REAL NOT NULL DEFAULT 0,
            sell_price REAL NOT NULL DEFAULT 0,
            quantity REAL NOT NULL DEFAULT 0,
            min_quantity REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            credit_limit REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT NOT NULL,
            date TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            additional REAL NOT NULL DEFAULT 0,
            net_total REAL NOT NULL DEFAULT 0,
            warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
            customer_name TEXT,
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity REAL NOT NULL,
            sell_price REAL NOT NULL,
            cost_price REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            date TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            additional REAL NOT NULL DEFAULT 0,
            warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity REAL NOT NULL,
            cost_price REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS customer_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS stock_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            total_difference REAL NOT NULL DEFAULT 0,
            total_surplus REAL NOT NULL DEFAULT 0,
            total_deficit REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS stock_count_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            system_qty REAL NOT NULL DEFAULT 0,
            counted_qty REAL NOT NULL DEFAULT 0,
            difference REAL NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
        CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_payments_customer ON customer_payments(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
        CREATE INDEX IF NOT EXISTS idx_count_items_count ON stock_count_items(count_id);

        CREATE TABLE IF NOT EXISTS sale_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT NOT NULL,
            date TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            additional REAL NOT NULL DEFAULT 0,
            warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
            customer_name TEXT,
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS sale_return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity REAL NOT NULL,
            sell_price REAL NOT NULL,
            cost_price REAL NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_sale_returns_date ON sale_returns(date);
        CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(return_id);

        CREATE TABLE IF NOT EXISTS purchase_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            invoice_no TEXT NOT NULL,
            date TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            additional REAL NOT NULL DEFAULT 0,
            warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
            supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS purchase_return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity REAL NOT NULL,
            cost_price REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(return_id);

        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            position TEXT,
            salary REAL NOT NULL DEFAULT 0,
            hire_date TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS salaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS vacations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            days INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'annual',
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            check_in TEXT,
            check_out TEXT,
            type TEXT NOT NULL DEFAULT 'manual',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            grace_minutes INTEGER NOT NULL DEFAULT 15,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS employee_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
            effective_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salaries(employee_id);
        CREATE INDEX IF NOT EXISTS idx_vacations_employee ON vacations(employee_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
        CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
        CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON employee_shifts(effective_date);
        ",
    )
    .map_err(|e| format!("فشل إنشاء الجداول: {e}"))?;

    ensure_column(
        conn,
        "sales",
        "customer_id",
        "INTEGER REFERENCES customers(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "sales",
        "payment_method",
        "TEXT NOT NULL DEFAULT 'cash'",
    )?;
    ensure_column(
        conn,
        "sales",
        "additional",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "sales",
        "warehouse_id",
        "INTEGER REFERENCES warehouses(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "purchases",
        "discount",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "purchases",
        "additional",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "purchases",
        "warehouse_id",
        "INTEGER REFERENCES warehouses(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "sales",
        "employee_id",
        "INTEGER REFERENCES employees(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "purchases",
        "employee_id",
        "INTEGER REFERENCES employees(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "products",
        "warehouse_id",
        "INTEGER REFERENCES warehouses(id) ON DELETE SET NULL",
    )?;
    ensure_column(
        conn,
        "products",
        "opening_balance",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "warehouses",
        "is_default",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "stock_counts",
        "total_surplus",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        conn,
        "stock_counts",
        "total_deficit",
        "REAL NOT NULL DEFAULT 0",
    )?;
    ensure_column(conn, "suppliers", "address", "TEXT")?;
    ensure_column(conn, "suppliers", "credit_limit", "REAL DEFAULT 0")?;

    // إنشاء موظف افتراضي "المدير العام" إذا لم يكن موجودًا
    conn.execute(
        "INSERT OR IGNORE INTO employees (id, name, position, salary) VALUES (1, 'المدير العام', 'المدير العام', 0)",
        [],
    )
    .map_err(|e| format!("فشل إنشاء الموظف الافتراضي: {e}"))?;

    conn.execute_batch(
        "UPDATE stock_counts SET
            total_surplus = (SELECT COALESCE(SUM(CASE WHEN difference > 0 THEN difference ELSE 0 END), 0)
                             FROM stock_count_items WHERE count_id = stock_counts.id),
            total_deficit = (SELECT COALESCE(SUM(CASE WHEN difference < 0 THEN -difference ELSE 0 END), 0)
                             FROM stock_count_items WHERE count_id = stock_counts.id),
            total_difference = (SELECT COALESCE(SUM(difference), 0)
                                FROM stock_count_items WHERE count_id = stock_counts.id);",
    )
    .map_err(|e| format!("فشل تحديث مجاميع الجرد: {e}"))?;

    // ==================== وحدة الصيانة ====================
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS service_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT NOT NULL UNIQUE,
            customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            device_type TEXT NOT NULL DEFAULT 'Other',
            device_brand TEXT,
            device_model TEXT,
            serial_number TEXT,
            imei TEXT,
            device_color TEXT,
            device_condition TEXT,
            accessories TEXT,
            device_password TEXT,
            customer_complaint TEXT,
            diagnosis TEXT,
            repair_action TEXT,
            technician_notes TEXT,
            status TEXT NOT NULL DEFAULT 'received',
            parts_cost REAL NOT NULL DEFAULT 0,
            labor_cost REAL NOT NULL DEFAULT 0,
            service_cost REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            tax_rate REAL NOT NULL DEFAULT 0,
            total_cost REAL NOT NULL DEFAULT 0,
            amount_paid REAL NOT NULL DEFAULT 0,
            customer_approval TEXT NOT NULL DEFAULT 'pending',
            approval_date TEXT,
            approval_price REAL,
            approval_notes TEXT,
            warranty_days INTEGER NOT NULL DEFAULT 0,
            warranty_start TEXT,
            warranty_end TEXT,
            original_order_id INTEGER REFERENCES service_orders(id),
            delivered_to TEXT,
            delivered_phone TEXT,
            delivered_date TEXT,
            delivered_time TEXT,
            payment_method TEXT,
            received_by INTEGER,
            delivered_by INTEGER,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            old_status TEXT,
            new_status TEXT NOT NULL,
            changed_by INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            image_path TEXT NOT NULL,
            image_type TEXT NOT NULL DEFAULT 'general',
            description TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            technician_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            work_type TEXT,
            start_time TEXT,
            end_time TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            item_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ok',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            part_name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 1,
            cost_price REAL NOT NULL DEFAULT 0,
            sell_price REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            date TEXT NOT NULL,
            notes TEXT,
            received_by INTEGER,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            note TEXT NOT NULL,
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS service_order_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            user_name TEXT,
            details TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS device_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            checklist_template TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS device_brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS maintenance_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS receipt_vouchers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voucher_no TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            source_type TEXT NOT NULL DEFAULT 'customer',
            source_id INTEGER,
            source_name TEXT,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            warehouse_id INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS payment_vouchers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voucher_no TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            dest_type TEXT NOT NULL DEFAULT 'supplier',
            dest_id INTEGER,
            dest_name TEXT,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            warehouse_id INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS warehouse_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transfer_no TEXT NOT NULL,
            date TEXT NOT NULL,
            from_warehouse_id INTEGER NOT NULL,
            to_warehouse_id INTEGER NOT NULL,
            transfer_type TEXT NOT NULL DEFAULT 'products',
            amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transfer_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            cost_price REAL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_so_order_no ON service_orders(order_no);
        CREATE INDEX IF NOT EXISTS idx_so_status ON service_orders(status);
        CREATE INDEX IF NOT EXISTS idx_so_customer ON service_orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_so_date ON service_orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_so_serial ON service_orders(serial_number);
        CREATE INDEX IF NOT EXISTS idx_so_imei ON service_orders(imei);
        CREATE INDEX IF NOT EXISTS idx_so_history_order ON service_order_status_history(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_images_order ON service_order_images(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_tech_order ON service_order_technicians(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_parts_order ON service_order_parts(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_payments_order ON service_order_payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_notes_order ON service_order_notes(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_log_order ON service_order_audit_log(order_id);
        ",
    )
    .map_err(|e| format!("فشل إنشاء جداول الصيانة: {e}"))?;

    // إدراج أنواع الأجهزة الافتراضية
    let default_types = [
        "Desktop", "Laptop", "Mobile", "Tablet", "Monitor", "Printer",
        "Router", "Switch", "DVR", "NVR", "Camera", "Gaming Console", "TV", "Other",
    ];
    for dt in &default_types {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO device_types (name) VALUES (?1)",
            params![dt],
        );
    }

    // إدراج ماركات افتراضية
    let default_brands = [
        "Apple", "Samsung", "HP", "Dell", "Lenovo", "Asus", "Acer",
        "Sony", "Huawei", "Xiaomi", "LG", "Canon", "Epson", "Cisco", "Other",
    ];
    for b in &default_brands {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO device_brands (name) VALUES (?1)",
            params![b],
        );
    }

    // إعدادات الصيانة الافتراضية
    let default_settings = [
        ("next_order_number", "1"),
        ("late_days", "7"),
        ("sticker_width", "70"),
        ("sticker_height", "100"),
        ("receipt_footer", "شكراً لثقتكم بنا - صيانة تبارك"),
        ("agreement_text", "أقر أنا المستلم باستلام الجهاز المذكور أعلاه بحالته المذكورة."),
    ];
    for (k, v) in &default_settings {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO maintenance_settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        );
    }

    // ==================== نهاية الصيانة ====================

    // إضافة أعمدة المزامنة
    crate::sync::schema::add_sync_columns(conn)?;

    Ok(())
}

pub fn money(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
