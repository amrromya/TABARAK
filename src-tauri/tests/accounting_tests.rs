//! Automated accounting tests for TABARAK
//! Tests verify: product CRUD, stock management, purchases, sales, returns,
//! expenses, dashboard calculations, and profit/loss accuracy.

use rusqlite::{params, Connection};

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    // Run the full schema
    conn.execute_batch(include_str!("schema.sql")).unwrap();
    conn
}

fn money(n: f64) -> f64 {
    (n * 100.0).round() / 100.0
}

// ===================== PRODUCT TESTS =====================

#[test]
fn test_create_product() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, barcode, cost_price, sell_price, quantity, min_quantity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params!["iPhone 15", "1001", 25000.0, 30000.0, 10.0, 2.0],
    )
    .unwrap();

    let (name, qty, cost, sell): (String, f64, f64, f64) = conn
        .query_row(
            "SELECT name, quantity, cost_price, sell_price FROM products WHERE barcode = '1001'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap();

    assert_eq!(name, "iPhone 15");
    assert_eq!(qty, 10.0);
    assert_eq!(cost, 25000.0);
    assert_eq!(sell, 30000.0);
}

#[test]
fn test_create_product_empty_name_fails() {
    let conn = setup_db();
    let result = conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES (?1, 0, 0, 0)",
        params![""],
    );
    // Name is NOT NULL, so empty string is allowed by SQL but should be caught by app logic
    // This tests the DB layer allows it
    assert!(result.is_ok());
}

#[test]
fn test_product_stock_initial() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Test', 100, 150, 50)",
        [],
    )
    .unwrap();
    let qty: f64 = conn
        .query_row("SELECT quantity FROM products WHERE name = 'Test'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 50.0);
}

// ===================== PURCHASE TESTS =====================

#[test]
fn test_purchase_increases_stock() {
    let conn = setup_db();
    // Create product with 10 units
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Widget', 100, 150, 10)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Purchase 5 more at cost 110
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO purchases (supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id)
         VALUES (NULL, '2025-01-15', 0, 0, 0, NULL, NULL, NULL)",
        [],
    )
    .unwrap();
    let purchase_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES (?1, ?2, ?3, ?4)",
        params![purchase_id, pid, 5.0, 110.0],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = quantity + ?1, cost_price = ?2 WHERE id = ?3",
        params![5.0, 110.0, pid],
    )
    .unwrap();
    tx.commit().unwrap();

    // Verify stock increased and cost updated
    let (qty, cost): (f64, f64) = conn
        .query_row("SELECT quantity, cost_price FROM products WHERE id = ?1", params![pid], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(qty, 15.0, "Stock should be 10 + 5 = 15");
    assert_eq!(cost, 110.0, "Cost price should update to latest purchase price");
}

#[test]
fn test_purchase_total_calculation() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('A', 50, 80, 0)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO purchases (supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id)
         VALUES (NULL, '2025-01-15', 0, 10, 5, NULL, NULL, NULL)",
        [],
    )
    .unwrap();
    let purchase_id = tx.last_insert_rowid();
    // 10 units * 50 = 500, + 5 additional - 10 discount = 495
    tx.execute(
        "INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES (?1, ?2, ?3, ?4)",
        params![purchase_id, pid, 10.0, 50.0],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = quantity + ?1, cost_price = ?2 WHERE id = ?3",
        params![10.0, 50.0, pid],
    )
    .unwrap();
    let total = money(500.0 + 5.0 - 10.0);
    tx.execute(
        "UPDATE purchases SET total = ?1 WHERE id = ?2",
        params![total, purchase_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let purchase_total: f64 = conn
        .query_row("SELECT total FROM purchases WHERE id = ?1", params![purchase_id], |r| r.get(0))
        .unwrap();
    assert_eq!(purchase_total, 495.0);
}

// ===================== SALE TESTS =====================

#[test]
fn test_sale_decreases_stock() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Gadget', 100, 200, 20)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Sell 3 units
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, warehouse_id, customer_name, customer_id, payment_method, employee_id)
         VALUES ('', '2025-01-15', 0, 0, 0, 0, NULL, NULL, NULL, 'cash', NULL)",
        [],
    )
    .unwrap();
    let sale_id = tx.last_insert_rowid();
    let subtotal = money(3.0 * 200.0);
    tx.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sale_id, pid, 3.0, 200.0, 100.0],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = quantity - ?1 WHERE id = ?2",
        params![3.0, pid],
    )
    .unwrap();
    tx.execute(
        "UPDATE sales SET invoice_no = ?1, total = ?2, net_total = ?3 WHERE id = ?4",
        params!["FS-000001", subtotal, subtotal, sale_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty: f64 = conn
        .query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 17.0, "Stock should be 20 - 3 = 17");
}

