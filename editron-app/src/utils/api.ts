import { invoke } from '@tauri-apps/api/core';

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback to default
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

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

  // Project API methods
  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Project API methods
  async getProjects() {
    return this.request('/api/v1/projects');
  }

  async getProject(uuid: string) {
    return this.request(`/api/v1/projects/${uuid}/details`);
  }

  async createProject(data: { name: string; description?: string; customInstructions?: string }) {
    return this.request('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(uuid: string, data: { name?: string; description?: string; customInstructions?: string }) {
    return this.request(`/api/v1/projects/${uuid}/update`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(uuid: string) {
    return this.request(`/api/v1/projects/${uuid}/delete`, {
      method: 'DELETE',
    });
  }

  // Document API methods (now scoped to projects)
  async getDocuments(projectUuid?: string) {
    if (projectUuid) {
      return this.request(`/api/v1/documents?projectUuid=${projectUuid}`);
    }
    return this.request('/api/v1/documents'); // Legacy endpoint
  }

  async getDocument(uuid: string, projectUuid?: string) {
    if (projectUuid) {
      return this.request(`/api/v1/documents/${uuid}?projectUuid=${projectUuid}`);
    }
    return this.request(`/api/v1/documents/${uuid}`); // Legacy endpoint
  }

  async updateDocument(uuid: string, data: { content?: string; title?: string }, projectUuid?: string) {
    if (projectUuid) {
      return this.request(`/api/v1/documents/${uuid}?projectUuid=${projectUuid}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }
    return this.request(`/api/v1/documents/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(uuid: string, projectUuid?: string) {
    if (projectUuid) {
      return this.request(`/api/v1/documents/${uuid}?projectUuid=${projectUuid}`, {
        method: 'DELETE',
      });
    }
    return this.request(`/api/v1/documents/${uuid}`, {
      method: 'DELETE',
    });
  }

  async agentEdit(documentUuid: string, promptText: string, projectUuid?: string) {
    if (projectUuid) {
      return this.request(`/api/v1/documents/agent-edit?projectUuid=${projectUuid}`, {
        method: 'POST',
        body: JSON.stringify({ documentUuid, promptText }),
      });
    }
    return this.request('/api/v1/documents/agent-edit', {
      method: 'POST',
      body: JSON.stringify({ documentUuid, promptText }),
    });
  }

  async uploadDocument(file: File, projectUuid?: string) {
    try {
      const headers = await this.getAuthHeaders();
      const formData = new FormData();
      formData.append('file', file);

      const uploadEndpoint = projectUuid 
        ? `/api/v1/documents/upload-and-preview?projectUuid=${projectUuid}`
        : '/api/v1/documents/upload-and-preview';
      
      const response = await fetch(`${this.baseUrl}${uploadEndpoint}`, {
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

  async chatQuery(promptText: string, documentUuid?: string, projectUuid?: string, mode: 'chat' | 'agent' = 'chat'): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    try {
      console.log(`[API] Starting chat query with documentUuid: ${documentUuid || 'none'}, projectUuid: ${projectUuid || 'none'}, mode: ${mode}`);
      const headers = await this.getAuthHeaders();
      
      const requestBody = { 
        promptText, 
        mode,
        ...(documentUuid && { documentUuid }),
        ...(projectUuid && { projectUuid })
      };
      
      console.log('[API] Chat request body:', requestBody);
      
      const response = await fetch(`${this.baseUrl}/api/v1/chat/query`, {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
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

  // Google API methods
  async searchGoogleContacts(query: string) {
    return this.request(`/api/v1/google-api/contacts/search?q=${encodeURIComponent(query)}`);
  }

  async sendEmail(data: { to: string; subject: string; body: string; documentUuid: string }) {
    return this.request('/api/v1/google-api/send-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async downloadPdf(documentUuid: string): Promise<Blob> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}/api/v1/google-api/download-pdf/${documentUuid}`, {
        method: 'GET',
        headers: {
          'Authorization': headers['Authorization'],
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download failed: ${response.status} ${errorText}`);
      }

      return response.blob();
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient(); 