import { supabase } from '../lib/supabase';

export interface Invitation {
    id: string;
    email: string;
    invited_by: string;
    status: 'pending' | 'accepted' | 'expired';
    token: string;
    expires_at: string;
    created_at: string;
    accepted_at?: string;
}

// Create new invitation (admin only)
export async function createInvitation(email: string): Promise<Invitation> {
    // Generate unique token
    const token = btoa(Math.random().toString()).substring(0, 32);

    const { data, error } = await supabase
        .from('invitations')
        .insert({
            email,
            token,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Get all invitations (admin only)
export async function getAllInvitations(): Promise<Invitation[]> {
    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// Get invitation by token (public - for registration)
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

    if (error) {
        console.error('Error fetching invitation:', error);
        return null;
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
        return null;
    }

    return data;
}

// Accept invitation (mark as accepted)
export async function acceptInvitation(token: string): Promise<void> {
    const { error } = await supabase
        .from('invitations')
        .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

    if (error) throw error;
}

// Delete invitation (admin only)
export async function deleteInvitation(id: string): Promise<void> {
    const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// Resend invitation (admin only)
export async function resendInvitation(id: string): Promise<Invitation> {
    // Generate new token and extend expiry
    const token = btoa(Math.random().toString()).substring(0, 32);

    const { data, error } = await supabase
        .from('invitations')
        .update({
            token,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}
