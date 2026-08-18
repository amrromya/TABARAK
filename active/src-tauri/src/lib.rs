use std::sync::Mutex;
use tauri::Manager;

mod license;

pub struct AppState {
    pub licenses: Mutex<Vec<license::LicenseRecord>>,
    pub licenses_path: String,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            std::fs::create_dir_all(&app_dir).ok();

            let licenses_path = app_dir
                .join("licenses.json")
                .to_string_lossy()
                .to_string();

            let licenses = license::load_licenses_from_file(&licenses_path);

            app.manage(AppState {
                licenses: Mutex::new(licenses),
                licenses_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            license::generate_license,
            license::list_licenses,
            license::delete_license,
            license::verify_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