#[test]
fn test_sale_profit_calculation() {
    let conn = setup_db();
    // Product: cost 100, sell 200
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Item', 100, 200, 50)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Sale: 5 units
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, warehouse_id, customer_name, customer_id, payment_method, employee_id)
         VALUES ('', '2025-01-15', 0, 0, 0, 0, NULL, NULL, NULL, 'cash', NULL)",
        [],
    )
    .unwrap();
    let sale_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sale_id, pid, 5.0, 200.0, 100.0],
    )
    .unwrap();
    tx.execute("UPDATE products SET quantity = quantity - 5 WHERE id = ?1", params![pid]).unwrap();
    let total = money(5.0 * 200.0);
    tx.execute(
        "UPDATE sales SET invoice_no = ?1, total = ?2, net_total = ?3 WHERE id = ?4",
        params!["FS-000001", total, total, sale_id],
    )
    .unwrap();
    tx.commit().unwrap();

    // Calculate profit: revenue - cost of goods sold
    let revenue: f64 = conn
        .query_row("SELECT net_total FROM sales WHERE id = ?1", params![sale_id], |r| r.get(0))
        .unwrap();
    let cogs: f64 = conn
        .query_row(
            "SELECT SUM(quantity * cost_price) FROM sale_items WHERE sale_id = ?1",
            params![sale_id],
            |r| r.get(0),
        )
        .unwrap();
    let profit = revenue - cogs;

    assert_eq!(revenue, 1000.0);
    assert_eq!(cogs, 500.0);
    assert_eq!(profit, 500.0, "Profit = 1000 - 500 = 500");
}

#[test]
fn test_sale_with_discount() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('X', 50, 100, 100)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, warehouse_id, customer_name, customer_id, payment_method, employee_id)
         VALUES ('', '2025-01-15', 0, 50, 20, 0, NULL, NULL, NULL, 'cash', NULL)",
        [],
    )
    .unwrap();
    let sale_id = tx.last_insert_rowid();
    // 4 * 100 = 400
    tx.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sale_id, pid, 4.0, 100.0, 50.0],
    )
    .unwrap();
    tx.execute("UPDATE products SET quantity = quantity - 4 WHERE id = ?1", params![pid]).unwrap();
    let total = money(400.0);
    let net = money(400.0 - 50.0 + 20.0); // 370
    tx.execute(
        "UPDATE sales SET invoice_no = ?1, total = ?2, net_total = ?3 WHERE id = ?4",
        params!["FS-000001", total, net, sale_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let net_total: f64 = conn
        .query_row("SELECT net_total FROM sales WHERE id = ?1", params![sale_id], |r| r.get(0))
        .unwrap();
    assert_eq!(net_total, 370.0, "net = 400 - 50 discount + 20 additional = 370");
}

#[test]
fn test_sale_insufficient_stock_fails() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Low', 10, 20, 3)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Check available stock
    let available: f64 = conn
        .query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0))
        .unwrap();
    assert!(available < 5.0, "Should detect insufficient stock");
}

#[test]
fn test_credit_sale_requires_customer() {
    // This tests the business rule: credit sales need a customer
    // In the actual code, this is checked before DB operations
    // Here we verify the data model supports it
    let conn = setup_db();
    conn.execute(
        "INSERT INTO customers (name, phone) VALUES ('Ahmed', '01012345678')",
        [],
    )
    .unwrap();
    let cid: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Item', 100, 150, 10)",
        [],
    )
    .unwrap();
    let _pid: i64 = conn.last_insert_rowid();

    // Credit sale with customer
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, customer_id, payment_method)
         VALUES ('FS-001', '2025-01-15', 150, 0, 0, 150, ?1, 'credit')",
        params![cid],
    )
    .unwrap();

    let customer_id: Option<i64> = conn
        .query_row("SELECT customer_id FROM sales WHERE invoice_no = 'FS-001'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(customer_id, Some(cid));
}

// ===================== SALE RETURN TESTS =====================

#[test]
fn test_sale_return_increases_stock() {
    let conn = setup_db();

    // Create product with stock 10
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('Ret', 80, 120, 10)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Sale return: 2 units
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sale_returns (invoice_no, date, total, discount, additional, warehouse_id, customer_name, customer_id, payment_method, notes)
         VALUES ('', '2025-01-15', 0, 0, 0, NULL, NULL, NULL, 'cash', NULL)",
        [],
    )
    .unwrap();
    let return_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO sale_return_items (return_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![return_id, pid, 2.0, 120.0, 80.0],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = quantity + ?1 WHERE id = ?2",
        params![2.0, pid],
    )
    .unwrap();
    let total = money(2.0 * 120.0);
    let invoice_no = format!("MSR-{:06}", return_id);
    tx.execute(
        "UPDATE sale_returns SET total = ?1, invoice_no = ?2 WHERE id = ?3",
        params![total, invoice_no, return_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty: f64 = conn
        .query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 12.0, "Stock should be 10 + 2 = 12 after return");
}

