use serde::{Deserialize, Serialize};

// ==================== Service Order ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOrder {
    pub id: i64,
    pub order_no: String,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub device_type: String,
    pub device_brand: Option<String>,
    pub device_model: Option<String>,
    pub serial_number: Option<String>,
    pub imei: Option<String>,
    pub device_color: Option<String>,
    pub device_condition: Option<String>,
    pub accessories: Option<String>,
    pub device_password: Option<String>,
    pub customer_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub repair_action: Option<String>,
    pub technician_notes: Option<String>,
    pub status: String,
    pub parts_cost: f64,
    pub labor_cost: f64,
    pub service_cost: f64,
    pub discount: f64,
    pub tax_rate: f64,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub remaining: f64,
    pub customer_approval: String,
    pub approval_date: Option<String>,
    pub approval_price: Option<f64>,
    pub approval_notes: Option<String>,
    pub warranty_days: i64,
    pub warranty_start: Option<String>,
    pub warranty_end: Option<String>,
    pub original_order_id: Option<i64>,
    pub delivered_to: Option<String>,
    pub delivered_phone: Option<String>,
    pub delivered_date: Option<String>,
    pub delivered_time: Option<String>,
    pub payment_method: Option<String>,
    pub received_by: Option<i64>,
    pub delivered_by: Option<i64>,
    pub received_by_name: Option<String>,
    pub delivered_by_name: Option<String>,
    pub images: Vec<ServiceImage>,
    pub technicians: Vec<ServiceTechnician>,
    pub checklist: Vec<ServiceChecklist>,
    pub parts: Vec<ServicePart>,
    pub payments: Vec<ServicePayment>,
    pub notes: Vec<ServiceNote>,
    pub history: Vec<StatusHistory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOrderSummary {
    pub id: i64,
    pub order_no: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub device_type: String,
    pub device_brand: Option<String>,
    pub device_model: Option<String>,
    pub status: String,
    pub total_cost: f64,
    pub amount_paid: f64,
    pub remaining: f64,
    pub warranty_end: Option<String>,
    pub original_order_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewServiceOrder {
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub customer_alt_phone: Option<String>,
    pub customer_address: Option<String>,
    pub customer_notes: Option<String>,
    pub device_type: String,
    pub device_brand: Option<String>,
    pub device_model: Option<String>,
    pub serial_number: Option<String>,
    pub imei: Option<String>,
    pub device_color: Option<String>,
    pub device_condition: Option<String>,
    pub accessories: Option<String>,
    pub device_password: Option<String>,
    pub customer_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub repair_action: Option<String>,
    pub technician_notes: Option<String>,
    pub parts_cost: Option<f64>,
    pub labor_cost: Option<f64>,
    pub service_cost: Option<f64>,
    pub discount: Option<f64>,
    pub tax_rate: Option<f64>,
    pub warranty_days: Option<i64>,
    pub original_order_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateServiceOrder {
    pub device_type: Option<String>,
    pub device_brand: Option<String>,
    pub device_model: Option<String>,
    pub serial_number: Option<String>,
    pub imei: Option<String>,
    pub device_color: Option<String>,
    pub device_condition: Option<String>,
    pub accessories: Option<String>,
    pub device_password: Option<String>,
    pub customer_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub repair_action: Option<String>,
    pub technician_notes: Option<String>,
    pub parts_cost: Option<f64>,
    pub labor_cost: Option<f64>,
    pub service_cost: Option<f64>,
    pub discount: Option<f64>,
    pub tax_rate: Option<f64>,
    pub warranty_days: Option<i64>,
}

// ==================== Status History ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusHistory {
    pub id: i64,
    pub order_id: i64,
    pub old_status: Option<String>,
    pub new_status: String,
    pub changed_by: Option<i64>,
    pub changed_by_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

// ==================== Images ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceImage {
    pub id: i64,
    pub order_id: i64,
    pub image_path: String,
    pub image_type: String,
    pub description: Option<String>,
}

// ==================== Technicians ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTechnician {
    pub id: i64,
    pub order_id: i64,
    pub technician_id: i64,
    pub technician_name: String,
    pub work_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignTechnician {
    pub technician_id: i64,
    pub work_type: Option<String>,
    pub notes: Option<String>,
}

// ==================== Checklist ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceChecklist {
    pub id: i64,
    pub order_id: i64,
    pub item_name: String,
    pub status: String,
    pub notes: Option<String>,
}

// ==================== Parts ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePart {
    pub id: i64,
    pub order_id: i64,
    pub product_id: Option<i64>,
    pub part_name: String,
    pub quantity: f64,
    pub cost_price: f64,
    pub sell_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddServicePart {
    pub product_id: Option<i64>,
    pub part_name: String,
    pub quantity: f64,
    pub cost_price: f64,
    pub sell_price: f64,
}

// ==================== Payments ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePayment {
    pub id: i64,
    pub order_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub date: String,
    pub notes: Option<String>,
    pub received_by: Option<i64>,
    pub received_by_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddServicePayment {
    pub amount: f64,
    pub payment_method: String,
    pub notes: Option<String>,
}

// ==================== Notes ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceNote {
    pub id: i64,
    pub order_id: i64,
    pub note: String,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: String,
}

// ==================== Device Types & Brands ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceType {
    pub id: i64,
    pub name: String,
    pub checklist_template: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceBrand {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
}

// ==================== Audit Log ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: i64,
    pub order_id: i64,
    pub action: String,
    pub user_name: Option<String>,
    pub details: Option<String>,
    pub created_at: String,
}

// ==================== Dashboard ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceDashboard {
    pub total_in维修: i64,
    pub received_today: i64,
    pub delivered_today: i64,
    pub under_inspection: i64,
    pub in_repair: i64,
    pub awaiting_approval: i64,
    pub awaiting_parts: i64,
    pub ready_for_delivery: i64,
    pub overdue: i64,
    pub under_warranty: i64,
    pub revenue_today: f64,
    pub revenue_month: f64,
    pub total_parts_cost: f64,
    pub total_labor: f64,
    pub net_profit: f64,
    pub recent_orders: Vec<ServiceOrderSummary>,
}

// ==================== Reports ====================
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceSettings {
    pub next_order_number: String,
    pub late_days: String,
    pub sticker_width: String,
    pub sticker_height: String,
    pub receipt_footer: String,
    pub agreement_text: String,
}
