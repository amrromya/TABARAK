export interface Category {
  id: number;
  name: string;
}

export interface Warehouse {
  id: number;
  name: string;
  is_default: boolean;
}

export interface WarehouseStats {
  quantity: number;
  value: number;
}

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  category_id: number | null;
  category_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  unit: string | null;
  cost_price: number;
  sell_price: number;
  wholesale_price: number;
  quantity: number;
  min_quantity: number;
  opening_balance: number;
  composite_category_id: number | null;
  composite_category_name: string | null;
  product_type: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  notes: string | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  balance: number;
  customer_type: string;
}

export interface CustomerPayment {
  id: number;
  customer_id: number;
  customer_name: string;
  date: string;
  amount: number;
  notes: string | null;
}

export interface Settings {
  store_name: string;
  phone: string;
  address: string;
  currency: string;
  invoice_footer: string;
  opening_balance: number;
  attendance_url: string;
}

export interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  sell_price: number;
  total: number;
  item_name?: string | null;
}

export interface Sale {
  id: number;
  invoice_no: string;
  date: string;
  total: number;
  discount: number;
  additional: number;
  net_total: number;
  warehouse_id: number | null;
  warehouse_name: string | null;
  customer_name: string | null;
  customer_id: number | null;
  payment_method: string;
  employee_id: number | null;
  employee_name: string | null;
  items: SaleItem[];
}

export interface PurchaseItem {
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
  total: number;
}

export interface Purchase {
  id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  date: string;
  total: number;
  discount: number;
  additional: number;
  warehouse_id: number | null;
  warehouse_name: string | null;
  notes: string | null;
  employee_id: number | null;
  employee_name: string | null;
  items: PurchaseItem[];
}

export interface PurchaseReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
  total: number;
}

export interface PurchaseReturn {
  id: number;
  purchase_id: number | null;
  invoice_no: string;
  date: string;
  total: number;
  discount: number;
  additional: number;
  warehouse_id: number | null;
  warehouse_name: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  notes: string | null;
  employee_id: number | null;
  employee_name: string | null;
  items: PurchaseReturnItem[];
}

export interface NewPurchaseReturnItem {
  product_id: number;
  quantity: number;
  cost_price: number;
}

export interface NewPurchaseReturn {
  purchase_id: number;
  date: string;
  discount?: number | null;
  additional?: number | null;
  warehouse_id?: number | null;
  notes?: string | null;
  employee_id?: number | null;
  items: NewPurchaseReturnItem[];
}

export interface SaleReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  sell_price: number;
  cost_price: number;
  total: number;
  item_name?: string | null;
}

export interface SaleReturn {
  id: number;
  invoice_no: string;
  date: string;
  total: number;
  discount: number;
  additional: number;
  warehouse_id: number | null;
  warehouse_name: string | null;
  customer_name: string | null;
  customer_id: number | null;
  payment_method: string;
  notes: string | null;
  employee_id: number | null;
  employee_name: string | null;
  items: SaleReturnItem[];
}

export interface NewSaleReturnItem {
  product_id: number;
  quantity: number;
  sell_price: number;
  item_name?: string | null;
}

export interface NewSaleReturn {
  date: string;
  discount: number;
  additional?: number | null;
  warehouse_id?: number | null;
  customer_name?: string | null;
  customer_id?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  employee_id?: number | null;
  items: NewSaleReturnItem[];
}

export interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
}

export interface Employee {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  salary: number;
  hire_date: string | null;
  notes: string | null;
}

export interface Salary {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  amount: number;
  notes: string | null;
}

export interface Vacation {
  id: number;
  employee_id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  days: number;
  type: string;
  notes: string | null;
  status: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  type: string;
  notes: string | null;
}

export interface NewAttendance {
  employee_id: number;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  type: string;
  notes?: string | null;
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_active: boolean;
}

export interface NewShift {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_active?: boolean;
}

export interface EmployeeShift {
  id: number;
  employee_id: number;
  employee_name: string;
  shift_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  effective_date: string;
}

export interface NewEmployeeShift {
  employee_id: number;
  shift_id: number;
  effective_date: string;
}

export interface ShiftReport {
  id: number;
  employee_id: number;
  employee_name: string;
  shift_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  check_in: string | null;
  check_out: string | null;
  date: string;
  has_shift: boolean;
  is_within_shift: boolean;
  is_late: boolean;
  late_minutes: number;
  is_early_leave: boolean;
  early_minutes: number;
  work_hours: number;
}

