use crate::http_client;
use crate::config::AppConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::sync::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;
use tauri_plugin_opener::OpenerExt;
use warp::Filter;
use tokio::sync::oneshot;
use url;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Server {
    pub id: String,
    pub profile: Option<UserProfile>,
    pub available: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerAccessToken {
    pub server_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserProfile {
    pub id: i32,
    pub email: String,
    pub name: String,
    #[serde(rename = "profilePicture")]
    pub profile_picture: Option<String>,
    #[serde(rename = "authProvider")]
    pub auth_provider: String,
}

#[derive(Serialize, Deserialize)]
struct AuthUrlResponse {
    url: String,
}

#[derive(Serialize, Deserialize)]
struct TokenExchangeRequest {
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
    provider: String,
    #[serde(rename = "tauriRedirectUri")]
    tauri_redirect_uri: String,
}

#[derive(Serialize, Deserialize)]
struct TokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
}

impl ServerAccessToken {
    pub fn new(server_id: String, access_token: String, refresh_token: String, expires_at: u64) -> Self {
        Self {
            server_id,
            access_token,
            refresh_token,
            expires_at,
        }
    }
}

lazy_static::lazy_static! {
    static ref SERVERS: Mutex<Vec<Server>> = Mutex::new(vec![]);
    static ref ACCESS_TOKENS: Mutex<HashMap<String, ServerAccessToken>> = Mutex::new(HashMap::new());
    static ref OAUTH_STATE: Mutex<Option<String>> = Mutex::new(None);
    static ref CONFIG: AppConfig = AppConfig::load();
}

/// Gets a server by ID from the global state
pub fn get_server_by_id(id: &str) -> Option<Server> {
    SERVERS.lock().unwrap().iter().find(|s| s.id == id).cloned()
}

/// Saves or updates a server in the global state
pub fn save_server(server: &Server) {
    let mut servers = SERVERS.lock().unwrap();
    if let Some(idx) = servers.iter().position(|s| s.id == server.id) {
        servers[idx] = server.clone();
    } else {
        servers.push(server.clone());
    }
}

/// Saves an access token for a server
pub fn save_access_token(server_id: String, token: ServerAccessToken) {
    ACCESS_TOKENS.lock().unwrap().insert(server_id, token);
}

/// Removes an access token for a server (used during logout)
pub fn remove_access_token(server_id: &str) {
    ACCESS_TOKENS.lock().unwrap().remove(server_id);
}

/// Initialize the stores during app setup
pub fn initialize_stores(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    use tauri_plugin_store::StoreBuilder;
    
    // Create servers store
    let _servers_store = StoreBuilder::new(app, "servers.json")
        .build()?;
    
    // Create tokens store  
    let _tokens_store = StoreBuilder::new(app, "tokens.json")
        .build()?;
    
    log::info!("Stores initialized successfully");
    Ok(())
}

/// Checks if a server has a valid access token
pub fn has_access_token(server_id: &str) -> bool {
    ACCESS_TOKENS.lock().unwrap().contains_key(server_id)
}

/// Persists servers to storage
pub async fn persist_servers(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("servers.json")
        .ok_or_else(|| "Could not get servers store - store not initialized")?;
    let servers = SERVERS.lock().unwrap().clone();
    store.set("servers".to_string(), serde_json::to_value(servers)?);
    store.save()?;
    log::info!("Servers persisted to storage");
    Ok(())
}

/// Persists access tokens to storage
pub async fn persist_servers_token(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("tokens.json")
        .ok_or_else(|| "Could not get tokens store - store not initialized")?;
    let tokens = ACCESS_TOKENS.lock().unwrap().clone();
    store.set("tokens".to_string(), serde_json::to_value(tokens)?);
    store.save()?;
    log::info!("Access tokens persisted to storage");
    Ok(())
}

/// Loads servers from storage
pub fn load_servers(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("servers.json")
        .ok_or_else(|| "Could not get servers store - store not initialized")?;
    if let Some(v) = store.get("servers") {
        let loaded: Vec<Server> = serde_json::from_value(v.clone())?;
        *SERVERS.lock().unwrap() = loaded;
        log::info!("Servers loaded from storage");
    } else {
        log::info!("No servers found in storage - starting fresh");
    }
    Ok(())
}

/// Loads access tokens from storage
pub fn load_servers_token(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("tokens.json")
        .ok_or_else(|| "Could not get tokens store - store not initialized")?;
    if let Some(v) = store.get("tokens") {
        let loaded: HashMap<String, ServerAccessToken> = serde_json::from_value(v.clone())?;
        *ACCESS_TOKENS.lock().unwrap() = loaded;
        log::info!("Access tokens loaded from storage");
    } else {
        log::info!("No tokens found in storage - starting fresh");
    }
    Ok(())
}

/// Generate a random state parameter for OAuth security
fn generate_state() -> String {
    use base64::{engine::general_purpose, Engine as _};
    
    general_purpose::URL_SAFE_NO_PAD.encode(
        (0..32).map(|_| rand::random::<u8>()).collect::<Vec<u8>>()
    )
}

/// Find an available port starting from the given port
fn find_available_port(start_port: u16) -> Option<u16> {
    use std::net::TcpListener;
    
    for port in start_port..start_port + 100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

/// Gets user profile from the backend using JWT token
/// Desktop apps use JWT tokens in Authorization headers, NOT cookies
async fn get_user_profile(server_id: &str) -> Result<UserProfile, String> {
    log::info!("Fetching user profile from backend using JWT token");
    
    let token = {
        let tokens = ACCESS_TOKENS.lock().unwrap();
        tokens.get(server_id)
            .map(|t| t.access_token.clone())
            .ok_or_else(|| "No JWT access token found".to_string())?
    };

    let client = http_client::get_client();
    // Desktop apps use JWT tokens via Authorization header (NOT cookies)
    let res = client
        .get(&CONFIG.user_profile_url()) // JWT-protected endpoint
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| {
            log::error!("Error fetching profile with JWT token: {}", e);
            e.to_string()
        })?;

    if res.status().is_success() {
        // Debug: log the raw response
        let response_text = res.text().await.map_err(|e| {
            log::error!("Error reading response text: {}", e);
            e.to_string()
        })?;
        
        log::debug!("Profile response from backend: {}", response_text);
        
        let profile: UserProfile = serde_json::from_str(&response_text).map_err(|e| {
            log::error!("Error parsing profile JSON: {}", e);
            log::error!("Raw response was: {}", response_text);
            e.to_string()
        })?;
        
        log::info!("Successfully fetched user profile: {:?}", profile);
        Ok(profile)
    } else if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        log::warn!("Profile request returned 401 Unauthorized - token expired");
        Err("Unauthorized: Token expired or invalid".to_string())
    } else {
        let status = res.status();
        log::error!("Profile request failed with status: {}", status);
        Err(format!("Request failed with status: {}", status))
    }
}