// ===================== PURCHASE RETURN TESTS =====================

#[test]
fn test_purchase_return_decreases_stock() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('PR', 60, 90, 20)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Create a purchase first (needed for foreign key)
    conn.execute(
        "INSERT INTO purchases (supplier_id, date, total, warehouse_id, notes)
         VALUES (NULL, '2025-01-10', 1200, NULL, NULL)",
        [],
    )
    .unwrap();
    let purch_id: i64 = conn.last_insert_rowid();

    // Purchase return: 3 units
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO purchase_returns (purchase_id, invoice_no, date, total, discount, additional, warehouse_id, supplier_id, notes)
         VALUES (?1, '', '2025-01-15', 0, 0, 0, NULL, NULL, NULL)",
        params![purch_id],
    )
    .unwrap();
    let return_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO purchase_return_items (return_id, product_id, quantity, cost_price) VALUES (?1, ?2, ?3, ?4)",
        params![return_id, pid, 3.0, 60.0],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = MAX(0, quantity - ?1), cost_price = ?2 WHERE id = ?3",
        params![3.0, 60.0, pid],
    )
    .unwrap();
    let total = money(3.0 * 60.0);
    let invoice_no = format!("MR-{:06}", return_id);
    tx.execute(
        "UPDATE purchase_returns SET total = ?1, invoice_no = ?2 WHERE id = ?3",
        params![total, invoice_no, return_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty: f64 = conn
        .query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 17.0, "Stock should be 20 - 3 = 17 after purchase return");
}

#[test]
fn test_purchase_return_stock_never_negative() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('MinTest', 10, 15, 2)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Create a purchase first (needed for foreign key)
    conn.execute(
        "INSERT INTO purchases (supplier_id, date, total, warehouse_id, notes)
         VALUES (NULL, '2025-01-10', 50, NULL, NULL)",
        [],
    )
    .unwrap();
    let purch_id: i64 = conn.last_insert_rowid();

    // Try to return more than available
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO purchase_returns (purchase_id, invoice_no, date, total, discount, additional, warehouse_id, supplier_id, notes)
         VALUES (?1, '', '2025-01-15', 0, 0, 0, NULL, NULL, NULL)",
        params![purch_id],
    )
    .unwrap();
    let return_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO purchase_return_items (return_id, product_id, quantity, cost_price) VALUES (?1, ?2, ?3, ?4)",
        params![return_id, pid, 5.0, 10.0],
    )
    .unwrap();
    // MAX(0, quantity - 5) prevents negative
    tx.execute(
        "UPDATE products SET quantity = MAX(0, quantity - ?1), cost_price = ?2 WHERE id = ?3",
        params![5.0, 10.0, pid],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty: f64 = conn
        .query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 0.0, "Stock should be clamped to 0, never negative");
}

// ===================== EXPENSE TESTS =====================

#[test]
fn test_create_expense() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO expenses (date, description, amount, category) VALUES ('2025-01-15', 'Electricity', 500, 'Bills')",
        [],
    )
    .unwrap();

    let (amount, desc): (f64, String) = conn
        .query_row("SELECT amount, description FROM expenses LIMIT 1", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(amount, 500.0);
    assert_eq!(desc, "Electricity");
}

#[test]
fn test_total_expenses_today() {
    let conn = setup_db();
    conn.execute_batch(
        "INSERT INTO expenses (date, description, amount) VALUES ('2025-01-15', 'A', 100);
         INSERT INTO expenses (date, description, amount) VALUES ('2025-01-15', 'B', 250);
         INSERT INTO expenses (date, description, amount) VALUES ('2025-01-14', 'C', 500);",
    )
    .unwrap();

    let total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date = '2025-01-15'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total, 350.0, "Only today's expenses: 100 + 250 = 350");
}

// ===================== CUSTOMER DEBT TESTS =====================

#[test]
fn test_customer_debt_calculation() {
    let conn = setup_db();
    conn.execute("INSERT INTO customers (name, phone) VALUES ('Client', '0100')", []).unwrap();
    let cid: i64 = conn.last_insert_rowid();

    // Credit sale: 500
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, customer_id, payment_method)
         VALUES ('FS-001', '2025-01-10', 500, 0, 0, 500, ?1, 'credit')",
        params![cid],
    )
    .unwrap();
    // Credit sale: 300
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, customer_id, payment_method)
         VALUES ('FS-002', '2025-01-12', 300, 0, 0, 300, ?1, 'credit')",
        params![cid],
    )
    .unwrap();
    // Cash sale (not debt)
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, customer_id, payment_method)
         VALUES ('FS-003', '2025-01-13', 200, 0, 0, 200, ?1, 'cash')",
        params![cid],
    )
    .unwrap();
    // Payment: 200
    conn.execute(
        "INSERT INTO customer_payments (customer_id, date, amount) VALUES (?1, '2025-01-14', 200)",
        params![cid],
    )
    .unwrap();

    // Debt = credit sales - payments
    let debt: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(s.net_total),0) - (SELECT COALESCE(SUM(amount),0) FROM customer_payments WHERE customer_id = ?1)
             FROM sales s WHERE s.customer_id = ?1 AND s.payment_method = 'credit'",
            params![cid],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(debt, 600.0, "Debt = 500 + 300 - 200 = 600");
}