export interface StockCountItem {
  product_id: number;
  product_name: string;
  barcode: string | null;
  system_qty: number;
  counted_qty: number;
  difference: number;
  unit: string | null;
}

export interface StockCount {
  id: number;
  date: string;
  status: "draft" | "applied";
  total_difference: number;
  total_surplus: number;
  total_deficit: number;
  notes: string | null;
  items_count: number;
  items: StockCountItem[];
}

export interface NewStockCountItem {
  product_id: number;
  counted_qty: number;
}

export interface NewStockCount {
  date: string;
  notes?: string | null;
  items: NewStockCountItem[];
}

export interface Dashboard {
  today_sales: number;
  today_purchases: number;
  today_expenses: number;
  today_profit: number;
  product_count: number;
  low_stock_count: number;
  recent_sales_count: number;
  total_suppliers: number;
  total_customers: number;
  total_debts: number;
  cash_in_hand: number;
}

export interface ProfitLoss {
  sales_total: number;
  cost_total: number;
  gross_profit: number;
  expenses_total: number;
  purchases_total: number;
  net_profit: number;
  sales_count: number;
}

export interface StockValue {
  product_count: number;
  total_value: number;
  low_stock_count: number;
}

export interface DailySalesRow {
  date: string;
  sales_count: number;
  sales_total: number;
  profit: number;
}

export interface BestSeller {
  product_name: string;
  quantity: number;
  revenue: number;
}

// ---------- Inputs ----------

export interface NewProduct {
  name: string;
  barcode?: string | null;
  category_id?: number | null;
  warehouse_id?: number | null;
  unit?: string | null;
  cost_price: number;
  sell_price: number;
  wholesale_price?: number;
  quantity: number;
  min_quantity: number;
  composite_category_id?: number | null;
  product_type?: string;
}

export interface OpeningBalanceItem {
  product_id: number;
  opening_balance: number;
}

export interface NewSaleItem {
  product_id: number;
  quantity: number;
  sell_price: number;
  item_name?: string | null;
}

export interface NewSale {
  date: string;
  discount: number;
  additional?: number | null;
  warehouse_id?: number | null;
  customer_name?: string | null;
  customer_id?: number | null;
  payment_method?: string | null;
  employee_id?: number | null;
  items: NewSaleItem[];
}

export interface NewPurchaseItem {
  product_id: number;
  quantity: number;
  cost_price: number;
}

export interface NewPurchase {
  date: string;
  supplier_id?: number | null;
  notes?: string | null;
  discount?: number | null;
  additional?: number | null;
  warehouse_id?: number | null;
  employee_id?: number | null;
  items: NewPurchaseItem[];
}

export interface NewExpense {
  date: string;
  description: string;
  amount: number;
  category?: string | null;
}

export interface NewEmployee {
  name: string;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  salary: number;
  hire_date?: string | null;
  notes?: string | null;
}

export interface NewSalary {
  employee_id: number;
  date: string;
  amount: number;
  notes?: string | null;
}

export interface NewVacation {
  employee_id: number;
  start_date: string;
  end_date: string;
  days: number;
  type?: string | null;
  notes?: string | null;
  status?: string | null;
}

export interface NewAttendance {
  employee_id: number;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  type: string;
  notes?: string | null;
}

export interface NewSupplier {
  name: string;
  phone?: string | null;
  address?: string | null;
  credit_limit?: number | null;
  notes?: string | null;
}

export interface NewCustomer {
  name: string;
  phone?: string | null;
  notes?: string | null;
  customer_type?: string | null;
}

export interface NewCustomerPayment {
  customer_id: number;
  date: string;
  amount: number;
  notes?: string | null;
}

export interface DateRange {
  from?: string | null;
  to?: string | null;
}

export interface ProductMovement {
  id: number;
  date: string;
  type: "sale" | "purchase" | "sale_return" | "purchase_return" | "maintenance";
  reference: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  related_id: number;
  customer_name?: string | null;
  supplier_name?: string | null;
  warehouse_name?: string | null;
  payment_method?: string | null;
}

export interface ProductComponent {
  id: number;
  composite_product_id: number;
  component_product_id: number;
  component_name: string;
  component_unit: string | null;
  component_quantity: number;
  quantity_per_unit: number;
}

export interface NewProductComponent {
  component_product_id: number;
  quantity_per_unit: number;
}

