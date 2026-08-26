use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Warehouse {
    pub id: i64,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct WarehouseStats {
    pub quantity: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub barcode: Option<String>,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub warehouse_id: Option<i64>,
    pub warehouse_name: Option<String>,
    pub unit: Option<String>,
    pub cost_price: f64,
    pub sell_price: f64,
    pub quantity: f64,
    pub min_quantity: f64,
    pub opening_balance: f64,
    pub composite_category_id: Option<i64>,
    pub composite_category_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub credit_limit: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerPayment {
    pub id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub date: String,
    pub amount: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub store_name: String,
    pub phone: String,
    pub address: String,
    pub currency: String,
    pub invoice_footer: String,
    pub opening_balance: f64,
    pub attendance_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleItem {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub sell_price: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sale {
    pub id: i64,
    pub invoice_no: String,
    pub date: String,
    pub total: f64,
    pub discount: f64,
    pub additional: f64,
    pub net_total: f64,
    pub warehouse_id: Option<i64>,
    pub warehouse_name: Option<String>,
    pub customer_name: Option<String>,
    pub customer_id: Option<i64>,
    pub payment_method: String,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub items: Vec<SaleItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReturnItem {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub sell_price: f64,
    pub cost_price: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReturn {
    pub id: i64,
    pub invoice_no: String,
    pub date: String,
    pub total: f64,
    pub discount: f64,
    pub additional: f64,
    pub warehouse_id: Option<i64>,
    pub warehouse_name: Option<String>,
    pub customer_name: Option<String>,
    pub customer_id: Option<i64>,
    pub payment_method: String,
    pub notes: Option<String>,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub items: Vec<SaleReturnItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSaleReturnItem {
    pub product_id: i64,
    pub quantity: f64,
    pub sell_price: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSaleReturn {
    pub date: String,
    pub discount: f64,
    pub additional: Option<f64>,
    pub warehouse_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_id: Option<i64>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub employee_id: Option<i64>,
    pub items: Vec<NewSaleReturnItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItem {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub cost_price: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Purchase {
    pub id: i64,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub date: String,
    pub total: f64,
    pub discount: f64,
    pub additional: f64,
    pub warehouse_id: Option<i64>,
    pub warehouse_name: Option<String>,
    pub notes: Option<String>,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub items: Vec<PurchaseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturnItem {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub cost_price: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturn {
    pub id: i64,
    pub purchase_id: i64,
    pub invoice_no: String,
    pub date: String,
    pub total: f64,
    pub discount: f64,
    pub additional: f64,
    pub warehouse_id: Option<i64>,
    pub warehouse_name: Option<String>,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub notes: Option<String>,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub items: Vec<PurchaseReturnItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPurchaseReturnItem {
    pub product_id: i64,
    pub quantity: f64,
    pub cost_price: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewPurchaseReturn {
    pub purchase_id: i64,
    pub date: String,
    pub discount: Option<f64>,
    pub additional: Option<f64>,
    pub warehouse_id: Option<i64>,
    pub notes: Option<String>,
    pub employee_id: Option<i64>,
    pub items: Vec<NewPurchaseReturnItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockCountItem {
    pub product_id: i64,
    pub product_name: String,
    pub barcode: Option<String>,
    pub system_qty: f64,
    pub counted_qty: f64,
    pub difference: f64,
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockCount {
    pub id: i64,
    pub date: String,
    pub status: String,
    pub total_difference: f64,
    pub total_surplus: f64,
    pub total_deficit: f64,
    pub notes: Option<String>,
    pub items_count: i64,
    pub items: Vec<StockCountItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: i64,
    pub date: String,
    pub description: String,
    pub amount: f64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Employee {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub position: Option<String>,
    pub salary: f64,
    pub hire_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Salary {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub date: String,
    pub amount: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vacation {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub start_date: String,
    pub end_date: String,
    pub days: i64,
    pub r#type: String,
    pub notes: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attendance {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub date: String,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub r#type: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewAttendance {
    pub employee_id: i64,
    pub date: String,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub r#type: String,
    pub notes: Option<String>,
}

// ---------- Input structs ----------

#[derive(Debug, Clone, Deserialize)]
pub struct NewProduct {
    pub name: String,
    pub barcode: Option<String>,
    pub category_id: Option<i64>,
    pub warehouse_id: Option<i64>,
    pub unit: Option<String>,
    pub cost_price: f64,
    pub sell_price: f64,
    pub quantity: f64,
    pub min_quantity: f64,
    pub composite_category_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceItem {
    pub product_id: i64,
    pub opening_balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarehouseCashBalance {
    pub warehouse_id: i64,
    pub warehouse_name: String,
    pub cash_in: f64,
    pub cash_out: f64,
    pub balance: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewCategory {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSupplier {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub credit_limit: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSaleItem {
    pub product_id: i64,
    pub quantity: f64,
    pub sell_price: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSale {
    pub date: String,
    pub discount: f64,
    pub additional: Option<f64>,
    pub warehouse_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_id: Option<i64>,
    pub payment_method: Option<String>,
    pub employee_id: Option<i64>,
    pub items: Vec<NewSaleItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewPurchaseItem {
    pub product_id: i64,
    pub quantity: f64,
    pub cost_price: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewPurchase {
    pub date: String,
    pub supplier_id: Option<i64>,
    pub notes: Option<String>,
    pub discount: Option<f64>,
    pub additional: Option<f64>,
    pub warehouse_id: Option<i64>,
    pub employee_id: Option<i64>,
    pub items: Vec<NewPurchaseItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewExpense {
    pub date: String,
    pub description: String,
    pub amount: f64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewEmployee {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub position: Option<String>,
    pub salary: f64,
    pub hire_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewSalary {
    pub employee_id: i64,
    pub date: String,
    pub amount: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewVacation {
    pub employee_id: i64,
    pub start_date: String,
    pub end_date: String,
    pub days: i64,
    pub r#type: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewCustomer {
    pub name: String,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewCustomerPayment {
    pub customer_id: i64,
    pub date: String,
    pub amount: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewStockCountItem {
    pub product_id: i64,
    pub counted_qty: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewStockCount {
    pub date: String,
    pub notes: Option<String>,
    pub items: Vec<NewStockCountItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DateRange {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shift {
    pub id: i64,
    pub name: String,
    pub start_time: String,
    pub end_time: String,
    pub grace_minutes: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewShift {
    pub name: String,
    pub start_time: String,
    pub end_time: String,
    pub grace_minutes: i64,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeShift {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub shift_id: i64,
    pub shift_name: String,
    pub start_time: String,
    pub end_time: String,
    pub effective_date: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewEmployeeShift {
    pub employee_id: i64,
    pub shift_id: i64,
    pub effective_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftReport {
    pub id: i64,
    pub employee_id: i64,
    pub employee_name: String,
    pub shift_name: Option<String>,
    pub shift_start: Option<String>,
    pub shift_end: Option<String>,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub date: String,
    pub has_shift: bool,
    pub is_within_shift: bool,
    pub is_late: bool,
    pub late_minutes: i64,
    pub is_early_leave: bool,
    pub early_minutes: i64,
    pub work_hours: f64,
}

// ---------- Reports ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct Dashboard {
    pub today_sales: f64,
    pub today_purchases: f64,
    pub today_expenses: f64,
    pub today_profit: f64,
    pub product_count: i64,
    pub low_stock_count: i64,
    pub recent_sales_count: i64,
    pub total_suppliers: i64,
    pub total_customers: i64,
    pub total_debts: f64,
    pub cash_in_hand: f64,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ProfitLoss {
    pub sales_total: f64,
    pub cost_total: f64,
    pub gross_profit: f64,
    pub expenses_total: f64,
    pub purchases_total: f64,
    pub net_profit: f64,
    pub sales_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockValue {
    pub product_count: i64,
    pub total_value: f64,
    pub low_stock_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailySalesRow {
    pub date: String,
    pub sales_count: i64,
    pub sales_total: f64,
    pub profit: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BestSeller {
    pub product_name: String,
    pub quantity: f64,
    pub revenue: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductMovement {
    pub id: i64,
    pub date: String,
    pub r#type: String,
    pub reference: String,
    pub description: String,
    pub quantity: f64,
    pub price: f64,
    pub total: f64,
    pub related_id: i64,
    pub customer_name: Option<String>,
    pub supplier_name: Option<String>,
    pub warehouse_name: Option<String>,
    pub payment_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductComponent {
    pub id: i64,
    pub composite_product_id: i64,
    pub component_product_id: i64,
    pub component_name: String,
    pub component_unit: Option<String>,
    pub component_quantity: f64,
    pub quantity_per_unit: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewProductComponent {
    pub component_product_id: i64,
    pub quantity_per_unit: f64,
}