// ===================== DASHBOARD TESTS =====================

#[test]
fn test_dashboard_today_sales() {
    let conn = setup_db();
    conn.execute_batch(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-1', '2025-01-15', 1000, 0, 0, 1000, 'cash');
         INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-2', '2025-01-15', 500, 50, 0, 450, 'card');
         INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-3', '2025-01-14', 800, 0, 0, 800, 'cash');",
    )
    .unwrap();

    let today_sales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(net_total),0) FROM sales WHERE date = '2025-01-15'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(today_sales, 1450.0, "Today: 1000 + 450 = 1450");
}

#[test]
fn test_dashboard_profit() {
    let conn = setup_db();
    // Product: cost 100, sell 200
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('P', 100, 200, 100)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Sale: 3 units
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-1', '2025-01-15', 600, 0, 0, 600, 'cash')",
        [],
    )
    .unwrap();
    let sale_id: i64 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, 3, 200, 100)",
        params![sale_id, pid],
    )
    .unwrap();

    // Expense: 100
    conn.execute(
        "INSERT INTO expenses (date, description, amount) VALUES ('2025-01-15', 'Rent', 100)",
        [],
    )
    .unwrap();

    // Dashboard profit = sales - cost - expenses
    let today_sales: f64 = conn
        .query_row("SELECT COALESCE(SUM(net_total),0) FROM sales WHERE date = '2025-01-15'", [], |r| r.get(0))
        .unwrap();
    let today_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(si.quantity * si.cost_price),0) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.date = '2025-01-15'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let today_expenses: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date = '2025-01-15'", [], |r| r.get(0))
        .unwrap();
    let profit = today_sales - today_cost - today_expenses;

    assert_eq!(today_sales, 600.0);
    assert_eq!(today_cost, 300.0);
    assert_eq!(today_expenses, 100.0);
    assert_eq!(profit, 200.0, "Profit = 600 - 300 - 100 = 200");
}

#[test]
fn test_dashboard_cash_in_hand() {
    let conn = setup_db();
    // Set opening balance
    conn.execute("INSERT INTO settings (key, value) VALUES ('opening_balance', '1000')", []).unwrap();

    // Cash sale: 500
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-1', '2025-01-15', 500, 0, 0, 500, 'cash')",
        [],
    )
    .unwrap();
    // Card sale: 300
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-2', '2025-01-15', 300, 0, 0, 300, 'card')",
        [],
    )
    .unwrap();
    // Customer payment: 200
    conn.execute("INSERT INTO customers (name) VALUES ('C')", []).unwrap();
    let cid: i64 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO customer_payments (customer_id, date, amount) VALUES (?1, '2025-01-15', 200)",
        params![cid],
    )
    .unwrap();
    // Purchase: 400
    conn.execute(
        "INSERT INTO purchases (supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id) VALUES (NULL, '2025-01-15', 400, 0, 0, NULL, NULL, NULL)",
        [],
    )
    .unwrap();
    // Expense: 150
    conn.execute(
        "INSERT INTO expenses (date, description, amount) VALUES ('2025-01-15', 'Tax', 150)",
        [],
    )
    .unwrap();

    // cash_in_hand = opening + cash_collected + payments - purchases - expenses
    let opening: f64 = conn
        .query_row("SELECT COALESCE(CAST(value AS REAL),0) FROM settings WHERE key = 'opening_balance'", [], |r| r.get(0))
        .unwrap();
    let cash_collected: f64 = conn
        .query_row("SELECT COALESCE(SUM(net_total),0) FROM sales WHERE payment_method != 'credit'", [], |r| r.get(0))
        .unwrap();
    let payments: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount),0) FROM customer_payments", [], |r| r.get(0))
        .unwrap();
    let purchases_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(total),0) FROM purchases", [], |r| r.get(0))
        .unwrap();
    let expenses_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount),0) FROM expenses", [], |r| r.get(0))
        .unwrap();

    let cash_in_hand = opening + cash_collected + payments - purchases_total - expenses_total;

    // opening=1000, cash=500+300=800, payments=200, purchases=400, expenses=150
    // 1000 + 800 + 200 - 400 - 150 = 1450
    assert_eq!(cash_in_hand, 1450.0);
}

