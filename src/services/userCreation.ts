import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

/**
 * Creates a new user with email and password using a temporary Supabase client.
 * This avoids logging out the current admin user, as the temporary client
 * does not persist the session.
 */
export const createUserWithPassword = async (email: string, password: string) => {
    // Create a temporary client that doesn't persist session
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // Critical: Don't overwrite the admin's session in localStorage
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const { data, error } = await tempClient.auth.signUp({
        email,
        password,
    });

    if (error) throw error;

    return data;
};

/**
 * Recovers a user by signing in to retrieve their ID.
 */
export const recoverUser = async (email: string, password: string) => {
    // Create a temporary client that doesn't persist session
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const { data, error } = await tempClient.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;

    return data;
};
