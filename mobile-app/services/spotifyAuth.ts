
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Platform-safe storage helpers (SecureStore doesn't work on web)
const storeSet = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const storeGet = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
};

const storeDelete = async (key: string) => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

// Allow WebBrowser to complete auth session
WebBrowser.maybeCompleteAuthSession();

// Endpoint discovery
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const CLIENT_ID = '5a15cd68b897411c92ad90a673539ed0';

// Scopes needed for playback control
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-private', // for username
];

const STORE_KEY_ACCESS = 'spotify_access_token';
const STORE_KEY_REFRESH = 'spotify_refresh_token';
const STORE_KEY_EXPIRATION = 'spotify_token_expiration';

export const useSpotifyAuth = () => {
    
  const redirectUri = makeRedirectUri({
    scheme: 'smarthome-pro',
    path: 'spotify-auth'
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
      responseType: ResponseType.Code,
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
};

export const exchangeSpotifyCode = async (code: string, codeVerifier: string, redirectUri: string) => {
  const result = await fetch(discovery.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
  });

  const data = await result.json();
  return data;
};

// --- Storage Helpers ---

export const saveSpotifyToken = async (
  accessToken: string, 
  refreshToken: string, 
  expiresIn: number
) => {
  const expirationTime = Date.now() + (expiresIn * 1000);
  await storeSet(STORE_KEY_ACCESS, accessToken);
  if (refreshToken) await storeSet(STORE_KEY_REFRESH, refreshToken);
  await storeSet(STORE_KEY_EXPIRATION, expirationTime.toString());
};

export const getSpotifyToken = async (): Promise<string | null> => {
  const expiration = await storeGet(STORE_KEY_EXPIRATION);
  const now = Date.now();

  if (!expiration || now >= parseInt(expiration, 10)) {
    // Token expired -> Try Refresh
    console.log("Spotify Token expired, attempting refresh...");
    return await refreshSpotifyToken();
  }

  return await storeGet(STORE_KEY_ACCESS);
};

const refreshSpotifyToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await storeGet(STORE_KEY_REFRESH);
    if (!refreshToken) return null;

    const tokenResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }).toString(),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
        console.log("Spotify Token Refreshed!");
        // Update storage
        // Note: Refresh token might not be returned again, so keep old one if missing
        await saveSpotifyToken(
            data.access_token, 
            data.refresh_token || refreshToken, 
            data.expires_in
        );
        return data.access_token;
    }
  } catch (error) {
    console.warn("Failed to refresh Spotify token:", error);
  }
  return null;
};

export const logoutSpotify = async () => {
    await storeDelete(STORE_KEY_ACCESS);
    await storeDelete(STORE_KEY_REFRESH);
    await storeDelete(STORE_KEY_EXPIRATION);
};
