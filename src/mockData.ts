import { EntityState, Room } from './types';

export const INITIAL_ENTITIES: EntityState[] = [
    // APPLIANCES
    {
        id: 'sensor.adoradish_v2000_programm',
        name: 'Abwaschmaschine',
        state: 'Eco',
        attributes: { remaining: '42 min', status: 'cleaning' },
        icon: 'fa-soap',
        type: 'appliance'
    },
    {
        id: 'sensor.adorawash_v4000_zustand',
        name: 'Waschmaschine',
        state: 'Hauptwäsche',
        attributes: { remaining: '15 min', status: 'cleaning' },
        icon: 'fa-shirt',
        type: 'appliance'
    },
    {
        id: 'sensor.001015699ea263_current',
        name: 'Tumbler',
        state: 'Trocknen',
        attributes: { remaining: '28 min', status: 'cleaning' },
        icon: 'fa-wind',
        type: 'appliance'
    },

    // LIGHTS
    { id: 'light.levins_zimmer', name: 'Levin', state: 'on', attributes: { brightness: 80 }, icon: 'fa-child', type: 'light' },
    { id: 'light.linas_zimmer', name: 'Lina', state: 'on', attributes: { brightness: 40 }, icon: 'fa-child-rearing', type: 'light' },
    { id: 'light.buro', name: 'Büro', state: 'off', attributes: { brightness: 0 }, icon: 'fa-briefcase', type: 'light' },
    { id: 'light.terrasse', name: 'Terrasse', state: 'off', attributes: { brightness: 0 }, icon: 'fa-sun-plant-wilt', type: 'light' },
    { id: 'light.kuche', name: 'Küche Main', state: 'on', attributes: { brightness: 100 }, icon: 'fa-kitchen-set', type: 'light' },
    { id: 'light.wohnzimmer', name: 'Wohnzimmer Ambient', state: 'on', attributes: { brightness: 60 }, icon: 'fa-couch', type: 'light' },

    // MEDIA
    { id: 'media_player.fernseher_im_wohnzimmer_2', name: 'Sony TV OLED', state: 'playing', attributes: { source: 'Netflix', content: 'Inception' }, icon: 'fa-tv', type: 'media' },
    { id: 'media_player.hub_lina', name: 'Lina Speaker', state: 'playing', attributes: { content: 'Disney Radio' }, icon: 'fa-music', type: 'media' },

    // VACUUM
    { id: 'vacuum.robi', name: 'Röbi Unit', state: 'docked', attributes: { battery: 100, fan_speed: 'Standard' }, icon: 'fa-robot', type: 'vacuum' },
];

export const ROOMS: Room[] = [
    { id: 'living', name: 'Wohnzimmer', icon: 'fa-couch', entities: ['light.wohnzimmer', 'media_player.fernseher_im_wohnzimmer_2'] },
    { id: 'kitchen', name: 'Küche', icon: 'fa-kitchen-set', entities: ['light.kuche'] },
    { id: 'laundry', name: 'Waschküche', icon: 'fa-shirt', entities: ['sensor.adorawash_v4000_zustand', 'sensor.001015699ea263_current', 'sensor.adoradish_v2000_programm'] },
];
