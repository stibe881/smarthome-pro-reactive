import { supabase } from '../lib/supabase';

export interface UserProfile {
    id: string;
    email: string;
    role: 'admin' | 'user';
    created_at: string;
    last_sign_in_at?: string;
}

// Check if current user is admin
export async function isCurrentUserAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('Error checking admin status:', error);
        return false;
    }

    return data?.role === 'admin';
}

// Get all users (admin only) - using database view instead of Admin API
export async function getAllUsers(): Promise<UserProfile[]> {
    // First check if current user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
    }

    // Use the admin_users_view instead of Admin API
    const { data, error } = await supabase
        .from('admin_users_view')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        throw error;
    }

    return (data || []).map(user => ({
        id: user.id,
        email: user.email || '',
        role: (user.role as 'admin' | 'user') || 'user',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
    }));
}

// Update user role (admin only)
export async function updateUserRole(userId: string, newRole: 'admin' | 'user'): Promise<void> {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        throw new Error('Unauthorized: Admin access required');
    }

    const { error } = await supabase
        .from('user_roles')
        .upsert({
            user_id: userId,
            role: newRole,
        }, {
            onConflict: 'user_id'
        });

    if (error) throw error;
}

// Deactivate user account (admin only) - since we can't use Admin API
// This just removes their role, preventing access
export async function deactivateUserAccount(userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const isAdmin = await isCurrentUserAdmin();

    // Allow if admin (but not self-deactivation)
    if (!isAdmin || user.id === userId) {
        throw new Error('Unauthorized: Cannot deactivate this user');
    }

    // Delete user's role (this prevents them from logging in effectively)
    const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

    if (roleError) throw roleError;

    // Delete user's settings
    const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId);

    if (settingsError) throw settingsError;
}

// Change password
export async function changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) throw error;
}

// Get current user's role
export async function getCurrentUserRole(): Promise<'admin' | 'user' | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('Error getting user role:', error);
        return null;
    }

    return (data?.role as 'admin' | 'user') || 'user';
}