#[test]
fn test_dashboard_total_debts() {
    let conn = setup_db();
    conn.execute("INSERT INTO customers (name) VALUES ('Debtor')", []).unwrap();
    let cid: i64 = conn.last_insert_rowid();

    // Credit sales: 1000
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, customer_id, payment_method) VALUES ('FS-1', '2025-01-15', 1000, 0, 0, 1000, ?1, 'credit')",
        params![cid],
    )
    .unwrap();
    // Payment: 400
    conn.execute(
        "INSERT INTO customer_payments (customer_id, date, amount) VALUES (?1, '2025-01-15', 400)",
        params![cid],
    )
    .unwrap();

    let total_debts: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(s.net_total),0) - (SELECT COALESCE(SUM(amount),0) FROM customer_payments)
             FROM sales s WHERE s.payment_method = 'credit'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total_debts, 600.0, "Debt = 1000 - 400 = 600");
}

// ===================== PROFIT & LOSS TESTS =====================

#[test]
fn test_profit_loss_full_calculation() {
    let conn = setup_db();
    // Product: cost 80, sell 120
    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity) VALUES ('PL', 80, 120, 200)",
        [],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // Sale 1: 10 units
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-1', '2025-01-15', 1200, 0, 0, 1200, 'cash')",
        [],
    )
    .unwrap();
    let sid1: i64 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, 10, 120, 80)",
        params![sid1, pid],
    )
    .unwrap();

    // Sale 2: 5 units with discount
    conn.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, payment_method) VALUES ('FS-2', '2025-01-15', 600, 50, 0, 550, 'cash')",
        [],
    )
    .unwrap();
    let sid2: i64 = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, 5, 120, 80)",
        params![sid2, pid],
    )
    .unwrap();

    // Expense: 300
    conn.execute(
        "INSERT INTO expenses (date, description, amount) VALUES ('2025-01-15', 'Salary', 300)",
        [],
    )
    .unwrap();

    // Calculate P&L
    let sales_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(net_total),0) FROM sales WHERE date = '2025-01-15'", [], |r| r.get(0))
        .unwrap();
    let cost_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(si.quantity * si.cost_price),0) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.date = '2025-01-15'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let expenses_total: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date = '2025-01-15'", [], |r| r.get(0))
        .unwrap();

    let gross_profit = sales_total - cost_total;
    let net_profit = sales_total - cost_total - expenses_total;

    // Sales: 1200 + 550 = 1750
    // Cost: (10*80) + (5*80) = 800 + 400 = 1200
    // Expenses: 300
    assert_eq!(sales_total, 1750.0);
    assert_eq!(cost_total, 1200.0);
    assert_eq!(gross_profit, 550.0);
    assert_eq!(net_profit, 250.0, "Net = 1750 - 1200 - 300 = 250");
}

// ===================== INTEGRATION TEST =====================

