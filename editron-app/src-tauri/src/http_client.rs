use lazy_static::lazy_static;
use reqwest::Client;
use std::sync::Arc;

lazy_static! {
    /// Global HTTP client for desktop application.
    /// Note: Desktop apps use JWT tokens via Authorization headers, NOT cookies.
    /// Cookie store is enabled here for any potential session-based endpoints,
    /// but the main authentication uses JWT Bearer tokens.
    static ref HTTP_CLIENT: Arc<Client> = {
        let client = Client::builder()
            .cookie_store(true) // Keep for compatibility, but JWT is primary auth method
            .build()
            .expect("Failed to build reqwest client");
        Arc::new(client)
    };
}

/// Returns a shared reference to the global HTTP client.
/// All backend API calls should use this client to maintain session state.
pub fn get_client() -> Arc<Client> {
    HTTP_CLIENT.clone()
} 