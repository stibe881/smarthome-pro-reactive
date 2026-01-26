const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';



class ApiClient {
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Auth endpoints
    async register(email: string, password: string) {
        return this.request<{ token: string; user: { id: number; email: string } }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async login(email: string, password: string) {
        return this.request<{ token: string; user: { id: number; email: string } }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async getCurrentUser() {
        return this.request<{ user: { id: number; email: string; created_at: string } }>('/api/auth/me');
    }

    // Settings endpoints
    async getSettings() {
        return this.request<{ settings: { ha_url: string | null; ha_token: string | null } }>('/api/settings');
    }

    async updateSettings(haUrl: string, haToken: string) {
        return this.request<{ message: string }>('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ ha_url: haUrl, ha_token: haToken }),
        });
    }

    async deleteSettings() {
        return this.request<{ message: string }>('/api/settings', {
            method: 'DELETE',
        });
    }
}

export const apiClient = new ApiClient();
