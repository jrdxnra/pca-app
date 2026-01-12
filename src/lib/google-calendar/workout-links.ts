/**
 * Utility functions for generating workout links to add to Google Calendar event descriptions
 */

/**
 * Generate workout links for Google Calendar event description
 * Returns both client view link and coach edit link
 */
export function generateWorkoutLinks(
  workoutId: string,
  clientId: string,
  date: string | Date,
  baseUrl?: string
): { clientLink: string; coachLink: string; descriptionText: string } {
  // Use provided baseUrl or default to current origin
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  
  // Format date as YYYY-MM-DD
  const dateStr = typeof date === 'string' 
    ? date 
    : date.toISOString().split('T')[0];
  
  // Client view link (read-only)
  const clientLink = `${base}/workouts/view?workoutId=${workoutId}&client=${clientId}&date=${dateStr}`;
  
  // Coach edit link (full access)
  const coachLink = `${base}/workouts/builder?workoutId=${workoutId}&client=${clientId}&date=${dateStr}`;
  
  // Format as HTML links for Google Calendar description (Google Calendar supports HTML)
  const descriptionText = `\n\n---\n📋 <a href="${clientLink}">View Your Workout</a>\n✏️ <a href="${coachLink}">Edit Workout (Coach)</a>`;
  
  return {
    clientLink,
    coachLink,
    descriptionText,
  };
}

/**
 * Extract workout links from event description
 * Useful for parsing existing descriptions
 */
export function extractWorkoutLinks(description: string): {
  clientLink?: string;
  coachLink?: string;
} {
  // Try HTML format first: <a href="...">View Your Workout</a>
  let clientLinkMatch = description.match(/<a href="([^"]+)"[^>]*>View Your Workout<\/a>/);
  let coachLinkMatch = description.match(/<a href="([^"]+)"[^>]*>Edit Workout[^<]*<\/a>/);
  
  // Fall back to plain text format: View Your Workout: https://...
  if (!clientLinkMatch) {
    clientLinkMatch = description.match(/View Your Workout:\s*(https?:\/\/[^\s\n]+)/);
  }
  if (!coachLinkMatch) {
    coachLinkMatch = description.match(/Edit Workout:\s*(https?:\/\/[^\s\n]+)/);
  }
  
  return {
    clientLink: clientLinkMatch?.[1],
    coachLink: coachLinkMatch?.[1],
  };
}

/**
 * Add or update workout links in an existing event description
 * Preserves existing description content
 */
export function addWorkoutLinksToDescription(
  existingDescription: string,
  workoutId: string,
  clientId: string,
  date: string | Date,
  baseUrl?: string
): string {
  // Remove existing workout links if present (both old plain text and new HTML formats)
  let cleanedDescription = existingDescription
    .replace(/\n\n---\n📋[\s\S]*?View Your Workout[\s\S]*?\n✏️[\s\S]*?Edit Workout[\s\S]*$/, '')
    .replace(/\n\n---\nView Your Workout:[\s\S]*?\nEdit Workout:[\s\S]*$/, '')
    .trim();
  
  // Generate new links
  const { descriptionText } = generateWorkoutLinks(workoutId, clientId, date, baseUrl);
  
  // Append new links
  return cleanedDescription + descriptionText;
}





























