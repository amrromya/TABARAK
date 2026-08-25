import { invoke } from "@tauri-apps/api/core";
import type {
  Attendance,
  BestSeller,
  Branch,
  Category,
  Customer,
  CustomerPayment,
  DailySalesRow,
  Dashboard,
  DateRange,
  Employee,
  EmployeeShift,
  Expense,
  NewAttendance,
  NewCustomer,
  NewCustomerPayment,
  NewEmployee,
  NewEmployeeShift,
  NewExpense,
  NewProduct,
  NewPurchase,
  NewPurchaseReturn,
  NewSale,
  NewSaleReturn,
  NewSalary,
  NewShift,
  NewStockCount,
  NewSupplier,
  NewVacation,
  Product,
  ProductMovement,
  ProfitLoss,
  Purchase,
  PurchaseReturn,
  Sale,
  SaleReturn,
  Salary,
  Settings,
  Shift,
  ShiftReport,
  StockCount,
  StockValue,
  Supplier,
  SyncConfig,
  SyncConflict,
  SyncResult,
  SyncStatus,
  Vacation,
  Warehouse,
  WarehouseStats,
} from "./types";

export const api = {
  // التصنيفات
  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (name: string) =>
    invoke<Category>("create_category", { input: { name } }),
  deleteCategory: (id: number) => invoke<void>("delete_category", { id }),

  // المستودعات
  listWarehouses: () => invoke<Warehouse[]>("list_warehouses"),
  createWarehouse: (name: string) =>
    invoke<Warehouse>("create_warehouse", { name }),
  updateWarehouse: (id: number, name: string) =>
    invoke<Warehouse>("update_warehouse", { id, name }),
  setDefaultWarehouse: (id: number) =>
    invoke<Warehouse[]>("set_default_warehouse", { id }),
  deleteWarehouse: (id: number) => invoke<void>("delete_warehouse", { id }),
  warehouseStats: (id: number) =>
    invoke<WarehouseStats>("warehouse_stats", { id }),

  // المنتجات
  listProducts: (search?: string) =>
    invoke<Product[]>("list_products", { search: search || null }),
  nextBarcode: () => invoke<string>("next_barcode"),
  createProduct: (input: NewProduct) =>
    invoke<Product>("create_product", { input }),
  updateProduct: (id: number, input: NewProduct) =>
    invoke<Product>("update_product", { id, input }),
  deleteProduct: (id: number) => invoke<void>("delete_product", { id }),
  adjustStock: (id: number, quantity: number) =>
    invoke<Product>("adjust_stock", { id, quantity }),
  getProductMovements: (productId: number) =>
    invoke<ProductMovement[]>("get_product_movements", { productId }),
  setOpeningBalances: (items: { product_id: number; opening_balance: number }[]) =>
    invoke<void>("set_opening_balances", { items }),
  getOpeningBalanceSummary: () =>
    invoke<[number, number, number]>("get_opening_balance_summary"),
  getWarehouseCashBalances: () =>
    invoke<{ warehouse_id: number; warehouse_name: string; cash_in: number; cash_out: number; balance: number }[]>("get_warehouse_cash_balances"),

  // الموردون
  listSuppliers: () => invoke<Supplier[]>("list_suppliers"),
  createSupplier: (input: NewSupplier) =>
    invoke<Supplier>("create_supplier", { input }),
  updateSupplier: (id: number, input: NewSupplier) =>
    invoke<Supplier>("update_supplier", { id, input }),
  deleteSupplier: (id: number) => invoke<void>("delete_supplier", { id }),
  getSupplierAccount: (supplierId: number) =>
    invoke<{ supplier_id: number; total_purchases: number; total_purchase_returns: number; total_paid: number; total_received: number; balance: number }>("get_supplier_account", { supplierId }),
  getSupplierTransactions: (supplierId: number) =>
    invoke<{ date: string; description: string; debit: number; credit: number; notes: string | null }[]>("get_supplier_transactions", { supplierId }),

  // العملاء والديون
  listCustomers: () => invoke<Customer[]>("list_customers"),
  createCustomer: (input: NewCustomer) =>
    invoke<Customer>("create_customer", { input }),
  updateCustomer: (id: number, input: NewCustomer) =>
    invoke<Customer>("update_customer", { id, input }),
  deleteCustomer: (id: number) => invoke<void>("delete_customer", { id }),
  listCustomerPayments: (customerId?: number) =>
    invoke<CustomerPayment[]>("list_customer_payments", {
      customerId: customerId ?? null,
    }),
  createCustomerPayment: (input: NewCustomerPayment) =>
    invoke<CustomerPayment>("create_customer_payment", { input }),
  deleteCustomerPayment: (id: number) =>
    invoke<void>("delete_customer_payment", { id }),

   // المبيعات
   listSales: (search?: string) =>
     invoke<Sale[]>("list_sales", { search: search || null }),
   getSale: (id: number) => invoke<Sale>("get_sale", { id }),
   createSale: (input: NewSale) => invoke<Sale>("create_sale", { input }),
   updateSale: (id: number, input: NewSale) =>
     invoke<Sale>("update_sale", { id, input }),
   deleteSale: (id: number) => invoke<void>("delete_sale", { id }),

   // مردود المبيعات
   listSaleReturns: (search?: string) =>
     invoke<SaleReturn[]>("list_sale_returns", {
       search: search || null,
     }),
   getSaleReturn: (id: number) =>
     invoke<SaleReturn>("get_sale_return", { id }),
   createSaleReturn: (input: NewSaleReturn) =>
     invoke<SaleReturn>("create_sale_return", { input }),

   // المشتريات
   listPurchases: (search?: string) =>
     invoke<Purchase[]>("list_purchases", { search: search || null }),
   getPurchase: (id: number) => invoke<Purchase>("get_purchase", { id }),
   createPurchase: (input: NewPurchase) =>
     invoke<Purchase>("create_purchase", { input }),
   updatePurchase: (id: number, input: NewPurchase) =>
     invoke<Purchase>("update_purchase", { id, input }),
   deletePurchase: (id: number) => invoke<void>("delete_purchase", { id }),

   // مردود المشتريات
   listPurchaseReturns: (search?: string) =>
     invoke<PurchaseReturn[]>("list_purchase_returns", {
       search: search || null,
     }),
   getPurchaseReturn: (id: number) =>
     invoke<PurchaseReturn>("get_purchase_return", { id }),
   createPurchaseReturn: (input: NewPurchaseReturn) =>
     invoke<PurchaseReturn>("create_purchase_return", { input }),

    // المصروفات
   listExpenses: (search?: string) =>
     invoke<Expense[]>("list_expenses", { search: search || null }),
   createExpense: (input: NewExpense) =>
     invoke<Expense>("create_expense", { input }),
   deleteExpense: (id: number) => invoke<void>("delete_expense", { id }),

   // الموظفين
   listEmployees: () => invoke<Employee[]>("list_employees"),
   createEmployee: (input: NewEmployee) =>
     invoke<Employee>("create_employee", { input }),
   updateEmployee: (id: number, input: NewEmployee) =>
     invoke<Employee>("update_employee", { id, input }),
   deleteEmployee: (id: number) => invoke<void>("delete_employee", { id }),

   // الرواتب
   listSalaries: (employeeId?: number) =>
     invoke<Salary[]>("list_salaries", {
       employeeId: employeeId ?? null,
     }),
   createSalary: (input: NewSalary) =>
     invoke<Salary>("create_salary", { input }),
   deleteSalary: (id: number) => invoke<void>("delete_salary", { id }),

    // الإجازات
    listVacations: (employeeId?: number) =>
      invoke<Vacation[]>("list_vacations", {
        employeeId: employeeId ?? null,
      }),
    createVacation: (input: NewVacation) =>
      invoke<Vacation>("create_vacation", { input }),
    updateVacation: (id: number, input: NewVacation) =>
      invoke<Vacation>("update_vacation", { id, input }),
    deleteVacation: (id: number) => invoke<void>("delete_vacation", { id }),

    // الحضور والانصراف
    listAttendance: (search?: string) =>
      invoke<Attendance[]>("list_attendance", { search: search ?? null }),
    createAttendance: (input: NewAttendance) =>
      invoke<Attendance>("create_attendance", { input }),
    updateAttendance: (id: number, input: NewAttendance) =>
      invoke<Attendance>("update_attendance", { id, input }),
    deleteAttendance: (id: number) => invoke<void>("delete_attendance", { id }),
    cleanupDuplicateAttendance: () => invoke<number>("cleanup_duplicate_attendance"),

    // الفترات (Shifts)
    listShifts: () => invoke<Shift[]>("list_shifts"),
    createShift: (shift: NewShift) => invoke<number>("create_shift", { shift }),
    updateShift: (id: number, shift: NewShift) => invoke<void>("update_shift", { id, shift }),
    deleteShift: (id: number) => invoke<void>("delete_shift", { id }),
    listEmployeeShifts: () => invoke<EmployeeShift[]>("list_employee_shifts"),
    createEmployeeShift: (es: NewEmployeeShift) => invoke<number>("create_employee_shift", { es }),
    deleteEmployeeShift: (id: number) => invoke<void>("delete_employee_shift", { id }),
    getShiftReport: (from_date: string, to_date: string) => invoke<ShiftReport[]>("get_shift_report", { fromDate: from_date, toDate: to_date }),

    // الإعدادات
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) =>
    invoke<Settings>("save_settings", { settings }),
  verifySectionPassword: (password: string) =>
    invoke<boolean>("verify_section_password", { password }),
  changeSectionPassword: (currentPassword: string, newPassword: string) =>
    invoke<void>("change_section_password", { currentPassword, newPassword }),
  isFirstRun: () => invoke<boolean>("is_first_run"),
  initializeAdmin: (adminName: string, adminPassword: string) =>
    invoke<void>("initialize_admin", { adminName, adminPassword }),
  verifyAdminPassword: (password: string) =>
    invoke<boolean>("verify_admin_password", { password }),
  changeAdminPassword: (currentPassword: string, newPassword: string) =>
    invoke<void>("change_admin_password", { currentPassword, newPassword }),

  // النسخ الاحتياطي
  exportBackup: (path: string) => invoke<void>("export_backup", { path }),
  importBackup: (path: string) => invoke<void>("import_backup", { path }),
  forceExit: () => invoke<void>("force_exit"),

  // التقارير
  getDashboard: () => invoke<Dashboard>("get_dashboard"),
  getProfitLoss: (range: DateRange) =>
    invoke<ProfitLoss>("get_profit_loss", { range }),
  getStockValue: () => invoke<StockValue>("get_stock_value"),
  getDailySales: (range: DateRange) =>
    invoke<DailySalesRow[]>("get_daily_sales", { range }),
  getBestSellers: (range: DateRange) =>
    invoke<BestSeller[]>("get_best_sellers", { range }),

  // جرد المخزون
  listStockCounts: () => invoke<StockCount[]>("list_stock_counts"),
  getStockCount: (id: number) => invoke<StockCount>("get_stock_count", { id }),
  createStockCount: (input: NewStockCount) =>
    invoke<StockCount>("create_stock_count", { input }),
  updateStockCount: (id: number, input: NewStockCount) =>
    invoke<StockCount>("update_stock_count", { id, input }),
  deleteStockCount: (id: number) => invoke<void>("delete_stock_count", { id }),
  applyStockCount: (id: number) =>
    invoke<StockCount>("apply_stock_count", { id }),

  // المزامنة
  getSyncStatus: () => invoke<SyncStatus>("get_sync_status"),
  saveSyncConfig: (config: SyncConfig) =>
    invoke<void>("save_sync_config", { config }),
  testSupabaseConnection: (url: string, key: string) =>
    invoke<boolean>("test_supabase_connection", { url, key }),
  syncNow: () => invoke<SyncResult>("sync_now"),
  initialSync: () => invoke<SyncResult>("initial_sync"),
  pushChanges: () => invoke<SyncResult>("push_changes_cmd"),
  pullChanges: () => invoke<SyncResult>("pull_changes_cmd"),
  resolveConflict: (conflict: SyncConflict, resolution: string) =>
    invoke<void>("resolve_conflict_cmd", { conflict, resolution }),

  // الفروع
  listBranches: () => invoke<Branch[]>("list_branches"),
  createBranch: (name: string, address?: string, phone?: string) =>
    invoke<Branch>("create_branch", { name, address: address ?? null, phone: phone ?? null }),
  updateBranch: (id: number, name: string, address?: string, phone?: string, is_active?: boolean) =>
    invoke<void>("update_branch", { id, name, address: address ?? null, phone: phone ?? null, is_active: is_active ?? true }),
  deleteBranch: (id: number) => invoke<void>("delete_branch", { id }),

  // إعادة تهيئة النظام
  resetSystem: () => invoke<void>("reset_system"),

  // كتابة ملف
  writeTextFile: (path: string, content: string) =>
    invoke<void>("write_text_file", { path, content }),
  writeBinaryFile: (path: string, data: number[]) =>
    invoke<void>("write_binary_file", { path, data }),

  copySoundFile: (sourcePath: string) =>
    invoke<string>("copy_sound_file", { sourcePath }),

  // ==================== Maintenance ====================
  listServiceOrders: (search?: string) =>
    invoke<any[]>("list_service_orders", { search: search ?? null }),
  getServiceOrder: (id: number) =>
    invoke<any>("get_service_order", { id }),
  createServiceOrder: (input: any) =>
    invoke<any>("create_service_order", { input }),
  updateServiceOrder: (id: number, input: any) =>
    invoke<any>("update_service_order", { id, input }),
  changeServiceStatus: (id: number, newStatus: string, notes?: string) =>
    invoke<any>("change_service_status", { id, newStatus, notes: notes ?? null }),
  assignTechnician: (orderId: number, tech: any) =>
    invoke<void>("assign_technician", { orderId, tech }),
  removeTechnician: (id: number) =>
    invoke<void>("remove_technician", { id }),
  addServicePart: (orderId: number, part: any) =>
    invoke<void>("add_service_part", { orderId, part }),
  removeServicePart: (id: number) =>
    invoke<void>("remove_service_part", { id }),
  addServiceChecklist: (orderId: number, items: any[]) =>
    invoke<void>("add_service_checklist", { orderId, items }),
  addServicePayment: (orderId: number, payment: any) =>
    invoke<any>("add_service_payment", { orderId, payment }),
  addServiceImage: (orderId: number, imagePath: string, imageType: string, description?: string) =>
    invoke<void>("add_service_image", { orderId, imagePath, imageType, description: description ?? null }),
  deleteServiceImage: (id: number) =>
    invoke<void>("delete_service_image", { id }),
  addServiceNote: (orderId: number, note: string) =>
    invoke<void>("add_service_note", { orderId, note }),
  getMaintenanceDashboard: () =>
    invoke<any>("get_maintenance_dashboard"),
  listServiceOrderHistory: (orderId: number) =>
    invoke<any[]>("list_service_order_history", { orderId }),
  getServiceOrderAuditLog: (orderId: number) =>
    invoke<any[]>("get_service_order_audit_log", { orderId }),
  searchCustomersForMaintenance: (query: string) =>
    invoke<any[]>("search_customers_for_maintenance", { query }),
  getDeviceTypes: () =>
    invoke<any[]>("get_device_types"),
  createDeviceType: (name: string) =>
    invoke<any>("create_device_type", { name }),
  deleteDeviceType: (id: number) =>
    invoke<void>("delete_device_type", { id }),
  getDeviceBrands: () =>
    invoke<any[]>("get_device_brands"),
  createDeviceBrand: (name: string) =>
    invoke<any>("create_device_brand", { name }),
  deleteDeviceBrand: (id: number) =>
    invoke<void>("delete_device_brand", { id }),
  getMaintenanceSettings: () =>
    invoke<any>("get_maintenance_settings"),
  saveMaintenanceSettings: (settings: any) =>
    invoke<void>("save_maintenance_settings", { settings }),
  getChecklistTemplate: (deviceType: string) =>
    invoke<string[]>("get_checklist_template", { deviceType }),
  saveChecklistTemplate: (deviceType: string, items: string[]) =>
    invoke<void>("save_checklist_template", { deviceType, items }),
  getEmployeeMaintenanceStats: (fromDate: string, toDate: string) =>
    invoke<any[]>("get_employee_maintenance_stats", { fromDate, toDate }),

  // ==================== Accounting ====================
  listReceiptVouchers: (search?: string) =>
    invoke<any[]>("list_receipt_vouchers", { search: search ?? null }),
  createReceiptVoucher: (input: any) =>
    invoke<any>("create_receipt_voucher", { input }),
  deleteReceiptVoucher: (id: number) =>
    invoke<void>("delete_receipt_voucher", { id }),
  listPaymentVouchers: (search?: string) =>
    invoke<any[]>("list_payment_vouchers", { search: search ?? null }),
  createPaymentVoucher: (input: any) =>
    invoke<any>("create_payment_voucher", { input }),
  deletePaymentVoucher: (id: number) =>
    invoke<void>("delete_payment_voucher", { id }),
  listWarehouseTransfers: (search?: string) =>
    invoke<any[]>("list_warehouse_transfers", { search: search ?? null }),
  createWarehouseTransfer: (input: any) =>
    invoke<any>("create_warehouse_transfer", { input }),
  deleteWarehouseTransfer: (id: number) =>
    invoke<void>("delete_warehouse_transfer", { id }),

  // التفعيل
  getHwid: () => invoke<string>("get_hwid_cmd"),
  activateLicense: (licenseKey: string) =>
    invoke<{ hwid: string; customer_name: string; expiry_date: string; features: string }>("activate_license", { licenseKey }),
  checkLicense: () =>
    invoke<{ hwid: string; customer_name: string; expiry_date: string; features: string }>("check_license"),
  getLicenseInfo: () =>
    invoke<{ hwid: string; customer_name: string; expiry_date: string; features: string; created_at: string } | null>("get_license_info"),
  removeLicense: () => invoke<void>("remove_license"),
  getAppVersion: () => invoke<string>("get_app_version"),
  installUpdate: (filePath: string) => invoke<string>("install_update", { filePath }),

  // التحديث الأونلاين
  checkOnlineUpdate: () =>
    invoke<{ has_update: boolean; latest_version: string; current_version: string; download_url: string; file_name: string; body: string; published_at: string }>("check_online_update"),
  downloadOnlineUpdate: (url: string, fileName: string) =>
    invoke<string>("download_online_update", { url, fileName }),
  applyOnlineUpdate: (filePath: string) =>
    invoke<string>("apply_online_update", { filePath }),

  // الطابعات
  listPrinters: () =>
    invoke<string[]>("list_printers"),

  // البحث في الصيانة
  searchServiceOrders: (query: string) =>
    invoke<any[]>("search_service_orders", { query }),

  // المنتجات بالصفحات
  listProductsPaged: (search: string | null, page: number, pageSize: number) =>
    invoke<[Product[], number]>("list_products_paged", { search: search || null, page, pageSize }),

  // التصدير CSV
  exportProductsCsv: () => invoke<string>("export_products_csv"),
  exportSalesCsv: (from?: string, to?: string) =>
    invoke<string>("export_sales_csv", { from: from || null, to: to || null }),
  exportPurchasesCsv: (from?: string, to?: string) =>
    invoke<string>("export_purchases_csv", { from: from || null, to: to || null }),

  // النسخ الاحتياطي التلقائي
  startAutoBackup: () => invoke<void>("start_auto_backup"),
};
