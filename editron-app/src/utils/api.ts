import { invoke } from '@tauri-apps/api/core';

const API_BASE_URL = 'http://localhost:5000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Get token from Tauri backend
      console.log('[API] Requesting access token from Tauri...');
      const token = await invoke<string>('get_access_token');
      console.log('[API] ✅ Access token received:', token ? `${token.substring(0, 20)}...` : 'null');
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('[API] ❌ Failed to get access token:', error);
      throw new Error('Authentication required');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      console.log(`[API] Making request to: ${url}`);
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      console.log(`[API] Response status: ${response.status} for ${url}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] ❌ Request failed: ${response.status} ${errorText}`);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await response.json();
        console.log(`[API] ✅ JSON response received for ${endpoint}`);
        return jsonData;
      } else {
        const textData = await response.text();
        console.log(`[API] ✅ Text response received for ${endpoint}`);
        return textData as T;
      }
    } catch (error) {
      console.error(`[API] ❌ Request failed for ${url}:`, error);
      throw error;
    }
  }

  // Document API methods
  async getDocuments() {
    return this.request('/api/v1/documents');
  }

  async getDocument(uuid: string) {
    return this.request(`/api/v1/documents/${uuid}`);
  }

  async updateDocument(uuid: string, data: { content?: string; title?: string }) {
    return this.request(`/api/v1/documents/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async agentEdit(documentUuid: string, promptText: string) {
    return this.request('/api/v1/documents/agent-edit', {
      method: 'POST',
      body: JSON.stringify({ documentUuid, promptText }),
    });
  }

  async uploadDocument(file: File) {
    try {
      const headers = await this.getAuthHeaders();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/api/v1/documents/upload-and-preview`, {
        method: 'POST',
        headers: {
          // Remove Content-Type to let browser set it with boundary for FormData
          'Authorization': headers['Authorization'],
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  // Chat API methods
  async getChatHistory() {
    return this.request('/api/v1/chat/history');
  }

  async chatQuery(promptText: string, documentUuid?: string, mode: 'chat' | 'agent' = 'chat'): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    try {
      console.log(`[API] Starting chat query with documentUuid: ${documentUuid || 'none'}, mode: ${mode}`);
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/v1/chat/query`, {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ 
          promptText, 
          mode,
          ...(documentUuid && { documentUuid }) 
        }),
      });

      console.log(`[API] Chat response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] ❌ Chat request failed: ${response.status} ${errorText}`);
        throw new Error(`Chat request failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      console.log('[API] ✅ Chat stream reader created');
      return reader;
    } catch (error) {
      console.error('[API] ❌ Chat query failed:', error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient(); 