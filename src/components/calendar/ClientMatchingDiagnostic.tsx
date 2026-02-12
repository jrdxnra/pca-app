/**
 * Client Email Matching Diagnostic Component
 * 
 * Displays calendar event to client matching statistics and results.
 * Shows which events were successfully matched to clients via guest emails,
 * and which events have guest emails but no matching client.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  Mail,
  AlertTriangle,
  TrendingUp,
  Info,
  RefreshCw
} from 'lucide-react';
import { useClientMatching } from '@/hooks/useClientMatching';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { format, subDays, addDays } from 'date-fns';
import { fetchCalendarEvents } from '@/lib/google-calendar/api-client';
import { SessionTypeBadge } from '@/components/calendar/SessionTypeBadge';

export function ClientMatchingDiagnostic() {
  const { matchEventsToAll, getUnmatched, getExcluded, getStats, extractEmails } = useClientMatching();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'matched' | 'unmatched' | 'excluded'>('overview');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch events for a focused 14-day window (last 7 days + next 7 days)
  // This ensures we get recent synced events with extendedProperties
  useEffect(() => {
    const fetchRecentEvents = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const start = subDays(now, 7);
        const end = addDays(now, 60); // Check 2 months ahead for future sessions

        const fetchedEvents = await fetchCalendarEvents(start, end, 'primary');
        console.log('[ClientMatchingDiagnostic] Fetched events for matching:', fetchedEvents.length);
        setEvents(fetchedEvents);
      } catch (error) {
        console.error('[ClientMatchingDiagnostic] Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentEvents();
  }, []);

  // Debug: Log events received
  console.log('[ClientMatchingDiagnostic] Received events count:', events.length);
  if (events.length > 0) {
    console.log('[ClientMatchingDiagnostic] First event sample:', events[0]);
    console.log('[ClientMatchingDiagnostic] First event has extendedProperties?', 'extendedProperties' in events[0]);
    if ('extendedProperties' in events[0]) {
      console.log('[ClientMatchingDiagnostic] extendedProperties:', events[0].extendedProperties);
    }
    console.log('[ClientMatchingDiagnostic] guestEmails value:', events[0].guestEmails);
    console.log('[ClientMatchingDiagnostic] originalEventId value:', events[0].originalEventId);
    console.log('[ClientMatchingDiagnostic] First event keys:', Object.keys(events[0]));
  }

  // Calculate matching statistics (use multi-client matching)
  const stats = getStats(events);
  console.log('[ClientMatchingDiagnostic] Stats:', stats);
  const multiMatches = matchEventsToAll(events);
  const unmatched = getUnmatched(events);
  const excluded = getExcluded(events);

  // Get matched events
  const matchedEvents = events.filter(e => multiMatches.has(e.id));

  const formatEventTime = (event: GoogleCalendarEvent | Record<string, unknown>) => {
    try {
      if (!('start' in event)) return 'Invalid date';
      const start = event.start as GoogleCalendarEvent['start'];
      const startDate = new Date(start.dateTime || start.date || '');
      return format(startDate, 'MMM d, h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Email Matching
            </CardTitle>
            <CardDescription>
              Calendar events matched to clients via guest email metadata (last 14 days)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fetchRecentEvents = async () => {
                  try {
                    setLoading(true);
                    const now = new Date();
                    const start = subDays(now, 7);
                    const end = addDays(now, 60); // Check 2 months ahead

                    const fetchedEvents = await fetchCalendarEvents(start, end, 'primary');
                    setEvents(fetchedEvents);
                  } catch (error) {
                    console.error('[ClientMatchingDiagnostic] Error refreshing:', error);
                  } finally {
                    setLoading(false);
                  }
                };
                fetchRecentEvents();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Badge variant={stats.matchRate >= 80 ? 'default' : stats.matchRate >= 50 ? 'secondary' : 'destructive'}>
              {stats.matchRate.toFixed(0)}% Match Rate
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Total Events
            </p>
            <p className="text-2xl font-bold">{stats.totalEvents}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              With Attendees
            </p>
            <p className="text-2xl font-bold">{stats.eventsWithAttendees}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Matched
            </p>
            <p className="text-2xl font-bold text-green-600">{stats.matchedEvents}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              Unmatched
            </p>
            <p className="text-2xl font-bold text-red-600">{stats.unmatchedEvents}</p>
          </div>
        </div>

        {/* Info Alert */}
        {stats.eventsWithAttendees === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Guest Email Metadata Found</AlertTitle>
            <AlertDescription>
              Calendar events don&apos;t have guest email metadata yet. Make sure your work calendar sync script is running
              and that events have been synced to jrdxn.ra@gmail.com with the guest_emails property.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs for detailed view */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'overview' | 'matched' | 'unmatched' | 'excluded')}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="matched" className="relative">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Matched ({stats.matchedEvents})
            </TabsTrigger>
            <TabsTrigger value="unmatched" className="relative">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Unmatched ({stats.unmatchedEvents})
            </TabsTrigger>
            <TabsTrigger value="excluded" className="relative">
              <XCircle className="h-4 w-4 mr-2" />
              Excluded ({excluded.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How It Works</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Your work calendar events are synced to your personal calendar (jrdxn.ra@gmail.com)
                  with hidden metadata containing guest email addresses.
                </p>
                <p>
                  This diagnostic tool matches those guest emails against your client database
                  to automatically identify which client each event is for.
                </p>
              </AlertDescription>
            </Alert>

            {stats.matchRate > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Sample Matched Events</h4>
                <div className="space-y-2">
                  {matchedEvents.slice(0, 3).map(event => {
                    const multiMatch = multiMatches.get(event.id)!;
                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{event.summary}</p>
                          <p className="text-sm text-muted-foreground">{formatEventTime(event)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <SessionTypeBadge
                            sessionType={multiMatch.sessionType}
                            clientCount={multiMatch.matches.length}
                          />
                          {multiMatch.matches.map(m => (
                            <Badge key={m.clientId} variant="outline">{m.clientName}</Badge>
                          ))}
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="matched" className="space-y-4 mt-4">
            {matchedEvents.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No matched events yet. Events need to have attendee names and matching client names.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {matchedEvents.map(event => {
                  const multiMatch = multiMatches.get(event.id)!;
                  const allAttendeeNames = extractEmails(event);
                  const matchedNames = new Set(multiMatch.matches.map(m => m.matchedName));
                  const otherAttendees = allAttendeeNames.filter(name => !matchedNames.has(name));

                  return (
                    <div key={event.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{event.summary}</p>
                          <p className="text-sm text-muted-foreground">{formatEventTime(event)}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      </div>

                      {/* Session type badge */}
                      <div className="flex items-center gap-2">
                        <SessionTypeBadge
                          sessionType={multiMatch.sessionType}
                          clientCount={multiMatch.matches.length}
                        />
                        <span className="text-xs text-muted-foreground">
                          {multiMatch.totalAttendees} total attendee{multiMatch.totalAttendees > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Matched clients */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Matched Clients:</p>
                        {multiMatch.matches.map(match => (
                          <div key={match.clientId} className="flex items-center gap-2 flex-wrap pl-2">
                            <Badge variant="default">{match.clientName}</Badge>
                            <span className="text-xs text-muted-foreground">matched to</span>
                            <Badge variant="outline" className="text-xs">
                              {match.matchedName}
                            </Badge>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {match.confidence}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {/* Other attendees not matched */}
                      {otherAttendees.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Other attendees: {otherAttendees.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unmatched" className="space-y-4 mt-4">
            {unmatched.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  All valid session events with attendees have been matched! 🎉
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Unmatched Sessions</AlertTitle>
                  <AlertDescription>
                    These are valid session events (PT, Training, Class, etc.) with no matching clients in your database.
                    This includes group classes where you&apos;re the only listed attendee - you can still link workouts to these manually.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  {unmatched.map(({ event, attendeeNames }) => {
                    const eventId = 'id' in event ? String(event.id) : `unknown-${Math.random()}`;
                    const eventSummary = 'summary' in event ? String(event.summary) : 'Untitled Event';

                    return (
                      <div key={eventId} className="p-4 border border-red-200 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{eventSummary}</p>
                            <p className="text-sm text-muted-foreground">{formatEventTime(event)}</p>
                          </div>
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Attendees:</p>
                          {attendeeNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attendeeNames.map((name, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No clients listed (group class)
                            </p>
                          )}
                        </div>
                        {attendeeNames.length > 0 && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Copy first attendee name to clipboard
                                if (attendeeNames.length > 0) {
                                  navigator.clipboard.writeText(attendeeNames[0]);
                                }
                              }}
                            >
                              Copy Name to Add Client
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="excluded" className="space-y-4 mt-4">
            {excluded.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  No events excluded. All events with attendees are valid sessions.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Excluded Events</AlertTitle>
                  <AlertDescription>
                    These events have attendees but were filtered out because they don&apos;t match session keywords
                    or contain exclusion keywords (hold, meeting, admin, etc.).
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  {excluded.map(({ event, reason }) => {
                    const attendeeNames = extractEmails(event);
                    return (
                      <div key={'id' in event ? String(event.id) : Math.random()} className="p-4 border border-orange-200 bg-orange-50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{'summary' in event ? String(event.summary) : 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{formatEventTime(event)}</p>
                          </div>
                          <XCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        </div>
                        <Badge variant="outline" className="bg-white">{reason}</Badge>
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium">Attendees:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attendeeNames.map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