export interface ProductMovementsQuery {
  product_id: number;
}

export type Permission =
  | "view_dashboard"
  | "view_inventory"
  | "view_warehouses"
  | "view_sales"
  | "view_purchases"
  | "view_suppliers"
  | "view_customers"
  | "view_employees"
  | "view_expenses"
  | "view_reports"
  | "view_settings"
  | "create_sale"
  | "edit_sale"
  | "delete_sale"
  | "create_purchase"
  | "edit_purchase"
  | "delete_purchase"
  | "create_customer"
  | "edit_customer"
  | "delete_customer"
  | "create_employee"
  | "edit_employee"
  | "delete_employee"
  | "manage_accounts"
  | "view_receipt_vouchers"
  | "view_payment_vouchers"
  | "view_warehouse_transfers"
  | "view_cash_register"
  | "maintenance.view"
  | "maintenance.create"
  | "maintenance.edit"
  | "maintenance.delete"
  | "maintenance.receive"
  | "maintenance.diagnose"
  | "maintenance.assign"
  | "maintenance.parts"
  | "maintenance.approve"
  | "maintenance.deliver"
  | "maintenance.reports"
  | "maintenance.financial"
  | "maintenance.settings";

export interface Account {
  id: string;
  name: string;
  password: string;
  permissions: Permission[];
  visibleMenus: string[];
}

// ---------- Sync ----------

export interface SyncConfig {
  supabase_url: string;
  supabase_key: string;
  branch_id: number;
  device_id: string;
  auto_sync: boolean;
  sync_interval_secs: number;
}

export interface SyncStatus {
  is_online: boolean;
  last_sync: string | null;
  pending_push: number;
  pending_pull: number;
  conflicts: SyncConflict[];
  config: SyncConfig;
}

export interface SyncConflict {
  table: string;
  record_id: number;
  local_version: Record<string, unknown>;
  remote_version: Record<string, unknown>;
  conflict_type: "UpdateUpdate" | "DeleteUpdate" | "UpdateDelete";
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

// ==================== Maintenance Types ====================

export type MaintenanceStatus =
  | "received" | "inspection" | "pending_approval" | "repairing"
  | "pending_parts" | "repaired" | "ready" | "delivered"
  | "cancelled" | "rejected";

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  received: "تم الاستلام",
  inspection: "تحت الفحص",
  pending_approval: "بانتظار موافقة",
  repairing: "جاري الإصلاح",
  pending_parts: "بانتظار قطعة غيار",
  repaired: "تم الإصلاح",
  ready: "جاهز للتسليم",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  rejected: "رفض الإصلاح",
};

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  received: "#3b82f6",
  inspection: "#f59e0b",
  pending_approval: "#8b5cf6",
  repairing: "#ef4444",
  pending_parts: "#f97316",
  repaired: "#10b981",
  ready: "#06b6d4",
  delivered: "#22c55e",
  cancelled: "#6b7280",
  rejected: "#dc2626",
};

