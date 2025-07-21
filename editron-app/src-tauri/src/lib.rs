// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod auth;
mod http_client;

use tauri::{Listener, Manager, RunEvent};
use url::Url;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();
    log::info!("Starting Editron application");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            auth::start_login_flow,
            auth::check_login,
            auth::get_profile,
            auth::logout
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            
            log::info!("Setting up application");
            
            // Load existing servers and tokens
            if let Err(e) = auth::load_servers(&handle) {
                log::error!("Failed to load servers: {}", e);
            }
            
            if let Err(e) = auth::load_servers_token(&handle) {
                log::error!("Failed to load server tokens: {}", e);
            }

            // Set up deep link listener for OAuth callback
            let listener_handle = handle.clone();
            handle.listen("tauri://deep-link", move |event| {
                log::info!("Deep link event received: {}", event.payload());
                
                if let Ok(url_str) = serde_json::from_str::<String>(event.payload()) {
                    log::info!("Processing deep link URL: {}", url_str);
                    
                    if let Ok(url) = Url::parse(&url_str) {
                        // Check if this is our OAuth callback
                        if url.scheme() == "editron-app" 
                            && url.host_str() == Some("auth") 
                            && url.path() == "/callback" 
                        {
                            // Check for success status in query parameters
                            let query_pairs: std::collections::HashMap<String, String> = url
                                .query_pairs()
                                .into_owned()
                                .collect();
                            
                            if query_pairs.get("status") == Some(&"success".to_string()) {
                                log::info!("OAuth callback received with success status");
                                let handle_clone = listener_handle.clone();
                                
                                // Extract code from query parameters if available
                                let code = query_pairs.get("code").cloned().unwrap_or_default();
                                
                                // Spawn async task to finalize the login
                                tauri::async_runtime::spawn(async move {
                                    if let Err(e) = auth::handle_sso_finalization(handle_clone, code).await {
                                        log::error!("Error during login finalization: {}", e);
                                    }
                                });
                            } else {
                                log::warn!("OAuth callback received without success status");
                            }
                        }
                    } else {
                        log::warn!("Failed to parse deep link URL: {}", url_str);
                    }
                }
            });

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
