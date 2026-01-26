// Spotify Web API Service with PKCE OAuth Flow
// This bypasses Home Assistant and connects directly to Spotify

const SPOTIFY_CLIENT_ID = '5a15cd68b897411c92ad90a673539ed0';
const SPOTIFY_REDIRECT_URI = window.location.origin + '/spotify-callback';
const SPOTIFY_SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'streaming',
    'user-read-private',
    'user-read-email'
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Token storage keys
const TOKEN_KEY = 'spotify_access_token';
const REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const TOKEN_EXPIRY_KEY = 'spotify_token_expiry';
const CODE_VERIFIER_KEY = 'spotify_code_verifier';

// Generate random string for PKCE
function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values).map(x => possible[x % possible.length]).join('');
}

// Pure JS SHA-256 implementation (works without crypto.subtle/HTTPS)
async function sha256(message: string): Promise<string> {
    // Try crypto.subtle first (works on HTTPS and localhost)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fall through to JS implementation
        }
    }

    // Fallback: Pure JS SHA-256 implementation
    function rightRotate(value: number, amount: number): number {
        return (value >>> amount) | (value << (32 - amount));
    }

    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const bytes: number[] = [];
    for (let i = 0; i < message.length; i++) {
        bytes.push(message.charCodeAt(i));
    }
    bytes.push(0x80);

    while ((bytes.length % 64) !== 56) bytes.push(0);

    const bitLen = message.length * 8;
    for (let i = 7; i >= 0; i--) {
        bytes.push((bitLen >>> (i * 8)) & 0xff);
    }

    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
        const w: number[] = [];
        for (let i = 0; i < 16; i++) {
            w[i] = (bytes[chunk + i * 4] << 24) | (bytes[chunk + i * 4 + 1] << 16) |
                (bytes[chunk + i * 4 + 2] << 8) | bytes[chunk + i * 4 + 3];
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }

        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            h = g; g = f; f = e; e = (d + temp1) >>> 0;
            d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
        .map(h => h.toString(16).padStart(8, '0'))
        .join('');
}

// Convert hex to base64url
function hexToBase64Url(hex: string): string {
    const bytes = hex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const binary = String.fromCharCode(...bytes);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

class SpotifyService {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.loadTokens();
    }

    private loadTokens() {
        this.accessToken = localStorage.getItem(TOKEN_KEY);
        this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
        this.tokenExpiry = expiry ? parseInt(expiry) : 0;
    }

    private saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiry = Date.now() + (expiresIn * 1000);

        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(TOKEN_EXPIRY_KEY, this.tokenExpiry.toString());
    }

    isLoggedIn(): boolean {
        return !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    async login(): Promise<void> {
        // Generate PKCE code verifier and S256 challenge
        const codeVerifier = generateRandomString(64);
        localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

        // Generate S256 code challenge
        const hashHex = await sha256(codeVerifier);
        const codeChallenge = hexToBase64Url(hashHex);

        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: SPOTIFY_REDIRECT_URI,
            scope: SPOTIFY_SCOPES,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            state: generateRandomString(16)
        });

        window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
    }

    async handleCallback(code: string): Promise<boolean> {
        const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY);
        if (!codeVerifier) {
            console.error('No code verifier found');
            return false;
        }

        try {
            const response = await fetch(SPOTIFY_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: SPOTIFY_REDIRECT_URI,
                    code_verifier: codeVerifier
                })
            });

            if (!response.ok) {
                throw new Error('Token exchange failed');
            }

            const data = await response.json();
            this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
            localStorage.removeItem(CODE_VERIFIER_KEY);

            console.log('✅ Spotify login successful');
            return true;
        } catch (error) {
            console.error('❌ Spotify token exchange failed:', error);
            return false;
        }
    }

    private async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) {
            return false;
        }

        try {
            const response = await fetch(SPOTIFY_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            this.saveTokens(
                data.access_token,
                data.refresh_token || this.refreshToken,
                data.expires_in
            );

            console.log('✅ Spotify token refreshed');
            return true;
        } catch (error) {
            console.error('❌ Spotify token refresh failed:', error);
            return false;
        }
    }

    private async getValidToken(): Promise<string | null> {
        if (!this.accessToken) {
            return null;
        }

        // Refresh if token expires in less than 5 minutes
        if (Date.now() > this.tokenExpiry - 300000) {
            const refreshed = await this.refreshAccessToken();
            if (!refreshed) {
                return null;
            }
        }

        return this.accessToken;
    }

    private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const token = await this.getValidToken();
        if (!token) {
            throw new Error('Not authenticated with Spotify');
        }

        const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        // Some endpoints return no content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Get available devices
    async getDevices(): Promise<SpotifyDevice[]> {
        const data = await this.apiRequest<{ devices: SpotifyDevice[] }>('/me/player/devices');
        return data.devices || [];
    }

    // Get user's playlists
    async getPlaylists(limit = 50): Promise<SpotifyPlaylist[]> {
        const data = await this.apiRequest<{ items: SpotifyPlaylist[] }>(`/me/playlists?limit=${limit}`);
        return data.items || [];
    }

    // Get playlist tracks
    async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        const data = await this.apiRequest<{ items: { track: SpotifyTrack }[] }>(
            `/playlists/${playlistId}/tracks?limit=100`
        );
        return data.items?.map(item => item.track) || [];
    }

    // Get user's saved albums
    async getSavedAlbums(limit = 50): Promise<SpotifyAlbum[]> {
        const data = await this.apiRequest<{ items: { album: SpotifyAlbum }[] }>(`/me/albums?limit=${limit}`);
        return data.items?.map(item => item.album) || [];
    }

    // Get album tracks
    async getAlbumTracks(albumId: string): Promise<SpotifyTrack[]> {
        const data = await this.apiRequest<{ items: SpotifyTrack[] }>(`/albums/${albumId}/tracks?limit=50`);
        return data.items || [];
    }

    // Play a track/album/playlist on a device
    async play(uri: string, deviceId?: string): Promise<void> {
        const body: any = {};

        // Handle different URI types
        if (uri.includes(':track:')) {
            body.uris = [uri];
        } else {
            body.context_uri = uri;
        }

        let endpoint = '/me/player/play';
        if (deviceId) {
            endpoint += `?device_id=${deviceId}`;
        }

        await this.apiRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        console.log('▶️ Playing:', uri);
    }

    // Transfer playback to a device
    async transferPlayback(deviceId: string): Promise<void> {
        await this.apiRequest('/me/player', {
            method: 'PUT',
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false
            })
        });
    }

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = 0;
    }
}

// Type definitions
export interface SpotifyDevice {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    images: { url: string }[];
    tracks: { total: number };
    uri: string;
}

export interface SpotifyAlbum {
    id: string;
    name: string;
    images: { url: string }[];
    artists: { name: string }[];
    uri: string;
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album?: { images: { url: string }[] };
    uri: string;
    duration_ms: number;
}

// Export singleton instance
export const spotifyService = new SpotifyService();
export default spotifyService;