/// Start a temporary HTTP server to catch OAuth callback
async fn start_oauth_callback_server(app_handle: AppHandle, port: u16) -> Result<String, String> {
    log::info!("Starting OAuth callback server on port {}", port);
    
    let (tx, rx) = oneshot::channel::<String>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let shutdown_tx = Arc::new(Mutex::new(None::<oneshot::Sender<()>>));

    // Clone shutdown_tx before moving into closure
    let shutdown_tx_clone = shutdown_tx.clone();
    
    // Create a warp filter to handle the OAuth callback
    let callback_route = warp::path!("auth" / "callback")
        .and(warp::query::<HashMap<String, String>>())
        .and(warp::any().map(move || tx.clone()))
        .and(warp::any().map(move || app_handle.clone()))
        .and(warp::any().map(move || shutdown_tx_clone.clone()))
        .and_then(|query_params: HashMap<String, String>, tx: Arc<Mutex<Option<oneshot::Sender<String>>>>, _app: AppHandle, shutdown_tx: Arc<Mutex<Option<oneshot::Sender<()>>>>| async move {
            log::info!("OAuth callback received");
            
            if let Some(code) = query_params.get("code") {
                log::info!("Authorization code received: {}", &code[..10.min(code.len())]);
                
                // Send the code through the channel
                if let Some(sender) = tx.lock().unwrap().take() {
                    let _ = sender.send(code.clone());
                }
                
                // Schedule server shutdown after response
                if let Some(shutdown_sender) = shutdown_tx.lock().unwrap().take() {
                    tokio::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        let _ = shutdown_sender.send(());
                    });
                }
                
                // Return a success page
                Ok::<warp::reply::Html<&str>, warp::Rejection>(warp::reply::html(
                    r#"
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Authentication Successful - Editron</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                padding: 20px;
                            }
                            
                            .container {
                                background: white;
                                padding: 48px;
                                border-radius: 16px;
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                                text-align: center;
                                max-width: 500px;
                                width: 100%;
                            }
                            
                            .success-icon {
                                width: 80px;
                                height: 80px;
                                margin: 0 auto 24px;
                                background: #10b981;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                animation: pulse 2s infinite;
                            }
                            
                            @keyframes pulse {
                                0% { transform: scale(1); }
                                50% { transform: scale(1.05); }
                                100% { transform: scale(1); }
                            }
                            
                            .success-icon svg {
                                width: 40px;
                                height: 40px;
                                fill: white;
                            }
                            
                            h1 {
                                font-size: 2rem;
                                font-weight: 700;
                                color: #1f2937;
                                margin-bottom: 16px;
                            }
                            
                            p {
                                color: #6b7280;
                                font-size: 1.1rem;
                                margin-bottom: 32px;
                                line-height: 1.6;
                            }
                            
                            .auto-close-info {
                                margin-top: 32px;
                                padding: 20px;
                                background: #f8fafc;
                                border-radius: 12px;
                                border: 1px solid #e2e8f0;
                            }
                            
                            .countdown {
                                font-size: 18px;
                                font-weight: 600;
                                color: #475569;
                                text-align: center;
                            }
                            
                            #countdown {
                                color: #4f46e5;
                                font-size: 24px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="success-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            
                            <h1>Authentication Successful!</h1>
                            <p>You have successfully signed in to Editron. This window will close automatically.</p>
                            
                            <div class="auto-close-info">
                                <div class="countdown" id="countdown-container">
                                    Closing in <span id="countdown">3</span> seconds...
                                </div>
                                <button id="manual-close" onclick="tryCloseWindow()" style="display: none; margin-top: 16px; padding: 8px 16px; border: none; background: #4f46e5; color: white; border-radius: 6px; cursor: pointer;">
                                    Close This Tab
                                </button>
                            </div>
                        </div>
                        
                        <script>
                            let countdown = 3;
                            const countdownElement = document.getElementById('countdown');
                            
                            function tryCloseWindow() {
                                try {
                                    // Try to close the window
                                    window.close();
                                    
                                    // If we're still here after 500ms, the close didn't work
                                    setTimeout(() => {
                                        // Show manual close button and update message
                                        document.getElementById('countdown-container').style.display = 'none';
                                        document.getElementById('manual-close').style.display = 'block';
                                        document.querySelector('p').innerHTML = 'Authentication successful! Please close this tab manually or click the button below.';
                                    }, 1000);
                                } catch (e) {
                                    // Show manual close button immediately
                                    document.getElementById('countdown-container').style.display = 'none';
                                    document.getElementById('manual-close').style.display = 'block';
                                    document.querySelector('p').innerHTML = 'Authentication successful! Please close this tab manually.';
                                }
                            }
                            
                            function updateCountdown() {
                                countdownElement.textContent = countdown;
                                if (countdown <= 0) {
                                    tryCloseWindow();
                                    return;
                                }
                                countdown--;
                                setTimeout(updateCountdown, 1000);
                            }
                            
                            // Start countdown immediately
                            setTimeout(updateCountdown, 1000);
                            
                            // Also try to close when the page loses focus (user switches back to app)
                            window.addEventListener('blur', () => {
                                setTimeout(tryCloseWindow, 1000);
                            });
                        </script>
                    </body>
                    </html>
                    "#
                ))
            } else if let Some(error) = query_params.get("error") {
                log::error!("OAuth error received: {}", error);
                
                // Send error through the channel
                if let Some(sender) = tx.lock().unwrap().take() {
                    let _ = sender.send(format!("error:{}", error));
                }
                
                // Schedule server shutdown after response
                if let Some(shutdown_sender) = shutdown_tx.lock().unwrap().take() {
                    tokio::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        let _ = shutdown_sender.send(());
                    });
                }
                
                Ok::<warp::reply::Html<&str>, warp::Rejection>(warp::reply::html(
                    r#"
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Authentication Failed - Editron</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                padding: 20px;
                            }
                            
                            .container {
                                background: white;
                                padding: 48px;
                                border-radius: 16px;
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                                text-align: center;
                                max-width: 500px;
                                width: 100%;
                            }
                            
                            .error-icon {
                                width: 80px;
                                height: 80px;
                                margin: 0 auto 24px;
                                background: #ef4444;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            
                            .error-icon svg {
                                width: 40px;
                                height: 40px;
                                fill: white;
                            }
                            
                            h1 {
                                font-size: 2rem;
                                font-weight: 700;
                                color: #1f2937;
                                margin-bottom: 16px;
                            }
                            
                            p {
                                color: #6b7280;
                                font-size: 1.1rem;
                                margin-bottom: 32px;
                                line-height: 1.6;
                            }
                            
                            .auto-close-info {
                                margin-top: 32px;
                                padding: 20px;
                                background: #fef2f2;
                                border-radius: 12px;
                                border: 1px solid #fecaca;
                            }
                            
                            .countdown {
                                font-size: 18px;
                                font-weight: 600;
                                color: #991b1b;
                                text-align: center;
                            }
                            
                            #countdown {
                                color: #dc2626;
                                font-size: 24px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="error-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            
                            <h1>Authentication Failed</h1>
                            <p>There was an error during the authentication process. Please return to the desktop application and try again.</p>
                            
                            <div class="auto-close-info">
                                <div class="countdown" id="countdown-container">
                                    Closing in <span id="countdown">5</span> seconds...
                                </div>
                                <button id="manual-close" onclick="tryCloseWindow()" style="display: none; margin-top: 16px; padding: 8px 16px; border: none; background: #dc2626; color: white; border-radius: 6px; cursor: pointer;">
                                    Close This Tab
                                </button>
                            </div>
                        </div>
                        
                        <script>
                            let countdown = 5;
                            const countdownElement = document.getElementById('countdown');
                            
                            function tryCloseWindow() {
                                try {
                                    window.close();
                                    setTimeout(() => {
                                        document.getElementById('countdown-container').style.display = 'none';
                                        document.getElementById('manual-close').style.display = 'block';
                                        document.querySelector('p').innerHTML = 'Authentication failed. Please close this tab manually or click the button below.';
                                    }, 1000);
                                } catch (e) {
                                    document.getElementById('countdown-container').style.display = 'none';
                                    document.getElementById('manual-close').style.display = 'block';
                                    document.querySelector('p').innerHTML = 'Authentication failed. Please close this tab manually.';
                                }
                            }
                            
                            function updateCountdown() {
                                countdownElement.textContent = countdown;
                                if (countdown <= 0) {
                                    tryCloseWindow();
                                    return;
                                }
                                countdown--;
                                setTimeout(updateCountdown, 1000);
                            }
                            
                            // Start countdown immediately
                            setTimeout(updateCountdown, 1000);
                            
                            window.addEventListener('blur', () => {
                                setTimeout(tryCloseWindow, 1000);
                            });
                        </script>
                        </div>
                    </body>
                    </html>
                    "#
                ))
            } else {
                log::warn!("OAuth callback received without code or error");
                Ok::<warp::reply::Html<&str>, warp::Rejection>(warp::reply::html(
                    r#"
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Invalid Callback - Editron</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                padding: 20px;
                            }
                            
                            .container {
                                background: white;
                                padding: 48px;
                                border-radius: 16px;
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                                text-align: center;
                                max-width: 500px;
                                width: 100%;
                            }
                            
                            .warning-icon {
                                width: 80px;
                                height: 80px;
                                margin: 0 auto 24px;
                                background: #f59e0b;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            
                            .warning-icon svg {
                                width: 40px;
                                height: 40px;
                                fill: white;
                            }
                            
                            h1 {
                                font-size: 2rem;
                                font-weight: 700;
                                color: #1f2937;
                                margin-bottom: 16px;
                            }
                            
                            p {
                                color: #6b7280;
                                font-size: 1.1rem;
                                margin-bottom: 32px;
                                line-height: 1.6;
                            }
                            
                            .auto-close-info {
                                margin-top: 32px;
                                padding: 20px;
                                background: #fffbeb;
                                border-radius: 12px;
                                border: 1px solid #fed7aa;
                            }
                            
                            .countdown {
                                font-size: 18px;
                                font-weight: 600;
                                color: #92400e;
                                text-align: center;
                            }
                            
                            #countdown {
                                color: #d97706;
                                font-size: 24px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="warning-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                </svg>
                            </div>
                            
                            <h1>Invalid Callback</h1>
                            <p>No authorization code was received. Please return to the desktop application and try the authentication process again.</p>
                            
                            <div class="auto-close-info">
                                <div class="countdown" id="countdown-container">
                                    Closing in <span id="countdown">5</span> seconds...
                                </div>
                                <button id="manual-close" onclick="tryCloseWindow()" style="display: none; margin-top: 16px; padding: 8px 16px; border: none; background: #d97706; color: white; border-radius: 6px; cursor: pointer;">
                                    Close This Tab
                                </button>
                            </div>
                        </div>
                        
                        <script>
                            let countdown = 5;
                            const countdownElement = document.getElementById('countdown');
                            
                            function tryCloseWindow() {
                                try {
                                    window.close();
                                    setTimeout(() => {
                                        document.getElementById('countdown-container').style.display = 'none';
                                        document.getElementById('manual-close').style.display = 'block';
                                        document.querySelector('p').innerHTML = 'Invalid callback received. Please close this tab manually or click the button below.';
                                    }, 1000);
                                } catch (e) {
                                    document.getElementById('countdown-container').style.display = 'none';
                                    document.getElementById('manual-close').style.display = 'block';
                                    document.querySelector('p').innerHTML = 'Invalid callback received. Please close this tab manually.';
                                }
                            }
                            
                            function updateCountdown() {
                                countdownElement.textContent = countdown;
                                if (countdown <= 0) {
                                    tryCloseWindow();
                                    return;
                                }
                                countdown--;
                                setTimeout(updateCountdown, 1000);
                            }
                            
                            // Start countdown immediately
                            setTimeout(updateCountdown, 1000);
                            
                            window.addEventListener('blur', () => {
                                setTimeout(tryCloseWindow, 1000);
                            });
                        </script>
                        </div>
                    </body>
                    </html>
                    "#
                ))
            }
        });

    let routes = callback_route.with(warp::log("oauth_callback"));
    
    // Create shutdown channel
    let (shutdown_tx_main, shutdown_rx) = oneshot::channel::<()>();
    *shutdown_tx.lock().unwrap() = Some(shutdown_tx_main);
    
    // Start the server with graceful shutdown
    let (addr, server) = warp::serve(routes)
        .bind_with_graceful_shutdown(([127, 0, 0, 1], port), async {
            shutdown_rx.await.ok();
            log::info!("OAuth callback server shutting down");
        });
    
    // Spawn the server in a separate task
    let server_handle = tokio::spawn(server);
    
    log::info!("OAuth callback server started on http://localhost:{}", addr.port());
    
    // Update the redirect URI to use the actual port
    tokio::select! {
                 result = rx => {
             match result {
                 Ok(auth_result) => {
                     if auth_result.starts_with("error:") {
                         Err(auth_result.replace("error:", ""))
                     } else {
                         Ok(auth_result)
                     }
                 }
                 Err(_) => Err("Failed to receive OAuth callback".to_string())
             }
         }
                 _ = tokio::time::sleep(std::time::Duration::from_secs(CONFIG.oauth.timeout_seconds)) => {
                         log::warn!("OAuth callback server timed out after {} seconds", CONFIG.oauth.timeout_seconds);
            Err("Authentication timed out".to_string())
        }
    }
}