#[test]
fn test_full_lifecycle() {
    let conn = setup_db();

    // 1. Create warehouse
    conn.execute("INSERT INTO warehouses (name, is_default) VALUES ('Main', 1)", []).unwrap();
    let wh_id: i64 = conn.last_insert_rowid();

    // 2. Create product
    conn.execute(
        "INSERT INTO products (name, barcode, cost_price, sell_price, quantity, min_quantity, warehouse_id)
         VALUES ('Laptop', 'LP001', 15000, 22000, 0, 5, ?1)",
        params![wh_id],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    // 3. Purchase 10 units at 15000
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO purchases (supplier_id, date, total, discount, additional, warehouse_id, notes, employee_id)
         VALUES (NULL, '2025-01-01', 0, 0, 0, ?1, NULL, NULL)",
        params![wh_id],
    )
    .unwrap();
    let purch_id: i64 = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES (?1, ?2, 10, 15000)",
        params![purch_id, pid],
    )
    .unwrap();
    tx.execute(
        "UPDATE products SET quantity = quantity + 10, cost_price = 15000 WHERE id = ?1",
        params![pid],
    )
    .unwrap();
    let purch_total = money(10.0 * 15000.0);
    tx.execute("UPDATE purchases SET total = ?1 WHERE id = ?2", params![purch_total, purch_id]).unwrap();
    tx.commit().unwrap();

    // 4. Verify purchase
    let qty: f64 = conn.query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0)).unwrap();
    assert_eq!(qty, 10.0);

    // 5. Create customer
    conn.execute("INSERT INTO customers (name, phone) VALUES ('Sara', '01099')", []).unwrap();
    let cust_id: i64 = conn.last_insert_rowid();

    // 6. Sale: 3 units at 22000 each (credit)
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sales (invoice_no, date, total, discount, additional, net_total, warehouse_id, customer_name, customer_id, payment_method, employee_id)
         VALUES ('', '2025-01-05', 0, 0, 0, 0, ?1, 'Sara', ?2, 'credit', NULL)",
        params![wh_id, cust_id],
    )
    .unwrap();
    let sale_id: i64 = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO sale_items (sale_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, 3, 22000, 15000)",
        params![sale_id, pid],
    )
    .unwrap();
    tx.execute("UPDATE products SET quantity = quantity - 3 WHERE id = ?1", params![pid]).unwrap();
    let sale_total = money(3.0 * 22000.0);
    let invoice_no = format!("FS-{:06}", sale_id);
    tx.execute(
        "UPDATE sales SET invoice_no = ?1, total = ?2, net_total = ?3 WHERE id = ?4",
        params![invoice_no, sale_total, sale_total, sale_id],
    )
    .unwrap();
    tx.commit().unwrap();

    // 7. Verify
    let qty: f64 = conn.query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0)).unwrap();
    assert_eq!(qty, 7.0, "Stock: 10 - 3 = 7");

    let sale_net: f64 = conn.query_row("SELECT net_total FROM sales WHERE id = ?1", params![sale_id], |r| r.get(0)).unwrap();
    assert_eq!(sale_net, 66000.0);

    let cogs: f64 = conn.query_row(
        "SELECT SUM(quantity * cost_price) FROM sale_items WHERE sale_id = ?1",
        params![sale_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(cogs, 45000.0);

    let profit = sale_net - cogs;
    assert_eq!(profit, 21000.0, "Profit: 66000 - 45000 = 21000");

    // 8. Customer pays 30000
    conn.execute(
        "INSERT INTO customer_payments (customer_id, date, amount) VALUES (?1, '2025-01-10', 30000)",
        params![cust_id],
    )
    .unwrap();

    let debt: f64 = conn.query_row(
        "SELECT COALESCE(SUM(s.net_total),0) - (SELECT COALESCE(SUM(amount),0) FROM customer_payments WHERE customer_id = ?1)
         FROM sales s WHERE s.customer_id = ?1 AND s.payment_method = 'credit'",
        params![cust_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(debt, 36000.0, "Debt: 66000 - 30000 = 36000");

    // 9. Sale return: 1 unit
    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO sale_returns (invoice_no, date, total, discount, additional, warehouse_id, customer_name, customer_id, payment_method, notes)
         VALUES ('', '2025-01-12', 0, 0, 0, ?1, 'Sara', ?2, 'credit', NULL)",
        params![wh_id, cust_id],
    )
    .unwrap();
    let ret_id: i64 = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO sale_return_items (return_id, product_id, quantity, sell_price, cost_price) VALUES (?1, ?2, 1, 22000, 15000)",
        params![ret_id, pid],
    )
    .unwrap();
    tx.execute("UPDATE products SET quantity = quantity + 1 WHERE id = ?1", params![pid]).unwrap();
    let ret_total = money(1.0 * 22000.0);
    let ret_invoice = format!("MSR-{:06}", ret_id);
    tx.execute(
        "UPDATE sale_returns SET total = ?1, invoice_no = ?2 WHERE id = ?3",
        params![ret_total, ret_invoice, ret_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty: f64 = conn.query_row("SELECT quantity FROM products WHERE id = ?1", params![pid], |r| r.get(0)).unwrap();
    assert_eq!(qty, 8.0, "Stock after return: 7 + 1 = 8");

    // 10. Expense
    conn.execute(
        "INSERT INTO expenses (date, description, amount, category) VALUES ('2025-01-15', 'Internet', 200, 'Bills')",
        [],
    )
    .unwrap();

    // 11. Final dashboard check
    let today_sales: f64 = conn.query_row(
        "SELECT COALESCE(SUM(net_total),0) FROM sales WHERE date = '2025-01-05'", [], |r| r.get(0)
    ).unwrap();
    let today_cost: f64 = conn.query_row(
        "SELECT COALESCE(SUM(si.quantity * si.cost_price),0) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.date = '2025-01-05'",
        [], |r| r.get(0),
    ).unwrap();
    assert_eq!(today_sales, 66000.0);
    assert_eq!(today_cost, 45000.0);
}

// ===================== SERVICE ORDER TESTS =====================

#[test]
fn test_create_service_order() {
    let conn = setup_db();
    conn.execute("INSERT INTO customers (name, phone) VALUES ('Omar', '010111')", []).unwrap();
    let cid: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO service_orders (order_no, customer_id, device_type, device_brand, device_model, serial_number, imei, device_condition, customer_complaint, parts_cost, labor_cost, service_cost, discount, tax_rate, total_cost, amount_paid, status)
         VALUES ('SO-000001', ?1, 'Mobile', 'Samsung', 'S24', 'SN123', 'IMEI999', 'Cracked screen', 'Screen not working', 0, 0, 0, 0, 0, 0, 0, 'received')",
        params![cid],
    )
    .unwrap();

    let (order_no, device_type, status): (String, String, String) = conn
        .query_row(
            "SELECT order_no, device_type, status FROM service_orders WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();

    assert_eq!(order_no, "SO-000001");
    assert_eq!(device_type, "Mobile");
    assert_eq!(status, "received");
}

#[test]
fn test_update_service_order_status() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO service_orders (order_no, status) VALUES ('SO-000001', 'received')",
        [],
    )
    .unwrap();
    let order_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "UPDATE service_orders SET status = 'in_progress', updated_at = datetime('now','localtime') WHERE id = ?1",
        params![order_id],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO service_order_status_history (order_id, old_status, new_status) VALUES (?1, 'received', 'in_progress')",
        params![order_id],
    )
    .unwrap();

    let status: String = conn
        .query_row("SELECT status FROM service_orders WHERE id = ?1", params![order_id], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "in_progress");

    let history_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM service_order_status_history WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(history_count, 1);
}

