import { CalendarSyncConfig } from '@/lib/google-calendar/types';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = path.join(process.cwd(), '.calendar-config.json');
const IS_DEV = process.env.NODE_ENV === 'development';

// Default config
const DEFAULT_CONFIG: CalendarSyncConfig = {
    coachingKeywords: ['1:1', 'coaching', 'pt', 'personal training'],
    classKeywords: ['class', 'group', 'bootcamp'],
    locationAbbreviations: [],
    selectedCalendarId: undefined,
};

async function readLocalConfig(): Promise<CalendarSyncConfig> {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('[ConfigAdapter] Failed to read local config, using defaults:', error);
    }
    return DEFAULT_CONFIG;
}

async function writeLocalConfig(config: CalendarSyncConfig): Promise<void> {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('[ConfigAdapter] Failed to write local config:', error);
    }
}

export async function getCalendarConfig(): Promise<CalendarSyncConfig> {
    if (IS_DEV) {
        console.log('[ConfigAdapter] Dev mode: reading local config');
        return readLocalConfig();
    }

    // Production: Use Firestore (Active lazy loading to avoid side effects)
    try {
        const { getCalendarSyncConfig } = await import('@/lib/firebase/services/calendarConfig');
        return getCalendarSyncConfig(DEFAULT_CONFIG);
    } catch (error) {
        console.error('[ConfigAdapter] Error loading Firestore service:', error);
        return DEFAULT_CONFIG;
    }
}

export async function updateCalendarConfig(updates: Partial<CalendarSyncConfig>): Promise<void> {
    if (IS_DEV) {
        console.log('[ConfigAdapter] Dev mode: updating local config');
        const current = await readLocalConfig();
        const updated = { ...current, ...updates };
        await writeLocalConfig(updated);
        return;
    }

    // Production
    try {
        const { updateCalendarSyncConfig } = await import('@/lib/firebase/services/calendarConfig');
        await updateCalendarSyncConfig(updates);
    } catch (error) {
        console.error('[ConfigAdapter] Error updating Firestore config:', error);
        throw error;
    }
}