/// Tauri command to start the Google OAuth login flow
#[tauri::command]
pub async fn start_login_flow(app: AppHandle) -> Result<(), String> {
    log::info!("Starting Google OAuth login flow");
    
    // Generate state for OAuth security
    let state = generate_state();
    *OAUTH_STATE.lock().unwrap() = Some(state);
    
    // Start the callback server first to get the port
    let port = find_available_port(CONFIG.oauth.callback_port_start).ok_or_else(|| "No available port found".to_string())?;
    let redirect_uri = CONFIG.oauth_callback_url(port);
    
    let client = http_client::get_client();
    let auth_url_endpoint = format!("{}?redirect_uri={}", 
        CONFIG.google_login_url(),
        url::form_urlencoded::byte_serialize(redirect_uri.as_bytes()).collect::<String>());

    let res = client
        .get(&auth_url_endpoint)
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to get auth URL from backend: {}", e);
            format!("Backend request failed: {}", e)
        })?;

    if !res.status().is_success() {
        let error_body = res.text().await.unwrap_or_default();
        log::error!("Backend auth URL request failed: {}", error_body);
        return Err("Failed to get auth URL from backend".into());
    }

    let auth_response: AuthUrlResponse = res.json().await.map_err(|e| {
        log::error!("Failed to parse auth URL response: {}", e);
        format!("Failed to parse backend response: {}", e)
    })?;

    log::info!("Opening browser for Google authentication");
    
    // Try to open URL in a way that's more conducive to auto-closing
    let enhanced_url = if auth_response.url.contains('?') {
        format!("{}&display=popup", auth_response.url)
    } else {
        format!("{}?display=popup", auth_response.url)
    };
    
    app.opener().open_url(enhanced_url, None::<String>).map_err(|e| {
        log::error!("Failed to open browser: {}", e);
        e.to_string()
    })?;

    // Start the callback server and wait for the authorization code
    let auth_code = start_oauth_callback_server(app.clone(), port).await?;
    
    // Exchange the code for tokens
    handle_sso_finalization(app, auth_code, port).await?;

    Ok(())
}