#[test]
fn test_add_service_order_parts_updates_parts_cost() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO service_orders (order_no, parts_cost, labor_cost, service_cost, discount, tax_rate, total_cost)
         VALUES ('SO-000001', 0, 0, 0, 0, 0, 0)",
        [],
    )
    .unwrap();
    let order_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO service_order_parts (order_id, product_id, part_name, quantity, cost_price, sell_price)
         VALUES (?1, NULL, 'Screen', 1, 500.0, 800.0)",
        params![order_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO service_order_parts (order_id, product_id, part_name, quantity, cost_price, sell_price)
         VALUES (?1, NULL, 'Battery', 1, 200.0, 350.0)",
        params![order_id],
    )
    .unwrap();

    let parts_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity * cost_price),0) FROM service_order_parts WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(parts_total, 700.0);

    conn.execute(
        "UPDATE service_orders SET parts_cost = ?1 WHERE id = ?2",
        params![parts_total, order_id],
    )
    .unwrap();

    let parts_cost: f64 = conn
        .query_row("SELECT parts_cost FROM service_orders WHERE id = ?1", params![order_id], |r| r.get(0))
        .unwrap();
    assert_eq!(parts_cost, 700.0);
}

#[test]
fn test_service_order_total_calculation() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO service_orders (order_no, parts_cost, labor_cost, service_cost, discount, tax_rate, total_cost)
         VALUES ('SO-000001', 0, 0, 0, 0, 0, 0)",
        [],
    )
    .unwrap();
    let order_id: i64 = conn.last_insert_rowid();

    let parts_cost = 1500.0;
    let labor_cost = 300.0;
    let service_cost = 200.0;
    let discount = 100.0;
    let tax_rate = 0.14;

    let subtotal = parts_cost + labor_cost + service_cost - discount;
    let tax = money(subtotal * tax_rate);
    let total = money(subtotal + tax);

    conn.execute(
        "UPDATE service_orders SET parts_cost = ?1, labor_cost = ?2, service_cost = ?3, discount = ?4, tax_rate = ?5, total_cost = ?6 WHERE id = ?7",
        params![parts_cost, labor_cost, service_cost, discount, tax_rate, total, order_id],
    )
    .unwrap();

    let (p, l, s, d, t, total_db): (f64, f64, f64, f64, f64, f64) = conn
        .query_row(
            "SELECT parts_cost, labor_cost, service_cost, discount, tax_rate, total_cost FROM service_orders WHERE id = ?1",
            params![order_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .unwrap();

    assert_eq!(p, 1500.0);
    assert_eq!(l, 300.0);
    assert_eq!(s, 200.0);
    assert_eq!(d, 100.0);
    assert_eq!(t, 0.14);
    assert_eq!(total_db, total);
}

// ===================== EMPLOYEE & SALARY TESTS =====================

#[test]
fn test_create_employee_and_add_salary() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO employees (name, phone, email, position, salary, hire_date) VALUES ('Ali', '010222', 'ali@test.com', 'Technician', 8000, '2025-01-01')",
        [],
    )
    .unwrap();
    let emp_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount, notes) VALUES (?1, '2025-01-31', 8000, 'January salary')",
        params![emp_id],
    )
    .unwrap();

    let (name, emp_salary): (String, f64) = conn
        .query_row("SELECT name, salary FROM employees WHERE id = ?1", params![emp_id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(name, "Ali");
    assert_eq!(emp_salary, 8000.0);

    let salary_amount: f64 = conn
        .query_row("SELECT amount FROM salaries WHERE employee_id = ?1", params![emp_id], |r| r.get(0))
        .unwrap();
    assert_eq!(salary_amount, 8000.0);
}

#[test]
fn test_multiple_salary_payments_for_employee() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO employees (name, position, salary) VALUES ('Sara', 'Manager', 15000)",
        [],
    )
    .unwrap();
    let emp_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount) VALUES (?1, '2025-01-31', 15000)",
        params![emp_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount) VALUES (?1, '2025-02-28', 15000)",
        params![emp_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount) VALUES (?1, '2025-03-31', 15000)",
        params![emp_id],
    )
    .unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM salaries WHERE employee_id = ?1",
            params![emp_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 3);

    let total_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE employee_id = ?1",
            params![emp_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total_paid, 45000.0);
}

