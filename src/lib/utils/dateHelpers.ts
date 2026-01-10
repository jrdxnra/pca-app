import { Timestamp } from 'firebase/firestore';

/**
 * Safely convert various date formats to a JavaScript Date object.
 * Handles: Date, Firestore Timestamp, {seconds, nanoseconds}, string, number
 */
export function safeToDate(dateValue: unknown): Date {
    if (!dateValue) return new Date();

    if (dateValue instanceof Date) {
        return dateValue;
    }

    if (dateValue && typeof dateValue === 'object') {
        // Firestore Timestamp with toDate() method
        if ('toDate' in dateValue && typeof (dateValue as Timestamp).toDate === 'function') {
            return (dateValue as Timestamp).toDate();
        }

        // Plain object with seconds/nanoseconds (serialized Timestamp)
        if ('seconds' in dateValue && typeof (dateValue as { seconds: number }).seconds === 'number') {
            return new Date((dateValue as { seconds: number }).seconds * 1000);
        }
    }

    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        return new Date(dateValue);
    }

    console.warn('Unknown date format:', dateValue);
    return new Date();
}

/**
 * Create a consistent date key string (YYYY-MM-DD) for indexing.
 * Uses local date to avoid timezone issues.
 */
export function getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Normalize a date to midnight (00:00:00.000) for consistent date comparisons.
 */
export function normalizeToMidnight(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

/**
 * Normalize a date to end of day (23:59:59.999) for range comparisons.
 */
export function normalizeToEndOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
}

/**
 * Format a Date to a time string (e.g., "9:30 AM").
 */
export function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format a Date to a short date string for display.
 */
export function formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Check if two dates are the same calendar day (ignoring time).
 */
export function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Check if a date falls within a range (inclusive).
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    const normalizedDate = normalizeToMidnight(date);
    const normalizedStart = normalizeToMidnight(startDate);
    const normalizedEnd = normalizeToEndOfDay(endDate);

    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
}

/**
 * Parse a time string (HH:mm or h:mm AM/PM) and set it on a date.
 */
export function setTimeOnDate(date: Date, timeStr: string): Date {
    const result = new Date(date);
    let hours: number;
    let minutes: number;

    const trimmedTime = timeStr.trim();

    if (trimmedTime.includes('AM') || trimmedTime.includes('PM')) {
        // 12-hour format: "9:30 AM"
        const [timePart, ampm] = trimmedTime.split(/\s*(AM|PM)/i);
        const [h, m] = timePart.split(':').map(Number);
        hours = ampm.toUpperCase() === 'PM' && h !== 12 ? h + 12 : (ampm.toUpperCase() === 'AM' && h === 12 ? 0 : h);
        minutes = m || 0;
    } else {
        // 24-hour format: "09:30"
        [hours, minutes] = trimmedTime.split(':').map(Number);
    }

    result.setHours(hours, minutes, 0, 0);
    return result;
}

/**
 * Add opacity to a hex color string.
 * Returns rgba() format.
 */
export function addOpacityToColor(color: string, opacity: number): string {
    // If already rgba, extract and modify
    if (color.startsWith('rgba')) {
        const rgb = color.match(/rgba?\(([^)]+)\)/)?.[1];
        if (rgb) {
            const [r, g, b] = rgb.split(',').map(v => v.trim());
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
    }

    // Convert hex to rgba
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Fallback
    return color;
}
