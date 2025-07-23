// Temporary mock for Tauri commands during development
// This will be replaced with proper Tauri backend implementation

declare global {
  interface Window {
    __TAURI_MOCK__?: boolean;
  }
}

// Mock access token storage
let mockAccessToken: string | null = null;

export const mockTauriCommands = {
  get_access_token: async (): Promise<string> => {
    if (mockAccessToken) {
      return mockAccessToken;
    }
    
    // For development, create a mock token
    // In production, this would come from the Tauri backend after OAuth
    mockAccessToken = 'mock-jwt-token-for-development';
    return mockAccessToken;
  },

  set_access_token: async (token: string): Promise<void> => {
    mockAccessToken = token;
  },

  check_login: async (): Promise<boolean> => {
    return mockAccessToken !== null;
  },

  get_profile: async () => {
    return {
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      profilePicture: '',
      authProvider: 'google'
    };
  },

  start_login_flow: async (): Promise<void> => {
    // Mock login flow
    console.log('Mock login flow started');
    mockAccessToken = 'mock-jwt-token';
    
    // Simulate successful login
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('login_success'));
    }, 1000);
  },

  logout: async (): Promise<void> => {
    mockAccessToken = null;
    window.dispatchEvent(new CustomEvent('logout_success'));
  }
};

// Patch the invoke function for development - only if Tauri is not available
if (typeof window !== 'undefined' && !window.__TAURI_MOCK__) {
  window.__TAURI_MOCK__ = true;
  
  // More robust Tauri detection
  const isTauriEnvironment = () => {
    // Check for Tauri-specific indicators
    return !!(
      (window as any).__TAURI__ ||
      (window as any).__TAURI_PLUGIN_SHELL__ ||
      (window as any).__TAURI_PLUGIN_FS__ ||
      navigator.userAgent.includes('Tauri') ||
      location.protocol === 'tauri:' ||
      location.hostname === 'tauri.localhost'
    );
  };
  
  // Check if real Tauri is available
  const originalInvoke = (window as any).__TAURI__?.invoke;
  const isTauri = isTauriEnvironment();
  
  if (!originalInvoke && !isTauri) {
    console.log('[TAURI MOCK] 🔧 Real Tauri not detected, initializing mock system');
    console.log('[TAURI MOCK] Environment details:', {
      userAgent: navigator.userAgent,
      protocol: location.protocol,
      hostname: location.hostname,
      hasTauriGlobals: !!(window as any).__TAURI__
    });
    
    // Create a mock invoke function only if real Tauri is not available
    (window as any).__TAURI__ = {
      invoke: async (command: string, ...args: any[]) => {
        console.log(`[TAURI MOCK] 🎭 Invoking command: ${command}`, args);
        
        if (command in mockTauriCommands) {
          return (mockTauriCommands as any)[command](...args);
        }
        
        throw new Error(`Mock command not implemented: ${command}`);
      }
    };
  } else {
    console.log('[TAURI] ✅ Real Tauri backend detected, using real commands');
  }
} 