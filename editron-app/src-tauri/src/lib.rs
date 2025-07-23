// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod auth;
mod config;
mod http_client;

use tauri::RunEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();
    log::info!("Starting Editron application");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            auth::start_login_flow,
            auth::check_login,
            auth::get_profile,
            auth::logout,
            auth::get_access_token
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            
            log::info!("Setting up application");
            
            // Initialize stores
            if let Err(e) = auth::initialize_stores(&handle) {
                log::error!("Failed to initialize stores: {}", e);
            }
            
            // Load existing servers and tokens
            if let Err(e) = auth::load_servers(&handle) {
                log::error!("Failed to load servers: {}", e);
            }
            
            if let Err(e) = auth::load_servers_token(&handle) {
                log::error!("Failed to load server tokens: {}", e);
            }

            // OAuth callback is now handled via localhost HTTP server in auth.rs

            log::info!("Application setup completed");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            match event {
                RunEvent::Ready => {
                    log::info!("Application is ready");
                }
                RunEvent::ExitRequested { .. } => {
                    log::info!("Application exit requested");
                }
                _ => {}
            }
        });
}
