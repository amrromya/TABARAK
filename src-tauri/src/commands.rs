use crate::models::*;
use crate::AppState;
use rusqlite::backup::Backup;
use rusqlite::{params, Connection, OpenFlags};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

fn lock(conn: &Mutex<Connection>) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
    conn.lock().map_err(|e| e.to_string())
}

fn get_db<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    lock(&state.db)
}

// =============== التصنيفات ===============

#[tauri::command]
pub fn list_categories(state: State<AppState>) -> Result<Vec<Category>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM categories ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(state: State<AppState>, input: NewCategory) -> Result<Category, String> {
    let conn = get_db(&state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("اسم التصنيف مطلوب".into());
    }
    conn.execute("INSERT INTO categories (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Category { id, name })
}

#[tauri::command]
pub fn delete_category(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== المستودعات ===============

fn query_warehouses(conn: &Connection) -> Result<Vec<Warehouse>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, is_default FROM warehouses
             ORDER BY is_default DESC, name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Warehouse {
                id: r.get(0)?,
                name: r.get(1)?,
                is_default: r.get::<_, i64>(2)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_warehouses(state: State<AppState>) -> Result<Vec<Warehouse>, String> {
    let conn = get_db(&state)?;
    query_warehouses(&conn)
}

#[tauri::command]
pub fn create_warehouse(state: State<AppState>, name: String) -> Result<Warehouse, String> {
    let conn = get_db(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("اسم المستودع مطلوب".into());
    }
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM warehouses", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let is_default = if count == 0 { 1 } else { 0 };
    conn.execute(
        "INSERT INTO warehouses (name, is_default) VALUES (?1, ?2)",
        params![name, is_default],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Warehouse {
        id,
        name,
        is_default: is_default == 1,
    })
}

#[tauri::command]
pub fn update_warehouse(state: State<AppState>, id: i64, name: String) -> Result<Warehouse, String> {
    let conn = get_db(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("اسم المستودع مطلوب".into());
    }
    conn.execute(
        "UPDATE warehouses SET name = ?1 WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    let is_default: i64 = conn
        .query_row(
            "SELECT is_default FROM warehouses WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(Warehouse {
        id,
        name,
        is_default: is_default != 0,
    })
}

#[tauri::command]
pub fn set_default_warehouse(state: State<AppState>, id: i64) -> Result<Vec<Warehouse>, String> {
    {
        let conn = get_db(&state)?;
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        tx.execute("UPDATE warehouses SET is_default = 0", [])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE warehouses SET is_default = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    list_warehouses(state)
}

#[tauri::command]
pub fn copy_sound_file(source_path: String) -> Result<String, String> {
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp3");
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("tabarak")
        .join("sounds");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("notif.{}", ext));
    fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_warehouse(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE products SET warehouse_id = NULL WHERE warehouse_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM warehouses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let remaining: i64 = tx
        .query_row("SELECT COUNT(*) FROM warehouses", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if remaining > 0 {
        let any_default: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM warehouses WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if any_default == 0 {
            tx.execute(
                "UPDATE warehouses SET is_default = 1
                 WHERE id = (SELECT MIN(id) FROM warehouses)",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_warehouse_cash_balances(
    state: State<AppState>,
) -> Result<Vec<WarehouseCashBalance>, String> {
    let conn = get_db(&state)?;

    let warehouses: Vec<(i64, String)> = conn
        .prepare("SELECT id, name FROM warehouses ORDER BY name")
        .map_err(|e| e.to_string())?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut result = Vec::new();

    for (wh_id, wh_name) in warehouses {
        let sales_cash: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(net_total), 0) FROM sales
                 WHERE warehouse_id = ?1 AND payment_method != 'credit'",
                params![wh_id],
                |r| r.get(0),
            )
            .unwrap_or(0.0);

        let receipts: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM receipt_vouchers
                 WHERE warehouse_id = ?1",
                params![wh_id],
                |r| r.get(0),
            )
            .unwrap_or(0.0);

        let purchases: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(total), 0) FROM purchases
                 WHERE warehouse_id = ?1",
                params![wh_id],
                |r| r.get(0),
            )
            .unwrap_or(0.0);

        let payments: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM payment_vouchers
                 WHERE warehouse_id = ?1",
                params![wh_id],
                |r| r.get(0),
            )
            .unwrap_or(0.0);

        let cash_in = sales_cash + receipts;
        let cash_out = purchases + payments;
        let balance = cash_in - cash_out;

        result.push(WarehouseCashBalance {
            warehouse_id: wh_id,
            warehouse_name: wh_name,
            cash_in: crate::db::money(cash_in),
            cash_out: crate::db::money(cash_out),
            balance: crate::db::money(balance),
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn warehouse_stats(state: State<AppState>, id: i64) -> Result<WarehouseStats, String> {
    let conn = get_db(&state)?;
    let (quantity, value): (Option<f64>, Option<f64>) = conn
        .query_row(
            "SELECT SUM(quantity), SUM(quantity * cost_price)
             FROM products WHERE warehouse_id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    Ok(WarehouseStats {
        quantity: crate::db::money(quantity.unwrap_or(0.0)),
        value: crate::db::money(value.unwrap_or(0.0)),
    })
}

// =============== المنتجات ===============

#[tauri::command]
pub fn list_products(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Product>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT p.id, p.name, p.barcode, p.category_id, c.name, p.warehouse_id, w.name, p.unit,
               p.cost_price, p.sell_price, p.quantity, p.min_quantity, p.opening_balance
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        WHERE (?1 IS NULL OR p.name LIKE '%' || ?1 || '%' OR p.barcode LIKE '%' || ?1 || '%')
        ORDER BY p.name COLLATE NOCASE";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(Product {
                id: r.get(0)?,
                name: r.get(1)?,
                barcode: r.get(2)?,
                category_id: r.get(3)?,
                category_name: r.get(4)?,
                warehouse_id: r.get(5)?,
                warehouse_name: r.get(6)?,
                unit: r.get(7)?,
                cost_price: r.get(8)?,
                sell_price: r.get(9)?,
                quantity: r.get(10)?,
                min_quantity: r.get(11)?,
                opening_balance: r.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn next_barcode_value(conn: &Connection) -> Result<String, String> {
    let max: Option<i64> = conn
        .query_row(
            "SELECT MAX(CAST(barcode AS INTEGER))
             FROM products
             WHERE barcode IS NOT NULL
               AND barcode <> ''
               AND barcode GLOB '[0-9]*'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok((max.unwrap_or(0) + 1).to_string())
}

#[tauri::command]
pub fn next_barcode(state: State<AppState>) -> Result<String, String> {
    let conn = get_db(&state)?;
    next_barcode_value(&conn)
}

#[tauri::command]
pub fn create_product(state: State<AppState>, input: NewProduct) -> Result<Product, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم المنتج مطلوب".into());
    }
    let barcode = match &input.barcode {
        Some(b) if !b.trim().is_empty() => input.barcode.clone(),
        _ => Some(next_barcode_value(&conn)?),
    };
    conn.execute(
        "INSERT INTO products (name, barcode, category_id, warehouse_id, unit, cost_price, sell_price, quantity, min_quantity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.name.trim(),
            barcode,
            input.category_id,
            input.warehouse_id,
            input.unit,
            input.cost_price,
            input.sell_price,
            input.quantity,
            input.min_quantity
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    get_product(&conn, id)
}

#[tauri::command]
pub fn update_product(
    state: State<AppState>,
    id: i64,
    input: NewProduct,
) -> Result<Product, String> {
    let conn = get_db(&state)?;
    let barcode = match &input.barcode {
        Some(b) if !b.trim().is_empty() => input.barcode.clone(),
        _ => Some(next_barcode_value(&conn)?),
    };
    conn.execute(
        "UPDATE products SET name=?1, barcode=?2, category_id=?3, warehouse_id=?4, unit=?5,
         cost_price=?6, sell_price=?7, quantity=?8, min_quantity=?9 WHERE id=?10",
        params![
            input.name.trim(),
            barcode,
            input.category_id,
            input.warehouse_id,
            input.unit,
            input.cost_price,
            input.sell_price,
            input.quantity,
            input.min_quantity,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_product(&conn, id)
}

#[tauri::command]
pub fn delete_product(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM products WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn adjust_stock(state: State<AppState>, id: i64, quantity: f64) -> Result<Product, String> {
    let conn = get_db(&state)?;
    conn.execute(
        "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
        params![quantity, id],
    )
    .map_err(|e| e.to_string())?;
    get_product(&conn, id)
}

#[tauri::command]
pub fn set_opening_balances(
    state: State<AppState>,
    items: Vec<OpeningBalanceItem>,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    for item in &items {
        conn.execute(
            "UPDATE products SET opening_balance = ?1 WHERE id = ?2",
            params![item.opening_balance, item.product_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_opening_balance_summary(
    state: State<AppState>,
) -> Result<(i64, f64, f64), String> {
    let conn = get_db(&state)?;
    let row = conn.query_row(
        "SELECT COUNT(*),
                COALESCE(SUM(opening_balance), 0),
                COALESCE(SUM(opening_balance * cost_price), 0)
         FROM products",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(1)?)),
    );
    match row {
        Ok(r) => Ok(r),
        Err(_) => Ok((0, 0.0, 0.0)),
    }
}

fn get_product(conn: &Connection, id: i64) -> Result<Product, String> {
    conn.query_row(
        "SELECT p.id, p.name, p.barcode, p.category_id, c.name, p.warehouse_id, w.name, p.unit,
                p.cost_price, p.sell_price, p.quantity, p.min_quantity, p.opening_balance
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         WHERE p.id = ?1",
        params![id],
        |r| {
            Ok(Product {
                id: r.get(0)?,
                name: r.get(1)?,
                barcode: r.get(2)?,
                category_id: r.get(3)?,
                category_name: r.get(4)?,
                warehouse_id: r.get(5)?,
                warehouse_name: r.get(6)?,
                unit: r.get(7)?,
                cost_price: r.get(8)?,
                sell_price: r.get(9)?,
                quantity: r.get(10)?,
                min_quantity: r.get(11)?,
                opening_balance: r.get(12)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_product_movements(
    state: State<AppState>,
    product_id: i64,
) -> Result<Vec<ProductMovement>, String> {
    let conn = get_db(&state)?;
    let mut movements: Vec<ProductMovement> = Vec::new();

    let mut add_movements = |sql: &str| -> Result<(), String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![product_id], |r| {
                Ok(ProductMovement {
                    id: r.get(0)?,
                    date: r.get(1)?,
                    r#type: r.get(2)?,
                    reference: r.get(3)?,
                    description: r.get(4)?,
                    quantity: r.get(5)?,
                    price: r.get(6)?,
                    total: r.get(7)?,
                    related_id: r.get(8)?,
                    customer_name: r.get(9)?,
                    supplier_name: r.get(10)?,
                    warehouse_name: r.get(11)?,
                    payment_method: r.get(12)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            movements.push(row.map_err(|e| e.to_string())?);
        }
        Ok(())
    };

    add_movements(
        "SELECT si.id, s.date, 'sale', s.invoice_no, 'فاتورة بيع', -si.quantity, si.sell_price, (si.quantity * si.sell_price), s.id, s.customer_name, NULL, w.name, s.payment_method
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN warehouses w ON w.id = s.warehouse_id
         WHERE si.product_id = ?1",
    )?;

    add_movements(
        "SELECT pi.id, p.date, 'purchase', 'P-' || p.id, 'مشتريات', pi.quantity, pi.cost_price, (pi.quantity * pi.cost_price), p.id, NULL, s.name, w.name, NULL
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         WHERE pi.product_id = ?1",
    )?;

    add_movements(
        "SELECT sri.id, sr.date, 'sale_return', sr.invoice_no, 'مردود مبيعات', sri.quantity, sri.sell_price, (sri.quantity * sri.sell_price), sr.id, sr.customer_name, NULL, NULL, sr.payment_method
         FROM sale_return_items sri
         JOIN sale_returns sr ON sr.id = sri.return_id
         WHERE sri.product_id = ?1",
    )?;

    add_movements(
        "SELECT pri.id, pr.date, 'purchase_return', pr.invoice_no, 'مردود مشتريات', -pri.quantity, pri.cost_price, (pri.quantity * pri.cost_price), pr.id, NULL, s.name, w.name, NULL
         FROM purchase_return_items pri
         JOIN purchase_returns pr ON pr.id = pri.return_id
         LEFT JOIN suppliers s ON s.id = pr.supplier_id
         LEFT JOIN warehouses w ON w.id = pr.warehouse_id
         WHERE pri.product_id = ?1",
    )?;

    movements.sort_by(|a, b| b.date.cmp(&a.date).then(b.id.cmp(&a.id)));
    Ok(movements)
}

// =============== الموردون ===============

#[tauri::command]
pub fn list_suppliers(state: State<AppState>) -> Result<Vec<Supplier>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, phone, notes FROM suppliers ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Supplier {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                notes: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_supplier(state: State<AppState>, input: NewSupplier) -> Result<Supplier, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم المورد مطلوب".into());
    }
    conn.execute(
        "INSERT INTO suppliers (name, phone, notes) VALUES (?1, ?2, ?3)",
        params![input.name.trim(), input.phone, input.notes],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Supplier {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn delete_supplier(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM suppliers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== العملاء ===============

fn customer_balance_sql() -> &'static str {
    "SELECT c.id, c.name, c.phone, c.notes,
        (SELECT COALESCE(SUM(net_total),0) FROM sales
         WHERE customer_id = c.id AND payment_method = 'credit')
        - (SELECT COALESCE(SUM(amount),0) FROM customer_payments
           WHERE customer_id = c.id)
     FROM customers c"
}

#[tauri::command]
pub fn list_customers(state: State<AppState>) -> Result<Vec<Customer>, String> {
    let conn = get_db(&state)?;
    let sql = format!("{} ORDER BY c.name COLLATE NOCASE", customer_balance_sql());
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Customer {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                notes: r.get(3)?,
                balance: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_customer(state: State<AppState>, input: NewCustomer) -> Result<Customer, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم العميل مطلوب".into());
    }
    conn.execute(
        "INSERT INTO customers (name, phone, notes) VALUES (?1, ?2, ?3)",
        params![input.name.trim(), input.phone, input.notes],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Customer {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        notes: input.notes,
        balance: 0.0,
    })
}

#[tauri::command]
pub fn update_customer(
    state: State<AppState>,
    id: i64,
    input: NewCustomer,
) -> Result<Customer, String> {
    let conn = get_db(&state)?;
    conn.execute(
        "UPDATE customers SET name=?1, phone=?2, notes=?3 WHERE id=?4",
        params![input.name.trim(), input.phone, input.notes, id],
    )
    .map_err(|e| e.to_string())?;
    get_customer(&conn, id)
}

#[tauri::command]
pub fn delete_customer(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM customers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_customer(conn: &Connection, id: i64) -> Result<Customer, String> {
    let sql = format!("{} WHERE c.id = ?1", customer_balance_sql());
    conn.query_row(&sql, params![id], |r| {
        Ok(Customer {
            id: r.get(0)?,
            name: r.get(1)?,
            phone: r.get(2)?,
            notes: r.get(3)?,
            balance: r.get(4)?,
        })
    })
    .map_err(|e| e.to_string())
}

// =============== مدفوعات العملاء (تحصيل الديون) ===============

#[tauri::command]
pub fn list_customer_payments(
    state: State<AppState>,
    customer_id: Option<i64>,
) -> Result<Vec<CustomerPayment>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT p.id, p.customer_id, c.name, p.date, p.amount, p.notes
        FROM customer_payments p
        JOIN customers c ON c.id = p.customer_id
        WHERE (?1 IS NULL OR p.customer_id = ?1)
        ORDER BY p.id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![customer_id], |r| {
            Ok(CustomerPayment {
                id: r.get(0)?,
                customer_id: r.get(1)?,
                customer_name: r.get(2)?,
                date: r.get(3)?,
                amount: r.get(4)?,
                notes: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_customer_payment(
    state: State<AppState>,
    input: NewCustomerPayment,
) -> Result<CustomerPayment, String> {
    let conn = get_db(&state)?;
    if input.amount <= 0.0 {
        return Err("المبلغ يجب أن يكون أكبر من صفر".into());
    }
    conn.execute(
        "INSERT INTO customer_payments (customer_id, date, amount, notes) VALUES (?1, ?2, ?3, ?4)",
        params![input.customer_id, input.date, input.amount, input.notes],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let name: String = conn
        .query_row(
            "SELECT name FROM customers WHERE id = ?1",
            params![input.customer_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(CustomerPayment {
        id,
        customer_id: input.customer_id,
        customer_name: name,
        date: input.date,
        amount: input.amount,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn delete_customer_payment(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM customer_payments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== المبيعات ===============

#[tauri::command]
pub fn list_sales(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Sale>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT s.id, s.invoice_no, s.date, s.total, s.discount, s.additional, s.net_total,
               s.warehouse_id, w.name, s.customer_name, s.customer_id, s.payment_method,
               s.employee_id, e.name
        FROM sales s
        LEFT JOIN warehouses w ON w.id = s.warehouse_id
        LEFT JOIN employees e ON e.id = s.employee_id
        WHERE (?1 IS NULL OR s.invoice_no LIKE '%' || ?1 || '%' OR s.customer_name LIKE '%' || ?1 || '%')
        ORDER BY s.id DESC
        LIMIT 500";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(Sale {
                id: r.get(0)?,
                invoice_no: r.get(1)?,
                date: r.get(2)?,
                total: r.get(3)?,
                discount: r.get(4)?,
                additional: r.get(5)?,
                net_total: r.get(6)?,
                warehouse_id: r.get(7)?,
                warehouse_name: r.get(8)?,
                customer_name: r.get(9)?,
                customer_id: r.get(10)?,
                payment_method: r.get(11)?,
                employee_id: r.get(12)?,
                employee_name: r.get(13)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut sales: Vec<Sale> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Fetch sale items for all returned sales in a single query
    if !sales.is_empty() {
        let sale_ids: Vec<i64> = sales.iter().map(|s| s.id).collect();
        let placeholders: Vec<String> = (0..sale_ids.len())
            .map(|_| "?".to_string())
            .collect();
        let items_sql = format!(
            "SELECT si.sale_id, si.product_id, p.name, si.quantity, si.sell_price, (si.quantity * si.sell_price)
             FROM sale_items si
             JOIN products p ON p.id = si.product_id
             WHERE si.sale_id IN ({})",
            placeholders.join(",")
        );
        let mut items_stmt = conn
            .prepare(&items_sql)
            .map_err(|e| e.to_string())?;
        let mut items_map: HashMap<i64, Vec<SaleItem>> = HashMap::new();
        let item_rows = items_stmt
            .query_map(rusqlite::params_from_iter(sale_ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    SaleItem {
                        product_id: r.get(1)?,
                        product_name: r.get(2)?,
                        quantity: r.get(3)?,
                        sell_price: r.get(4)?,
                        total: r.get(5)?,
                    },
                ))
            })
            .map_err(|e| e.to_string())?;
        for item_row in item_rows {
            let (sale_id, item) = item_row.map_err(|e| e.to_string())?;
            items_map
                .entry(sale_id)
                .or_default()
                .push(item);
        }
        for sale in &mut sales {
            if let Some(items) = items_map.get(&sale.id) {
                sale.items = items.clone();
            }
        }
    }

    Ok(sales)
}

#[tauri::command]
pub fn get_sale(state: State<AppState>, id: i64) -> Result<Sale, String> {
    let conn = get_db(&state)?;
    get_sale_full(&conn, id)
}

#[tauri::command]
pub fn create_sale(state: State<AppState>, input: NewSale) -> Result<Sale, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل للفاتورة".into());
    }
    let payment_method = input
        .payment_method
        .unwrap_or_else(|| "cash".to_string());
    if !["cash", "credit", "card", "card_visa", "card_wallet"].contains(&payment_method.as_str()) {
        return Err("طريقة دفع غير صحيحة".into());
    }
    if payment_method == "credit" && input.customer_id.is_none() {
        return Err("اختر عميلًا للبيع الآجل".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let available: f64 = tx
            .query_row(
                "SELECT quantity FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|_| "منتج غير موجود".to_string())?;
        if available < it.quantity {
            let name: String = tx
                .query_row(
                    "SELECT name FROM products WHERE id = ?1",
                    params![it.product_id],
                    |r| r.get(0),
                )
                .map_err(|_| "منتج غير موجود".to_string())?;
            return Err(format!("الكمية غير كافية للمنتج «{name}» (المتوفر: {available})"));
        }
    }

    let customer_name = if let Some(cid) = input.customer_id {
        Some(
            tx.query_row(
                "SELECT name FROM customers WHERE id = ?1",
                params![cid],
                |r| r.get::<_, String>(0),
            )
            .map_err(|_| "العميل غير موجود".to_string())?,
        )
    } else {
        input.customer_name.clone()
    };

    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, warehouse_id, customer_name, customer_id, payment_method, employee_id)
         VALUES ('', ?1, 0, ?2, ?3, 0, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.date,
            input.discount,
            additional,
            input.warehouse_id,
            customer_name,
            input.customer_id,
            payment_method,
            input.employee_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let sale_id = tx.last_insert_rowid();

    let mut total = 0.0;
    for it in &input.items {
        let subtotal = crate::db::money(it.quantity * it.sell_price);
        let cost_price: f64 = tx
            .query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![sale_id, it.product_id, it.quantity, it.sell_price, cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
            params![it.quantity, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total);
    let net_total = crate::db::money(total - input.discount + additional);
    let invoice_no = format!("FS-{:06}", sale_id);
    tx.execute(
        "UPDATE sales SET invoice_no = ?1, total = ?2, net_total = ?3 WHERE id = ?4",
        params![invoice_no, total, net_total, sale_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_sale_full(&conn, sale_id)
}

#[tauri::command]
pub fn update_sale(
    state: State<AppState>,
    id: i64,
    input: NewSale,
) -> Result<Sale, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل للفاتورة".into());
    }
    let payment_method = input
        .payment_method
        .unwrap_or_else(|| "cash".to_string());
    if !["cash", "credit", "card", "card_visa", "card_wallet"].contains(&payment_method.as_str()) {
        return Err("طريقة دفع غير صحيحة".into());
    }
    if payment_method == "credit" && input.customer_id.is_none() {
        return Err("اختر عميلًا للبيع الآجل".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut stmt = tx
        .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1")
        .map_err(|e| e.to_string())?;
    let old: Vec<(i64, f64)> = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (pid, qty) in old {
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
            params![qty, pid],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM sale_items WHERE sale_id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let available: f64 = tx
            .query_row(
                "SELECT quantity FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|_| "منتج غير موجود".to_string())?;
        if available < it.quantity {
            let name: String = tx
                .query_row(
                    "SELECT name FROM products WHERE id = ?1",
                    params![it.product_id],
                    |r| r.get(0),
                )
                .map_err(|_| "منتج غير موجود".to_string())?;
            return Err(format!(
                "الكمية غير كافية للمنتج «{name}» (المتوفر: {available})"
            ));
        }
    }

    let customer_name = if let Some(cid) = input.customer_id {
        Some(
            tx.query_row(
                "SELECT name FROM customers WHERE id = ?1",
                params![cid],
                |r| r.get::<_, String>(0),
            )
            .map_err(|_| "العميل غير موجود".to_string())?,
        )
    } else {
        input.customer_name.clone()
    };

    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "UPDATE sales SET date = ?1, discount = ?2, additional = ?3, warehouse_id = ?4,
         customer_name = ?5, customer_id = ?6, payment_method = ?7, employee_id = ?8 WHERE id = ?9",
        params![
            input.date,
            input.discount,
            additional,
            input.warehouse_id,
            customer_name,
            input.customer_id,
            payment_method,
            input.employee_id,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut total = 0.0;
    for it in &input.items {
        let subtotal = crate::db::money(it.quantity * it.sell_price);
        let cost_price: f64 = tx
            .query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, it.product_id, it.quantity, it.sell_price, cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
            params![it.quantity, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total);
    let net_total = crate::db::money(total - input.discount + additional);
    tx.execute(
        "UPDATE sales SET total = ?1, net_total = ?2 WHERE id = ?3",
        params![total, net_total, id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_sale_full(&conn, id)
}

#[tauri::command]
pub fn delete_sale(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut stmt = tx
        .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, f64)> = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (pid, qty) in rows {
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
            params![qty, pid],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM sales WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn get_sale_full(conn: &Connection, id: i64) -> Result<Sale, String> {
    let sale = conn
        .query_row(
            "SELECT s.id, s.invoice_no, s.date, s.total, s.discount, s.additional, s.net_total,
                    s.warehouse_id, w.name, s.customer_name, s.customer_id, s.payment_method,
                    s.employee_id, e.name
             FROM sales s
             LEFT JOIN warehouses w ON w.id = s.warehouse_id
             LEFT JOIN employees e ON e.id = s.employee_id
             WHERE s.id = ?1",
            params![id],
            |r| {
                Ok(Sale {
                    id: r.get(0)?,
                    invoice_no: r.get(1)?,
                    date: r.get(2)?,
                    total: r.get(3)?,
                    discount: r.get(4)?,
                    additional: r.get(5)?,
                    net_total: r.get(6)?,
                    warehouse_id: r.get(7)?,
                    warehouse_name: r.get(8)?,
                    customer_name: r.get(9)?,
                    customer_id: r.get(10)?,
                    payment_method: r.get(11)?,
                    employee_id: r.get(12)?,
                    employee_name: r.get(13)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT si.product_id, p.name, si.quantity, si.sell_price, (si.quantity * si.sell_price)
             FROM sale_items si
             JOIN products p ON p.id = si.product_id
             WHERE si.sale_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(SaleItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                sell_price: r.get(3)?,
                total: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(Sale { items, ..sale })
}

// =============== المشتريات ===============

#[tauri::command]
pub fn list_purchases(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Purchase>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT p.id, p.supplier_id, s.name, p.date, p.total, p.discount, p.additional,
               p.warehouse_id, w.name, p.notes, p.employee_id, e.name
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        LEFT JOIN employees e ON e.id = p.employee_id
        WHERE (?1 IS NULL OR s.name LIKE '%' || ?1 || '%' OR p.notes LIKE '%' || ?1 || '%')
        ORDER BY p.id DESC
        LIMIT 500";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(Purchase {
                id: r.get(0)?,
                supplier_id: r.get(1)?,
                supplier_name: r.get(2)?,
                date: r.get(3)?,
                total: r.get(4)?,
                discount: r.get(5)?,
                additional: r.get(6)?,
                warehouse_id: r.get(7)?,
                warehouse_name: r.get(8)?,
                notes: r.get(9)?,
                employee_id: r.get(10)?,
                employee_name: r.get(11)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut purchases: Vec<Purchase> =
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Fetch purchase items for all returned purchases in a single query
    if !purchases.is_empty() {
        let purchase_ids: Vec<i64> = purchases.iter().map(|p| p.id).collect();
        let placeholders: Vec<String> = (0..purchase_ids.len())
            .map(|_| "?".to_string())
            .collect();
        let items_sql = format!(
            "SELECT pi.purchase_id, pi.product_id, p.name, pi.quantity, pi.cost_price, (pi.quantity * pi.cost_price)
             FROM purchase_items pi
             JOIN products p ON p.id = pi.product_id
             WHERE pi.purchase_id IN ({})",
            placeholders.join(",")
        );
        let mut items_stmt = conn
            .prepare(&items_sql)
            .map_err(|e| e.to_string())?;
        let mut items_map: HashMap<i64, Vec<PurchaseItem>> = HashMap::new();
        let item_rows = items_stmt
            .query_map(rusqlite::params_from_iter(purchase_ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    PurchaseItem {
                        product_id: r.get(1)?,
                        product_name: r.get(2)?,
                        quantity: r.get(3)?,
                        cost_price: r.get(4)?,
                        total: r.get(5)?,
                    },
                ))
            })
            .map_err(|e| e.to_string())?;
        for item_row in item_rows {
            let (purchase_id, item) = item_row.map_err(|e| e.to_string())?;
            items_map
                .entry(purchase_id)
                .or_default()
                .push(item);
        }
        for purchase in &mut purchases {
            if let Some(items) = items_map.get(&purchase.id) {
                purchase.items = items.clone();
            }
        }
    }

    Ok(purchases)
}

#[tauri::command]
pub fn create_purchase(state: State<AppState>, input: NewPurchase) -> Result<Purchase, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل للمشتريات".into());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let discount = input.discount.unwrap_or(0.0);
    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "INSERT INTO purchases (supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id)
         VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.supplier_id,
            input.date,
            discount,
            additional,
            input.warehouse_id,
            input.notes,
            input.employee_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let purchase_id = tx.last_insert_rowid();

    let mut total = 0.0;
    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let subtotal = crate::db::money(it.quantity * it.cost_price);
        tx.execute(
            "INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price)
             VALUES (?1, ?2, ?3, ?4)",
            params![purchase_id, it.product_id, it.quantity, it.cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1, cost_price = ?2 WHERE id = ?3",
            params![it.quantity, it.cost_price, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total + additional - discount);
    tx.execute(
        "UPDATE purchases SET total = ?1 WHERE id = ?2",
        params![total, purchase_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_purchase_full(&conn, purchase_id)
}

#[tauri::command]
pub fn delete_purchase(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut stmt = tx
        .prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, f64)> = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (pid, qty) in rows {
        tx.execute(
            "UPDATE products SET quantity = MAX(0, quantity - ?1) WHERE id = ?2",
            params![qty, pid],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM purchases WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_purchase(state: State<AppState>, id: i64) -> Result<Purchase, String> {
    let conn = get_db(&state)?;
    get_purchase_full(&conn, id)
}

#[tauri::command]
pub fn update_purchase(
    state: State<AppState>,
    id: i64,
    input: NewPurchase,
) -> Result<Purchase, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل للمشتريات".into());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut stmt = tx
        .prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?1")
        .map_err(|e| e.to_string())?;
    let old: Vec<(i64, f64)> = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (pid, qty) in old {
        tx.execute(
            "UPDATE products SET quantity = MAX(0, quantity - ?1) WHERE id = ?2",
            params![qty, pid],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM purchase_items WHERE purchase_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let discount = input.discount.unwrap_or(0.0);
    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "UPDATE purchases SET supplier_id = ?1, date = ?2, notes = ?3,
         discount = ?4, additional = ?5, warehouse_id = ?6, employee_id = ?7 WHERE id = ?8",
        params![
            input.supplier_id,
            input.date,
            input.notes,
            discount,
            additional,
            input.warehouse_id,
            input.employee_id,
            id
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut total = 0.0;
    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let subtotal = crate::db::money(it.quantity * it.cost_price);
        tx.execute(
            "INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, it.product_id, it.quantity, it.cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1, cost_price = ?2 WHERE id = ?3",
            params![it.quantity, it.cost_price, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total + additional - discount);
    tx.execute(
        "UPDATE purchases SET total = ?1 WHERE id = ?2",
        params![total, id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_purchase_full(&conn, id)
}

fn get_purchase_full(conn: &Connection, id: i64) -> Result<Purchase, String> {
    let purchase = conn
        .query_row(
            "SELECT p.id, p.supplier_id, s.name, p.date, p.total, p.discount, p.additional,
                    p.warehouse_id, w.name, p.notes, p.employee_id, e.name
             FROM purchases p
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             LEFT JOIN warehouses w ON w.id = p.warehouse_id
             LEFT JOIN employees e ON e.id = p.employee_id
             WHERE p.id = ?1",
            params![id],
            |r| {
                Ok(Purchase {
                    id: r.get(0)?,
                    supplier_id: r.get(1)?,
                    supplier_name: r.get(2)?,
                    date: r.get(3)?,
                    total: r.get(4)?,
                    discount: r.get(5)?,
                    additional: r.get(6)?,
                    warehouse_id: r.get(7)?,
                    warehouse_name: r.get(8)?,
                    notes: r.get(9)?,
                    employee_id: r.get(10)?,
                    employee_name: r.get(11)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pi.product_id, p.name, pi.quantity, pi.cost_price, (pi.quantity * pi.cost_price)
             FROM purchase_items pi
             JOIN products p ON p.id = pi.product_id
             WHERE pi.purchase_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(PurchaseItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                cost_price: r.get(3)?,
                total: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(Purchase { items, ..purchase })
}

// =============== مردود المشتريات ===============

#[tauri::command]
pub fn list_purchase_returns(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<PurchaseReturn>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT pr.id, pr.purchase_id, pr.invoice_no, pr.date, pr.total, pr.discount, pr.additional,
               pr.warehouse_id, w.name, pr.supplier_id, s.name, pr.notes, pr.employee_id, e.name
        FROM purchase_returns pr
        LEFT JOIN warehouses w ON w.id = pr.warehouse_id
        LEFT JOIN suppliers s ON s.id = pr.supplier_id
        LEFT JOIN employees e ON e.id = pr.employee_id
        WHERE (?1 IS NULL OR s.name LIKE '%' || ?1 || '%' OR pr.notes LIKE '%' || ?1 || '%' OR pr.invoice_no LIKE '%' || ?1 || '%')
        ORDER BY pr.id DESC
        LIMIT 500";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(PurchaseReturn {
                id: r.get(0)?,
                purchase_id: r.get(1)?,
                invoice_no: r.get(2)?,
                date: r.get(3)?,
                total: r.get(4)?,
                discount: r.get(5)?,
                additional: r.get(6)?,
                warehouse_id: r.get(7)?,
                warehouse_name: r.get(8)?,
                supplier_id: r.get(9)?,
                supplier_name: r.get(10)?,
                notes: r.get(11)?,
                employee_id: r.get(12)?,
                employee_name: r.get(13)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut returns: Vec<PurchaseReturn> =
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    if !returns.is_empty() {
        let return_ids: Vec<i64> = returns.iter().map(|r| r.id).collect();
        let placeholders: Vec<String> = (0..return_ids.len())
            .map(|_| "?".to_string())
            .collect();
        let items_sql = format!(
            "SELECT pri.return_id, pri.product_id, p.name, pri.quantity, pri.cost_price, (pri.quantity * pri.cost_price)
             FROM purchase_return_items pri
             JOIN products p ON p.id = pri.product_id
             WHERE pri.return_id IN ({})",
            placeholders.join(",")
        );
        let mut items_stmt = conn
            .prepare(&items_sql)
            .map_err(|e| e.to_string())?;
        let mut items_map: HashMap<i64, Vec<PurchaseReturnItem>> = HashMap::new();
        let item_rows = items_stmt
            .query_map(rusqlite::params_from_iter(return_ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    PurchaseReturnItem {
                        product_id: r.get(1)?,
                        product_name: r.get(2)?,
                        quantity: r.get(3)?,
                        cost_price: r.get(4)?,
                        total: r.get(5)?,
                    },
                ))
            })
            .map_err(|e| e.to_string())?;
        for item_row in item_rows {
            let (return_id, item) = item_row.map_err(|e| e.to_string())?;
            items_map
                .entry(return_id)
                .or_default()
                .push(item);
        }
        for ret in &mut returns {
            if let Some(items) = items_map.get(&ret.id) {
                ret.items = items.clone();
            }
        }
    }

    Ok(returns)
}

#[tauri::command]
pub fn get_purchase_return(state: State<AppState>, id: i64) -> Result<PurchaseReturn, String> {
    let conn = get_db(&state)?;
    let ret = conn
        .query_row(
            "SELECT pr.id, pr.purchase_id, pr.invoice_no, pr.date, pr.total, pr.discount, pr.additional,
                    pr.warehouse_id, w.name, pr.supplier_id, s.name, pr.notes, pr.employee_id, e.name
             FROM purchase_returns pr
             LEFT JOIN warehouses w ON w.id = pr.warehouse_id
             LEFT JOIN suppliers s ON s.id = pr.supplier_id
             LEFT JOIN employees e ON e.id = pr.employee_id
             WHERE pr.id = ?1",
            params![id],
            |r| {
                Ok(PurchaseReturn {
                    id: r.get(0)?,
                    purchase_id: r.get(1)?,
                    invoice_no: r.get(2)?,
                    date: r.get(3)?,
                    total: r.get(4)?,
                    discount: r.get(5)?,
                    additional: r.get(6)?,
                    warehouse_id: r.get(7)?,
                    warehouse_name: r.get(8)?,
                    supplier_id: r.get(9)?,
                    supplier_name: r.get(10)?,
                    notes: r.get(11)?,
                    employee_id: r.get(12)?,
                    employee_name: r.get(13)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pri.product_id, p.name, pri.quantity, pri.cost_price, (pri.quantity * pri.cost_price)
             FROM purchase_return_items pri
             JOIN products p ON p.id = pri.product_id
             WHERE pri.return_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(PurchaseReturnItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                cost_price: r.get(3)?,
                total: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(PurchaseReturn { items, ..ret })
}

#[tauri::command]
pub fn create_purchase_return(
    state: State<AppState>,
    input: NewPurchaseReturn,
) -> Result<PurchaseReturn, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل لمردود المشتريات".into());
    }

    let purchase: Option<Purchase> = conn
        .query_row(
            "SELECT id, supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id
             FROM purchases WHERE id = ?1",
            params![input.purchase_id],
            |r| {
                Ok(Purchase {
                    id: r.get(0)?,
                    supplier_id: r.get(1)?,
                    supplier_name: None,
                    date: r.get(2)?,
                    total: r.get(3)?,
                    discount: r.get(4)?,
                    additional: r.get(5)?,
                    warehouse_id: r.get(6)?,
                    warehouse_name: None,
                    notes: r.get(7)?,
                    employee_id: r.get(8)?,
                    employee_name: None,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|_| "فاتورة المشتريات غير موجودة".to_string())
        .ok();

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let discount = input.discount.unwrap_or(0.0);
    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "INSERT INTO purchase_returns (purchase_id, date, total, discount, additional, warehouse_id, supplier_id, notes, employee_id)
         VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.purchase_id,
            input.date,
            discount,
            additional,
            input.warehouse_id,
            purchase.as_ref().and_then(|p| p.supplier_id),
            input.notes,
            input.employee_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let return_id = tx.last_insert_rowid();

    let mut total = 0.0;
    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let subtotal = crate::db::money(it.quantity * it.cost_price);
        tx.execute(
            "INSERT INTO purchase_return_items (return_id, product_id, quantity, cost_price)
             VALUES (?1, ?2, ?3, ?4)",
            params![return_id, it.product_id, it.quantity, it.cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = MAX(0, quantity - ?1), cost_price = ?2 WHERE id = ?3",
            params![it.quantity, it.cost_price, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total + additional - discount);
    let invoice_no = format!("MR-{:06}", return_id);
    tx.execute(
        "UPDATE purchase_returns SET total = ?1, invoice_no = ?2 WHERE id = ?3",
        params![total, invoice_no, return_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_purchase_return_full(&conn, return_id)
}

fn get_purchase_return_full(conn: &Connection, id: i64) -> Result<PurchaseReturn, String> {
    let ret = conn
        .query_row(
            "SELECT pr.id, pr.purchase_id, pr.invoice_no, pr.date, pr.total, pr.discount, pr.additional,
                    pr.warehouse_id, w.name, pr.supplier_id, s.name, pr.notes, pr.employee_id, e.name
             FROM purchase_returns pr
             LEFT JOIN warehouses w ON w.id = pr.warehouse_id
             LEFT JOIN suppliers s ON s.id = pr.supplier_id
             LEFT JOIN employees e ON e.id = pr.employee_id
             WHERE pr.id = ?1",
            params![id],
            |r| {
                Ok(PurchaseReturn {
                    id: r.get(0)?,
                    purchase_id: r.get(1)?,
                    invoice_no: r.get(2)?,
                    date: r.get(3)?,
                    total: r.get(4)?,
                    discount: r.get(5)?,
                    additional: r.get(6)?,
                    warehouse_id: r.get(7)?,
                    warehouse_name: r.get(8)?,
                    supplier_id: r.get(9)?,
                    supplier_name: r.get(10)?,
                    notes: r.get(11)?,
                    employee_id: r.get(12)?,
                    employee_name: r.get(13)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pri.product_id, p.name, pri.quantity, pri.cost_price, (pri.quantity * pri.cost_price)
             FROM purchase_return_items pri
             JOIN products p ON p.id = pri.product_id
             WHERE pri.return_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(PurchaseReturnItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                cost_price: r.get(3)?,
                total: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(PurchaseReturn { items, ..ret })
}

// =============== مردود المبيعات ===============

#[tauri::command]
pub fn list_sale_returns(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<SaleReturn>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT sr.id, sr.invoice_no, sr.date, sr.total, sr.discount, sr.additional,
               sr.warehouse_id, w.name, sr.customer_name, sr.customer_id, sr.payment_method,
               sr.notes, sr.employee_id, e.name
        FROM sale_returns sr
        LEFT JOIN warehouses w ON w.id = sr.warehouse_id
        LEFT JOIN employees e ON e.id = sr.employee_id
        WHERE (?1 IS NULL OR sr.invoice_no LIKE '%' || ?1 || '%' OR sr.customer_name LIKE '%' || ?1 || '%' OR sr.notes LIKE '%' || ?1 || '%')
        ORDER BY sr.id DESC
        LIMIT 500";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(SaleReturn {
                id: r.get(0)?,
                invoice_no: r.get(1)?,
                date: r.get(2)?,
                total: r.get(3)?,
                discount: r.get(4)?,
                additional: r.get(5)?,
                warehouse_id: r.get(6)?,
                warehouse_name: r.get(7)?,
                customer_name: r.get(8)?,
                customer_id: r.get(9)?,
                payment_method: r.get(10)?,
                notes: r.get(11)?,
                employee_id: r.get(12)?,
                employee_name: r.get(13)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut returns: Vec<SaleReturn> =
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    if !returns.is_empty() {
        let return_ids: Vec<i64> = returns.iter().map(|r| r.id).collect();
        let placeholders: Vec<String> = (0..return_ids.len())
            .map(|_| "?".to_string())
            .collect();
        let items_sql = format!(
            "SELECT sri.return_id, sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price)
             FROM sale_return_items sri
             JOIN products p ON p.id = sri.product_id
             WHERE sri.return_id IN ({})",
            placeholders.join(",")
        );
        let mut items_stmt = conn
            .prepare(&items_sql)
            .map_err(|e| e.to_string())?;
        let mut items_map: HashMap<i64, Vec<SaleReturnItem>> = HashMap::new();
        let item_rows = items_stmt
            .query_map(rusqlite::params_from_iter(return_ids.iter()), |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    SaleReturnItem {
                        product_id: r.get(1)?,
                        product_name: r.get(2)?,
                        quantity: r.get(3)?,
                        sell_price: r.get(4)?,
                        cost_price: r.get(5)?,
                        total: r.get(6)?,
                    },
                ))
            })
            .map_err(|e| e.to_string())?;
        for item_row in item_rows {
            let (return_id, item) = item_row.map_err(|e| e.to_string())?;
            items_map
                .entry(return_id)
                .or_default()
                .push(item);
        }
        for ret in &mut returns {
            if let Some(items) = items_map.get(&ret.id) {
                ret.items = items.clone();
            }
        }
    }

    Ok(returns)
}

#[tauri::command]
pub fn get_sale_return(state: State<AppState>, id: i64) -> Result<SaleReturn, String> {
    let conn = get_db(&state)?;
    let ret = conn
        .query_row(
            "SELECT sr.id, sr.invoice_no, sr.date, sr.total, sr.discount, sr.additional,
                    sr.warehouse_id, w.name, sr.customer_name, sr.customer_id, sr.payment_method,
                    sr.notes, sr.employee_id, e.name
             FROM sale_returns sr
             LEFT JOIN warehouses w ON w.id = sr.warehouse_id
             LEFT JOIN employees e ON e.id = sr.employee_id
             WHERE sr.id = ?1",
            params![id],
            |r| {
                Ok(SaleReturn {
                    id: r.get(0)?,
                    invoice_no: r.get(1)?,
                    date: r.get(2)?,
                    total: r.get(3)?,
                    discount: r.get(4)?,
                    additional: r.get(5)?,
                    warehouse_id: r.get(6)?,
                    warehouse_name: r.get(7)?,
                    customer_name: r.get(8)?,
                    customer_id: r.get(9)?,
                    payment_method: r.get(10)?,
                    notes: r.get(11)?,
                    employee_id: r.get(12)?,
                    employee_name: r.get(13)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price)
             FROM sale_return_items sri
             JOIN products p ON p.id = sri.product_id
             WHERE sri.return_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(SaleReturnItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                sell_price: r.get(3)?,
                cost_price: r.get(4)?,
                total: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(SaleReturn { items, ..ret })
}

#[tauri::command]
pub fn create_sale_return(
    state: State<AppState>,
    input: NewSaleReturn,
) -> Result<SaleReturn, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنف واحد على الأقل لمردود المبيعات".into());
    }

    let payment_method = input
        .payment_method
        .unwrap_or_else(|| "cash".to_string());
    if !["cash", "credit", "card", "card_visa", "card_wallet"].contains(&payment_method.as_str()) {
        return Err("طريقة دفع غير صحيحة".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let discount = input.discount;
    let additional = input.additional.unwrap_or(0.0);
    tx.execute(
        "INSERT INTO sale_returns (date, total, discount, additional, warehouse_id, customer_name, customer_id, payment_method, notes, employee_id)
         VALUES (?1, 0, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.date,
            discount,
            additional,
            input.warehouse_id,
            input.customer_name,
            input.customer_id,
            payment_method,
            input.notes,
            input.employee_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let return_id = tx.last_insert_rowid();

    let mut total = 0.0;
    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let _available: f64 = tx
            .query_row(
                "SELECT quantity FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|_| "منتج غير موجود".to_string())?;
        let subtotal = crate::db::money(it.quantity * it.sell_price);
        let cost_price: f64 = tx
            .query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO sale_return_items (return_id, product_id, quantity, sell_price, cost_price)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![return_id, it.product_id, it.quantity, it.sell_price, cost_price],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
            params![it.quantity, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::db::money(total + additional - discount);
    let invoice_no = format!("MSR-{:06}", return_id);
    tx.execute(
        "UPDATE sale_returns SET total = ?1, invoice_no = ?2 WHERE id = ?3",
        params![total, invoice_no, return_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    get_sale_return_full(&conn, return_id)
}

fn get_sale_return_full(conn: &Connection, id: i64) -> Result<SaleReturn, String> {
    let ret = conn
        .query_row(
            "SELECT sr.id, sr.invoice_no, sr.date, sr.total, sr.discount, sr.additional,
                    sr.warehouse_id, w.name, sr.customer_name, sr.customer_id, sr.payment_method,
                    sr.notes, sr.employee_id, e.name
             FROM sale_returns sr
             LEFT JOIN warehouses w ON w.id = sr.warehouse_id
             LEFT JOIN employees e ON e.id = sr.employee_id
             WHERE sr.id = ?1",
            params![id],
            |r| {
                Ok(SaleReturn {
                    id: r.get(0)?,
                    invoice_no: r.get(1)?,
                    date: r.get(2)?,
                    total: r.get(3)?,
                    discount: r.get(4)?,
                    additional: r.get(5)?,
                    warehouse_id: r.get(6)?,
                    warehouse_name: r.get(7)?,
                    customer_name: r.get(8)?,
                    customer_id: r.get(9)?,
                    payment_method: r.get(10)?,
                    notes: r.get(11)?,
                    employee_id: r.get(12)?,
                    employee_name: r.get(13)?,
                    items: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price)
             FROM sale_return_items sri
             JOIN products p ON p.id = sri.product_id
             WHERE sri.return_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(SaleReturnItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                quantity: r.get(2)?,
                sell_price: r.get(3)?,
                cost_price: r.get(4)?,
                total: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(SaleReturn { items, ..ret })
}

// =============== المصروفات ===============

#[tauri::command]
pub fn list_expenses(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Expense>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT id, date, description, amount, category
        FROM expenses
        WHERE (?1 IS NULL OR description LIKE '%' || ?1 || '%' OR category LIKE '%' || ?1 || '%')
        ORDER BY id DESC
        LIMIT 500";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(Expense {
                id: r.get(0)?,
                date: r.get(1)?,
                description: r.get(2)?,
                amount: r.get(3)?,
                category: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_expense(state: State<AppState>, input: NewExpense) -> Result<Expense, String> {
    let conn = get_db(&state)?;
    if input.description.trim().is_empty() {
        return Err("وصف المصروف مطلوب".into());
    }
    conn.execute(
        "INSERT INTO expenses (date, description, amount, category) VALUES (?1, ?2, ?3, ?4)",
        params![
            input.date,
            input.description.trim(),
            input.amount,
            input.category
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Expense {
        id,
        date: input.date,
        description: input.description,
        amount: input.amount,
        category: input.category,
    })
}

#[tauri::command]
pub fn delete_expense(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM expenses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== الموظفين ===============

#[tauri::command]
pub fn list_employees(state: State<AppState>) -> Result<Vec<Employee>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, position, salary, hire_date, notes
             FROM employees ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Employee {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                email: r.get(3)?,
                position: r.get(4)?,
                salary: r.get(5)?,
                hire_date: r.get(6)?,
                notes: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_employee(
    state: State<AppState>,
    input: NewEmployee,
) -> Result<Employee, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم الموظف مطلوب".into());
    }
    conn.execute(
        "INSERT INTO employees (name, phone, email, position, salary, hire_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.name.trim(),
            input.phone,
            input.email,
            input.position,
            input.salary,
            input.hire_date,
            input.notes
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Employee {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        email: input.email,
        position: input.position,
        salary: input.salary,
        hire_date: input.hire_date,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn update_employee(
    state: State<AppState>,
    id: i64,
    input: NewEmployee,
) -> Result<Employee, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم الموظف مطلوب".into());
    }
    conn.execute(
        "UPDATE employees SET name=?1, phone=?2, email=?3, position=?4, salary=?5,
         hire_date=?6, notes=?7 WHERE id=?8",
        params![
            input.name.trim(),
            input.phone,
            input.email,
            input.position,
            input.salary,
            input.hire_date,
            input.notes,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_employee(&conn, id)
}

#[tauri::command]
pub fn delete_employee(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM employees WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_employee(conn: &Connection, id: i64) -> Result<Employee, String> {
    conn.query_row(
        "SELECT id, name, phone, email, position, salary, hire_date, notes
         FROM employees WHERE id = ?1",
        params![id],
        |r| {
            Ok(Employee {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                email: r.get(3)?,
                position: r.get(4)?,
                salary: r.get(5)?,
                hire_date: r.get(6)?,
                notes: r.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

// =============== الرواتب ===============

#[tauri::command]
pub fn list_salaries(
    state: State<AppState>,
    employee_id: Option<i64>,
) -> Result<Vec<Salary>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT s.id, s.employee_id, e.name, s.date, s.amount, s.notes
        FROM salaries s
        JOIN employees e ON e.id = s.employee_id
        WHERE (?1 IS NULL OR s.employee_id = ?1)
        ORDER BY s.id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![employee_id], |r| {
            Ok(Salary {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                date: r.get(3)?,
                amount: r.get(4)?,
                notes: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_salary(
    state: State<AppState>,
    input: NewSalary,
) -> Result<Salary, String> {
    let conn = get_db(&state)?;
    if input.amount <= 0.0 {
        return Err("المبلغ يجب أن يكون أكبر من صفر".into());
    }
    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount, notes) VALUES (?1, ?2, ?3, ?4)",
        params![input.employee_id, input.date, input.amount, input.notes],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let name: String = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![input.employee_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(Salary {
        id,
        employee_id: input.employee_id,
        employee_name: name,
        date: input.date,
        amount: input.amount,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn delete_salary(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM salaries WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== الإجازات ===============

#[tauri::command]
pub fn list_vacations(
    state: State<AppState>,
    employee_id: Option<i64>,
) -> Result<Vec<Vacation>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT v.id, v.employee_id, e.name, v.start_date, v.end_date, v.days,
               v.type, v.notes, v.status
        FROM vacations v
        JOIN employees e ON e.id = v.employee_id
        WHERE (?1 IS NULL OR v.employee_id = ?1)
        ORDER BY v.id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![employee_id], |r| {
            Ok(Vacation {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                start_date: r.get(3)?,
                end_date: r.get(4)?,
                days: r.get(5)?,
                r#type: r.get(6)?,
                notes: r.get(7)?,
                status: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_vacation(
    state: State<AppState>,
    input: NewVacation,
) -> Result<Vacation, String> {
    let conn = get_db(&state)?;
    if input.start_date.is_empty() || input.end_date.is_empty() {
        return Err("تواريخ الإجازة مطلوبة".into());
    }
    let vtype = input.r#type.unwrap_or_else(|| "annual".to_string());
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    conn.execute(
        "INSERT INTO vacations (employee_id, start_date, end_date, days, type, notes, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.employee_id,
            input.start_date,
            input.end_date,
            input.days,
            vtype,
            input.notes,
            status
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let name: String = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![input.employee_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(Vacation {
        id,
        employee_id: input.employee_id,
        employee_name: name,
        start_date: input.start_date,
        end_date: input.end_date,
        days: input.days,
        r#type: vtype,
        notes: input.notes,
        status,
    })
}

#[tauri::command]
pub fn update_vacation(
    state: State<AppState>,
    id: i64,
    input: NewVacation,
) -> Result<Vacation, String> {
    let conn = get_db(&state)?;
    let vtype = input.r#type.unwrap_or_else(|| "annual".to_string());
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    conn.execute(
        "UPDATE vacations SET start_date=?1, end_date=?2, days=?3, type=?4,
         notes=?5, status=?6 WHERE id=?7",
        params![
            input.start_date,
            input.end_date,
            input.days,
            vtype,
            input.notes,
            status,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    get_vacation(&conn, id)
}

fn get_vacation(conn: &Connection, id: i64) -> Result<Vacation, String> {
    conn.query_row(
        "SELECT v.id, v.employee_id, e.name, v.start_date, v.end_date, v.days,
                v.type, v.notes, v.status
         FROM vacations v
         JOIN employees e ON e.id = v.employee_id
         WHERE v.id = ?1",
        params![id],
        |r| {
            Ok(Vacation {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                start_date: r.get(3)?,
                end_date: r.get(4)?,
                days: r.get(5)?,
                r#type: r.get(6)?,
                notes: r.get(7)?,
                status: r.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_vacation(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM vacations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== الحضور والانصراف ===============

#[tauri::command]
pub fn list_attendance(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Attendance>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT a.id, a.employee_id, e.name, a.date, a.check_in, a.check_out, a.type, a.notes
        FROM attendance a
        LEFT JOIN employees e ON e.id = a.employee_id
        WHERE (?1 IS NULL OR e.name LIKE '%' || ?1 || '%' OR a.date LIKE '%' || ?1 || '%')
        ORDER BY a.date DESC, a.id DESC
        LIMIT 500
    ";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(Attendance {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                date: r.get(3)?,
                check_in: r.get(4)?,
                check_out: r.get(5)?,
                r#type: r.get(6)?,
                notes: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_attendance(
    state: State<AppState>,
    input: NewAttendance,
) -> Result<Attendance, String> {
    let conn = get_db(&state)?;
    let employee_name = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![input.employee_id],
            |r| r.get::<_, String>(0),
        )
        .map_err(|_| "الموظف غير موجود".to_string())?;

    conn.execute(
        "INSERT INTO attendance (employee_id, date, check_in, check_out, type, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.employee_id,
            input.date,
            input.check_in,
            input.check_out,
            input.r#type,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();

    Ok(Attendance {
        id,
        employee_id: input.employee_id,
        employee_name,
        date: input.date,
        check_in: input.check_in,
        check_out: input.check_out,
        r#type: input.r#type,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn update_attendance(
    state: State<AppState>,
    id: i64,
    input: NewAttendance,
) -> Result<Attendance, String> {
    let conn = get_db(&state)?;
    let employee_name = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![input.employee_id],
            |r| r.get::<_, String>(0),
        )
        .map_err(|_| "الموظف غير موجود".to_string())?;

    conn.execute(
        "UPDATE attendance SET employee_id=?1, date=?2, check_in=?3, check_out=?4, type=?5, notes=?6 WHERE id=?7",
        params![
            input.employee_id,
            input.date,
            input.check_in,
            input.check_out,
            input.r#type,
            input.notes,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Attendance {
        id,
        employee_id: input.employee_id,
        employee_name,
        date: input.date,
        check_in: input.check_in,
        check_out: input.check_out,
        r#type: input.r#type,
        notes: input.notes,
    })
}

#[tauri::command]
pub fn delete_attendance(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM attendance WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cleanup_duplicate_attendance(state: State<AppState>) -> Result<i64, String> {
    let conn = get_db(&state)?;
    let deleted = conn
        .execute(
            "DELETE FROM attendance WHERE id NOT IN (
                SELECT MIN(id) FROM attendance
                GROUP BY employee_id, date,
                    COALESCE(check_in, ''),
                    COALESCE(check_out, '')
            )",
            [],
        )
        .map_err(|e| e.to_string())?;
    Ok(deleted as i64)
}

// =============== الفترات (Shifts) ===============

#[tauri::command]
pub fn list_shifts(state: State<AppState>) -> Result<Vec<Shift>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, start_time, end_time, grace_minutes, is_active FROM shifts ORDER BY start_time")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Shift {
                id: r.get(0)?,
                name: r.get(1)?,
                start_time: r.get(2)?,
                end_time: r.get(3)?,
                grace_minutes: r.get(4)?,
                is_active: r.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn create_shift(state: State<AppState>, shift: NewShift) -> Result<i64, String> {
    let conn = get_db(&state)?;
    let active = if shift.is_active.unwrap_or(true) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO shifts (name, start_time, end_time, grace_minutes, is_active) VALUES (?, ?, ?, ?, ?)",
        params![shift.name, shift.start_time, shift.end_time, shift.grace_minutes, active],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_shift(state: State<AppState>, id: i64, shift: NewShift) -> Result<(), String> {
    let conn = get_db(&state)?;
    let active = if shift.is_active.unwrap_or(true) { 1 } else { 0 };
    conn.execute(
        "UPDATE shifts SET name = ?, start_time = ?, end_time = ?, grace_minutes = ?, is_active = ? WHERE id = ?",
        params![shift.name, shift.start_time, shift.end_time, shift.grace_minutes, active, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_shift(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM employee_shifts WHERE shift_id = ?", [id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM shifts WHERE id = ?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== تعيين الفترات للموظفين ===============

#[tauri::command]
pub fn list_employee_shifts(state: State<AppState>) -> Result<Vec<EmployeeShift>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT es.id, es.employee_id, e.name, es.shift_id, s.name, s.start_time, s.end_time, es.effective_date
             FROM employee_shifts es
             JOIN employees e ON e.id = es.employee_id
             JOIN shifts s ON s.id = es.shift_id
             ORDER BY es.effective_date DESC, e.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(EmployeeShift {
                id: r.get(0)?,
                employee_id: r.get(1)?,
                employee_name: r.get(2)?,
                shift_id: r.get(3)?,
                shift_name: r.get(4)?,
                start_time: r.get(5)?,
                end_time: r.get(6)?,
                effective_date: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn create_employee_shift(state: State<AppState>, es: NewEmployeeShift) -> Result<i64, String> {
    let conn = get_db(&state)?;
    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM employee_shifts WHERE employee_id = ? AND effective_date = ?",
            params![es.employee_id, es.effective_date],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if existing > 0 {
        conn.execute(
            "UPDATE employee_shifts SET shift_id = ? WHERE employee_id = ? AND effective_date = ?",
            params![es.shift_id, es.employee_id, es.effective_date],
        )
        .map_err(|e| e.to_string())?;
        return Ok(0);
    }
    conn.execute(
        "INSERT INTO employee_shifts (employee_id, shift_id, effective_date) VALUES (?, ?, ?)",
        params![es.employee_id, es.shift_id, es.effective_date],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn delete_employee_shift(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM employee_shifts WHERE id = ?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_shift_report(state: State<AppState>, from_date: String, to_date: String) -> Result<Vec<ShiftReport>, String> {
    let conn = get_db(&state)?;

    conn.execute(
        "DELETE FROM attendance WHERE (check_in IS NULL OR check_in = '') AND (check_out IS NULL OR check_out = '')",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM attendance WHERE id NOT IN (
            SELECT MIN(id) FROM attendance
            WHERE employee_id IS NOT NULL AND date IS NOT NULL
            GROUP BY employee_id, date
        )",
        [],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
             "SELECT
                a.id,
                a.date,
                e.id as employee_id, e.name as employee_name,
                s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end,
                a.check_in, a.check_out
             FROM (
                 SELECT id, employee_id, date, check_in, check_out
                 FROM attendance
                 WHERE date BETWEEN ? AND ?
                   AND check_in IS NOT NULL AND check_in != ''
             ) a
             JOIN employees e ON e.id = a.employee_id
             LEFT JOIN employee_shifts es ON es.id = (
                 SELECT id FROM employee_shifts
                 WHERE employee_id = a.employee_id AND effective_date <= a.date
                 ORDER BY effective_date DESC
                 LIMIT 1
             )
             LEFT JOIN shifts s ON s.id = es.shift_id
             ORDER BY a.date DESC, e.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![from_date, to_date], |r| {
            let id: i64 = r.get(0)?;
            let date: String = r.get(1)?;
            let emp_id: i64 = r.get(2)?;
            let emp_name: String = r.get(3)?;
            let shift_name: Option<String> = r.get(4)?;
            let shift_start: Option<String> = r.get(5)?;
            let shift_end: Option<String> = r.get(6)?;
            let check_in: Option<String> = r.get(7)?;
            let check_out: Option<String> = r.get(8)?;

            let has_shift = shift_start.is_some() && shift_end.is_some();

            let mut shift_start_mins: i64 = 0;
            let mut shift_end_mins: i64 = 0;
            let mut shift_overnight = false;
            if let (Some(ref ss), Some(ref se)) = (&shift_start, &shift_end) {
                let (ssh, ssm): (i64, i64) = {
                    let parts: Vec<&str> = ss.split(':').collect();
                    (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                };
                let (seh, sem): (i64, i64) = {
                    let parts: Vec<&str> = se.split(':').collect();
                    (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                };
                shift_start_mins = ssh * 60 + ssm;
                shift_end_mins = seh * 60 + sem;
                shift_overnight = shift_end_mins < shift_start_mins;
            }

            let mut is_within_shift = false;
            if has_shift {
                if let (Some(ref ci), Some(ref co)) = (&check_in, &check_out) {
                    let (cih, cim): (i64, i64) = {
                        let parts: Vec<&str> = ci.split(':').collect();
                        (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                    };
                    let (coh, com): (i64, i64) = {
                        let parts: Vec<&str> = co.split(':').collect();
                        (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                    };
                    let ci_mins = cih * 60 + cim;
                    let co_mins = coh * 60 + com;

                    if shift_overnight {
                        let ci_ok = ci_mins >= shift_start_mins || ci_mins <= shift_end_mins;
                        let co_ok = co_mins >= shift_start_mins || co_mins <= shift_end_mins;
                        is_within_shift = ci_ok && co_ok;
                    } else {
                        is_within_shift = ci_mins >= shift_start_mins && co_mins <= shift_end_mins;
                    }
                } else if let Some(ref ci) = check_in {
                    let (cih, cim): (i64, i64) = {
                        let parts: Vec<&str> = ci.split(':').collect();
                        (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                    };
                    let ci_mins = cih * 60 + cim;
                    if shift_overnight {
                        is_within_shift = ci_mins >= shift_start_mins || ci_mins <= shift_end_mins;
                    } else {
                        is_within_shift = ci_mins >= shift_start_mins;
                    }
                }
            }

            let mut is_late = false;
            let mut late_minutes: i64 = 0;
            if has_shift {
                if let Some(ref ci) = check_in {
                    let (ch, cm): (i64, i64) = {
                        let parts: Vec<&str> = ci.split(':').collect();
                        (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                    };
                    let ci_mins = ch * 60 + cm;
                    if ci_mins > shift_start_mins {
                        is_late = true;
                        late_minutes = ci_mins - shift_start_mins;
                    }
                }
            }

            let mut is_early_leave = false;
            let mut early_minutes: i64 = 0;
            if has_shift {
                if let Some(ref co) = check_out {
                    let (coh, com): (i64, i64) = {
                        let parts: Vec<&str> = co.split(':').collect();
                        (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                    };
                    let co_mins = coh * 60 + com;
                    if shift_overnight {
                        if co_mins < shift_start_mins {
                            if co_mins < shift_end_mins {
                                is_early_leave = true;
                                early_minutes = shift_end_mins - co_mins;
                            }
                        } else {
                            let shift_end_abs = shift_end_mins + 24 * 60;
                            if co_mins < shift_end_abs {
                                is_early_leave = true;
                                early_minutes = shift_end_abs - co_mins;
                            }
                        }
                    } else {
                        if co_mins < shift_end_mins {
                            is_early_leave = true;
                            early_minutes = shift_end_mins - co_mins;
                        }
                    }
                }
            }

            let mut work_hours: f64 = 0.0;
            if let (Some(ref ci), Some(ref co)) = (&check_in, &check_out) {
                let (ih, im): (i64, i64) = {
                    let parts: Vec<&str> = ci.split(':').collect();
                    (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                };
                let (oh, om): (i64, i64) = {
                    let parts: Vec<&str> = co.split(':').collect();
                    (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
                };
                let ci_mins = ih * 60 + im;
                let co_mins = oh * 60 + om;
                if co_mins >= ci_mins {
                    work_hours = (co_mins - ci_mins) as f64 / 60.0;
                } else {
                    work_hours = (co_mins + 24 * 60 - ci_mins) as f64 / 60.0;
                }
            }

            Ok(ShiftReport {
                id,
                employee_id: emp_id,
                employee_name: emp_name,
                shift_name,
                shift_start,
                shift_end,
                check_in,
                check_out,
                date,
                has_shift,
                is_within_shift,
                is_late,
                late_minutes,
                is_early_leave,
                early_minutes,
                work_hours: (work_hours * 100.0).round() / 100.0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

// =============== الإعدادات ===============

const DEFAULT_SETTINGS: &[(&str, &str)] = &[
    ("store_name", "تبارك"),
    ("phone", ""),
    ("address", ""),
    ("currency", "ج.م"),
    ("invoice_footer", "شكرًا لزيارتكم"),
];

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let conn = get_db(&state)?;
    let mut values: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        values.insert(k, v);
    }
    Ok(Settings {
        store_name: values
            .get("store_name")
            .cloned()
            .unwrap_or_else(|| DEFAULT_SETTINGS[0].1.to_string()),
        phone: values.get("phone").cloned().unwrap_or_default(),
        address: values.get("address").cloned().unwrap_or_default(),
        currency: values
            .get("currency")
            .cloned()
            .unwrap_or_else(|| DEFAULT_SETTINGS[3].1.to_string()),
        invoice_footer: values
            .get("invoice_footer")
            .cloned()
            .unwrap_or_else(|| DEFAULT_SETTINGS[4].1.to_string()),
        opening_balance: values
            .get("opening_balance")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0),
        attendance_url: values.get("attendance_url").cloned().unwrap_or_default(),
    })
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: Settings) -> Result<Settings, String> {
    let conn = get_db(&state)?;
    let items: Vec<(&str, String)> = vec![
        ("store_name", settings.store_name),
        ("phone", settings.phone),
        ("address", settings.address),
        ("currency", settings.currency),
        ("invoice_footer", settings.invoice_footer),
        ("opening_balance", settings.opening_balance.to_string()),
        ("attendance_url", settings.attendance_url),
    ];
    for (k, v) in items {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )
        .map_err(|e| e.to_string())?;
    }
    drop(conn);
    get_settings(state)
}

// =============== النسخ الاحتياطي ===============

#[tauri::command]
pub fn export_backup(state: State<AppState>, path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("اختر مسار الحفظ".into());
    }
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let _ = fs::remove_file(&target);

    let conn = get_db(&state)?;
    let mut dst = Connection::open(&target).map_err(|e| e.to_string())?;
    let backup = Backup::new(&conn, &mut dst).map_err(|e| e.to_string())?;
    backup
        .run_to_completion(0, std::time::Duration::from_secs(0), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_backup(state: State<AppState>, path: String) -> Result<(), String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err("ملف النسخة الاحتياطية غير موجود".into());
    }
    let check = Connection::open_with_flags(&src, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "الملف ليس قاعدة بيانات صالحة".to_string())?;
    let count: i64 = check
        .query_row("SELECT COUNT(*) FROM sqlite_master", [], |r| r.get(0))
        .map_err(|_| "الملف ليس قاعدة بيانات صالحة".to_string())?;
    if count == 0 {
        return Err("قاعدة البيانات فارغة أو غير صالحة".into());
    }
    drop(check);

    let db_path = state.db_path.clone();
    fs::copy(&src, &db_path).map_err(|e| e.to_string())?;
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    *conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== التقارير ===============

fn date_filter_clause(from: &Option<String>, to: &Option<String>) -> (String, Vec<String>) {
    let mut clauses = Vec::new();
    let mut args: Vec<String> = Vec::new();
    if let Some(f) = from {
        clauses.push("date >= ?".to_string());
        args.push(f.clone());
    }
    if let Some(t) = to {
        clauses.push("date <= ?".to_string());
        args.push(t.clone());
    }
    if clauses.is_empty() {
        ("".to_string(), args)
    } else {
        (format!(" WHERE {}", clauses.join(" AND ")), args)
    }
}

fn date_params(range: &DateRange) -> Vec<rusqlite::types::Value> {
    let (_, mut args) = date_filter_clause(&range.from, &range.to);
    args.drain(..)
        .map(|s| rusqlite::types::Value::Text(s))
        .collect()
}

#[tauri::command]
pub fn get_dashboard(state: State<AppState>) -> Result<Dashboard, String> {
    let conn = get_db(&state)?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let today_sales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(net_total),0) FROM sales WHERE date = ?1",
            params![today],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let today_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(si.quantity * si.cost_price),0)
             FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.date = ?1",
            params![today],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let today_purchases: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total),0) FROM purchases WHERE date = ?1",
            params![today],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let today_expenses: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date = ?1",
            params![today],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let product_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let low_stock_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE quantity <= min_quantity",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let recent_sales_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sales WHERE date = ?1",
            params![today],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_suppliers: i64 = conn
        .query_row("SELECT COUNT(*) FROM suppliers", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let total_customers: i64 = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let total_debts: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(s.net_total),0) - (SELECT COALESCE(SUM(amount),0) FROM customer_payments)
             FROM sales s WHERE s.payment_method = 'credit'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let cash_collected: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(net_total),0) FROM sales WHERE payment_method != 'credit'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let payments: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM customer_payments",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let purchases_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(total),0) FROM purchases", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let expenses_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount),0) FROM expenses", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let opening: f64 = conn
        .query_row(
            "SELECT COALESCE((SELECT CAST(value AS REAL) FROM settings WHERE key = 'opening_balance'), 0)",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(Dashboard {
        today_sales: crate::db::money(today_sales),
        today_purchases: crate::db::money(today_purchases),
        today_expenses: crate::db::money(today_expenses),
        today_profit: crate::db::money(today_sales - today_cost - today_expenses),
        product_count,
        low_stock_count,
        recent_sales_count,
        total_suppliers,
        total_customers,
        total_debts: crate::db::money(total_debts),
        cash_in_hand: crate::db::money(
            opening + cash_collected + payments - purchases_total - expenses_total,
        ),
    })
}

#[tauri::command]
pub fn get_profit_loss(state: State<AppState>, range: DateRange) -> Result<ProfitLoss, String> {
    let conn = get_db(&state)?;
    let (clause, params) = date_filter_clause(&range.from, &range.to);
    let pv = date_params(&range);

    let net_sales: f64 = conn
        .query_row(
            &format!("SELECT COALESCE(SUM(net_total),0) FROM sales{clause}"),
            rusqlite::params_from_iter(pv.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let cost_total: f64 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(SUM(si.quantity * si.cost_price),0)
                 FROM sale_items si JOIN sales s ON s.id = si.sale_id{clause}"
            ),
            rusqlite::params_from_iter(pv.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let expenses_total: f64 = conn
        .query_row(
            &format!("SELECT COALESCE(SUM(amount),0) FROM expenses{clause}"),
            rusqlite::params_from_iter(pv.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let purchases_total: f64 = conn
        .query_row(
            &format!("SELECT COALESCE(SUM(total),0) FROM purchases{clause}"),
            rusqlite::params_from_iter(pv.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let sales_count: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM sales{clause}"),
            rusqlite::params_from_iter(pv.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let _ = params;
    Ok(ProfitLoss {
        sales_total: crate::db::money(net_sales),
        cost_total: crate::db::money(cost_total),
        gross_profit: crate::db::money(net_sales - cost_total),
        expenses_total: crate::db::money(expenses_total),
        purchases_total: crate::db::money(purchases_total),
        net_profit: crate::db::money(net_sales - cost_total - expenses_total),
        sales_count,
    })
}

#[tauri::command]
pub fn get_stock_value(state: State<AppState>) -> Result<StockValue, String> {
    let conn = get_db(&state)?;
    let product_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let total_value: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity * cost_price),0) FROM products",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let low_stock_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE quantity <= min_quantity",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(StockValue {
        product_count,
        total_value: crate::db::money(total_value),
        low_stock_count,
    })
}

#[tauri::command]
pub fn get_daily_sales(state: State<AppState>, range: DateRange) -> Result<Vec<DailySalesRow>, String> {
    let conn = get_db(&state)?;
    let (clause, _) = date_filter_clause(&range.from, &range.to);
    let pv = date_params(&range);
    let sql = format!(
        "SELECT s.date, COUNT(*), COALESCE(SUM(s.net_total),0),
                COALESCE(SUM(s.net_total),0) - COALESCE(SUM(si.qty_cost),0)
         FROM sales s
         LEFT JOIN (SELECT sale_id, SUM(quantity * cost_price) qty_cost
                    FROM sale_items GROUP BY sale_id) si ON si.sale_id = s.id
         {clause}
         GROUP BY s.date
         ORDER BY s.date DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(pv.iter()), |r| {
            Ok(DailySalesRow {
                date: r.get(0)?,
                sales_count: r.get(1)?,
                sales_total: r.get(2)?,
                profit: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_best_sellers(state: State<AppState>, range: DateRange) -> Result<Vec<BestSeller>, String> {
    let conn = get_db(&state)?;
    let (clause, _) = date_filter_clause(&range.from, &range.to);
    let pv = date_params(&range);
    let sql = format!(
        "SELECT p.name, SUM(si.quantity), SUM(si.quantity * si.sell_price)
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         {clause}
         GROUP BY si.product_id
         ORDER BY SUM(si.quantity) DESC
         LIMIT 10"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(pv.iter()), |r| {
            Ok(BestSeller {
                product_name: r.get(0)?,
                quantity: r.get(1)?,
                revenue: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== جرد المخزون (فاتورة جرد مؤقت) ===============

fn get_stock_count_full(conn: &Connection, id: i64) -> Result<StockCount, String> {
    let (date, status, total_difference, total_surplus, total_deficit, notes) = conn
        .query_row(
            "SELECT date, status, total_difference, total_surplus, total_deficit, notes
             FROM stock_counts WHERE id = ?1",
            params![id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, f64>(4)?,
                    r.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .map_err(|_| "فاتورة الجرد غير موجودة".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT sci.product_id, COALESCE(p.name, ''), p.barcode, sci.system_qty,
                    sci.counted_qty, sci.difference, p.unit
             FROM stock_count_items sci
             LEFT JOIN products p ON p.id = sci.product_id
             WHERE sci.count_id = ?1
             ORDER BY sci.id",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |r| {
            Ok(StockCountItem {
                product_id: r.get(0)?,
                product_name: r.get(1)?,
                barcode: r.get(2)?,
                system_qty: r.get(3)?,
                counted_qty: r.get(4)?,
                difference: r.get(5)?,
                unit: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(StockCount {
        id,
        date,
        status,
        total_difference,
        total_surplus,
        total_deficit,
        notes,
        items_count: items.len() as i64,
        items,
    })
}

#[tauri::command]
pub fn list_stock_counts(state: State<AppState>) -> Result<Vec<StockCount>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT sc.id, sc.date, sc.status, sc.total_difference, sc.total_surplus,
                    sc.total_deficit, sc.notes,
                    (SELECT COUNT(*) FROM stock_count_items sci WHERE sci.count_id = sc.id)
             FROM stock_counts sc
             ORDER BY sc.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(StockCount {
                id: r.get(0)?,
                date: r.get(1)?,
                status: r.get(2)?,
                total_difference: r.get(3)?,
                total_surplus: r.get(4)?,
                total_deficit: r.get(5)?,
                notes: r.get(6)?,
                items_count: r.get(7)?,
                items: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stock_count(state: State<AppState>, id: i64) -> Result<StockCount, String> {
    let conn = get_db(&state)?;
    get_stock_count_full(&conn, id)
}

fn save_count_items(
    tx: &rusqlite::Transaction<'_>,
    count_id: i64,
    old_system: &HashMap<i64, f64>,
    items: &[NewStockCountItem],
) -> Result<(f64, f64, f64), String> {
    let mut total_diff = 0.0;
    let mut total_surplus = 0.0;
    let mut total_deficit = 0.0;
    for it in items {
        if it.counted_qty < 0.0 {
            return Err("الكمية العدّية لا يمكن أن تكون سالبة".into());
        }
        let system_qty = match old_system.get(&it.product_id) {
            Some(q) => *q,
            None => tx
                .query_row(
                    "SELECT quantity FROM products WHERE id = ?1",
                    params![it.product_id],
                    |r| r.get::<_, f64>(0),
                )
                .map_err(|_| "منتج غير موجود".to_string())?,
        };
        let difference = crate::db::money(it.counted_qty - system_qty);
        tx.execute(
            "INSERT INTO stock_count_items (count_id, product_id, system_qty, counted_qty, difference)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![count_id, it.product_id, system_qty, it.counted_qty, difference],
        )
        .map_err(|e| e.to_string())?;
        if difference > 0.0 {
            total_surplus += difference;
        } else if difference < 0.0 {
            total_deficit += -difference;
        }
        total_diff += difference;
    }
    Ok((
        crate::db::money(total_diff),
        crate::db::money(total_surplus),
        crate::db::money(total_deficit),
    ))
}

#[tauri::command]
pub fn create_stock_count(
    state: State<AppState>,
    input: NewStockCount,
) -> Result<StockCount, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنفًا واحدًا على الأقل لفاتورة الجرد".into());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO stock_counts (date, status, total_difference, total_surplus, total_deficit, notes)
         VALUES (?1, 'draft', 0, 0, 0, ?2)",
        params![input.date, input.notes],
    )
    .map_err(|e| e.to_string())?;
    let count_id = tx.last_insert_rowid();
    let (total_diff, total_surplus, total_deficit) =
        save_count_items(&tx, count_id, &HashMap::new(), &input.items)?;
    tx.execute(
        "UPDATE stock_counts SET total_difference = ?1, total_surplus = ?2, total_deficit = ?3 WHERE id = ?4",
        params![total_diff, total_surplus, total_deficit, count_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    get_stock_count_full(&conn, count_id)
}

#[tauri::command]
pub fn update_stock_count(
    state: State<AppState>,
    id: i64,
    input: NewStockCount,
) -> Result<StockCount, String> {
    let conn = get_db(&state)?;
    if input.items.is_empty() {
        return Err("أضف صنفًا واحدًا على الأقل لفاتورة الجرد".into());
    }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let status: String = tx
        .query_row(
            "SELECT status FROM stock_counts WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "فاتورة الجرد غير موجودة".to_string())?;
    if status != "draft" {
        return Err("لا يمكن تعديل فاتورة جرد مطبّقة".into());
    }

    let mut stmt = tx
        .prepare("SELECT product_id, system_qty FROM stock_count_items WHERE count_id = ?1")
        .map_err(|e| e.to_string())?;
    let old_system = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<HashMap<i64, f64>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    tx.execute("DELETE FROM stock_count_items WHERE count_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE stock_counts SET date = ?1, notes = ?2 WHERE id = ?3",
        params![input.date, input.notes, id],
    )
    .map_err(|e| e.to_string())?;

    let (total_diff, total_surplus, total_deficit) =
        save_count_items(&tx, id, &old_system, &input.items)?;
    tx.execute(
        "UPDATE stock_counts SET total_difference = ?1, total_surplus = ?2, total_deficit = ?3 WHERE id = ?4",
        params![total_diff, total_surplus, total_deficit, id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    get_stock_count_full(&conn, id)
}

// =============== إعادة تهيئة النظام ===============

#[tauri::command]
pub fn reset_system(state: State<AppState>) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute_batch(
        "
        DELETE FROM service_order_audit_log;
        DELETE FROM service_order_notes;
        DELETE FROM service_order_payments;
        DELETE FROM service_order_parts;
        DELETE FROM service_order_checklists;
        DELETE FROM service_order_technicians;
        DELETE FROM service_order_images;
        DELETE FROM service_order_status_history;
        DELETE FROM service_orders;
        DELETE FROM device_types;
        DELETE FROM device_brands;
        DELETE FROM maintenance_settings;

        DELETE FROM warehouse_transfer_items;
        DELETE FROM warehouse_transfers;
        DELETE FROM receipt_vouchers;
        DELETE FROM payment_vouchers;

        DELETE FROM employee_shifts;
        DELETE FROM shifts;

        DELETE FROM sale_return_items;
        DELETE FROM sale_returns;
        DELETE FROM purchase_return_items;
        DELETE FROM purchase_returns;
        DELETE FROM purchase_items;
        DELETE FROM purchases;
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM customer_payments;
        DELETE FROM stock_count_items;
        DELETE FROM stock_counts;
        DELETE FROM expenses;
        DELETE FROM salaries;
        DELETE FROM vacations;
        DELETE FROM attendance;
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM suppliers;
        DELETE FROM employees;
        DELETE FROM categories;
        DELETE FROM warehouses;
        DELETE FROM settings;
        DELETE FROM sync_meta;
        DELETE FROM branches;

        DELETE FROM sqlite_sequence;
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== كتابة ملف نصي ===============

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("فشل كتابة الملف: {}", e))
}

#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| format!("فشل كتابة الملف: {}", e))
}
#[tauri::command]
pub fn delete_stock_count(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    let status: String = conn
        .query_row(
            "SELECT status FROM stock_counts WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "فاتورة الجرد غير موجودة".to_string())?;
    if status != "draft" {
        return Err("لا يمكن حذف فاتورة جرد مطبّقة".into());
    }
    conn.execute("DELETE FROM stock_counts WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn apply_stock_count(state: State<AppState>, id: i64) -> Result<StockCount, String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let status: String = tx
        .query_row(
            "SELECT status FROM stock_counts WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "فاتورة الجرد غير موجودة".to_string())?;
    if status != "draft" {
        return Err("هذه الفاتورة مطبّقة بالفعل".into());
    }

    let mut stmt = tx
        .prepare("SELECT product_id, counted_qty FROM stock_count_items WHERE count_id = ?1")
        .map_err(|e| e.to_string())?;
    let items: Vec<(i64, f64)> = stmt
        .query_map(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (pid, counted) in items {
        tx.execute(
            "UPDATE products SET quantity = ?1 WHERE id = ?2",
            params![counted, pid],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE stock_counts SET status = 'applied' WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    get_stock_count_full(&conn, id)
}

// =============== ACCOUNTING: Receipt Vouchers ===============

#[tauri::command]
pub fn list_receipt_vouchers(state: State<AppState>, search: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db(&state)?;
    let sql = "SELECT id, voucher_no, date, amount, source_type, source_id, source_name, payment_method, warehouse_id, notes, created_at
               FROM receipt_vouchers
               WHERE (?1 IS NULL OR voucher_no LIKE '%'||?1||'%' OR source_name LIKE '%'||?1||'%' OR notes LIKE '%'||?1||'%')
               ORDER BY id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![search], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?,
            "voucher_no": r.get::<_, String>(1)?,
            "date": r.get::<_, String>(2)?,
            "amount": r.get::<_, f64>(3)?,
            "source_type": r.get::<_, String>(4)?,
            "source_id": r.get::<_, Option<i64>>(5)?,
            "source_name": r.get::<_, Option<String>>(6)?,
            "payment_method": r.get::<_, String>(7)?,
            "warehouse_id": r.get::<_, Option<i64>>(8)?,
            "notes": r.get::<_, Option<String>>(9)?,
            "created_at": r.get::<_, Option<String>>(10)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_receipt_voucher(state: State<AppState>, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let conn = get_db(&state)?;
    let max_no: i64 = conn.query_row("SELECT COALESCE(MAX(CAST(SUBSTR(voucher_no, 5) AS INTEGER)), 0) FROM receipt_vouchers", [], |r| r.get(0)).unwrap_or(0);
    let voucher_no = format!("RC-{:04}", max_no + 1);
    let date = input["date"].as_str().unwrap_or("");
    let amount = input["amount"].as_f64().unwrap_or(0.0);
    let source_type = input["source_type"].as_str().unwrap_or("customer");
    let source_id = input["source_id"].as_i64();
    let source_name = input["source_name"].as_str();
    let payment_method = input["payment_method"].as_str().unwrap_or("cash");
    let warehouse_id = input["warehouse_id"].as_i64();
    let notes = input["notes"].as_str();
    conn.execute(
        "INSERT INTO receipt_vouchers (voucher_no, date, amount, source_type, source_id, source_name, payment_method, warehouse_id, notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![voucher_no, date, amount, source_type, source_id, source_name, payment_method, warehouse_id, notes],
    ).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let row = conn.query_row("SELECT id, voucher_no, date, amount, source_type, source_id, source_name, payment_method, warehouse_id, notes, created_at FROM receipt_vouchers WHERE id=?1", params![id], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?, "voucher_no": r.get::<_, String>(1)?, "date": r.get::<_, String>(2)?,
            "amount": r.get::<_, f64>(3)?, "source_type": r.get::<_, String>(4)?, "source_id": r.get::<_, Option<i64>>(5)?,
            "source_name": r.get::<_, Option<String>>(6)?, "payment_method": r.get::<_, String>(7)?,
            "warehouse_id": r.get::<_, Option<i64>>(8)?, "notes": r.get::<_, Option<String>>(9)?, "created_at": r.get::<_, Option<String>>(10)?,
        }))
    }).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub fn delete_receipt_voucher(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM receipt_vouchers WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// =============== ACCOUNTING: Payment Vouchers ===============

#[tauri::command]
pub fn list_payment_vouchers(state: State<AppState>, search: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db(&state)?;
    let sql = "SELECT id, voucher_no, date, amount, dest_type, dest_id, dest_name, payment_method, warehouse_id, notes, created_at
               FROM payment_vouchers
               WHERE (?1 IS NULL OR voucher_no LIKE '%'||?1||'%' OR dest_name LIKE '%'||?1||'%' OR notes LIKE '%'||?1||'%')
               ORDER BY id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![search], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?,
            "voucher_no": r.get::<_, String>(1)?,
            "date": r.get::<_, String>(2)?,
            "amount": r.get::<_, f64>(3)?,
            "dest_type": r.get::<_, String>(4)?,
            "dest_id": r.get::<_, Option<i64>>(5)?,
            "dest_name": r.get::<_, Option<String>>(6)?,
            "payment_method": r.get::<_, String>(7)?,
            "warehouse_id": r.get::<_, Option<i64>>(8)?,
            "notes": r.get::<_, Option<String>>(9)?,
            "created_at": r.get::<_, Option<String>>(10)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_payment_voucher(state: State<AppState>, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let conn = get_db(&state)?;
    let max_no: i64 = conn.query_row("SELECT COALESCE(MAX(CAST(SUBSTR(voucher_no, 5) AS INTEGER)), 0) FROM payment_vouchers", [], |r| r.get(0)).unwrap_or(0);
    let voucher_no = format!("PY-{:04}", max_no + 1);
    let date = input["date"].as_str().unwrap_or("");
    let amount = input["amount"].as_f64().unwrap_or(0.0);
    let dest_type = input["dest_type"].as_str().unwrap_or("supplier");
    let dest_id = input["dest_id"].as_i64();
    let dest_name = input["dest_name"].as_str();
    let payment_method = input["payment_method"].as_str().unwrap_or("cash");
    let warehouse_id = input["warehouse_id"].as_i64();
    let notes = input["notes"].as_str();
    conn.execute(
        "INSERT INTO payment_vouchers (voucher_no, date, amount, dest_type, dest_id, dest_name, payment_method, warehouse_id, notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![voucher_no, date, amount, dest_type, dest_id, dest_name, payment_method, warehouse_id, notes],
    ).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let row = conn.query_row("SELECT id, voucher_no, date, amount, dest_type, dest_id, dest_name, payment_method, warehouse_id, notes, created_at FROM payment_vouchers WHERE id=?1", params![id], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?, "voucher_no": r.get::<_, String>(1)?, "date": r.get::<_, String>(2)?,
            "amount": r.get::<_, f64>(3)?, "dest_type": r.get::<_, String>(4)?, "dest_id": r.get::<_, Option<i64>>(5)?,
            "dest_name": r.get::<_, Option<String>>(6)?, "payment_method": r.get::<_, String>(7)?,
            "warehouse_id": r.get::<_, Option<i64>>(8)?, "notes": r.get::<_, Option<String>>(9)?, "created_at": r.get::<_, Option<String>>(10)?,
        }))
    }).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub fn delete_payment_voucher(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM payment_vouchers WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// =============== ACCOUNTING: Warehouse Transfers ===============

#[tauri::command]
pub fn list_warehouse_transfers(state: State<AppState>, search: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db(&state)?;
    let sql = "SELECT t.id, t.transfer_no, t.date, w1.name, w2.name, t.transfer_type, t.amount, t.notes, t.created_at,
                      t.from_warehouse_id, t.to_warehouse_id
               FROM warehouse_transfers t
               LEFT JOIN warehouses w1 ON w1.id = t.from_warehouse_id
               LEFT JOIN warehouses w2 ON w2.id = t.to_warehouse_id
               WHERE (?1 IS NULL OR t.transfer_no LIKE '%'||?1||'%' OR w1.name LIKE '%'||?1||'%' OR w2.name LIKE '%'||?1||'%' OR t.notes LIKE '%'||?1||'%')
               ORDER BY t.id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![search], |r| {
        Ok(serde_json::json!({
            "id": r.get::<_, i64>(0)?,
            "transfer_no": r.get::<_, String>(1)?,
            "date": r.get::<_, String>(2)?,
            "from_warehouse": r.get::<_, Option<String>>(3)?,
            "to_warehouse": r.get::<_, Option<String>>(4)?,
            "transfer_type": r.get::<_, String>(5)?,
            "amount": r.get::<_, f64>(6)?,
            "notes": r.get::<_, Option<String>>(7)?,
            "created_at": r.get::<_, Option<String>>(8)?,
            "from_warehouse_id": r.get::<_, i64>(9)?,
            "to_warehouse_id": r.get::<_, i64>(10)?,
        }))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_warehouse_transfer(state: State<AppState>, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let conn = get_db(&state)?;
    let max_no: i64 = conn.query_row("SELECT COALESCE(MAX(CAST(SUBSTR(transfer_no, 4) AS INTEGER)), 0) FROM warehouse_transfers", [], |r| r.get(0)).unwrap_or(0);
    let transfer_no = format!("TR-{:04}", max_no + 1);
    let date = input["date"].as_str().unwrap_or("");
    let from_warehouse_id = input["from_warehouse_id"].as_i64().ok_or("اختر المستودع المصدر")?;
    let to_warehouse_id = input["to_warehouse_id"].as_i64().ok_or("اختر المستودع الوجهة")?;
    let transfer_type = input["transfer_type"].as_str().unwrap_or("products");
    let amount = input["amount"].as_f64().unwrap_or(0.0);
    let notes = input["notes"].as_str();

    if from_warehouse_id == to_warehouse_id {
        return Err("لا يمكن التحويل إلى نفس المستودع".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO warehouse_transfers (transfer_no, date, from_warehouse_id, to_warehouse_id, transfer_type, amount, notes) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![transfer_no, date, from_warehouse_id, to_warehouse_id, transfer_type, amount, notes],
    ).map_err(|e| e.to_string())?;
    let transfer_id = tx.last_insert_rowid();

    if transfer_type == "products" {
        if let Some(items) = input["items"].as_array() {
            for item in items {
                let product_id = item["product_id"].as_i64().unwrap_or(0);
                let quantity = item["quantity"].as_f64().unwrap_or(0.0);
                if product_id == 0 || quantity <= 0.0 { continue; }
                let cost: f64 = tx.query_row("SELECT cost_price FROM products WHERE id=?1", params![product_id], |r| r.get(0)).unwrap_or(0.0);
                tx.execute("INSERT INTO warehouse_transfer_items (transfer_id, product_id, quantity, cost_price) VALUES (?1,?2,?3,?4)",
                    params![transfer_id, product_id, quantity, cost]).map_err(|e| e.to_string())?;
                tx.execute("UPDATE products SET quantity = quantity - ?1 WHERE id = ?2 AND warehouse_id = ?3",
                    params![quantity, product_id, from_warehouse_id]).map_err(|e| e.to_string())?;
                tx.execute("UPDATE products SET quantity = quantity + ?1 WHERE id = ?2 AND warehouse_id = ?3",
                    params![quantity, product_id, to_warehouse_id]).map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    let row = conn.query_row(
        "SELECT t.id, t.transfer_no, t.date, w1.name, w2.name, t.transfer_type, t.amount, t.notes, t.created_at, t.from_warehouse_id, t.to_warehouse_id
         FROM warehouse_transfers t LEFT JOIN warehouses w1 ON w1.id=t.from_warehouse_id LEFT JOIN warehouses w2 ON w2.id=t.to_warehouse_id WHERE t.id=?1",
        params![transfer_id], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_, i64>(0)?, "transfer_no": r.get::<_, String>(1)?, "date": r.get::<_, String>(2)?,
                "from_warehouse": r.get::<_, Option<String>>(3)?, "to_warehouse": r.get::<_, Option<String>>(4)?,
                "transfer_type": r.get::<_, String>(5)?, "amount": r.get::<_, f64>(6)?, "notes": r.get::<_, Option<String>>(7)?,
                "created_at": r.get::<_, Option<String>>(8)?, "from_warehouse_id": r.get::<_, i64>(9)?, "to_warehouse_id": r.get::<_, i64>(10)?,
            }))
    }).map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
pub fn delete_warehouse_transfer(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("DELETE FROM warehouse_transfer_items WHERE transfer_id=?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM warehouse_transfers WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
pub fn install_update(file_path: String) -> Result<String, String> {
    use std::process::Command;

    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("الملف غير موجود".into());
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "msi" && ext != "exe" {
        return Err("صيغة الملف غير مدعومة - يُقبل فقط .msi أو .exe".into());
    }

    if ext == "msi" {
        Command::new("msiexec")
            .args(["/i", &file_path, "/qn", "/norestart"])
            .spawn()
            .map_err(|e| format!("فشل تشغيل المُثبّت: {e}"))?;
    } else {
        Command::new(&file_path)
            .args(["/S", "/silent", "/quiet"])
            .spawn()
            .map_err(|e| format!("فشل تشغيل المُثبّت: {e}"))?;
    }

    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(3));
        std::process::exit(0);
    });

    Ok("جاري التحديث...".into())
}

#[derive(serde::Serialize)]
pub struct OnlineUpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub current_version: String,
    pub download_url: String,
    pub file_name: String,
    pub body: String,
    pub published_at: String,
}

const GITHUB_REPO: &str = "amrromya/TABARAK";

#[tauri::command]
pub async fn check_online_update() -> Result<OnlineUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "tabarak-updater")
        .send()
        .await
        .map_err(|e| format!("فشل الاتصال بـ GitHub: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub رد بحالة {}", resp.status()));
    }

    let release: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("فشل قراءة البيانات: {e}"))?;

    let tag_name = release["tag_name"].as_str().unwrap_or("0.0.0");
    let latest_version = tag_name.trim_start_matches('v').to_string();
    let body = release["body"].as_str().unwrap_or("").to_string();
    let published_at = release["published_at"].as_str().unwrap_or("").to_string();

    let assets = release["assets"].as_array().cloned().unwrap_or_default();
    let asset = assets.iter().find(|a| {
        let name = a["name"].as_str().unwrap_or("").to_lowercase();
        name.ends_with(".exe") || name.ends_with(".msi")
    });

    let download_url = asset
        .and_then(|a| a["browser_download_url"].as_str())
        .unwrap_or("")
        .to_string();

    let file_name = asset
        .and_then(|a| a["name"].as_str())
        .unwrap_or("")
        .to_string();

    let has_update = compare_versions(&latest_version, &current_version);

    Ok(OnlineUpdateInfo {
        has_update,
        latest_version,
        current_version,
        download_url,
        file_name,
        body,
        published_at,
    })
}

#[tauri::command]
pub async fn download_online_update(url: String, file_name: String) -> Result<String, String> {
    let dirs = dirs::download_dir().ok_or("لا يمكن الوصول لمجلد التنزيلات")?;
    let dest = dirs.join(&file_name);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "tabarak-updater")
        .send()
        .await
        .map_err(|e| format!("فشل بدء التحميل: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("فشل التحميل - حالة: {}", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("فشل تحميل الملف: {e}"))?;

    std::fs::write(&dest, &bytes).map_err(|e| format!("فشل حفظ الملف: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn apply_online_update(file_path: String) -> Result<String, String> {
    use std::process::Command;

    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("الملف غير موجود".into());
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "msi" {
        Command::new("msiexec")
            .args(["/i", &file_path, "/qn", "/norestart"])
            .spawn()
            .map_err(|e| format!("فشل تشغيل المُثبّت: {e}"))?;
    } else if ext == "exe" {
        Command::new(&file_path)
            .args(["/S", "/silent", "/quiet"])
            .spawn()
            .map_err(|e| format!("فشل تشغيل المُثبّت: {e}"))?;
    } else {
        return Err("صيغة غير مدعومة".into());
    }

    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(3));
        std::process::exit(0);
    });

    Ok("جاري التحديث... سيُعاد تشغيل البرنامج".into())
}

fn compare_versions(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };
    let lv = parse(latest);
    let cv = parse(current);
    for i in 0..lv.len().max(cv.len()) {
        let l = lv.get(i).copied().unwrap_or(0);
        let c = cv.get(i).copied().unwrap_or(0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }
    false
}
