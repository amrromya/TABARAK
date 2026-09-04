use crate::models::*;
use crate::AppState;
use rusqlite::backup::Backup;
use rusqlite::{params, Connection, OpenFlags};
use std::collections::HashMap;
use tauri::Manager;
use tauri::Emitter;
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
            cash_in: crate::utils::money(cash_in),
            cash_out: crate::utils::money(cash_out),
            balance: crate::utils::money(balance),
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
        quantity: crate::utils::money(quantity.unwrap_or(0.0)),
        value: crate::utils::money(value.unwrap_or(0.0)),
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
               p.cost_price, p.sell_price, p.wholesale_price, p.quantity, p.min_quantity, p.opening_balance,
               p.composite_category_id, cc.name, p.product_type
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        LEFT JOIN categories cc ON cc.id = p.composite_category_id
        WHERE (?1 IS NULL OR p.name LIKE '%' || ?1 || '%' OR p.barcode LIKE '%' || ?1 || '%'
               OR c.name LIKE '%' || ?1 || '%' OR w.name LIKE '%' || ?1 || '%'
               OR p.unit LIKE '%' || ?1 || '%'
               OR CAST(p.cost_price AS INTEGER) = CAST(?1 AS INTEGER)
               OR CAST(p.sell_price AS INTEGER) = CAST(?1 AS INTEGER))
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
                wholesale_price: r.get(10)?,
                quantity: r.get(11)?,
                min_quantity: r.get(12)?,
                opening_balance: r.get(13)?,
                composite_category_id: r.get(14)?,
                composite_category_name: r.get(15)?,
                product_type: r.get::<_, String>(16).unwrap_or_else(|_| "inventory".to_string()),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_products_paged(
    state: State<AppState>,
    search: Option<String>,
    page: i64,
    page_size: i64,
) -> Result<(Vec<Product>, i64), String> {
    let conn = get_db(&state)?;
    let ps = if page_size <= 0 { 50 } else { page_size };
    let offset = (page - 1) * ps;

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products p
             WHERE (?1 IS NULL OR p.name LIKE '%' || ?1 || '%' OR p.barcode LIKE '%' || ?1 || '%')",
            params![search],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let sql = "
        SELECT p.id, p.name, p.barcode, p.category_id, c.name, p.warehouse_id, w.name, p.unit,
               p.cost_price, p.sell_price, p.wholesale_price, p.quantity, p.min_quantity, p.opening_balance,
               p.composite_category_id, cc.name, p.product_type
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        LEFT JOIN categories cc ON cc.id = p.composite_category_id
        WHERE (?1 IS NULL OR p.name LIKE '%' || ?1 || '%' OR p.barcode LIKE '%' || ?1 || '%')
        ORDER BY p.name COLLATE NOCASE
        LIMIT ?2 OFFSET ?3";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search, ps, offset], |r| {
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
                wholesale_price: r.get(10)?,
                quantity: r.get(11)?,
                min_quantity: r.get(12)?,
                opening_balance: r.get(13)?,
                composite_category_id: r.get(14)?,
                composite_category_name: r.get(15)?,
                product_type: r.get::<_, String>(16).unwrap_or_else(|_| "inventory".to_string()),
            })
        })
        .map_err(|e| e.to_string())?;
    let products = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    Ok((products, total))
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
    let product_type = if input.product_type.is_empty() { "inventory".to_string() } else { input.product_type };
    conn.execute(
        "INSERT INTO products (name, barcode, category_id, warehouse_id, unit, cost_price, sell_price, wholesale_price, quantity, min_quantity, composite_category_id, product_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            input.name.trim(),
            barcode,
            input.category_id,
            input.warehouse_id,
            input.unit,
            input.cost_price,
            input.sell_price,
            input.wholesale_price,
            input.quantity,
            input.min_quantity,
            input.composite_category_id,
            product_type,
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
    let product_type = if input.product_type.is_empty() { "inventory".to_string() } else { input.product_type };
    conn.execute(
        "UPDATE products SET name=?1, barcode=?2, category_id=?3, warehouse_id=?4, unit=?5,
         cost_price=?6, sell_price=?7, wholesale_price=?8, quantity=?9, min_quantity=?10, composite_category_id=?11, product_type=?12 WHERE id=?13",
        params![
            input.name.trim(),
            barcode,
            input.category_id,
            input.warehouse_id,
            input.unit,
            input.cost_price,
            input.sell_price,
            input.wholesale_price,
            input.quantity,
            input.min_quantity,
            input.composite_category_id,
            product_type,
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
                p.cost_price, p.sell_price, p.wholesale_price, p.quantity, p.min_quantity, p.opening_balance,
                p.composite_category_id, cc.name, p.product_type
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         LEFT JOIN categories cc ON cc.id = p.composite_category_id
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
                wholesale_price: r.get(10)?,
                quantity: r.get(11)?,
                min_quantity: r.get(12)?,
                opening_balance: r.get(13)?,
                composite_category_id: r.get(14)?,
                composite_category_name: r.get(15)?,
                product_type: r.get::<_, String>(16).unwrap_or_else(|_| "inventory".to_string()),
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

    add_movements(
        "SELECT sop.id, so.created_at, 'maintenance', so.order_no, 'قطع صيانة', -sop.quantity, sop.sell_price, (sop.quantity * sop.sell_price), so.id, c.name, NULL, NULL, so.payment_method
         FROM service_order_parts sop
         JOIN service_orders so ON so.id = sop.order_id
         LEFT JOIN customers c ON c.id = so.customer_id
         WHERE sop.product_id = ?1",
    )?;

    movements.sort_by(|a, b| b.date.cmp(&a.date).then(b.id.cmp(&a.id)));
    Ok(movements)
}

// =============== الموردون ===============

#[tauri::command]
pub fn list_suppliers(state: State<AppState>) -> Result<Vec<Supplier>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, phone, address, credit_limit, notes FROM suppliers ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Supplier {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                address: r.get(3)?,
                credit_limit: r.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                notes: r.get(5)?,
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
        "INSERT INTO suppliers (name, phone, address, credit_limit, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.name.trim(), input.phone, input.address, input.credit_limit.unwrap_or(0.0), input.notes],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Supplier {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        address: input.address,
        credit_limit: input.credit_limit.unwrap_or(0.0),
        notes: input.notes,
    })
}

