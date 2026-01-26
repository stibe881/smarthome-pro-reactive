import { EntityState, Room } from './types';

export const INITIAL_ENTITIES: EntityState[] = [
    // APPLIANCES
    // APPLIANCES - Real Entities
    // Dishwasher
    { id: 'sensor.adoradish_v2000_programm', name: 'Geschirrspüler Status', state: 'Eco', attributes: {}, icon: 'fa-soap', type: 'appliance' },
    { id: 'sensor.adoradish_v2000_programm_ende', name: 'Geschirrspüler Ende', state: new Date(Date.now() + 45 * 60000).toISOString(), attributes: {}, icon: 'fa-clock', type: 'appliance' },

    // Washing Machine
    { id: 'sensor.adorawash_v4000_zustand', name: 'Waschmaschine Zustand', state: 'Waschen', attributes: {}, icon: 'fa-shirt', type: 'appliance' },
    { id: 'sensor.adorawash_v4000_programm_ende', name: 'Waschmaschine Ende', state: '2026-01-26T14:00:00+01:00', attributes: {}, icon: 'fa-clock', type: 'appliance' },
    { id: 'sensor.adorawash_v4000_program_ende_rohwert', name: 'Waschmaschine Restzeit', state: '1h15', attributes: {}, icon: 'fa-hourglass', type: 'appliance' },

    // Dryer
    { id: 'sensor.001015699ea263_current', name: 'Tumbler Strom', state: 15.5, attributes: {}, icon: 'fa-plug', type: 'appliance' },

    // LIGHTS
    { id: 'light.devins_zimmer', name: 'Levin', state: 'on', attributes: { brightness: 80 }, icon: 'fa-child', type: 'light' },
    { id: 'light.linas_zimmer', name: 'Lina', state: 'on', attributes: { brightness: 40 }, icon: 'fa-child-rearing', type: 'light' },
    { id: 'light.deckenbeleuchtung_buro', name: 'Büro', state: 'off', attributes: { brightness: 0 }, icon: 'fa-briefcase', type: 'light' },
    { id: 'light.terrasse', name: 'Terrasse', state: 'off', attributes: { brightness: 0 }, icon: 'fa-sun-plant-wilt', type: 'light' },
    { id: 'light.kuche', name: 'Küche Main', state: 'on', attributes: { brightness: 100 }, icon: 'fa-kitchen-set', type: 'light' },
    { id: 'light.wohnzimmer', name: 'Wohnzimmer Ambient', state: 'on', attributes: { brightness: 60 }, icon: 'fa-couch', type: 'light' },

    // MEDIA PLAYERS
    { id: 'media_player.fernseher_im_wohnzimmer_2', name: 'Sony TV OLED', state: 'playing', attributes: { media_title: 'Inception', media_artist: 'Netflix', media_duration: 8880, media_position: 4320 }, icon: 'fa-tv', type: 'media_player' },
    { id: 'media_player.hub_lina', name: 'Lina Speaker', state: 'playing', attributes: { media_title: 'Disney Radio', media_duration: 0, media_position: 0 }, icon: 'fa-music', type: 'media_player' },

    // VACUUM
    { id: 'vacuum.robi', name: 'Röbi Unit', state: 'docked', attributes: { battery: 100, fan_speed: 'Standard' }, icon: 'fa-robot', type: 'vacuum' },

    // WEATHER
    { id: 'weather.zell_lu', name: 'Zell LU', state: 'partlycloudy', attributes: { temperature: 18, humidity: 45, wind_speed: 12 }, icon: 'fa-cloud-sun', type: 'weather' },
];

export const ROOMS: Room[] = [
    { id: 'living', name: 'Wohnzimmer', icon: 'fa-couch', entities: ['light.wohnzimmer', 'media_player.fernseher_im_wohnzimmer_2'] },
    { id: 'kitchen', name: 'Küche', icon: 'fa-kitchen-set', entities: ['light.kuche'] },
    { id: 'laundry', name: 'Waschküche', icon: 'fa-shirt', entities: ['sensor.adorawash_v4000_zustand', 'sensor.001015699ea263_current', 'sensor.adoradish_v2000_programm'] },
];
