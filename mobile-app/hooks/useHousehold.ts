import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useHousehold() {
    const { user } = useAuth();
    const [householdId, setHouseholdId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setHouseholdId(null);
            setLoading(false);
            return;
        }

        async function fetchHousehold() {
            try {
                const { data, error } = await supabase
                    .from('family_members')
                    .select('household_id')
                    .eq('user_id', user!.id)
                    .single();

                if (data) {
                    setHouseholdId(data.household_id);
                } else if (error) {
                    console.warn('Error fetching household:', error);
                }
            } catch (e) {
                console.error('Failed to fetch household:', e);
            } finally {
                setLoading(false);
            }
        }

        fetchHousehold();
    }, [user]);

    return { householdId, loading };
}
