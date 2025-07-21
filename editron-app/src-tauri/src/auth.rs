use crate::http_client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;
use tauri_plugin_opener::OpenerExt;

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
    pub profile_picture: Option<String>,
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
    static ref PKCE_VERIFIER: Mutex<Option<String>> = Mutex::new(None);
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

/// Checks if a server has a valid access token
pub fn has_access_token(server_id: &str) -> bool {
    ACCESS_TOKENS.lock().unwrap().contains_key(server_id)
}

/// Persists servers to storage
pub async fn persist_servers(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("servers.json")
        .ok_or_else(|| "Could not get servers store")?;
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
        .ok_or_else(|| "Could not get tokens store")?;
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
        .ok_or_else(|| "Could not get servers store")?;
    if let Some(v) = store.get("servers") {
        let loaded: Vec<Server> = serde_json::from_value(v.clone())?;
        *SERVERS.lock().unwrap() = loaded;
        log::info!("Servers loaded from storage");
    }
    Ok(())
}

/// Loads access tokens from storage
pub fn load_servers_token(app: &AppHandle) -> Result<(), Box<dyn Error>> {
    let store = app
        .get_store("tokens.json")
        .ok_or_else(|| "Could not get tokens store")?;
    if let Some(v) = store.get("tokens") {
        let loaded: HashMap<String, ServerAccessToken> = serde_json::from_value(v.clone())?;
        *ACCESS_TOKENS.lock().unwrap() = loaded;
        log::info!("Access tokens loaded from storage");
    }
    Ok(())
}

/// Generate PKCE code verifier and challenge
fn generate_pkce_pair() -> (String, String) {
    use base64::{engine::general_purpose, Engine as _};
    use sha2::{Digest, Sha256};
    
    // Generate code verifier
    let verifier = general_purpose::URL_SAFE_NO_PAD.encode(
        (0..32).map(|_| rand::random::<u8>()).collect::<Vec<u8>>()
    );
    
    // Generate code challenge
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());
    
    (verifier, challenge)
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
        .get("http://localhost:5000/api/v1/auth/user") // JWT-protected endpoint
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| {
            log::error!("Error fetching profile with JWT token: {}", e);
            e.to_string()
        })?;

    if res.status().is_success() {
        let profile: UserProfile = res.json().await.map_err(|e| {
            log::error!("Error parsing profile response: {}", e);
            e.to_string()
        })?;
        log::info!("Successfully fetched user profile");
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

/// Tauri command to start the Google OAuth login flow
#[tauri::command]
pub async fn start_login_flow(app: AppHandle) -> Result<(), String> {
    log::info!("Starting Google OAuth login flow");
    
    // Generate PKCE pair
    let (verifier, _challenge) = generate_pkce_pair();
    *PKCE_VERIFIER.lock().unwrap() = Some(verifier);
    
    let client = http_client::get_client();
    let auth_url_endpoint = "http://localhost:5000/api/v1/auth/google/login";

    let res = client
        .get(auth_url_endpoint)
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
    app.opener().open_url(auth_response.url, None::<String>).map_err(|e| {
        log::error!("Failed to open browser: {}", e);
        e.to_string()
    })?;

    Ok(())
}

/// Finalizes the SSO login after the OAuth callback using token exchange
pub async fn handle_sso_finalization(app: AppHandle, code: String) -> Result<(), String> {
    log::info!("Finalizing SSO login with token exchange");
    let server_id = "backend_v1".to_string();

    let verifier = PKCE_VERIFIER.lock().unwrap().take()
        .ok_or_else(|| "PKCE verifier not found".to_string())?;

    let client = http_client::get_client();
    let exchange_request = TokenExchangeRequest {
        code,
        code_verifier: verifier,
        provider: "google-oauth2".to_string(),
        tauri_redirect_uri: "editron-app://auth/callback".to_string(),
    };

    log::info!("Exchanging OAuth code for tokens");
    let res = client
        .post("http://localhost:5000/api/v1/auth/token/exchange")
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
    let server_id = "backend_v1".to_string();

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
    log::info!("Getting user profile");
    let server_id = "backend_v1".to_string();
    get_user_profile(&server_id).await
}

/// Tauri command to logout user
#[tauri::command]
pub async fn logout(app: AppHandle) -> Result<(), String> {
    log::info!("Logging out user");
    let server_id = "backend_v1".to_string();
    
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