#[tauri::command]
pub fn update_supplier(state: State<AppState>, id: i64, input: NewSupplier) -> Result<Supplier, String> {
    let conn = get_db(&state)?;
    if input.name.trim().is_empty() {
        return Err("اسم المورد مطلوب".into());
    }
    conn.execute(
        "UPDATE suppliers SET name = ?1, phone = ?2, address = ?3, credit_limit = ?4, notes = ?5 WHERE id = ?6",
        params![input.name.trim(), input.phone, input.address, input.credit_limit.unwrap_or(0.0), input.notes, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(Supplier {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        address: input.address,
        credit_limit: input.credit_limit.unwrap_or(0.0),
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

#[tauri::command]
pub fn get_supplier_account(state: State<AppState>, supplier_id: i64) -> Result<SupplierAccountSummary, String> {
    let conn = get_db(&state)?;

    let total_purchases: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = ?1",
            params![supplier_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_purchase_returns: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0) FROM purchase_returns WHERE supplier_id = ?1",
            params![supplier_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM receipt_vouchers WHERE source_type = 'supplier' AND source_id = ?1",
            params![supplier_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_received: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payment_vouchers WHERE dest_type = 'supplier' AND dest_id = ?1",
            params![supplier_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let balance = total_purchases - total_purchase_returns - total_paid + total_received;

    Ok(SupplierAccountSummary {
        supplier_id,
        total_purchases,
        total_purchase_returns,
        total_paid,
        total_received,
        balance,
    })
}

#[derive(serde::Serialize)]
pub struct SupplierAccountSummary {
    pub supplier_id: i64,
    pub total_purchases: f64,
    pub total_purchase_returns: f64,
    pub total_paid: f64,
    pub total_received: f64,
    pub balance: f64,
}

#[tauri::command]
pub fn get_supplier_transactions(state: State<AppState>, supplier_id: i64) -> Result<Vec<SupplierTransaction>, String> {
    let conn = get_db(&state)?;
    let mut txns: Vec<SupplierTransaction> = Vec::new();

    // المشتريات
    {
        let mut stmt = conn
            .prepare("SELECT id, date, total, notes FROM purchases WHERE supplier_id = ?1 ORDER BY date DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![supplier_id], |r| {
            Ok(SupplierTransaction {
                date: r.get::<_, String>(1)?,
                description: format!("مشتريات رقم P-{}", r.get::<_, i64>(0)?),
                debit: r.get::<_, f64>(2)?,
                credit: 0.0,
                notes: r.get::<_, Option<String>>(3)?,
            })
        }).map_err(|e| e.to_string())?;
        for r in rows { if let Ok(t) = r { txns.push(t); } }
    }

    // مردود المشتريات
    {
        let mut stmt = conn
            .prepare("SELECT id, date, total, notes FROM purchase_returns WHERE supplier_id = ?1 ORDER BY date DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![supplier_id], |r| {
            Ok(SupplierTransaction {
                date: r.get::<_, String>(1)?,
                description: format!("مردود مشتريات رقم {}", r.get::<_, i64>(0)?),
                debit: 0.0,
                credit: r.get::<_, f64>(2)?,
                notes: r.get::<_, Option<String>>(3)?,
            })
        }).map_err(|e| e.to_string())?;
        for r in rows { if let Ok(t) = r { txns.push(t); } }
    }

    // سندات القبض (مدفوعات للمورد)
    {
        let mut stmt = conn
            .prepare("SELECT id, date, amount, notes FROM receipt_vouchers WHERE source_type = 'supplier' AND source_id = ?1 ORDER BY date DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![supplier_id], |r| {
            Ok(SupplierTransaction {
                date: r.get::<_, String>(1)?,
                description: format!("سند قبض رقم {}", r.get::<_, i64>(0)?),
                debit: 0.0,
                credit: r.get::<_, f64>(2)?,
                notes: r.get::<_, Option<String>>(3)?,
            })
        }).map_err(|e| e.to_string())?;
        for r in rows { if let Ok(t) = r { txns.push(t); } }
    }

    // سندات الصرف (مبالغ من المورد)
    {
        let mut stmt = conn
            .prepare("SELECT id, date, amount, notes FROM payment_vouchers WHERE dest_type = 'supplier' AND dest_id = ?1 ORDER BY date DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![supplier_id], |r| {
            Ok(SupplierTransaction {
                date: r.get::<_, String>(1)?,
                description: format!("سند صرف رقم {}", r.get::<_, i64>(0)?),
                debit: r.get::<_, f64>(2)?,
                credit: 0.0,
                notes: r.get::<_, Option<String>>(3)?,
            })
        }).map_err(|e| e.to_string())?;
        for r in rows { if let Ok(t) = r { txns.push(t); } }
    }

    txns.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(txns)
}

#[derive(serde::Serialize)]
pub struct SupplierTransaction {
    pub date: String,
    pub description: String,
    pub debit: f64,
    pub credit: f64,
    pub notes: Option<String>,
}

// =============== العملاء ===============

fn customer_balance_sql() -> &'static str {
    "SELECT c.id, c.name, c.phone, c.notes,
        (SELECT COALESCE(SUM(net_total),0) FROM sales
         WHERE customer_id = c.id AND payment_method = 'credit')
        - (SELECT COALESCE(SUM(amount),0) FROM customer_payments
           WHERE customer_id = c.id),
        c.customer_type
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
                customer_type: r.get(5)?,
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
    let ctype = input.customer_type.as_deref().unwrap_or("regular");
    conn.execute(
        "INSERT INTO customers (name, phone, notes, customer_type) VALUES (?1, ?2, ?3, ?4)",
        params![input.name.trim(), input.phone, input.notes, ctype],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Customer {
        id,
        name: input.name.trim().to_string(),
        phone: input.phone,
        notes: input.notes,
        balance: 0.0,
        customer_type: ctype.to_string(),
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
        "UPDATE customers SET name=?1, phone=?2, notes=?3, customer_type=?4 WHERE id=?5",
        params![input.name.trim(), input.phone, input.notes, input.customer_type.as_deref().unwrap_or("regular"), id],
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
            customer_type: r.get(5)?,
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
            "SELECT si.sale_id, si.product_id, p.name, si.quantity, si.sell_price, (si.quantity * si.sell_price), si.item_name
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
                        item_name: r.get(6)?,
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
pub fn get_product_components(state: State<AppState>, product_id: i64) -> Result<Vec<ProductComponent>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.composite_product_id, pc.component_product_id,
                    p.name, p.unit, p.quantity, pc.quantity_per_unit
             FROM product_components pc
             JOIN products p ON p.id = pc.component_product_id
             WHERE pc.composite_product_id = ?1
             ORDER BY p.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![product_id], |r| {
            Ok(ProductComponent {
                id: r.get(0)?,
                composite_product_id: r.get(1)?,
                component_product_id: r.get(2)?,
                component_name: r.get(3)?,
                component_unit: r.get(4)?,
                component_quantity: r.get(5)?,
                quantity_per_unit: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_product_components(
    state: State<AppState>,
    product_id: i64,
    components: Vec<NewProductComponent>,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM product_components WHERE composite_product_id = ?1", params![product_id])
        .map_err(|e| e.to_string())?;
    for c in &components {
        if c.quantity_per_unit <= 0.0 {
            return Err("كمية المكون يجب أن تكون أكبر من صفر".into());
        }
        tx.execute(
            "INSERT INTO product_components (composite_product_id, component_product_id, quantity_per_unit)
             VALUES (?1, ?2, ?3)",
            params![product_id, c.component_product_id, c.quantity_per_unit],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_products_by_category(state: State<AppState>, category_id: i64) -> Result<Vec<Product>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.barcode, p.category_id, c.name, p.warehouse_id, w.name, p.unit,
                p.cost_price, p.sell_price, p.wholesale_price, p.quantity, p.min_quantity, p.opening_balance,
                p.composite_category_id, cc.name, p.product_type
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         LEFT JOIN categories cc ON cc.id = p.composite_category_id
         WHERE p.category_id = ?1
         ORDER BY p.name COLLATE NOCASE"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![category_id], |r| {
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
            wholesale_price: r.get(10)?,
            quantity: r.get(11)?,
            min_quantity: r.get(12)?,
            opening_balance: r.get(13)?,
            composite_category_id: r.get(14)?,
            composite_category_name: r.get(15)?,
            product_type: r.get::<_, String>(16).unwrap_or_else(|_| "inventory".to_string()),
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
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
        let has_components: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM product_components WHERE composite_product_id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT pc.quantity_per_unit, p.quantity, p.name
                     FROM product_components pc
                     JOIN products p ON p.id = pc.component_product_id
                     WHERE pc.composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let components: Vec<(f64, f64, String)> = stmt
                .query_map(params![it.product_id], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            for (qty_per_unit, comp_available, comp_name) in &components {
                let needed = it.quantity * qty_per_unit;
                if comp_available < &needed {
                    return Err(format!(
                        "الكمية غير كافية للمنتج «{comp_name}» (المتوفر: {comp_available})"
                    ));
                }
            }
        } else {
            let (available, ptype): (f64, String) = tx
                .query_row(
                    "SELECT quantity, COALESCE(product_type, 'inventory') FROM products WHERE id = ?1",
                    params![it.product_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(|_| "منتج غير موجود".to_string())?;
            if ptype != "service" && available < it.quantity {
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
        let subtotal = crate::utils::money(it.quantity * it.sell_price);
        let has_components: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM product_components WHERE composite_product_id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let cost_price: f64 = if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT pc.quantity_per_unit, p.cost_price
                     FROM product_components pc
                     JOIN products p ON p.id = pc.component_product_id
                     WHERE pc.composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let comp_costs: Vec<(f64, f64)> = stmt
                .query_map(params![it.product_id], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            comp_costs.iter().map(|(q, c)| q * c).sum::<f64>()
        } else {
            tx.query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?
        };
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price, item_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![sale_id, it.product_id, it.quantity, it.sell_price, cost_price, it.item_name],
        )
        .map_err(|e| e.to_string())?;
        if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT component_product_id, quantity_per_unit
                     FROM product_components WHERE composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let comps: Vec<(i64, f64)> = stmt
                .query_map(params![it.product_id], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            for (comp_id, qty_per) in comps {
                tx.execute(
                    "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
                    params![it.quantity * qty_per, comp_id],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            tx.execute(
                "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
                params![it.quantity, it.product_id],
            )
            .map_err(|e| e.to_string())?;
        }
        total += subtotal;
    }

    let total = crate::utils::money(total);
    let net_total = crate::utils::money(total - input.discount + additional);
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
        let has_comp: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM product_components WHERE composite_product_id = ?1",
                params![pid],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if has_comp > 0 {
            let mut s = tx
                .prepare("SELECT component_product_id, quantity_per_unit FROM product_components WHERE composite_product_id = ?1")
                .map_err(|e| e.to_string())?;
            let comps: Vec<(i64, f64)> = s
                .query_map(params![pid], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(s);
            for (cid, qpu) in comps {
                tx.execute(
                    "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
                    params![qty * qpu, cid],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            tx.execute(
                "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
                params![qty, pid],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.execute("DELETE FROM sale_items WHERE sale_id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    for it in &input.items {
        if it.quantity <= 0.0 {
            return Err("الكمية يجب أن تكون أكبر من صفر".into());
        }
        let has_components: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM product_components WHERE composite_product_id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT pc.quantity_per_unit, p.quantity, p.name
                     FROM product_components pc
                     JOIN products p ON p.id = pc.component_product_id
                     WHERE pc.composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let components: Vec<(f64, f64, String)> = stmt
                .query_map(params![it.product_id], |r| {
                    Ok((r.get(0)?, r.get(1)?, r.get(2)?))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            for (qty_per_unit, comp_available, comp_name) in &components {
                let needed = it.quantity * qty_per_unit;
                if comp_available < &needed {
                    return Err(format!(
                        "الكمية غير كافية للمنتج «{comp_name}» (المتوفر: {comp_available})"
                    ));
                }
            }
        } else {
            let (available, ptype): (f64, String) = tx
                .query_row(
                    "SELECT quantity, COALESCE(product_type, 'inventory') FROM products WHERE id = ?1",
                    params![it.product_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(|_| "منتج غير موجود".to_string())?;
            if ptype != "service" && available < it.quantity {
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
        let subtotal = crate::utils::money(it.quantity * it.sell_price);
        let has_components: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM product_components WHERE composite_product_id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let cost_price: f64 = if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT pc.quantity_per_unit, p.cost_price
                     FROM product_components pc
                     JOIN products p ON p.id = pc.component_product_id
                     WHERE pc.composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let comp_costs: Vec<(f64, f64)> = stmt
                .query_map(params![it.product_id], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            comp_costs.iter().map(|(q, c)| q * c).sum::<f64>()
        } else {
            tx.query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?
        };
        tx.execute(
            "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price, item_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, it.product_id, it.quantity, it.sell_price, cost_price, it.item_name],
        )
        .map_err(|e| e.to_string())?;
        if has_components > 0 {
            let mut stmt = tx
                .prepare(
                    "SELECT component_product_id, quantity_per_unit
                     FROM product_components WHERE composite_product_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let comps: Vec<(i64, f64)> = stmt
                .query_map(params![it.product_id], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            drop(stmt);
            for (comp_id, qty_per) in comps {
                tx.execute(
                    "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
                    params![it.quantity * qty_per, comp_id],
                )
                .map_err(|e| e.to_string())?;
            }
        } else {
            tx.execute(
                "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
                params![it.quantity, it.product_id],
            )
            .map_err(|e| e.to_string())?;
        }
        total += subtotal;
    }

    let total = crate::utils::money(total);
    let net_total = crate::utils::money(total - input.discount + additional);
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
            "SELECT si.product_id, p.name, si.quantity, si.sell_price, (si.quantity * si.sell_price), si.item_name
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
                item_name: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut sale = sale;
    sale.items = items;
    Ok(sale)
}

// ==================== Cash Register ====================

fn get_current_session(conn: &Connection) -> Result<Option<CashRegisterSession>, String> {
    let result = conn.query_row(
        "SELECT id, opened_at, closed_at, opened_by, closed_by, opening_balance, closing_balance, actual_cash, status FROM cash_register_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1",
        [],
        |r| {
            Ok(CashRegisterSession {
                id: r.get(0)?,
                opened_at: r.get(1)?,
                closed_at: r.get(2)?,
                opened_by: r.get(3)?,
                closed_by: r.get(4)?,
                opening_balance: r.get(5)?,
                closing_balance: r.get(6)?,
                actual_cash: r.get(7)?,
                status: r.get(8)?,
            })
        },
    );
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_cash_session(state: State<AppState>) -> Result<Option<CashRegisterSession>, String> {
    let conn = get_db(&state)?;
    get_current_session(&conn)
}

#[tauri::command]
pub fn open_cash_register(state: State<AppState>, opening_balance: f64, opened_by: Option<String>) -> Result<CashRegisterSession, String> {
    let conn = get_db(&state)?;
    if get_current_session(&conn)?.is_some() {
        return Err("يوجد جلسة صندوق مفتوحة بالفعل".into());
    }
    conn.execute(
        "INSERT INTO cash_register_sessions (opened_at, opened_by, opening_balance, status) VALUES (datetime('now','localtime'), ?1, ?2, 'open')",
        params![opened_by, opening_balance],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let session = conn.query_row(
        "SELECT id, opened_at, closed_at, opened_by, closed_by, opening_balance, closing_balance, actual_cash, status FROM cash_register_sessions WHERE id = ?1",
        params![id],
        |r| {
            Ok(CashRegisterSession {
                id: r.get(0)?,
                opened_at: r.get(1)?,
                closed_at: r.get(2)?,
                opened_by: r.get(3)?,
                closed_by: r.get(4)?,
                opening_balance: r.get(5)?,
                closing_balance: r.get(6)?,
                actual_cash: r.get(7)?,
                status: r.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())?;
    Ok(session)
}

#[tauri::command]
pub fn close_cash_register(state: State<AppState>, closing_balance: f64, actual_cash: f64, closed_by: Option<String>) -> Result<CashRegisterSession, String> {
    let conn = get_db(&state)?;
    let session = get_current_session(&conn)?.ok_or("لا توجد جلسة صندوق مفتوحة")?;
    conn.execute(
        "UPDATE cash_register_sessions SET closed_at = datetime('now','localtime'), closed_by = ?1, closing_balance = ?2, actual_cash = ?3, status = 'closed' WHERE id = ?4",
        params![closed_by, closing_balance, actual_cash, session.id],
    )
    .map_err(|e| e.to_string())?;
    let updated = conn.query_row(
        "SELECT id, opened_at, closed_at, opened_by, closed_by, opening_balance, closing_balance, actual_cash, status FROM cash_register_sessions WHERE id = ?1",
        params![session.id],
        |r| {
            Ok(CashRegisterSession {
                id: r.get(0)?,
                opened_at: r.get(1)?,
                closed_at: r.get(2)?,
                opened_by: r.get(3)?,
                closed_by: r.get(4)?,
                opening_balance: r.get(5)?,
                closing_balance: r.get(6)?,
                actual_cash: r.get(7)?,
                status: r.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())?;
    Ok(updated)
}

#[tauri::command]
pub fn add_cash_movement(state: State<AppState>, input: NewCashMovement) -> Result<CashRegisterMovement, String> {
    let conn = get_db(&state)?;
    let session = get_current_session(&conn)?.ok_or("لا توجد جلسة صندوق مفتوحة")?;
    conn.execute(
        "INSERT INTO cash_register_movements (session_id, type, amount, description, reference_id, reference_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![session.id, input.r#type, input.amount, input.description, input.reference_id, input.reference_type],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let mov = conn.query_row(
        "SELECT id, session_id, type, amount, description, reference_id, reference_type, created_at FROM cash_register_movements WHERE id = ?1",
        params![id],
        |r| {
            Ok(CashRegisterMovement {
                id: r.get(0)?,
                session_id: r.get(1)?,
                r#type: r.get(2)?,
                amount: r.get(3)?,
                description: r.get(4)?,
                reference_id: r.get(5)?,
                reference_type: r.get(6)?,
                created_at: r.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())?;
    Ok(mov)
}

#[tauri::command]
pub fn list_cash_movements(state: State<AppState>) -> Result<Vec<CashRegisterMovement>, String> {
    let conn = get_db(&state)?;
    let session = get_current_session(&conn)?.ok_or("لا توجد جلسة صندوق مفتوحة")?;
    let mut stmt = conn
        .prepare("SELECT id, session_id, type, amount, description, reference_id, reference_type, created_at FROM cash_register_movements WHERE session_id = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session.id], |r| {
            Ok(CashRegisterMovement {
                id: r.get(0)?,
                session_id: r.get(1)?,
                r#type: r.get(2)?,
                amount: r.get(3)?,
                description: r.get(4)?,
                reference_id: r.get(5)?,
                reference_type: r.get(6)?,
                created_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn get_cash_session_summary(state: State<AppState>) -> Result<Option<CashSessionSummary>, String> {
    let conn = get_db(&state)?;
    let session = match get_current_session(&conn)? {
        Some(s) => s,
        None => return Ok(None),
    };
    let movements = {
        let mut stmt = conn
            .prepare("SELECT id, session_id, type, amount, description, reference_id, reference_type, created_at FROM cash_register_movements WHERE session_id = ?1 ORDER BY id")
            .map_err(|e| e.to_string())?;
        let result: Vec<CashRegisterMovement> = stmt
            .query_map(params![session.id], |r| {
                Ok(CashRegisterMovement {
                    id: r.get(0)?,
                    session_id: r.get(1)?,
                    r#type: r.get(2)?,
                    amount: r.get(3)?,
                    description: r.get(4)?,
                    reference_id: r.get(5)?,
                    reference_type: r.get(6)?,
                    created_at: r.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        result
    };
    let total_in: f64 = movements.iter().filter(|m| m.amount > 0.0).map(|m| m.amount).sum();
    let total_out: f64 = movements.iter().filter(|m| m.amount < 0.0).map(|m| m.amount.abs()).sum();
    let expected_cash = session.opening_balance + total_in - total_out;
    Ok(Some(CashSessionSummary {
        session,
        movements,
        total_in,
        total_out,
        expected_cash,
        difference: None,
    }))
}

#[tauri::command]
pub fn list_cash_sessions(state: State<AppState>) -> Result<Vec<CashRegisterSession>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, opened_at, closed_at, opened_by, closed_by, opening_balance, closing_balance, actual_cash, status FROM cash_register_sessions ORDER BY id DESC LIMIT 100")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CashRegisterSession {
                id: r.get(0)?,
                opened_at: r.get(1)?,
                closed_at: r.get(2)?,
                opened_by: r.get(3)?,
                closed_by: r.get(4)?,
                opening_balance: r.get(5)?,
                closing_balance: r.get(6)?,
                actual_cash: r.get(7)?,
                status: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
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
        let subtotal = crate::utils::money(it.quantity * it.cost_price);
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

    let total = crate::utils::money(total + additional - discount);
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
        let subtotal = crate::utils::money(it.quantity * it.cost_price);
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

    let total = crate::utils::money(total + additional - discount);
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
        let subtotal = crate::utils::money(it.quantity * it.cost_price);
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

    let total = crate::utils::money(total + additional - discount);
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
            "SELECT sri.return_id, sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price), sri.item_name
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
                        item_name: r.get(7)?,
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
            "SELECT sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price), sri.item_name
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
                item_name: r.get(6)?,
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
        let subtotal = crate::utils::money(it.quantity * it.sell_price);
        let cost_price: f64 = tx
            .query_row(
                "SELECT cost_price FROM products WHERE id = ?1",
                params![it.product_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO sale_return_items (return_id, product_id, quantity, sell_price, cost_price, item_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![return_id, it.product_id, it.quantity, it.sell_price, cost_price, it.item_name],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
            params![it.quantity, it.product_id],
        )
        .map_err(|e| e.to_string())?;
        total += subtotal;
    }

    let total = crate::utils::money(total + additional - discount);
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
            "SELECT sri.product_id, p.name, sri.quantity, sri.sell_price, sri.cost_price, (sri.quantity * sri.sell_price), sri.item_name
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
                item_name: r.get(6)?,
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

// =============== كلمات المرور ===============

#[tauri::command]
pub fn verify_section_password(state: State<AppState>, password: String) -> Result<bool, String> {
    let conn = get_db(&state)?;
    let stored: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'section_password_hash'",
            [],
            |r| r.get(0),
        )
        .ok();
    match stored {
        Some(expected) => {
            match bcrypt::verify(&password, &expected) {
                Ok(result) => Ok(result),
                Err(_) => {
                    // Hash may be corrupted — fallback: check if password matches "5506" default
                    if password == "5506" {
                        if let Ok(new_hash) = bcrypt::hash("5506", bcrypt::DEFAULT_COST) {
                            let _ = conn.execute(
                                "INSERT OR REPLACE INTO settings (key, value) VALUES ('section_password_hash', ?1)",
                                params![new_hash],
                            );
                        }
                        Ok(true)
                    } else {
                        Ok(false)
                    }
                }
            }
        }
        None => {
            // No hash exists — set default "5506"
            if let Ok(hash) = bcrypt::hash("5506", bcrypt::DEFAULT_COST) {
                let _ = conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('section_password_hash', ?1)",
                    params![hash],
                );
            }
            // Now verify
            if password == "5506" {
                Ok(true)
            } else {
                Ok(false)
            }
        }
    }
}

#[tauri::command]
pub fn change_section_password(
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let stored: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'section_password_hash'",
            [],
            |r| r.get(0),
        )
        .ok();
    match &stored {
        Some(expected) => {
            let ok = match bcrypt::verify(&current_password, expected) {
                Ok(result) => result,
                Err(_) => current_password == "5506",
            };
            if !ok {
                return Err("كلمة المرور الحالية خاطئة".into());
            }
        }
        None => {
            if current_password != "5506" {
                return Err("كلمة المرور الحالية خاطئة".into());
            }
        }
    }
    if new_password.len() < 4 {
        return Err("كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل".into());
    }
    let hash = bcrypt::hash(new_password.as_bytes(), bcrypt::DEFAULT_COST)
        .map_err(|e| format!("فشل تشفير كلمة المرور: {e}"))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('section_password_hash', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![hash],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
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
            "SELECT COUNT(*) FROM products WHERE quantity <= min_quantity AND product_type != 'service'",
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
    let payment_vouchers_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM payment_vouchers WHERE payment_method = 'cash'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let receipt_vouchers_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM receipt_vouchers WHERE payment_method = 'cash'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let opening: f64 = conn
        .query_row(
            "SELECT COALESCE((SELECT CAST(value AS REAL) FROM settings WHERE key = 'opening_balance'), 0)",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(Dashboard {
        today_sales: crate::utils::money(today_sales),
        today_purchases: crate::utils::money(today_purchases),
        today_expenses: crate::utils::money(today_expenses),
        today_profit: crate::utils::money(today_sales - today_cost - today_expenses),
        product_count,
        low_stock_count,
        recent_sales_count,
        total_suppliers,
        total_customers,
        total_debts: crate::utils::money(total_debts),
        cash_in_hand: crate::utils::money(
            opening + cash_collected + payments + receipt_vouchers_total - purchases_total - expenses_total - payment_vouchers_total,
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
        sales_total: crate::utils::money(net_sales),
        cost_total: crate::utils::money(cost_total),
        gross_profit: crate::utils::money(net_sales - cost_total),
        expenses_total: crate::utils::money(expenses_total),
        purchases_total: crate::utils::money(purchases_total),
        net_profit: crate::utils::money(net_sales - cost_total - expenses_total),
        sales_count,
    })
}

#[tauri::command]
pub fn get_stock_value(state: State<AppState>) -> Result<StockValue, String> {
    let conn = get_db(&state)?;
    let product_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products WHERE product_type != 'service'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let total_value: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity * cost_price),0) FROM products WHERE product_type != 'service'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let low_stock_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE quantity <= min_quantity AND product_type != 'service'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(StockValue {
        product_count,
        total_value: crate::utils::money(total_value),
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
        let difference = crate::utils::money(it.counted_qty - system_qty);
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
        crate::utils::money(total_diff),
        crate::utils::money(total_surplus),
        crate::utils::money(total_deficit),
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
    if payment_method == "cash" {
        let has_session: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM cash_register_sessions WHERE status = 'open')", [], |r| r.get(0)
        ).unwrap_or(false);
        if has_session {
            conn.execute(
                "INSERT INTO cash_register_movements (session_id, type, amount, description, reference_id, reference_type) SELECT id, 'receipt_voucher', ?1, ?2, ?3, 'receipt_voucher' FROM cash_register_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1",
                params![amount, format!("سند قبض {} — {}", voucher_no, source_name.unwrap_or("")), id],
            ).map_err(|e| e.to_string())?;
        }
    }
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
    conn.execute("DELETE FROM cash_register_movements WHERE reference_id = ?1 AND reference_type = 'receipt_voucher'", params![id]).map_err(|e| e.to_string())?;
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
    if payment_method == "cash" {
        let has_session: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM cash_register_sessions WHERE status = 'open')", [], |r| r.get(0)
        ).unwrap_or(false);
        if has_session {
            conn.execute(
                "INSERT INTO cash_register_movements (session_id, type, amount, description, reference_id, reference_type) SELECT id, 'payment_voucher', ?1, ?2, ?3, 'payment_voucher' FROM cash_register_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1",
                params![-amount, format!("سند صرف {} — {}", voucher_no, dest_name.unwrap_or("")), id],
            ).map_err(|e| e.to_string())?;
        }
    }
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
    conn.execute("DELETE FROM cash_register_movements WHERE reference_id = ?1 AND reference_type = 'payment_voucher'", params![id]).map_err(|e| e.to_string())?;
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
pub async fn download_online_update(app: tauri::AppHandle, url: String, file_name: String) -> Result<String, String> {
    use futures_util::StreamExt;

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

    let total_size = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(&dest).map_err(|e| format!("فشل إنشاء الملف: {e}"))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("فشل تحميل الملف: {e}"))?;
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| format!("فشل حفظ الملف: {e}"))?;
        downloaded += chunk.len() as u64;
        let percent = if total_size > 0 {
            (downloaded as f64 / total_size as f64 * 100.0) as u32
        } else {
            0
        };
        let _ = app.emit("update-download-progress", serde_json::json!({
            "downloaded": downloaded,
            "total": total_size,
            "percent": percent,
        }));
    }

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

// =============== الطابعات ===============

#[tauri::command]
pub fn list_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let printers: Vec<String> = stdout
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();
        Ok(printers)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn print_turn_number(number: i32, store_name: String, created_at: String, printer_name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let store_esc = store_name.replace('\'', "''");
        let time_esc = created_at.replace('\'', "''");
        let printer_name_esc = printer_name.replace('\'', "''");

        let ps_script = format!(
            "Add-Type -AssemblyName System.Drawing\n\
             Add-Type -AssemblyName System.Drawing.Printing\n\
             $doc = New-Object System.Drawing.Printing.PrintDocument\n\
             $doc.DocumentName = 'Tabarak Turn #{number}'\n\
             $doc.OriginAtMargins = $false\n\
             $doc.DefaultPageSettings.Margins = (New-Object System.Drawing.Printing.Margins(0,0,0,0))\n\
             $doc.DefaultPageSettings.PaperSize = $doc.PrinterSettings.PaperSizes[0]\n\
             if ('{printer_name_esc}') {{ try {{ $doc.PrinterSettings.PrinterName = '{printer_name_esc}' }} catch {{}} }}\n\
             $w = $doc.DefaultPageSettings.PaperSize.Width\n\
             $h = $doc.DefaultPageSettings.PaperSize.Height\n\
             $doc.Add_PrintPage({{ param($sender, $e)\n\
               $g = $e.Graphics\n\
               $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit\n\
               $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality\n\
               $center = [System.Drawing.StringAlignment]::Center\n\
               $far = [System.Drawing.StringAlignment]::Far\n\
               $storeFont = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Bold)\n\
               $labelFont = New-Object System.Drawing.Font('Arial', 7)\n\
               $numFont = New-Object System.Drawing.Font('Arial', 36, [System.Drawing.FontStyle]::Bold)\n\
               $timeFont = New-Object System.Drawing.Font('Arial', 6)\n\
               $brush = [System.Drawing.Brushes]::Black\n\
               $cx = $w / 2\n\
               $g.DrawString('{store_esc}', $storeFont, $brush, $cx, 10, (New-Object System.Drawing.StringFormat {{ Alignment = $center }}))\n\
               $g.DrawString('رقم الدور', $labelFont, $brush, $cx, 30, (New-Object System.Drawing.StringFormat {{ Alignment = $center }}))\n\
               $numText = '#{number}'\n\
               $numSize = $g.MeasureString($numText, $numFont)\n\
               $g.DrawString($numText, $numFont, $brush, $cx - ($numSize.Width / 2), 45)\n\
               $g.DrawString('{time_esc}', $timeFont, $brush, $cx, 110, (New-Object System.Drawing.StringFormat {{ Alignment = $center }}))\n\
             }})\n\
             $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController\n\
             $doc.Print()\n\
             $doc.Dispose()",
            number = number,
            store_esc = store_esc,
            time_esc = time_esc,
            printer_name_esc = printer_name_esc
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Print failed: {}", stderr));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Direct printing is only supported on Windows".into())
    }
}

#[tauri::command]
pub fn print_sale_receipt(
    store_name: String,
    phone: String,
    address: String,
    invoice_no: String,
    date: String,
    customer_name: String,
    payment_method: String,
    employee_name: String,
    items_json: String,
    total: f64,
    discount: f64,
    additional: f64,
    net_total: f64,
    currency: String,
    footer: String,
    printer_width: String,
    printer_name: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let store_esc = store_name.replace('\'', "''");
        let phone_esc = phone.replace('\'', "''");
        let address_esc = address.replace('\'', "''");
        let invoice_esc = invoice_no.replace('\'', "''");
        let date_esc = date.replace('\'', "''");
        let customer_esc = customer_name.replace('\'', "''");
        let payment_esc = payment_method.replace('\'', "''");
        let employee_esc = employee_name.replace('\'', "''");
        let footer_esc = footer.replace('\'', "''");
        let currency_esc = currency.replace('\'', "''");
        let items_esc = items_json.replace('\'', "''");
        let printer_name_esc = printer_name.replace('\'', "''");

        let is_58mm = printer_width == "58mm";
        let width_px = if is_58mm { 300 } else { 400 };
        let font_size = if is_58mm { 9 } else { 10 };
        let title_size = if is_58mm { 11 } else { 12 };

        let ps_script = format!(
            "Add-Type -AssemblyName System.Drawing\n\
             Add-Type -AssemblyName System.Drawing.Printing\n\
             $doc = New-Object System.Drawing.Printing.PrintDocument\n\
             $doc.DocumentName = 'Sale Invoice {invoice_esc}'\n\
             $doc.OriginAtMargins = $false\n\
             $doc.DefaultPageSettings.Margins = (New-Object System.Drawing.Printing.Margins(10,10,10,10))\n\
             $items = ConvertFrom-Json -InputObject '{items_esc}'\n\
             if ('{printer_name_esc}') {{ try {{ $doc.PrinterSettings.PrinterName = '{printer_name_esc}' }} catch {{}} }}\n\
             $doc.Add_PrintPage({{ param($sender, $e)\n\
               $g = $e.Graphics\n\
               $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit\n\
               $y = 10\n\
               $cx = {width_px} / 2\n\
               $right = {width_px} - 10\n\
               $font = New-Object System.Drawing.Font('Courier New', {font_size})\n\
               $boldFont = New-Object System.Drawing.Font('Courier New', {font_size}, [System.Drawing.FontStyle]::Bold)\n\
               $titleFont = New-Object System.Drawing.Font('Courier New', {title_size}, [System.Drawing.FontStyle]::Bold)\n\
               $smallFont = New-Object System.Drawing.Font('Courier New', {font_size} - 1)\n\
               $brush = [System.Drawing.Brushes]::Black\n\
               $center = New-Object System.Drawing.StringFormat {{ Alignment = [System.Drawing.StringAlignment]::Center }}\n\
               $right2 = New-Object System.Drawing.StringFormat {{ Alignment = [System.Drawing.StringAlignment]::Far }}\n\
               $pen = New-Object System.Drawing.Pen([System.Drawing.Brushes]::Black, 1)\n\
               $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash\n\
               \n\
               $g.DrawString('{store_esc}', $titleFont, $brush, $cx, $y, $center)\n\
               $y += 22\n\
               if ('{phone_esc}') {{ $g.DrawString('Tel: {phone_esc}', $smallFont, $brush, $cx, $y, $center); $y += 16 }}\n\
               if ('{address_esc}') {{ $g.DrawString('{address_esc}', $smallFont, $brush, $cx, $y, $center); $y += 16 }}\n\
               $g.DrawLine($pen, 10, $y, $right, $y); $y += 6\n\
               $g.DrawString('SALE INVOICE', $boldFont, $brush, $cx, $y, $center); $y += 18\n\
               $g.DrawString('#{invoice_esc}', $boldFont, $brush, $right, $y, $right2); $y += 18\n\
               $g.DrawString('Date: {date_esc}', $font, $brush, $right, $y, $right2); $y += 16\n\
               $g.DrawString('Customer: {customer_esc}', $font, $brush, $right, $y, $right2); $y += 16\n\
               $g.DrawString('Payment: {payment_esc}', $font, $brush, $right, $y, $right2); $y += 16\n\
               if ('{employee_esc}') {{ $g.DrawString('Employee: {employee_esc}', $font, $brush, $right, $y, $right2); $y += 16 }}\n\
               $g.DrawLine($pen, 10, $y, $right, $y); $y += 6\n\
               \n\
               foreach ($item in $items) {{\n\
                 $name = $item.name\n\
                 if ($name.Length -gt 20) {{ $name = $name.Substring(0, 18) + '..' }}\n\
                 $line = $name + ' ' + $item.qty + ' x ' + $item.price + ' = ' + $item.total\n\
                 $g.DrawString($line, $font, $brush, $right, $y, $right2)\n\
                 $y += 16\n\
               }}\n\
               \n\
               $g.DrawLine($pen, 10, $y, $right, $y); $y += 6\n\
               $g.DrawString('Total: ' + [math]::Round({total}, 2).ToString('F2'), $font, $brush, $right, $y, $right2); $y += 16\n\
               $g.DrawString('Discount: ' + [math]::Round({discount}, 2).ToString('F2'), $font, $brush, $right, $y, $right2); $y += 16\n\
               if ({additional} -gt 0) {{ $g.DrawString('Additional: ' + [math]::Round({additional}, 2).ToString('F2'), $font, $brush, $right, $y, $right2); $y += 16 }}\n\
               $g.DrawString('NET: ' + [math]::Round({net_total}, 2).ToString('F2') + ' {currency_esc}', $boldFont, $brush, $right, $y, $right2); $y += 20\n\
               \n\
               $g.DrawLine($pen, 10, $y, $right, $y); $y += 6\n\
               if ('{footer_esc}') {{ $g.DrawString('{footer_esc}', $smallFont, $brush, $cx, $y, $center); $y += 16 }}\n\
               $g.DrawString('Thank you!', $boldFont, $brush, $cx, $y, $center)\n\
             }})\n\
             $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController\n\
             $doc.Print()\n\
             $doc.Dispose()",
            store_esc = store_esc,
            phone_esc = phone_esc,
            address_esc = address_esc,
            invoice_esc = invoice_esc,
            date_esc = date_esc,
            customer_esc = customer_esc,
            payment_esc = payment_esc,
            employee_esc = employee_esc,
            footer_esc = footer_esc,
            currency_esc = currency_esc,
            items_esc = items_esc,
            printer_name_esc = printer_name_esc,
            width_px = width_px,
            font_size = font_size,
            title_size = title_size,
            total = total,
            discount = discount,
            additional = additional,
            net_total = net_total,
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Print failed: {}", stderr));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Direct printing is only supported on Windows".into())
    }
}

#[tauri::command]
pub fn print_barcode_label(
    barcode_image_base64: String,
    product_name: String,
    barcode_value: String,
    price: f64,
    store_name: String,
    quantity: i32,
    width_mm: f64,
    height_mm: f64,
    show_name: bool,
    show_price: bool,
    show_barcode: bool,
    show_store: bool,
    printer_name: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::io::Write;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let temp_dir = std::env::temp_dir();
        let uid = uuid::Uuid::new_v4().to_string();
        let img_path = temp_dir.join(format!("tabarak_bc_{}.png", uid));
        let img_path_esc = img_path.to_string_lossy().replace('\\', "\\\\");

        let b64_data = barcode_image_base64
            .trim_start_matches("data:image/png;base64,")
            .trim_start_matches("data:image/jpeg;base64,");

        if let Ok(bytes) = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            b64_data,
        ) {
            std::fs::write(&img_path, &bytes).map_err(|e| e.to_string())?;
        } else {
            return Err("Failed to decode barcode image".into());
        }

        let name_esc = product_name.replace('\'', "''");
        let bc_esc = barcode_value.replace('\'', "''");
        let store_esc = store_name.replace('\'', "''");
        let printer_name_esc = printer_name.replace('\'', "''");

        let show_name_i32 = if show_name { 1 } else { 0 };
        let show_price_i32 = if show_price { 1 } else { 0 };
        let show_bc_i32 = if show_barcode { 1 } else { 0 };
        let show_store_i32 = if show_store { 1 } else { 0 };
        let qty_i32 = quantity.max(1);

        let ps_script = format!(
            "Add-Type -AssemblyName System.Drawing\n\
             Add-Type -AssemblyName System.Drawing.Printing\n\
             $doc = New-Object System.Drawing.Printing.PrintDocument\n\
             $doc.DocumentName = 'Barcode {bc_esc}'\n\
             $doc.OriginAtMargins = $false\n\
             $doc.DefaultPageSettings.Margins = (New-Object System.Drawing.Printing.Margins(5,5,5,5))\n\
             if ('{printer_name_esc}') {{ try {{ $doc.PrinterSettings.PrinterName = '{printer_name_esc}' }} catch {{}} }}\n\
             $copiesLeft = {qty_i32}\n\
             $doc.Add_PrintPage({{ param($sender, $e)\n\
               $g = $e.Graphics\n\
               $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit\n\
               $pw = $e.PageBounds.Width\n\
               $cx = [float]($pw / 2)\n\
               $y = [float]8\n\
               $brush = [System.Drawing.Brushes]::Black\n\
               $font = New-Object System.Drawing.Font('Arial', 8)\n\
               $nameFont = New-Object System.Drawing.Font('Arial', 9, [System.Drawing.FontStyle]::Bold)\n\
               $bcFont = New-Object System.Drawing.Font('Courier New', 7)\n\
               $fmt = New-Object System.Drawing.StringFormat\n\
               $fmt.Alignment = [System.Drawing.StringAlignment]::Center\n\
               $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near\n\
               $fmt.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft\n\
               \n\
               if ({show_store_i32} -eq 1) {{\n\
                 $g.DrawString(\"{store_esc}\", $font, $brush, $cx, $y, $fmt)\n\
                 $y += 16\n\
               }}\n\
               if ({show_name_i32} -eq 1) {{\n\
                 $g.DrawString(\"{name_esc}\", $nameFont, $brush, $cx, $y, $fmt)\n\
                 $y += 20\n\
               }}\n\
               $img = [System.Drawing.Image]::FromFile(\"{img_path_esc}\")\n\
               $iw = $pw - 16\n\
               $ih = [int]([float]$iw * [float]$img.Height / [float]$img.Width)\n\
               $g.DrawImage($img, [float](($pw - $iw) / 2), $y, [float]$iw, [float]$ih)\n\
               $img.Dispose()\n\
               $y += $ih + 4\n\
               if ({show_bc_i32} -eq 1) {{\n\
                 $g.DrawString(\"{bc_esc}\", $bcFont, $brush, $cx, $y, $fmt)\n\
                 $y += 14\n\
               }}\n\
               if ({show_price_i32} -eq 1) {{\n\
                 $priceStr = [math]::Round({price}, 2).ToString('F2') + ' EGP'\n\
                 $g.DrawString($priceStr, $font, $brush, $cx, $y, $fmt)\n\
               }}\n\
               $copiesLeft -= 1\n\
               if ($copiesLeft -gt 0) {{ $e.HasMorePages = $true }} else {{ $e.HasMorePages = $false }}\n\
             }})\n\
             $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController\n\
             $doc.Print()\n\
             $doc.Dispose()\n\
             Remove-Item \"{img_path_esc}\" -ErrorAction SilentlyContinue",
            img_path_esc = img_path_esc,
            bc_esc = bc_esc,
            name_esc = name_esc,
            store_esc = store_esc,
            printer_name_esc = printer_name_esc,
            qty_i32 = qty_i32,
            show_name_i32 = show_name_i32,
            show_price_i32 = show_price_i32,
            show_bc_i32 = show_bc_i32,
            show_store_i32 = show_store_i32,
            price = price,
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Barcode print failed: {}", stderr));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Direct printing is only supported on Windows".into())
    }
}

// =============== أول تشغيل ===============

#[tauri::command]
pub fn is_first_run(state: State<AppState>) -> Result<bool, String> {
    let conn = get_db(&state)?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM settings WHERE key = 'admin_initialized'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count == 0)
}

#[tauri::command]
pub fn initialize_admin(
    state: State<AppState>,
    admin_name: String,
    admin_password: String,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    if admin_name.trim().is_empty() {
        return Err("اسم المستخدم مطلوب".into());
    }
    if admin_password.len() < 6 {
        return Err("كلمة المرور يجب أن تكون 6 أحرف على الأقل".into());
    }
    // حفظ كلمة مرور الأدمن في الإعدادات (مش في ملف الحسابات)
    let hash = bcrypt::hash(admin_password.as_bytes(), bcrypt::DEFAULT_COST)
        .map_err(|e| format!("فشل تشفير كلمة المرور: {e}"))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![hash],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('admin_name', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![admin_name],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('admin_initialized', '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn verify_admin_password(
    state: State<AppState>,
    password: String,
) -> Result<bool, String> {
    let conn = get_db(&state)?;
    let stored_hash: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'admin_password_hash'",
            [],
            |r| r.get(0),
        )
        .ok();
    match stored_hash {
        Some(expected) => {
            bcrypt::verify(&password, &expected)
                .map_err(|_| "فشل التحقق من كلمة المرور".to_string())
        }
        None => Err("لم يتم تهيئة كلمة مرور الأدمن بعد".to_string()),
    }
}

#[tauri::command]
pub fn change_admin_password(
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    // Inline verification to avoid moving state
    let stored_hash: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'admin_password_hash'",
            [],
            |r| r.get(0),
        )
        .ok();
    let ok = match stored_hash {
        Some(expected) => {
            bcrypt::verify(&current_password, &expected).unwrap_or(false)
        }
        None => return Err("لم يتم تهيئة كلمة مرور الأدمن بعد".to_string()),
    };
    if !ok {
        return Err("كلمة المرور الحالية خاطئة".into());
    }
    if new_password.len() < 6 {
        return Err("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل".into());
    }
    let hash = bcrypt::hash(new_password.as_bytes(), bcrypt::DEFAULT_COST)
        .map_err(|e| format!("فشل تشفير كلمة المرور: {e}"))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![hash],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== التصدير CSV ===============

/// Sanitize a string field for CSV output to prevent CSV injection and formatting issues.
fn csv_field(s: &str) -> String {
    let trimmed = s.trim();
    // If starts with dangerous prefix, prepend single quote to neutralize
    if let Some(first) = trimmed.chars().next() {
        if first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r' || first == '\n' {
            return format!("'{}", trimmed.replace('"', "\"\""));
        }
    }
    // If contains comma, quote, or newline, wrap in quotes
    if trimmed.contains(',') || trimmed.contains('"') || trimmed.contains('\n') || trimmed.contains('\r') {
        format!("\"{}\"", trimmed.replace('"', "\"\""))
    } else {
        trimmed.to_string()
    }
}

#[tauri::command]
pub fn export_products_csv(state: State<AppState>) -> Result<String, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT p.name, p.barcode, c.name, w.name, p.unit, p.cost_price, p.sell_price, p.quantity, p.min_quantity
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN warehouses w ON w.id = p.warehouse_id
             ORDER BY p.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let mut csv = String::from("Name,Barcode,Category,Warehouse,Unit,Cost Price,Sell Price,Quantity,Min Qty\n");
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, Option<String>>(0).unwrap_or_default(),
                r.get::<_, Option<String>>(1).unwrap_or_default(),
                r.get::<_, Option<String>>(2).unwrap_or_default(),
                r.get::<_, Option<String>>(3).unwrap_or_default(),
                r.get::<_, Option<String>>(4).unwrap_or_default(),
                r.get::<_, f64>(5).unwrap_or(0.0),
                r.get::<_, f64>(6).unwrap_or(0.0),
                r.get::<_, f64>(7).unwrap_or(0.0),
                r.get::<_, f64>(8).unwrap_or(0.0),
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (name, barcode, cat, wh, unit, cost, sell, qty, min) = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},{}\n",
            csv_field(&name.unwrap_or_default()),
            csv_field(&barcode.unwrap_or_default()),
            csv_field(&cat.unwrap_or_default()),
            csv_field(&wh.unwrap_or_default()),
            csv_field(&unit.unwrap_or_default()),
            cost, sell, qty, min
        ));
    }
    Ok(csv)
}

#[tauri::command]
pub fn export_sales_csv(
    state: State<AppState>,
    from: Option<String>,
    to: Option<String>,
) -> Result<String, String> {
    let conn = get_db(&state)?;
    let (clause, pv) = if from.is_some() || to.is_some() {
        let f = from.unwrap_or_default();
        let t = to.unwrap_or_default();
        let mut parts = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if !f.is_empty() {
            parts.push("s.date >= ?".to_string());
            params.push(Box::new(f));
        }
        if !t.is_empty() {
            parts.push("s.date <= ?".to_string());
            params.push(Box::new(t));
        }
        if parts.is_empty() {
            (String::new(), params)
        } else {
            (format!(" WHERE {}", parts.join(" AND ")), params)
        }
    } else {
        (String::new(), vec![])
    };

    let sql = format!(
        "SELECT s.invoice_no, s.date, s.customer_name, s.total, s.discount, s.additional, s.net_total, s.payment_method
         FROM sales s{clause} ORDER BY s.date DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();

    let mut csv = String::from("Invoice,Date,Customer,Total,Discount,Additional,Net Total,Payment\n");
    let rows = stmt
        .query_map(param_refs.as_slice(), |r| {
            Ok((
                r.get::<_, String>(0).unwrap_or_default(),
                r.get::<_, String>(1).unwrap_or_default(),
                r.get::<_, Option<String>>(2).unwrap_or_default(),
                r.get::<_, f64>(3).unwrap_or(0.0),
                r.get::<_, f64>(4).unwrap_or(0.0),
                r.get::<_, f64>(5).unwrap_or(0.0),
                r.get::<_, f64>(6).unwrap_or(0.0),
                r.get::<_, String>(7).unwrap_or_default(),
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (inv, date, cust, total, disc, add, net, pay) = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            csv_field(&inv), csv_field(&date), csv_field(&cust.unwrap_or_default()), total, disc, add, net, csv_field(&pay)
        ));
    }
    Ok(csv)
}

#[tauri::command]
pub fn export_purchases_csv(
    state: State<AppState>,
    from: Option<String>,
    to: Option<String>,
) -> Result<String, String> {
    let conn = get_db(&state)?;
    let (clause, pv) = if from.is_some() || to.is_some() {
        let f = from.unwrap_or_default();
        let t = to.unwrap_or_default();
        let mut parts = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if !f.is_empty() {
            parts.push("date >= ?".to_string());
            params.push(Box::new(f));
        }
        if !t.is_empty() {
            parts.push("date <= ?".to_string());
            params.push(Box::new(t));
        }
        if parts.is_empty() {
            (String::new(), params)
        } else {
            (format!(" WHERE {}", parts.join(" AND ")), params)
        }
    } else {
        (String::new(), vec![])
    };

    let sql = format!(
        "SELECT date, total, discount, additional, notes
         FROM purchases{clause} ORDER BY date DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();

    let mut csv = String::from("Date,Total,Discount,Additional,Notes\n");
    let rows = stmt
        .query_map(param_refs.as_slice(), |r| {
            Ok((
                r.get::<_, String>(0).unwrap_or_default(),
                r.get::<_, f64>(1).unwrap_or(0.0),
                r.get::<_, f64>(2).unwrap_or(0.0),
                r.get::<_, f64>(3).unwrap_or(0.0),
                r.get::<_, Option<String>>(4).unwrap_or_default(),
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (date, total, disc, add, notes) = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{},{},{}\n",
            csv_field(&date), total, disc, add, csv_field(&notes.unwrap_or_default())
        ));
    }
    Ok(csv)
}

// =============== النسخ الاحتياطي التلقائي ===============

lazy_static::lazy_static! {
    static ref BACKUP_TIMERS: Mutex<Vec<std::sync::mpsc::Sender<()>>> = Mutex::new(Vec::new());
}

#[tauri::command]
pub fn start_auto_backup(state: State<AppState>) -> Result<(), String> {
    let db_path = state.db_path.clone();
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    BACKUP_TIMERS.lock().map_err(|e| e.to_string())?.push(tx);

    std::thread::spawn(move || {
        let backup_interval = std::time::Duration::from_secs(24 * 60 * 60);
        loop {
            std::thread::sleep(backup_interval);
            if rx.try_recv().is_ok() {
                break;
            }
            if let Some(parent) = db_path.parent() {
                let backup_dir = parent.join("backups");
                let _ = std::fs::create_dir_all(&backup_dir);
                let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
                let backup_path = backup_dir.join(format!("tabarak_{}.db", timestamp));
                let _ = std::fs::copy(&db_path, &backup_path);
                if let Ok(entries) = std::fs::read_dir(&backup_dir) {
                    let mut backups: Vec<_> = entries
                        .filter_map(|e| e.ok())
                        .filter(|e| e.path().extension().map_or(false, |ext| ext == "db"))
                        .collect();
                    backups.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
                    while backups.len() > 7 {
                        if let Some(oldest) = backups.first() {
                            let _ = std::fs::remove_file(oldest.path());
                        }
                        backups.remove(0);
                    }
                }
            }
        }
    });
    Ok(())
}

// =============== البحث في الصيانة ===============

#[tauri::command]
pub fn search_service_orders(
    state: State<AppState>,
    query: String,
) -> Result<Vec<crate::maintenance_models::ServiceOrderSummary>, String> {
    let conn = get_db(&state)?;
    let q = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT so.id, so.order_no, c.name, c.phone, so.device_type, so.device_brand, so.device_model,
                    so.status, so.total_cost, so.amount_paid, (so.total_cost - so.amount_paid) AS remaining,
                    so.warranty_end, so.original_order_id, so.created_at, so.updated_at
             FROM service_orders so
             LEFT JOIN customers c ON c.id = so.customer_id
             WHERE so.order_no LIKE ?1
                OR c.name LIKE ?1
                OR c.phone LIKE ?1
                OR so.device_brand LIKE ?1
                OR so.device_model LIKE ?1
                OR so.serial_number LIKE ?1
                OR so.imei LIKE ?1
             ORDER BY so.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![q], |r| {
            Ok(crate::maintenance_models::ServiceOrderSummary {
                id: r.get(0)?,
                order_no: r.get(1)?,
                customer_name: r.get(2)?,
                customer_phone: r.get(3)?,
                device_type: r.get(4)?,
                device_brand: r.get(5)?,
                device_model: r.get(6)?,
                status: r.get(7)?,
                total_cost: r.get(8)?,
                amount_paid: r.get(9)?,
                remaining: r.get(10)?,
                warranty_end: r.get(11)?,
                original_order_id: r.get(12)?,
                created_at: r.get(13)?,
                updated_at: r.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn force_exit() {
    std::process::exit(0);
}

#[tauri::command]
pub fn close_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// =============== وحدات الصنف ===============

#[tauri::command]
pub fn list_product_units(state: State<AppState>, product_id: i64) -> Result<Vec<ProductUnit>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, product_id, unit_name, conversion_factor, sell_price, barcode FROM product_units WHERE product_id = ?1 ORDER BY conversion_factor")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![product_id], |r| {
            Ok(ProductUnit {
                id: r.get(0)?,
                product_id: r.get(1)?,
                unit_name: r.get(2)?,
                conversion_factor: r.get(3)?,
                sell_price: r.get(4)?,
                barcode: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn save_product_units(state: State<AppState>, product_id: i64, units: Vec<NewProductUnit>) -> Result<Vec<ProductUnit>, String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM product_units WHERE product_id = ?1", params![product_id])
        .map_err(|e| e.to_string())?;
    for u in &units {
        tx.execute(
            "INSERT INTO product_units (product_id, unit_name, conversion_factor, sell_price, barcode) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![product_id, u.unit_name, u.conversion_factor, u.sell_price, u.barcode],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, product_id, unit_name, conversion_factor, sell_price, barcode FROM product_units WHERE product_id = ?1 ORDER BY conversion_factor")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![product_id], |r| {
            Ok(ProductUnit {
                id: r.get(0)?,
                product_id: r.get(1)?,
                unit_name: r.get(2)?,
                conversion_factor: r.get(3)?,
                sell_price: r.get(4)?,
                barcode: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}
