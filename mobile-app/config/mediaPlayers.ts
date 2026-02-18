import { Speaker, Tv } from 'lucide-react-native';

export const MEDIA_PLAYER_CONFIG: Record<string, { name: string; type: 'speaker' | 'tv'; icon: any; isGroup?: boolean }> = {
    'media_player.haus_4': { name: 'Haus', type: 'speaker', icon: Speaker, isGroup: true },
    'media_player.wohnung_4': { name: 'Wohnung', type: 'speaker', icon: Speaker, isGroup: true },
    'media_player.kuche_2': { name: 'Küche', type: 'speaker', icon: Speaker },
    'media_player.nest_terrasse': { name: 'Terrasse', type: 'speaker', icon: Speaker },
    'media_player.nest_buro': { name: 'Büro', type: 'speaker', icon: Speaker },
    'media_player.hub_levin': { name: 'Levin', type: 'speaker', icon: Speaker },
    'media_player.hub_lina': { name: 'Lina', type: 'speaker', icon: Speaker },
    'media_player.nest_schlafzimmer': { name: 'Schlafzimmer', type: 'speaker', icon: Speaker },
    'media_player.fernseher_im_wohnzimmer_2': { name: 'Wohnzimmer TV', type: 'tv', icon: Tv },
    'media_player.shield_schlafzimmer': { name: 'Schlafzimmer TV', type: 'tv', icon: Tv },
};

export const WHITELISTED_PLAYERS = Object.keys(MEDIA_PLAYER_CONFIG);
