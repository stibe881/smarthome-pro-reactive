export type DeviceType = 'light' | 'cover' | 'climate' | 'appliance' | 'media' | 'vacuum' | 'media_player' | 'weather';

export interface EntityState {
    id: string;
    name: string;
    state: string | number | boolean;
    attributes: Record<string, any>;
    icon: string;
    type: DeviceType;
    color?: string;
    room?: string;
    brightness?: number;
    position?: number;
    myPositionEntity?: string;
}

export interface Room {
    id: string;
    name: string;
    icon: string;
    entities: string[];
}

export type ViewType = 'overview' | 'family' | 'household' | 'rooms' | 'media' | 'admin' | 'settings';
