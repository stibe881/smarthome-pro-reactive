import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

export interface User {
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
}

export interface UserSettings {
    id: number;
    user_id: number;
    ha_url: string | null;
    ha_token: string | null;
    created_at: string;
    updated_at: string;
}

interface Database {
    users: User[];
    user_settings: UserSettings[];
    nextUserId: number;
    nextSettingsId: number;
}

let db: Database;

function loadDatabase(): Database {
    if (!existsSync(DB_PATH)) {
        return {
            users: [],
            user_settings: [],
            nextUserId: 1,
            nextSettingsId: 1
        };
    }

    try {
        const data = readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading database:', err);
        return {
            users: [],
            user_settings: [],
            nextUserId: 1,
            nextSettingsId: 1
        };
    }
}

function saveDatabase(): void {
    try {
        const dir = dirname(DB_PATH);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving database:', err);
    }
}

export function initDatabase(): void {
    db = loadDatabase();
    console.log('✅ Database initialized at:', DB_PATH);
    console.log(`📊 Users: ${db.users.length}, Settings: ${db.user_settings.length}`);
}

export function getDatabase(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// User operations
export function createUser(email: string, passwordHash: string): User {
    const now = new Date().toISOString();
    const user: User = {
        id: db.nextUserId++,
        email,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now
    };
    db.users.push(user);
    saveDatabase();
    return user;
}

export function getUserByEmail(email: string): User | undefined {
    return db.users.find(u => u.email === email);
}

export function getUserById(id: number): User | undefined {
    return db.users.find(u => u.id === id);
}

// Settings operations
export function getSettings(userId: number): UserSettings | undefined {
    return db.user_settings.find(s => s.user_id === userId);
}

export function createOrUpdateSettings(userId: number, haUrl: string, haToken: string): UserSettings {
    const now = new Date().toISOString();
    const existing = db.user_settings.find(s => s.user_id === userId);

    if (existing) {
        existing.ha_url = haUrl;
        existing.ha_token = haToken;
        existing.updated_at = now;
        saveDatabase();
        return existing;
    } else {
        const settings: UserSettings = {
            id: db.nextSettingsId++,
            user_id: userId,
            ha_url: haUrl,
            ha_token: haToken,
            created_at: now,
            updated_at: now
        };
        db.user_settings.push(settings);
        saveDatabase();
        return settings;
    }
}

export function deleteSettings(userId: number): void {
    const index = db.user_settings.findIndex(s => s.user_id === userId);
    if (index !== -1) {
        db.user_settings.splice(index, 1);
        saveDatabase();
    }
}