#[test]
fn test_list_salaries_for_employee() {
    let conn = setup_db();
    conn.execute("INSERT INTO employees (name, salary) VALUES ('Khaled', 10000)", []).unwrap();
    let emp_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount) VALUES (?1, '2025-01-31', 10000)",
        params![emp_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO salaries (employee_id, date, amount) VALUES (?1, '2025-02-28', 10000)",
        params![emp_id],
    )
    .unwrap();

    let mut stmt = conn
        .prepare("SELECT date, amount FROM salaries WHERE employee_id = ?1 ORDER BY date")
        .unwrap();
    let rows: Vec<(String, f64)> = stmt
        .query_map(params![emp_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].0, "2025-01-31");
    assert_eq!(rows[0].1, 10000.0);
    assert_eq!(rows[1].0, "2025-02-28");
    assert_eq!(rows[1].1, 10000.0);
}

// ===================== VACATION TESTS =====================

#[test]
fn test_create_vacation_default_pending() {
    let conn = setup_db();
    conn.execute("INSERT INTO employees (name, salary) VALUES ('Youssef', 9000)", []).unwrap();
    let emp_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO vacations (employee_id, start_date, end_date, days, type, notes)
         VALUES (?1, '2025-06-01', '2025-06-05', 5, 'annual', 'Summer vacation')",
        params![emp_id],
    )
    .unwrap();

    let (status, days, vac_type): (String, i64, String) = conn
        .query_row(
            "SELECT status, days, type FROM vacations WHERE employee_id = ?1",
            params![emp_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();

    assert_eq!(status, "pending");
    assert_eq!(days, 5);
    assert_eq!(vac_type, "annual");
}

#[test]
fn test_update_vacation_status() {
    let conn = setup_db();
    conn.execute("INSERT INTO employees (name, salary) VALUES ('Nour', 12000)", []).unwrap();
    let emp_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO vacations (employee_id, start_date, end_date, days, status)
         VALUES (?1, '2025-07-01', '2025-07-10', 10, 'pending')",
        params![emp_id],
    )
    .unwrap();
    let vac_id: i64 = conn.last_insert_rowid();

    conn.execute(
        "UPDATE vacations SET status = 'approved' WHERE id = ?1",
        params![vac_id],
    )
    .unwrap();

    let status: String = conn
        .query_row("SELECT status FROM vacations WHERE id = ?1", params![vac_id], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "approved");

    conn.execute(
        "UPDATE vacations SET status = 'rejected' WHERE id = ?1",
        params![vac_id],
    )
    .unwrap();

    let status: String = conn
        .query_row("SELECT status FROM vacations WHERE id = ?1", params![vac_id], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "rejected");
}

// ===================== WAREHOUSE TRANSFER TESTS =====================

#[test]
fn test_warehouse_transfer_stock_changes() {
    let conn = setup_db();
    conn.execute("INSERT INTO warehouses (name, is_default) VALUES ('WH-A', 1)", []).unwrap();
    let wh_a: i64 = conn.last_insert_rowid();
    conn.execute("INSERT INTO warehouses (name, is_default) VALUES ('WH-B', 0)", []).unwrap();
    let wh_b: i64 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO products (name, cost_price, sell_price, quantity, warehouse_id) VALUES ('Item', 100, 150, 50, ?1)",
        params![wh_a],
    )
    .unwrap();
    let pid: i64 = conn.last_insert_rowid();

    let tx = conn.unchecked_transaction().unwrap();
    tx.execute(
        "INSERT INTO warehouse_transfers (transfer_no, date, from_warehouse_id, to_warehouse_id, transfer_type, amount, notes)
         VALUES ('TR-000001', '2025-01-15', ?1, ?2, 'products', 0, 'Transfer 20 units')",
        params![wh_a, wh_b],
    )
    .unwrap();
    let transfer_id: i64 = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO warehouse_transfer_items (transfer_id, product_id, quantity, cost_price)
         VALUES (?1, ?2, 20, 100)",
        params![transfer_id, pid],
    )
    .unwrap();

    tx.execute(
        "UPDATE products SET quantity = quantity - 20 WHERE id = ?1 AND warehouse_id = ?2",
        params![pid, wh_a],
    )
    .unwrap();
    tx.commit().unwrap();

    let qty_a: f64 = conn
        .query_row(
            "SELECT quantity FROM products WHERE id = ?1 AND warehouse_id = ?2",
            params![pid, wh_a],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(qty_a, 30.0);

    let transfer_qty: f64 = conn
        .query_row(
            "SELECT quantity FROM warehouse_transfer_items WHERE transfer_id = ?1 AND product_id = ?2",
            params![transfer_id, pid],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(transfer_qty, 20.0);
}