export interface ServiceOrderSummary {
  id: number;
  order_no: string;
  customer_name: string | null;
  customer_phone: string | null;
  device_type: string;
  device_brand: string | null;
  device_model: string | null;
  status: MaintenanceStatus;
  total_cost: number;
  amount_paid: number;
  remaining: number;
  warranty_end: string | null;
  original_order_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceImage {
  id: number;
  order_id: number;
  image_path: string;
  image_type: string;
  description: string | null;
}

export interface ServiceTechnician {
  id: number;
  order_id: number;
  technician_id: number;
  technician_name: string;
  work_type: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

export interface ServiceChecklist {
  id: number;
  order_id: number;
  item_name: string;
  status: string;
  notes: string | null;
}

export interface ServicePart {
  id: number;
  order_id: number;
  product_id: number | null;
  part_name: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
}

export interface ServicePayment {
  id: number;
  order_id: number;
  amount: number;
  payment_method: string;
  date: string;
  notes: string | null;
  received_by: number | null;
  received_by_name: string | null;
}

export interface ServiceNote {
  id: number;
  order_id: number;
  note: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  order_id: number;
  old_status: string | null;
  new_status: string;
  changed_by: number | null;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  order_id: number;
  action: string;
  user_name: string | null;
  details: string | null;
  created_at: string;
}

export interface ServiceOrder {
  id: number;
  order_no: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  device_type: string;
  device_brand: string | null;
  device_model: string | null;
  serial_number: string | null;
  imei: string | null;
  device_color: string | null;
  device_condition: string | null;
  accessories: string | null;
  device_password: string | null;
  customer_complaint: string | null;
  diagnosis: string | null;
  repair_action: string | null;
  technician_notes: string | null;
  status: MaintenanceStatus;
  parts_cost: number;
  labor_cost: number;
  service_cost: number;
  discount: number;
  tax_rate: number;
  total_cost: number;
  amount_paid: number;
  remaining: number;
  customer_approval: string;
  approval_date: string | null;
  approval_price: number | null;
  approval_notes: string | null;
  warranty_days: number;
  warranty_start: string | null;
  warranty_end: string | null;
  original_order_id: number | null;
  delivered_to: string | null;
  delivered_phone: string | null;
  delivered_date: string | null;
  delivered_time: string | null;
  payment_method: string | null;
  received_by: number | null;
  delivered_by: number | null;
  received_by_name: string | null;
  delivered_by_name: string | null;
  images: ServiceImage[];
  technicians: ServiceTechnician[];
  checklist: ServiceChecklist[];
  parts: ServicePart[];
  payments: ServicePayment[];
  notes: ServiceNote[];
  history: StatusHistory[];
  created_at: string;
  updated_at: string;
}

export interface NewServiceOrder {
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_alt_phone?: string | null;
  customer_address?: string | null;
  customer_notes?: string | null;
  device_type: string;
  device_brand?: string | null;
  device_model?: string | null;
  serial_number?: string | null;
  imei?: string | null;
  device_color?: string | null;
  device_condition?: string | null;
  accessories?: string | null;
  device_password?: string | null;
  customer_complaint?: string | null;
  diagnosis?: string | null;
  repair_action?: string | null;
  technician_notes?: string | null;
  parts_cost?: number | null;
  labor_cost?: number | null;
  service_cost?: number | null;
  discount?: number | null;
  tax_rate?: number | null;
  warranty_days?: number | null;
  original_order_id?: number | null;
  deposit?: number | null;
  deposit_method?: string | null;
}

export interface AssignTechnician {
  technician_id: number;
  work_type?: string | null;
  notes?: string | null;
}

export interface AddServicePart {
  product_id?: number | null;
  part_name: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
}

export interface AddServicePayment {
  amount: number;
  payment_method: string;
  notes?: string | null;
}

export interface NewChecklistItem {
  item_name: string;
  status: string;
  notes?: string | null;
}

export interface DeviceType {
  id: number;
  name: string;
  checklist_template: string | null;
  is_active: boolean;
}

export interface DeviceBrand {
  id: number;
  name: string;
  is_active: boolean;
}

export interface CustomerSearchResult {
  id: number;
  name: string;
  phone: string | null;
}

export interface MaintenanceDashboard {
  total_in维修: number;
  received_today: number;
  delivered_today: number;
  under_inspection: number;
  in_repair: number;
  awaiting_approval: number;
  awaiting_parts: number;
  ready_for_delivery: number;
  overdue: number;
  under_warranty: number;
  revenue_today: number;
  revenue_month: number;
  total_parts_cost: number;
  total_labor: number;
  net_profit: number;
  recent_orders: ServiceOrderSummary[];
}

export interface MaintenanceSettings {
  next_order_number: string;
  late_days: string;
  sticker_width: string;
  sticker_height: string;
  receipt_footer: string;
  agreement_text: string;
}

export interface ProductUnit {
  id: number;
  product_id: number;
  unit_name: string;
  conversion_factor: number;
  sell_price: number;
  barcode?: string | null;
}

export interface NewProductUnit {
  product_id: number;
  unit_name: string;
  conversion_factor: number;
  sell_price: number;
  barcode?: string | null;
}

// ---------- Cash Register ----------

export interface CashRegisterSession {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  opening_balance: number;
  closing_balance: number | null;
  actual_cash: number | null;
  status: string;
}

export interface CashRegisterMovement {
  id: number;
  session_id: number;
  type: string;
  amount: number;
  description: string | null;
  reference_id: number | null;
  reference_type: string | null;
  created_at: string;
}

export interface NewCashMovement {
  type: string;
  amount: number;
  description?: string | null;
  reference_id?: number | null;
  reference_type?: string | null;
}

export interface CashSessionSummary {
  session: CashRegisterSession;
  movements: CashRegisterMovement[];
  total_in: number;
  total_out: number;
  expected_cash: number;
  difference: number | null;
}
