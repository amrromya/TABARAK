mod commands;
mod db;
mod models;
mod maintenance_commands;
mod maintenance_models;
mod license;
pub mod sync;
mod sync_commands;
pub mod utils;
pub mod migrations;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub db_path: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("فشل الحصول على مسار البيانات: {e}"))?;
            let db_path = dir.join("tabarak.db");
            let conn = db::init_db(app)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                db_path,
            });

            // تثبيت الخطوط تلقائياً عند التشغيل الأول
            #[cfg(target_os = "windows")]
            install_fonts_if_needed(app);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_categories,
            commands::create_category,
            commands::delete_category,
            commands::list_warehouses,
            commands::create_warehouse,
            commands::update_warehouse,
            commands::set_default_warehouse,
            commands::delete_warehouse,
            commands::warehouse_stats,
            commands::list_products,
            commands::next_barcode,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::adjust_stock,
            commands::get_product_movements,
            commands::set_opening_balances,
            commands::get_opening_balance_summary,
            commands::get_warehouse_cash_balances,
            commands::list_suppliers,
            commands::create_supplier,
            commands::update_supplier,
            commands::delete_supplier,
            commands::get_supplier_account,
            commands::get_supplier_transactions,
            commands::list_customers,
            commands::create_customer,
            commands::update_customer,
            commands::delete_customer,
            commands::list_customer_payments,
            commands::create_customer_payment,
            commands::delete_customer_payment,
            commands::list_sales,
            commands::get_sale,
            commands::create_sale,
            commands::update_sale,
            commands::delete_sale,
            commands::list_purchases,
            commands::get_purchase,
            commands::create_purchase,
            commands::update_purchase,
            commands::delete_purchase,
            commands::list_purchase_returns,
            commands::get_purchase_return,
            commands::create_purchase_return,
            commands::list_sale_returns,
            commands::get_sale_return,
            commands::create_sale_return,
            commands::list_expenses,
            commands::create_expense,
            commands::delete_expense,
            commands::list_employees,
            commands::create_employee,
            commands::update_employee,
            commands::delete_employee,
            commands::list_salaries,
            commands::create_salary,
            commands::delete_salary,
            commands::list_vacations,
            commands::create_vacation,
            commands::update_vacation,
            commands::delete_vacation,
            commands::list_attendance,
            commands::create_attendance,
            commands::update_attendance,
            commands::delete_attendance,
            commands::copy_sound_file,
            commands::cleanup_duplicate_attendance,
            commands::list_shifts,
            commands::create_shift,
            commands::update_shift,
            commands::delete_shift,
            commands::list_employee_shifts,
            commands::create_employee_shift,
            commands::delete_employee_shift,
            commands::get_shift_report,
            commands::get_settings,
            commands::save_settings,
            commands::verify_section_password,
            commands::change_section_password,
            commands::export_backup,
            commands::import_backup,
            commands::force_exit,
            commands::close_window,
            commands::get_product_components,
            commands::save_product_components,
            commands::list_products_by_category,
            commands::get_dashboard,
            commands::get_profit_loss,
            commands::get_stock_value,
            commands::get_daily_sales,
            commands::get_best_sellers,
            commands::list_stock_counts,
            commands::get_stock_count,
            commands::create_stock_count,
            commands::update_stock_count,
            commands::delete_stock_count,
            commands::apply_stock_count,
            commands::reset_system,
            commands::write_text_file,
            commands::write_binary_file,
            sync_commands::get_sync_status,
            sync_commands::save_sync_config,
            sync_commands::test_supabase_connection,
            sync_commands::sync_now,
            sync_commands::push_changes_cmd,
            sync_commands::pull_changes_cmd,
            sync_commands::resolve_conflict_cmd,
            sync_commands::initial_sync,
            sync_commands::list_branches,
            sync_commands::create_branch,
            sync_commands::update_branch,
            sync_commands::delete_branch,
            maintenance_commands::list_service_orders,
            maintenance_commands::get_service_order,
            maintenance_commands::create_service_order,
            maintenance_commands::update_service_order,
            maintenance_commands::change_service_status,
            maintenance_commands::assign_technician,
            maintenance_commands::remove_technician,
            maintenance_commands::add_service_part,
            maintenance_commands::remove_service_part,
            maintenance_commands::add_service_checklist,
            maintenance_commands::add_service_payment,
            maintenance_commands::add_service_image,
            maintenance_commands::delete_service_image,
            maintenance_commands::add_service_note,
            maintenance_commands::get_maintenance_dashboard,
            maintenance_commands::list_service_order_history,
            maintenance_commands::get_service_order_audit_log,
            maintenance_commands::search_customers_for_maintenance,
            maintenance_commands::get_device_types,
            maintenance_commands::create_device_type,
            maintenance_commands::delete_device_type,
            maintenance_commands::get_device_brands,
            maintenance_commands::create_device_brand,
            maintenance_commands::delete_device_brand,
            maintenance_commands::get_maintenance_settings,
            maintenance_commands::save_maintenance_settings,
            maintenance_commands::get_checklist_template,
            maintenance_commands::save_checklist_template,
            maintenance_commands::get_employee_maintenance_stats,
            commands::list_receipt_vouchers,
            commands::create_receipt_voucher,
            commands::delete_receipt_voucher,
            commands::list_payment_vouchers,
            commands::create_payment_voucher,
            commands::delete_payment_voucher,
            commands::list_warehouse_transfers,
            commands::create_warehouse_transfer,
            commands::delete_warehouse_transfer,
            license::get_hwid_cmd,
            license::activate_license,
            license::check_license,
            license::get_license_info,
            license::remove_license,
            commands::get_app_version,
            commands::install_update,
            commands::check_online_update,
            commands::download_online_update,
            commands::apply_online_update,
            commands::list_printers,
            commands::is_first_run,
            commands::initialize_admin,
            commands::verify_admin_password,
            commands::change_admin_password,
            commands::list_products_paged,
            commands::export_products_csv,
            commands::export_sales_csv,
            commands::export_purchases_csv,
            commands::start_auto_backup,
            commands::search_service_orders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "windows")]
fn install_fonts_if_needed(app: &tauri::App) {
    use std::fs;
    use winreg::enums::*;
    use winreg::RegKey;

    let fonts_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("TabarakFonts");

    let marker = fonts_dir.join(".installed");
    if marker.exists() {
        return;
    }

    fs::create_dir_all(&fonts_dir).ok();

    let font_names = ["Cairo-Variable.ttf", "NotoColorEmoji.ttf"];

    for font_name in &font_names {
        let resource_path = app
            .path()
            .resource_dir()
            .ok()
            .and_then(|p| Some(p.join("fonts").join(font_name)));

        if let Some(src) = resource_path {
            if src.exists() {
                let dest = fonts_dir.join(font_name);
                fs::copy(&src, &dest).ok();
            }
        }
    }

    let hklm = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((font_key, _)) = hklm.create_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts") {
        for font_name in &font_names {
            let display_name = match *font_name {
                "Cairo-Variable.ttf" => "Cairo (TrueType)",
                "NotoColorEmoji.ttf" => "Noto Color Emoji (TrueType)",
                _ => font_name,
            };
            let full_path = fonts_dir.join(font_name);
            let _ = font_key.set_value(display_name, &full_path.to_string_lossy().to_string());
        }
    }

    fs::write(&marker, "1").ok();
}