/// Finalizes the SSO login after the OAuth callback using token exchange
pub async fn handle_sso_finalization(app: AppHandle, code: String, server_port: u16) -> Result<(), String> {
    log::info!("Finalizing SSO login with token exchange");
    let server_id = CONFIG.server.default_server_id.clone();

    // Clear the stored state
    let _state = OAUTH_STATE.lock().unwrap().take();

    let client = http_client::get_client();
    let exchange_request = TokenExchangeRequest {
        code,
        code_verifier: String::new(), // Not using PKCE
        provider: "google-oauth2".to_string(),
        tauri_redirect_uri: CONFIG.oauth_callback_url(server_port),
    };

    log::info!("Exchanging OAuth code for tokens");
    let res = client
        .post(&CONFIG.token_exchange_url())
        .json(&exchange_request)
        .send()
        .await
        .map_err(|e| {
            log::error!("Token exchange request failed: {}", e);
            e.to_string()
        })?;

    if !res.status().is_success() {
        let error_body = res.text().await.unwrap_or_default();
        log::error!("Token exchange failed: {}", error_body);
        return Err("Token exchange failed".into());
    }

    let token_response: TokenResponse = res.json().await.map_err(|e| {
        log::error!("Failed to parse token response: {}", e);
        e.to_string()
    })?;

    log::info!("Successfully exchanged code for tokens");

    // Create access token entry
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let access_token = ServerAccessToken::new(
        server_id.clone(),
        token_response.access_token,
        token_response.refresh_token,
        (now + 24 * 60 * 60) as u64, // 24 hours from now
    );

    save_access_token(server_id.clone(), access_token);
    persist_servers_token(&app).await.map_err(|e| {
        log::error!("Failed to persist tokens: {}", e);
        e.to_string()
    })?;

    // Get user profile using the new token
    match get_user_profile(&server_id).await {
        Ok(profile) => {
            log::info!("Successfully retrieved user profile");

            // Update or create server with profile
            let mut server = get_server_by_id(&server_id).unwrap_or(Server {
                id: server_id.clone(),
                profile: None,
                available: false,
            });

            server.profile = Some(profile);
            server.available = true;
            save_server(&server);

            persist_servers(&app).await.map_err(|e| {
                log::error!("Failed to persist servers: {}", e);
                e.to_string()
            })?;

            // Emit success event to frontend
            app.emit("login_success", ()).map_err(|e| {
                log::error!("Failed to emit login_success event: {}", e);
                e.to_string()
            })?;

            log::info!("SSO login finalization completed successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to get user profile after token exchange: {}", e);
            app.emit("login_failed", e.clone()).map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

/// Tauri command to check if user is logged in
#[tauri::command]
pub async fn check_login(app: AppHandle) -> Result<bool, String> {
    log::info!("Checking login status");
    let server_id = CONFIG.server.default_server_id.clone();

    if has_access_token(&server_id) {
        // We have a token, verify it's still valid by making a profile request
        match get_user_profile(&server_id).await {
            Ok(_) => {
                log::info!("Login check successful - user is authenticated");
                Ok(true)
            }
            Err(_) => {
                log::warn!("Login check failed - removing invalid token");
                remove_access_token(&server_id);
                persist_servers_token(&app).await.map_err(|e| e.to_string())?;
                Ok(false)
            }
        }
    } else {
        log::info!("Login check - no token found");
        Ok(false)
    }
}

/// Tauri command to get user profile
#[tauri::command]
pub async fn get_profile(_app: AppHandle) -> Result<UserProfile, String> {
    log::info!("Getting user profile via Tauri command");
    let server_id = CONFIG.server.default_server_id.clone();
    
    match get_user_profile(&server_id).await {
        Ok(profile) => {
            log::info!("Successfully got profile in Tauri command: {:?}", profile);
            Ok(profile)
        }
        Err(e) => {
            log::error!("Failed to get profile in Tauri command: {}", e);
            Err(e)
        }
    }
}

/// Tauri command to logout user
#[tauri::command]
pub async fn logout(app: AppHandle) -> Result<(), String> {
    log::info!("Logging out user");
    let server_id = CONFIG.server.default_server_id.clone();
    
    remove_access_token(&server_id);
    persist_servers_token(&app).await.map_err(|e| e.to_string())?;
    
    // Update server availability
    if let Some(mut server) = get_server_by_id(&server_id) {
        server.available = false;
        server.profile = None;
        save_server(&server);
        persist_servers(&app).await.map_err(|e| e.to_string())?;
    }
    
    app.emit("logout_success", ()).map_err(|e| e.to_string())?;
    log::info!("Logout completed successfully");
    Ok(())
}

/// Tauri command to get the current access token
#[tauri::command]
pub async fn get_access_token(_app: AppHandle) -> Result<String, String> {
    log::info!("Getting access token via Tauri command");
    let server_id = CONFIG.server.default_server_id.clone();
    
    let tokens = ACCESS_TOKENS.lock().unwrap();
    if let Some(token_data) = tokens.get(&server_id) {
        log::info!("Access token found for server: {}", server_id);
        Ok(token_data.access_token.clone())
    } else {
        log::warn!("No access token found for server: {}", server_id);
        Err("No access token available".to_string())
    }
} 