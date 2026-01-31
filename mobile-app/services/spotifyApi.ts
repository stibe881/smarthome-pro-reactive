
import { getSpotifyToken } from './spotifyAuth';

const BASE_URL = 'https://api.spotify.com/v1';

async function fetchSpotify(endpoint: string, options: RequestInit = {}) {
  const token = await getSpotifyToken();
  if (!token) {
    throw new Error("No Spotify Token available");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Ideally we should retry once after refresh
    // For now, assume getSpotifyToken() handled refresh if it was expired by time
    // If we get 401 here, it means the token is invalid/revoked despite time validity
    throw new Error("Spotify Token Invalid (401)");
  }
  
  // 204 No Content is common for Play/Pause commands
  if (response.status === 204) return null;

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`Spotify API Error [${endpoint}]:`, errorText);
    throw new Error(`Spotify API Error: ${response.status}`);
  }

  return response.json();
}

export type SpotifyDevice = {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
};

export const spotifyApi = {
    getDevices: async (): Promise<SpotifyDevice[]> => {
        const data = await fetchSpotify('/me/player/devices');
        return data?.devices || [];
    },

    play: async (deviceId?: string, contextUri?: string, uris?: string[]) => {
        const body: any = {};
        if (contextUri) body.context_uri = contextUri;
        if (uris) body.uris = uris;
        
        // If deviceId is provided, use query param, otherwise it plays on active device
        const query = deviceId ? `?device_id=${deviceId}` : '';
        
        await fetchSpotify(`/me/player/play${query}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    pause: async (deviceId?: string) => {
        const query = deviceId ? `?device_id=${deviceId}` : '';
        await fetchSpotify(`/me/player/pause${query}`, {
            method: 'PUT',
        });
    },

    next: async (deviceId?: string) => {
        const query = deviceId ? `?device_id=${deviceId}` : '';
        await fetchSpotify(`/me/player/next${query}`, {
            method: 'POST',
        });
    },

    previous: async (deviceId?: string) => {
        const query = deviceId ? `?device_id=${deviceId}` : '';
        await fetchSpotify(`/me/player/previous${query}`, {
            method: 'POST',
        });
    },
    
    setVolume: async (volumePercent: number, deviceId?: string) => {
        const query = deviceId ? `?device_id=${deviceId}&volume_percent=${volumePercent}` : `?volume_percent=${volumePercent}`;
        await fetchSpotify(`/me/player/volume${query}`, {
            method: 'PUT',
        });
    },
    
    getPlaybackState: async () => {
        return await fetchSpotify('/me/player');
    },
    
    transferPlayback: async (deviceId: string, play = false) => {
        await fetchSpotify('/me/player', {
            method: 'PUT',
            body: JSON.stringify({
                device_ids: [deviceId],
                play: play
            })
        });
    }
};
