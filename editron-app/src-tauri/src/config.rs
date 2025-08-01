use serde::{Deserialize, Serialize};
use std::env;
use dotenv::dotenv;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub backend: BackendConfig,
    pub oauth: OAuthConfig,
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub base_url: String,
    pub api_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub callback_port_start: u16,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub default_server_id: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            backend: BackendConfig::default(),
            oauth: OAuthConfig::default(),
            server: ServerConfig::default(),
        }
    }
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:5000".to_string(),
            api_version: "v1".to_string(),
        }
    }
}

impl Default for OAuthConfig {
    fn default() -> Self {
        Self {
            callback_port_start: 8080,
            timeout_seconds: 300, // 5 minutes
        }
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            default_server_id: "backend_v1".to_string(),
        }
    }
}

impl AppConfig {
    /// Load configuration from environment variables with fallback to defaults
    pub fn load() -> Self {
        // Load .env file if it exists
        dotenv().ok();
        
        let mut config = Self::default();

        // Backend configuration
        if let Ok(base_url) = env::var("EDITRON_BACKEND_URL") {
            config.backend.base_url = base_url;
        }
        
        if let Ok(api_version) = env::var("EDITRON_API_VERSION") {
            config.backend.api_version = api_version;
        }

        // OAuth configuration
        if let Ok(port_str) = env::var("EDITRON_OAUTH_PORT_START") {
            if let Ok(port) = port_str.parse::<u16>() {
                config.oauth.callback_port_start = port;
            }
        }
        
        if let Ok(timeout_str) = env::var("EDITRON_OAUTH_TIMEOUT") {
            if let Ok(timeout) = timeout_str.parse::<u64>() {
                config.oauth.timeout_seconds = timeout;
            }
        }

        // Server configuration
        if let Ok(server_id) = env::var("EDITRON_SERVER_ID") {
            config.server.default_server_id = server_id;
        }

        log::info!("Loaded configuration: backend_url={}, api_version={}, oauth_port={}, server_id={}", 
            config.backend.base_url, 
            config.backend.api_version,
            config.oauth.callback_port_start,
            config.server.default_server_id
        );

        config
    }

    /// Get the full backend API base URL
    pub fn backend_api_url(&self) -> String {
        format!("{}/api/{}", self.backend.base_url, self.backend.api_version)
    }

    /// Get the Google login URL
    pub fn google_login_url(&self) -> String {
        format!("{}/auth/google/login", self.backend_api_url())
    }

    /// Get the user profile URL
    pub fn user_profile_url(&self) -> String {
        format!("{}/auth/user", self.backend_api_url())
    }

    /// Get the token exchange URL
    pub fn token_exchange_url(&self) -> String {
        format!("{}/auth/token/exchange", self.backend_api_url())
    }

    /// Get OAuth callback URL for a specific port
    pub fn oauth_callback_url(&self, port: u16) -> String {
        format!("http://localhost:{}/auth/callback", port)
    }
} 