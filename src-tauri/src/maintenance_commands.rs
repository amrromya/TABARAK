use crate::utils::money;
use crate::maintenance_models::*;
use crate::AppState;
use chrono::Local;
use rusqlite::params;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

fn get_db<'a>(
    state: &'a State<'_, AppState>,
) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    state.db.lock().map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerSearchResult {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewChecklistItem {
    pub item_name: String,
    pub status: String,
    pub notes: Option<String>,
}

// =============== Helper functions ===============

fn today_str() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn time_str() -> String {
    Local::now().format("%H:%M:%S").to_string()
}

fn generate_order_no(conn: &Connection) -> Result<String, String> {
    let year = Local::now().format("%Y").to_string();
    let prefix = format!("SRV-{}-", year);
    let last: Option<String> = conn
        .query_row(
            "SELECT order_no FROM service_orders WHERE order_no LIKE ?1 ORDER BY id DESC LIMIT 1",
            params![format!("{}%", prefix)],
            |r| r.get(0),
        )
        .ok();
    let seq = if let Some(ref no) = last {
        let num_part = no.rsplit('-').next().unwrap_or("0");
        num_part.parse::<i64>().unwrap_or(0) + 1
    } else {
        1
    };
    Ok(format!("{}{:06}", prefix, seq))
}

fn recalc_total(conn: &Connection, order_id: i64) -> Result<(), String> {
    let parts_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(cost_price * quantity), 0) FROM service_order_parts WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let order: (f64, f64, f64) = conn
        .query_row(
            "SELECT labor_cost, service_cost, discount FROM service_orders WHERE id = ?1",
            params![order_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;
    let (labor_cost, service_cost, discount) = order;
    let tax_rate: f64 = conn
        .query_row(
            "SELECT tax_rate FROM service_orders WHERE id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let subtotal = parts_total + labor_cost + service_cost - discount;
    let tax = money(subtotal * tax_rate / 100.0);
    let total = money(subtotal + tax);
    conn.execute(
        "UPDATE service_orders SET parts_cost = ?1, total_cost = ?2, updated_at = datetime('now','localtime') WHERE id = ?3",
        params![money(parts_total), total, order_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn add_audit_log(
    conn: &Connection,
    order_id: i64,
    action: &str,
    user_name: Option<&str>,
    details: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO service_order_audit_log (order_id, action, user_name, details) VALUES (?1, ?2, ?3, ?4)",
        params![order_id, action, user_name, details],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_full_order(conn: &Connection, id: i64) -> Result<ServiceOrder, String> {
    let order = conn.query_row(
        "SELECT so.id, so.order_no, so.customer_id, c.name, c.phone, so.device_type, so.device_brand,
                so.device_model, so.serial_number, so.imei, so.device_color, so.device_condition,
                so.accessories, so.device_password, so.customer_complaint, so.diagnosis,
                so.repair_action, so.technician_notes, so.status, so.parts_cost, so.labor_cost,
                so.service_cost, so.discount, so.tax_rate, so.total_cost, so.amount_paid,
                (so.total_cost - so.amount_paid) AS remaining,
                so.customer_approval, so.approval_date, so.approval_price, so.approval_notes,
                so.warranty_days, so.warranty_start, so.warranty_end, so.original_order_id,
                so.delivered_to, so.delivered_phone, so.delivered_date, so.delivered_time,
                so.payment_method, so.received_by, so.delivered_by,
                e1.name, e2.name
         FROM service_orders so
         LEFT JOIN customers c ON c.id = so.customer_id
         LEFT JOIN employees e1 ON e1.id = so.received_by
         LEFT JOIN employees e2 ON e2.id = so.delivered_by
         WHERE so.id = ?1",
        params![id],
        |r| {
            Ok(ServiceOrder {
                id: r.get(0)?,
                order_no: r.get(1)?,
                customer_id: r.get(2)?,
                customer_name: r.get(3)?,
                customer_phone: r.get(4)?,
                device_type: r.get(5)?,
                device_brand: r.get(6)?,
                device_model: r.get(7)?,
                serial_number: r.get(8)?,
                imei: r.get(9)?,
                device_color: r.get(10)?,
                device_condition: r.get(11)?,
                accessories: r.get(12)?,
                device_password: r.get(13)?,
                customer_complaint: r.get(14)?,
                diagnosis: r.get(15)?,
                repair_action: r.get(16)?,
                technician_notes: r.get(17)?,
                status: r.get(18)?,
                parts_cost: r.get(19)?,
                labor_cost: r.get(20)?,
                service_cost: r.get(21)?,
                discount: r.get(22)?,
                tax_rate: r.get(23)?,
                total_cost: r.get(24)?,
                amount_paid: r.get(25)?,
                remaining: r.get(26)?,
                customer_approval: r.get(27)?,
                approval_date: r.get(28)?,
                approval_price: r.get(29)?,
                approval_notes: r.get(30)?,
                warranty_days: r.get(31)?,
                warranty_start: r.get(32)?,
                warranty_end: r.get(33)?,
                original_order_id: r.get(34)?,
                delivered_to: r.get(35)?,
                delivered_phone: r.get(36)?,
                delivered_date: r.get(37)?,
                delivered_time: r.get(38)?,
                payment_method: r.get(39)?,
                received_by: r.get(40)?,
                delivered_by: r.get(41)?,
                received_by_name: r.get(42)?,
                delivered_by_name: r.get(43)?,
                images: Vec::new(),
                technicians: Vec::new(),
                checklist: Vec::new(),
                parts: Vec::new(),
                payments: Vec::new(),
                notes: Vec::new(),
                history: Vec::new(),
            })
        },
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, image_path, image_type, description FROM service_order_images WHERE order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let images = stmt
        .query_map(params![id], |r| {
            Ok(ServiceImage {
                id: r.get(0)?,
                order_id: r.get(1)?,
                image_path: r.get(2)?,
                image_type: r.get(3)?,
                description: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT sot.id, sot.order_id, sot.technician_id, e.name, sot.work_type, sot.start_time, sot.end_time, sot.notes
             FROM service_order_technicians sot
             LEFT JOIN employees e ON e.id = sot.technician_id
             WHERE sot.order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let technicians = stmt
        .query_map(params![id], |r| {
            Ok(ServiceTechnician {
                id: r.get(0)?,
                order_id: r.get(1)?,
                technician_id: r.get(2)?,
                technician_name: r.get(3)?,
                work_type: r.get(4)?,
                start_time: r.get(5)?,
                end_time: r.get(6)?,
                notes: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, item_name, status, notes FROM service_order_checklists WHERE order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let checklist = stmt
        .query_map(params![id], |r| {
            Ok(ServiceChecklist {
                id: r.get(0)?,
                order_id: r.get(1)?,
                item_name: r.get(2)?,
                status: r.get(3)?,
                notes: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, product_id, part_name, quantity, cost_price, sell_price FROM service_order_parts WHERE order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let parts = stmt
        .query_map(params![id], |r| {
            Ok(ServicePart {
                id: r.get(0)?,
                order_id: r.get(1)?,
                product_id: r.get(2)?,
                part_name: r.get(3)?,
                quantity: r.get(4)?,
                cost_price: r.get(5)?,
                sell_price: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT sop.id, sop.order_id, sop.amount, sop.payment_method, sop.date, sop.notes, sop.received_by, e.name
             FROM service_order_payments sop
             LEFT JOIN employees e ON e.id = sop.received_by
             WHERE sop.order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let payments = stmt
        .query_map(params![id], |r| {
            Ok(ServicePayment {
                id: r.get(0)?,
                order_id: r.get(1)?,
                amount: r.get(2)?,
                payment_method: r.get(3)?,
                date: r.get(4)?,
                notes: r.get(5)?,
                received_by: r.get(6)?,
                received_by_name: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT son.id, son.order_id, son.note, son.created_by, e.name, son.created_at
             FROM service_order_notes son
             LEFT JOIN employees e ON e.id = son.created_by
             WHERE son.order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map(params![id], |r| {
            Ok(ServiceNote {
                id: r.get(0)?,
                order_id: r.get(1)?,
                note: r.get(2)?,
                created_by: r.get(3)?,
                created_by_name: r.get(4)?,
                created_at: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut stmt = conn
        .prepare(
            "SELECT soh.id, soh.order_id, soh.old_status, soh.new_status, soh.changed_by, e.name, soh.notes, soh.created_at
             FROM service_order_status_history soh
             LEFT JOIN employees e ON e.id = soh.changed_by
             WHERE soh.order_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let history = stmt
        .query_map(params![id], |r| {
            Ok(StatusHistory {
                id: r.get(0)?,
                order_id: r.get(1)?,
                old_status: r.get(2)?,
                new_status: r.get(3)?,
                changed_by: r.get(4)?,
                changed_by_name: r.get(5)?,
                notes: r.get(6)?,
                created_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    Ok(ServiceOrder {
        images,
        technicians,
        checklist,
        parts,
        payments,
        notes,
        history,
        ..order
    })
}

// =============== 1. list_service_orders ===============

#[tauri::command]
pub fn list_service_orders(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<ServiceOrderSummary>, String> {
    let conn = get_db(&state)?;
    let sql = "
        SELECT so.id, so.order_no, c.name, c.phone, so.device_type, so.device_brand, so.device_model,
               so.status, so.total_cost, so.amount_paid, (so.total_cost - so.amount_paid) AS remaining,
               so.warranty_end, so.original_order_id, so.created_at, so.updated_at
        FROM service_orders so
        LEFT JOIN customers c ON c.id = so.customer_id
        WHERE (?1 IS NULL OR so.order_no LIKE '%' || ?1 || '%'
               OR c.name LIKE '%' || ?1 || '%'
               OR c.phone LIKE '%' || ?1 || '%'
               OR so.serial_number LIKE '%' || ?1 || '%'
               OR so.imei LIKE '%' || ?1 || '%'
               OR so.device_model LIKE '%' || ?1 || '%')
        ORDER BY so.id DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![search], |r| {
            Ok(ServiceOrderSummary {
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

// =============== 2. get_service_order ===============

#[tauri::command]
pub fn get_service_order(state: State<AppState>, id: i64) -> Result<ServiceOrder, String> {
    let conn = get_db(&state)?;
    get_full_order(&conn, id)
}

// =============== 3. create_service_order ===============

#[tauri::command]
pub fn create_service_order(
    state: State<AppState>,
    input: NewServiceOrder,
) -> Result<ServiceOrder, String> {
    let conn = get_db(&state)?;
    if input.device_type.trim().is_empty() {
        return Err("نوع الجهاز مطلوب".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let customer_id = if let Some(cid) = input.customer_id {
        let exists: bool = tx
            .query_row(
                "SELECT COUNT(*) FROM customers WHERE id = ?1",
                params![cid],
                |r| r.get::<_, i64>(0),
            )
            .map_err(|e| e.to_string())?
            > 0;
        if exists {
            Some(cid)
        } else {
            return Err("العميل غير موجود".into());
        }
    } else if let Some(ref name) = input.customer_name {
        if !name.trim().is_empty() {
            tx.execute(
                "INSERT INTO customers (name, phone, notes) VALUES (?1, ?2, ?3)",
                params![name.trim(), input.customer_phone, input.customer_notes],
            )
            .map_err(|e| e.to_string())?;
            let cid = tx.last_insert_rowid();
            Some(cid)
        } else {
            None
        }
    } else {
        None
    };

    let order_no = generate_order_no(&tx)?;
    let parts_cost = 0.0_f64;
    let labor_cost = input.labor_cost.unwrap_or(0.0);
    let service_cost = input.service_cost.unwrap_or(0.0);
    let discount = input.discount.unwrap_or(0.0);
    let tax_rate = input.tax_rate.unwrap_or(0.0);
    let warranty_days = input.warranty_days.unwrap_or(0);
    let deposit = input.deposit.unwrap_or(0.0);
    let deposit_method = input.deposit_method.unwrap_or_else(|| "cash".to_string());

    tx.execute(
        "INSERT INTO service_orders (
            order_no, customer_id, device_type, device_brand, device_model, serial_number, imei,
            device_color, device_condition, accessories, device_password, customer_complaint,
            diagnosis, repair_action, technician_notes, status, parts_cost, labor_cost,
            service_cost, discount, tax_rate, total_cost, amount_paid, warranty_days,
            original_order_id, received_by
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'received',
            ?16, ?17, ?18, ?19, ?20, 0, ?21, ?22, ?23, NULL
        )",
        params![
            order_no,
            customer_id,
            input.device_type.trim(),
            input.device_brand,
            input.device_model,
            input.serial_number,
            input.imei,
            input.device_color,
            input.device_condition,
            input.accessories,
            input.device_password,
            input.customer_complaint,
            input.diagnosis,
            input.repair_action,
            input.technician_notes,
            parts_cost,
            labor_cost,
            service_cost,
            discount,
            tax_rate,
            deposit,
            warranty_days,
            input.original_order_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    let order_id = tx.last_insert_rowid();

    // If deposit > 0, record it as a payment and add cash register movement
    if deposit > 0.0 {
        tx.execute(
            "INSERT INTO service_order_payments (order_id, amount, payment_method, date, notes) VALUES (?1, ?2, ?3, datetime('now','localtime'), 'عربون عند الاستلام')",
            params![order_id, deposit, deposit_method],
        )
        .map_err(|e| e.to_string())?;

        // Add cash register movement if open session exists and method is cash
        if deposit_method == "cash" {
            let has_session: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM cash_register_sessions WHERE status = 'open')",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(false);
            if has_session {
                tx.execute(
                    "INSERT INTO cash_register_movements (session_id, type, amount, description, reference_id, reference_type) \
                     SELECT id, 'service_deposit', ?1, ?2, ?3, 'service_order' \
                     FROM cash_register_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1",
                    params![
                        deposit,
                        format!("عربون صيانة — {} — {}", order_no, input.customer_name.as_deref().unwrap_or("")),
                        order_id,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    tx.execute(
        "INSERT INTO service_order_status_history (order_id, new_status, notes) VALUES (?1, 'received', 'تم استلام الجهاز')",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(&tx, order_id, "created", None, Some("تم إنشاء أمر الصيانة"))?;

    tx.commit().map_err(|e| e.to_string())?;

    recalc_total(&conn, order_id)?;
    get_full_order(&conn, order_id)
}

// =============== 4. update_service_order ===============

#[tauri::command]
pub fn update_service_order(
    state: State<AppState>,
    id: i64,
    input: UpdateServiceOrder,
) -> Result<ServiceOrder, String> {
    let conn = get_db(&state)?;

    let current: Option<String> = conn
        .query_row(
            "SELECT device_type FROM service_orders WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .ok();
    if current.is_none() {
        return Err("أمر الصيانة غير موجود".into());
    }

    let device_type = input
        .device_type
        .unwrap_or_else(|| current.unwrap_or_else(|| "Other".to_string()));
    let device_brand = input.device_brand;
    let device_model = input.device_model;
    let serial_number = input.serial_number;
    let imei = input.imei;
    let device_color = input.device_color;
    let device_condition = input.device_condition;
    let accessories = input.accessories;
    let device_password = input.device_password;
    let customer_complaint = input.customer_complaint;
    let diagnosis = input.diagnosis;
    let repair_action = input.repair_action;
    let technician_notes = input.technician_notes;
    let labor_cost = input.labor_cost.unwrap_or(0.0);
    let service_cost = input.service_cost.unwrap_or(0.0);
    let discount = input.discount.unwrap_or(0.0);
    let tax_rate = input.tax_rate.unwrap_or(0.0);
    let warranty_days = input.warranty_days.unwrap_or(0);

    conn.execute(
        "UPDATE service_orders SET
            device_type = ?1, device_brand = ?2, device_model = ?3, serial_number = ?4, imei = ?5,
            device_color = ?6, device_condition = ?7, accessories = ?8, device_password = ?9,
            customer_complaint = ?10, diagnosis = ?11, repair_action = ?12, technician_notes = ?13,
            labor_cost = ?14, service_cost = ?15, discount = ?16, tax_rate = ?17,
            warranty_days = ?18, updated_at = datetime('now','localtime')
         WHERE id = ?19",
        params![
            device_type,
            device_brand,
            device_model,
            serial_number,
            imei,
            device_color,
            device_condition,
            accessories,
            device_password,
            customer_complaint,
            diagnosis,
            repair_action,
            technician_notes,
            labor_cost,
            service_cost,
            discount,
            tax_rate,
            warranty_days,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    recalc_total(&conn, id)?;
    add_audit_log(&conn, id, "updated", None, Some("تم تعديل أمر الصيانة"))?;

    get_full_order(&conn, id)
}

// =============== 5. change_service_status ===============

#[tauri::command]
pub fn change_service_status(
    state: State<AppState>,
    id: i64,
    new_status: String,
    notes: Option<String>,
) -> Result<ServiceOrder, String> {
    let conn = get_db(&state)?;

    let valid = [
        "received",
        "inspection",
        "pending_approval",
        "repairing",
        "pending_parts",
        "repaired",
        "ready",
        "delivered",
        "cancelled",
        "rejected",
    ];
    if !valid.contains(&new_status.as_str()) {
        return Err(format!("حالة غير صحيحة: {}", new_status));
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let old_status: Option<String> = tx
        .query_row(
            "SELECT status FROM service_orders WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "أمر الصيانة غير موجود".to_string())?;

    tx.execute(
        "UPDATE service_orders SET status = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
        params![new_status, id],
    )
    .map_err(|e| e.to_string())?;

    let change_notes = notes
        .as_deref()
        .unwrap_or("تم تغيير الحالة");
    tx.execute(
        "INSERT INTO service_order_status_history (order_id, old_status, new_status, notes) VALUES (?1, ?2, ?3, ?4)",
        params![id, old_status, new_status, change_notes],
    )
    .map_err(|e| e.to_string())?;

    if new_status == "delivered" {
        tx.execute(
            "UPDATE service_orders SET
                delivered_date = ?1, delivered_time = ?2, warranty_start = ?1,
                warranty_end = date(?1, '+' || warranty_days || ' days')
             WHERE id = ?3 AND warranty_days > 0",
            params![today_str(), time_str(), id],
        )
        .map_err(|e| e.to_string())?;
    }

    add_audit_log(
        &tx,
        id,
        "status_changed",
        None,
        Some(&format!(
            "تم تغيير الحالة من {:?} إلى {}",
            old_status, new_status
        )),
    )?;

    tx.commit().map_err(|e| e.to_string())?;

    get_full_order(&conn, id)
}

// =============== 5b. delete_service_order ===============

#[tauri::command]
pub fn delete_service_order(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;

    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM service_orders WHERE id = ?1)",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if !exists {
        return Err("أمر الصيانة غير موجود".into());
    }

    conn.execute("DELETE FROM service_order_parts WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_payments WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_status_history WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_images WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_technicians WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_checklists WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_notes WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_order_audit_log WHERE order_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM service_orders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// =============== 6. assign_technician ===============

#[tauri::command]
pub fn assign_technician(
    state: State<AppState>,
    order_id: i64,
    tech: AssignTechnician,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let name: String = conn
        .query_row(
            "SELECT name FROM employees WHERE id = ?1",
            params![tech.technician_id],
            |r| r.get(0),
        )
        .map_err(|_| "الفني غير موجود".to_string())?;

    conn.execute(
        "INSERT INTO service_order_technicians (order_id, technician_id, work_type, notes) VALUES (?1, ?2, ?3, ?4)",
        params![order_id, tech.technician_id, tech.work_type, tech.notes],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &conn,
        order_id,
        "technician_assigned",
        None,
        Some(&format!("تم تعيين الفني: {}", name)),
    )?;

    conn.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// =============== 7. remove_technician ===============

#[tauri::command]
pub fn remove_technician(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;

    let order_id: i64 = conn
        .query_row(
            "SELECT order_id FROM service_order_technicians WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "التعيين غير موجود".to_string())?;

    conn.execute(
        "DELETE FROM service_order_technicians WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &conn,
        order_id,
        "technician_removed",
        None,
        Some("تم إزالة تعيين الفني"),
    )?;

    conn.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// =============== 8. add_service_part ===============

#[tauri::command]
pub fn add_service_part(
    state: State<AppState>,
    order_id: i64,
    part: AddServicePart,
) -> Result<(), String> {
    let conn = get_db(&state)?;

    if part.part_name.trim().is_empty() {
        return Err("اسم القطعة مطلوب".into());
    }
    if part.quantity <= 0.0 {
        return Err("الكمية يجب أن تكون أكبر من صفر".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    if let Some(pid) = part.product_id {
        let available: f64 = tx
            .query_row(
                "SELECT quantity FROM products WHERE id = ?1",
                params![pid],
                |r| r.get(0),
            )
            .map_err(|_| "المنتج غير موجود".to_string())?;
        if available < part.quantity {
            let pname: String = tx
                .query_row(
                    "SELECT name FROM products WHERE id = ?1",
                    params![pid],
                    |r| r.get(0),
                )
                .map_err(|_| "المنتج غير موجود".to_string())?;
            return Err(format!(
                "الكمية غير كافية للمنتج «{}» (المتوفر: {})",
                pname, available
            ));
        }
        tx.execute(
            "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
            params![part.quantity, pid],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT INTO service_order_parts (order_id, product_id, part_name, quantity, cost_price, sell_price) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            order_id,
            part.product_id,
            part.part_name.trim(),
            part.quantity,
            part.cost_price,
            part.sell_price
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &tx,
        order_id,
        "part_added",
        None,
        Some(&format!("تم إضافة قطعة: {}", part.part_name.trim())),
    )?;

    tx.commit().map_err(|e| e.to_string())?;

    recalc_total(&conn, order_id)?;
    Ok(())
}

// =============== 9. remove_service_part ===============

#[tauri::command]
pub fn remove_service_part(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;

    let part: (i64, Option<i64>, f64, String) = conn
        .query_row(
            "SELECT order_id, product_id, quantity, part_name FROM service_order_parts WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| "القطعة غير موجودة".to_string())?;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    if let Some(pid) = part.1 {
        tx.execute(
            "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
            params![part.2, pid],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute("DELETE FROM service_order_parts WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    add_audit_log(
        &tx,
        part.0,
        "part_removed",
        None,
        Some(&format!("تم إزالة قطعة: {}", part.3)),
    )?;

    tx.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![part.0],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    recalc_total(&conn, part.0)?;
    Ok(())
}

// =============== 10. add_service_checklist ===============

#[tauri::command]
pub fn add_service_checklist(
    state: State<AppState>,
    order_id: i64,
    items: Vec<NewChecklistItem>,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM service_order_checklists WHERE order_id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    for item in &items {
        tx.execute(
            "INSERT INTO service_order_checklists (order_id, item_name, status, notes) VALUES (?1, ?2, ?3, ?4)",
            params![order_id, item.item_name, item.status, item.notes],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// =============== 11. add_service_payment ===============

#[tauri::command]
pub fn add_service_payment(
    state: State<AppState>,
    order_id: i64,
    payment: AddServicePayment,
) -> Result<ServiceOrder, String> {
    let conn = get_db(&state)?;

    if payment.amount <= 0.0 {
        return Err("المبلغ يجب أن يكون أكبر من صفر".into());
    }

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let total_cost: f64 = tx
        .query_row(
            "SELECT total_cost FROM service_orders WHERE id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .map_err(|_| "أمر الصيانة غير موجود".to_string())?;
    let amount_paid: f64 = tx
        .query_row(
            "SELECT amount_paid FROM service_orders WHERE id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let remaining = money(total_cost - amount_paid);
    if payment.amount > remaining + 0.01 {
        return Err(format!(
            "المبلغ المدفوع ({}) أكبر من المتبقي ({})",
            payment.amount, remaining
        ));
    }

    tx.execute(
        "INSERT INTO service_order_payments (order_id, amount, payment_method, date, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            order_id,
            payment.amount,
            payment.payment_method,
            today_str(),
            payment.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let new_paid = money(amount_paid + payment.amount);
    tx.execute(
        "UPDATE service_orders SET amount_paid = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
        params![new_paid, order_id],
    )
    .map_err(|e| e.to_string())?;

    // Record cash register movement for cash payments
    if payment.payment_method == "cash" {
        let has_session: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM cash_register_sessions WHERE status = 'open')",
                [],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if has_session {
            let order_no: String = tx
                .query_row(
                    "SELECT order_no FROM service_orders WHERE id = ?1",
                    params![order_id],
                    |r| r.get(0),
                )
                .unwrap_or_default();
            tx.execute(
                "INSERT INTO cash_register_movements (session_id, type, amount, description, reference_id, reference_type) \
                 SELECT id, 'service_payment', ?1, ?2, ?3, 'service_order' \
                 FROM cash_register_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1",
                params![
                    payment.amount,
                    format!("دفعة صيانة — {}", order_no),
                    order_id,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    add_audit_log(
        &tx,
        order_id,
        "payment_added",
        None,
        Some(&format!(
            "تم دفع {} بـ {}",
            payment.amount, payment.payment_method
        )),
    )?;

    tx.commit().map_err(|e| e.to_string())?;

    get_full_order(&conn, order_id)
}

// =============== 12. add_service_image ===============

#[tauri::command]
pub fn add_service_image(
    state: State<AppState>,
    order_id: i64,
    image_path: String,
    image_type: String,
    description: Option<String>,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute(
        "INSERT INTO service_order_images (order_id, image_path, image_type, description) VALUES (?1, ?2, ?3, ?4)",
        params![order_id, image_path, image_type, description],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &conn,
        order_id,
        "image_added",
        None,
        Some(&format!("تم إضافة صورة: {}", image_type)),
    )?;

    Ok(())
}

// =============== 13. delete_service_image ===============

#[tauri::command]
pub fn delete_service_image(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;

    let order_id: i64 = conn
        .query_row(
            "SELECT order_id FROM service_order_images WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "الصورة غير موجودة".to_string())?;

    conn.execute("DELETE FROM service_order_images WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &conn,
        order_id,
        "image_deleted",
        None,
        Some("تم حذف صورة"),
    )?;

    Ok(())
}

// =============== 14. add_service_note ===============

#[tauri::command]
pub fn add_service_note(
    state: State<AppState>,
    order_id: i64,
    note: String,
) -> Result<(), String> {
    let conn = get_db(&state)?;

    if note.trim().is_empty() {
        return Err("الملاحظة مطلوبة".into());
    }

    conn.execute(
        "INSERT INTO service_order_notes (order_id, note) VALUES (?1, ?2)",
        params![order_id, note.trim()],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE service_orders SET updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .map_err(|e| e.to_string())?;

    add_audit_log(
        &conn,
        order_id,
        "note_added",
        None,
        Some("تم إضافة ملاحظة"),
    )?;

    Ok(())
}

// =============== 15. get_maintenance_dashboard ===============

#[tauri::command]
pub fn get_maintenance_dashboard(state: State<AppState>) -> Result<MaintenanceDashboard, String> {
    let conn = get_db(&state)?;

    let total_in维修: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status NOT IN ('delivered', 'cancelled', 'rejected')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let received_today: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE DATE(created_at) = DATE('now','localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let delivered_today: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'delivered' AND delivered_date = DATE('now','localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let under_inspection: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'inspection'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let in_repair: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'repairing'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let awaiting_approval: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'pending_approval'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let awaiting_parts: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'pending_parts'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let ready_for_delivery: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders WHERE status = 'ready'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let overdue: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders
             WHERE status NOT IN ('delivered', 'cancelled', 'rejected')
               AND DATE(created_at) < DATE('now', '-7 days')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let under_warranty: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_orders
             WHERE status = 'delivered'
               AND warranty_end IS NOT NULL
               AND warranty_end >= DATE('now','localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let revenue_today: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM service_order_payments WHERE DATE(date) = DATE('now','localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let revenue_month: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM service_order_payments
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now','localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_parts_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(parts_cost), 0) FROM service_orders",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_labor: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(labor_cost), 0) FROM service_orders",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let net_profit = money(revenue_month - total_parts_cost - total_labor);

    let mut stmt = conn
        .prepare(
            "SELECT so.id, so.order_no, c.name, c.phone, so.device_type, so.device_brand, so.device_model,
                    so.status, so.total_cost, so.amount_paid, (so.total_cost - so.amount_paid) AS remaining,
                    so.warranty_end, so.original_order_id, so.created_at, so.updated_at
             FROM service_orders so
             LEFT JOIN customers c ON c.id = so.customer_id
             ORDER BY so.id DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let recent_orders = stmt
        .query_map([], |r| {
            Ok(ServiceOrderSummary {
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
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(MaintenanceDashboard {
        total_in维修,
        received_today,
        delivered_today,
        under_inspection,
        in_repair,
        awaiting_approval,
        awaiting_parts,
        ready_for_delivery,
        overdue,
        under_warranty,
        revenue_today,
        revenue_month,
        total_parts_cost,
        total_labor,
        net_profit,
        recent_orders,
    })
}

// =============== 16. list_service_order_history ===============

#[tauri::command]
pub fn list_service_order_history(
    state: State<AppState>,
    order_id: i64,
) -> Result<Vec<StatusHistory>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT soh.id, soh.order_id, soh.old_status, soh.new_status, soh.changed_by, e.name, soh.notes, soh.created_at
             FROM service_order_status_history soh
             LEFT JOIN employees e ON e.id = soh.changed_by
             WHERE soh.order_id = ?1
             ORDER BY soh.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![order_id], |r| {
            Ok(StatusHistory {
                id: r.get(0)?,
                order_id: r.get(1)?,
                old_status: r.get(2)?,
                new_status: r.get(3)?,
                changed_by: r.get(4)?,
                changed_by_name: r.get(5)?,
                notes: r.get(6)?,
                created_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== 17. get_service_order_audit_log ===============

#[tauri::command]
pub fn get_service_order_audit_log(
    state: State<AppState>,
    order_id: i64,
) -> Result<Vec<AuditLog>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, action, user_name, details, created_at
             FROM service_order_audit_log
             WHERE order_id = ?1
             ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![order_id], |r| {
            Ok(AuditLog {
                id: r.get(0)?,
                order_id: r.get(1)?,
                action: r.get(2)?,
                user_name: r.get(3)?,
                details: r.get(4)?,
                created_at: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== 18. search_customers_for_maintenance ===============

#[tauri::command]
pub fn search_customers_for_maintenance(
    state: State<AppState>,
    query: String,
) -> Result<Vec<CustomerSearchResult>, String> {
    let conn = get_db(&state)?;
    let q = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone FROM customers
             WHERE name LIKE ?1 OR phone LIKE ?1
             ORDER BY name COLLATE NOCASE
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![q], |r| {
            Ok(CustomerSearchResult {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== 19. get_device_types ===============

#[tauri::command]
pub fn get_device_types(state: State<AppState>) -> Result<Vec<DeviceType>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, checklist_template, is_active FROM device_types WHERE is_active = 1 ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(DeviceType {
                id: r.get(0)?,
                name: r.get(1)?,
                checklist_template: r.get(2)?,
                is_active: r.get::<_, i64>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== 20. create_device_type ===============

#[tauri::command]
pub fn create_device_type(state: State<AppState>, name: String) -> Result<DeviceType, String> {
    let conn = get_db(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("اسم نوع الجهاز مطلوب".into());
    }
    conn.execute(
        "INSERT INTO device_types (name) VALUES (?1)",
        params![name],
    )
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("UNIQUE") {
            "نوع الجهاز موجود مسبقاً".to_string()
        } else {
            msg
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(DeviceType {
        id,
        name,
        checklist_template: None,
        is_active: true,
    })
}

// =============== 21. delete_device_type ===============

#[tauri::command]
pub fn delete_device_type(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute(
        "UPDATE device_types SET is_active = 0 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== 22. get_device_brands ===============

#[tauri::command]
pub fn get_device_brands(state: State<AppState>) -> Result<Vec<DeviceBrand>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, is_active FROM device_brands WHERE is_active = 1 ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(DeviceBrand {
                id: r.get(0)?,
                name: r.get(1)?,
                is_active: r.get::<_, i64>(2)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// =============== 23. create_device_brand ===============

#[tauri::command]
pub fn create_device_brand(
    state: State<AppState>,
    name: String,
) -> Result<DeviceBrand, String> {
    let conn = get_db(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("اسم الماركة مطلوب".into());
    }
    conn.execute(
        "INSERT INTO device_brands (name) VALUES (?1)",
        params![name],
    )
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("UNIQUE") {
            "الماركة موجودة مسبقاً".to_string()
        } else {
            msg
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(DeviceBrand {
        id,
        name,
        is_active: true,
    })
}

// =============== 24. delete_device_brand ===============

#[tauri::command]
pub fn delete_device_brand(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute(
        "UPDATE device_brands SET is_active = 0 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// =============== 25. get_maintenance_settings ===============

#[tauri::command]
pub fn get_maintenance_settings(state: State<AppState>) -> Result<MaintenanceSettings, String> {
    let conn = get_db(&state)?;

    let get_val = |key: &str| -> Result<String, String> {
        conn.query_row(
            "SELECT value FROM maintenance_settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
    };

    Ok(MaintenanceSettings {
        next_order_number: get_val("next_order_number").unwrap_or_default(),
        late_days: get_val("late_days").unwrap_or_else(|_| "7".to_string()),
        sticker_width: get_val("sticker_width").unwrap_or_else(|_| "70".to_string()),
        sticker_height: get_val("sticker_height").unwrap_or_else(|_| "100".to_string()),
        receipt_footer: get_val("receipt_footer").unwrap_or_default(),
        agreement_text: get_val("agreement_text").unwrap_or_default(),
    })
}

// =============== 26. save_maintenance_settings ===============

#[tauri::command]
pub fn save_maintenance_settings(
    state: State<AppState>,
    settings: MaintenanceSettings,
) -> Result<(), String> {
    let conn = get_db(&state)?;

    let upsert = |key: &str, val: &str| -> Result<(), String> {
        conn.execute(
            "INSERT INTO maintenance_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, val],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    };

    upsert("next_order_number", &settings.next_order_number)?;
    upsert("late_days", &settings.late_days)?;
    upsert("sticker_width", &settings.sticker_width)?;
    upsert("sticker_height", &settings.sticker_height)?;
    upsert("receipt_footer", &settings.receipt_footer)?;
    upsert("agreement_text", &settings.agreement_text)?;

    Ok(())
}

// =============== 27. get_checklist_template ===============

#[tauri::command]
pub fn get_checklist_template(
    state: State<AppState>,
    device_type: String,
) -> Result<Vec<String>, String> {
    let conn = get_db(&state)?;
    let result: Option<String> = conn
        .query_row(
            "SELECT checklist_template FROM device_types WHERE name = ?1 AND is_active = 1",
            params![device_type],
            |r| r.get(0),
        )
        .ok();
    match result {
        Some(ref template) if !template.is_empty() => {
            Ok(template
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
                .collect())
        }
        _ => Ok(vec![]),
    }
}

// =============== 28. save_checklist_template ===============

#[tauri::command]
pub fn save_checklist_template(
    state: State<AppState>,
    device_type: String,
    items: Vec<String>,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let template = items.join("\n");
    let updated = conn
        .execute(
            "UPDATE device_types SET checklist_template = ?1 WHERE name = ?2 AND is_active = 1",
            params![template, device_type],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("نوع الجهاز غير موجود".into());
    }
    Ok(())
}

// =============== 28. get_employee_maintenance_stats ===============

#[derive(serde::Serialize)]
pub struct EmployeeMaintenanceStats {
    pub employee_id: i64,
    pub employee_name: String,
    pub total_orders: i64,
    pub delivered_orders: i64,
    pub labor_balance: f64,
    pub orders: Vec<EmployeeOrderRow>,
}

#[derive(serde::Serialize)]
pub struct EmployeeOrderRow {
    pub id: i64,
    pub order_no: String,
    pub customer_name: Option<String>,
    pub device_type: String,
    pub device_brand: Option<String>,
    pub device_model: Option<String>,
    pub status: String,
    pub total_cost: f64,
    pub labor_cost: f64,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn get_employee_maintenance_stats(
    state: State<AppState>,
    from_date: String,
    to_date: String,
) -> Result<Vec<EmployeeMaintenanceStats>, String> {
    let conn = get_db(&state)?;

    let mut emp_stmt = conn
        .prepare("SELECT id, name FROM employees ORDER BY name")
        .map_err(|e| e.to_string())?;
    let employees: Vec<(i64, String)> = emp_stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(emp_stmt);

    let mut result = Vec::new();

    for (emp_id, emp_name) in &employees {
        let mut stmt = conn
            .prepare(
                "SELECT so.id, so.order_no, c.name, so.device_type, so.device_brand, so.device_model,
                        so.status, so.total_cost, so.labor_cost, so.created_at
                 FROM service_orders so
                 INNER JOIN service_order_technicians sot ON sot.order_id = so.id
                 LEFT JOIN customers c ON c.id = so.customer_id
                 WHERE sot.technician_id = ?1
                   AND DATE(so.created_at) >= ?2
                   AND DATE(so.created_at) <= ?3
                 ORDER BY so.id DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(            params![emp_id, from_date, to_date], |r| {
                Ok(EmployeeOrderRow {
                    id: r.get(0)?,
                    order_no: r.get(1)?,
                    customer_name: r.get(2)?,
                    device_type: r.get(3)?,
                    device_brand: r.get(4)?,
                    device_model: r.get(5)?,
                    status: r.get(6)?,
                    total_cost: r.get(7)?,
                    labor_cost: r.get(8)?,
                    created_at: r.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);

        let delivered_orders = rows.iter().filter(|r| r.status == "delivered").count() as i64;
        let labor_balance = rows
            .iter()
            .filter(|r| r.status == "delivered")
            .fold(0.0, |s, r| s + r.labor_cost);

        result.push(EmployeeMaintenanceStats {
            employee_id: *emp_id,
            employee_name: emp_name.clone(),
            total_orders: rows.len() as i64,
            delivered_orders,
            labor_balance,
            orders: rows,
        });
    }

    Ok(result)
}
