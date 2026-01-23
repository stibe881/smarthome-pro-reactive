export type DeviceType = 'light' | 'cover' | 'climate' | 'appliance' | 'media' | 'vacuum';

export interface EntityState {
    id: string;
    name: string;
    state: string | number | boolean;
    attributes: Record<string, any>;
    icon: string;
    type: DeviceType;
    color?: string;
}

export interface Room {
    id: string;
    name: string;
    icon: string;
    entities: string[];
}

export type ViewType = 'overview' | 'family' | 'household' | 'rooms' | 'media' | 'settings';
