/**
 * Timezone utilities
 * Manages app timezone settings (defaults to America/Los_Angeles)
 */

const TIMEZONE_KEY = 'pca-app-timezone';
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Get the configured app timezone
 */
export function getAppTimezone(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_TIMEZONE;
  }
  
  const stored = localStorage.getItem(TIMEZONE_KEY);
  return stored || DEFAULT_TIMEZONE;
}

/**
 * Set the app timezone
 */
export function setAppTimezone(timezone: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem(TIMEZONE_KEY, timezone);
}

/**
 * Get the user's browser timezone
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if the browser timezone differs from the app timezone
 */
export function hasTimezoneChanged(): boolean {
  const appTimezone = getAppTimezone();
  const browserTimezone = getBrowserTimezone();
  return appTimezone !== browserTimezone;
}

/**
 * Common timezone options for coaches
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

/**
 * Format a timezone value to a readable label
 */
export function formatTimezoneLabel(timezone: string): string {
  const found = COMMON_TIMEZONES.find(tz => tz.value === timezone);
  if (found) return found.label;
  
  // Fallback: format the timezone string nicely
  return timezone.replace(/_/g, ' ').replace(/\//g, ' - ');
}


