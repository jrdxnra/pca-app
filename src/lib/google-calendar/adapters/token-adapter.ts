import type { StoredTokens } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Helper to match token-storage.ts logic
const getLocalTokenFile = (userId?: string) =>
    userId
        ? path.join(process.cwd(), `.google-calendar-tokens-${userId}.json`)
        : path.join(process.cwd(), '.google-calendar-tokens.json');

const IS_DEV = process.env.NODE_ENV === 'development';

async function readLocalTokens(userId?: string): Promise<StoredTokens | null> {
    const filePath = getLocalTokenFile(userId);
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('[TokenAdapter] Failed to read local tokens:', error);
    }
    return null;
}

async function writeLocalTokens(tokens: StoredTokens, userId?: string): Promise<void> {
    const filePath = getLocalTokenFile(userId);
    try {
        fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2));
    } catch (error) {
        console.error('[TokenAdapter] Failed to write local tokens:', error);
    }
}

export async function getStoredTokens(userId?: string): Promise<StoredTokens | null> {
    if (IS_DEV) {
        return readLocalTokens(userId);
    }

    // Production - Commented out to prevent dev crash
    // Logic: In dev, we don't want to bundle token-storage.ts at all.
    // Ensure you uncomment this for production build or use a separate file.

    try {
        // @ts-ignore
        const { getStoredTokens } = await import('@/lib/google-calendar/token-storage');
        return getStoredTokens(userId);
    } catch (error) {
        console.error('[TokenAdapter] Error loading Firestore tokens:', error);
        return null;
    }

}

export async function storeTokens(tokens: StoredTokens, userId?: string): Promise<void> {
    if (IS_DEV) {
        await writeLocalTokens(tokens, userId);
        return;
    }

    // Production
    try {
        const { storeTokens } = await import('@/lib/google-calendar/token-storage');
        await storeTokens(tokens, userId);
    } catch (error) {
        console.error('[TokenAdapter] Error storing Firestore tokens:', error);
        throw error;
    }
}

export async function clearStoredTokens(userId?: string): Promise<void> {
    if (IS_DEV) {
        try {
            const filePath = getLocalTokenFile(userId);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('[TokenAdapter] Error clearing local tokens:', e);
        }
        return;
    }

    // Production
    try {
        const { clearStoredTokens } = await import('@/lib/google-calendar/token-storage');
        await clearStoredTokens(userId);
    } catch (error) {
        console.error('[TokenAdapter] Error clearing Firestore tokens:', error);
    }
}
