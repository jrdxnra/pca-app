"use client";

import { useEffect, useMemo, useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Circle, Lock, CalendarCheck2, Users, ArrowRight } from 'lucide-react';

export type SetupHubTab = 'calendar' | 'clients' | 'review';
export type SetupHubLayout = 'dialog' | 'page';

interface SetupHubFlowProps {
  calendarReady: boolean;
  hasClients: boolean;
  onConnectCalendar: () => void;
  onAddClients: () => void;
  selectedCalendarLabel?: string;
  layout?: SetupHubLayout;
  showHeader?: boolean;
  onFinish?: () => void;
  onDismiss?: () => void;
  onRemindLater?: () => void;
}

interface StepSummaryProps {
  title: string;
  description: string;
  complete: boolean;
  icon: ReactNode;
  locked?: boolean;
  layout: SetupHubLayout;
}

const StepSummaryCard = ({ title, description, complete, icon, locked, layout }: StepSummaryProps) => {
  const StatusIcon = () => {
    if (locked) {
      return <Lock className="h-4 w-4 text-gray-400" />;
    }
    return complete ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <Circle className="h-5 w-5 text-gray-300" />
    );
  };

  const baseClasses = layout === 'dialog'
    ? 'rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm'
    : 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm';

  return (
    <div className={`flex flex-col gap-3 ${baseClasses}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <StatusIcon />
        {title}
      </div>
      <div className="flex items-start gap-3 text-sm text-slate-600">
        <div className="rounded-full bg-slate-100 p-2 text-slate-500">
          {icon}
        </div>
        <p className="leading-snug">{description}</p>
      </div>
    </div>
  );
};

export function SetupHubFlow({
  calendarReady,
  hasClients,
  onConnectCalendar,
  onAddClients,
  selectedCalendarLabel,
  layout = 'page',
  showHeader = true,
  onFinish,
  onDismiss,
  onRemindLater,
}: SetupHubFlowProps) {
  const [activeTab, setActiveTab] = useState<SetupHubTab>('calendar');

  useEffect(() => {
    if (calendarReady && !hasClients) {
      setActiveTab('clients');
      return;
    }

    if (calendarReady && hasClients) {
      setActiveTab('review');
      return;
    }

    setActiveTab('calendar');
  }, [calendarReady, hasClients]);

  const reviewCopy = useMemo(() => {
    if (!calendarReady) {
      return 'Connect your shared Google Calendar to unlock the client step.';
    }
    if (!hasClients) {
      return 'Add at least one client so we can match events to real people.';
    }
    return 'All checkpoints complete. You are clear to run PCA with live data!';
  }, [calendarReady, hasClients]);

  const containerClasses = layout === 'dialog' ? 'space-y-6' : 'space-y-8';
  const tabSurfaceClasses = layout === 'dialog'
    ? 'bg-white rounded-3xl p-5 text-slate-900 shadow-inner'
    : 'bg-white rounded-3xl p-6 text-slate-900 shadow-sm border border-slate-100';
  const tabsListClasses = layout === 'dialog'
    ? 'grid grid-cols-3 rounded-full bg-white/10'
    : 'grid grid-cols-3 rounded-full bg-slate-100 text-slate-600';

  const handleFinish = () => {
    if (!calendarReady || !hasClients) return;
    if (onFinish) {
      onFinish();
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleRemindLater = () => {
    if (onRemindLater) {
      onRemindLater();
      return;
    }
    handleDismiss();
  };

  const renderReviewActions = () => {
    if (layout === 'dialog') {
      return (
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleFinish} disabled={!calendarReady || !hasClients}>
            Finish Setup
          </Button>
          <Button variant="ghost" onClick={handleRemindLater}>
            Remind me later
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleFinish} disabled={!calendarReady || !hasClients}>
          Go to Schedule
        </Button>
        <Button onClick={handleDismiss}>
          Back to Configure
        </Button>
      </div>
    );
  };

  return (
    <div className={containerClasses}>
      {showHeader && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Coach Setup</p>
          <h3 className="text-3xl font-semibold text-slate-900">Coach Setup Hub</h3>
          <p className="text-slate-600">Tackle these checkpoints once. PCA will keep everything synced afterward.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StepSummaryCard
          title="1 · Connect calendar"
          description={calendarReady ? `Connected to ${selectedCalendarLabel || 'selected calendar'}` : 'Use your secondary Google account and pick the shared work calendar.'}
          complete={calendarReady}
          icon={<CalendarCheck2 className="h-4 w-4" />}
          layout={layout}
        />
        <StepSummaryCard
          title="2 · Add clients"
          description={hasClients ? 'Clients are in—events can match immediately.' : 'Add your roster so PCA knows who is on the schedule.'}
          complete={hasClients}
          icon={<Users className="h-4 w-4" />}
          locked={!calendarReady}
          layout={layout}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SetupHubTab)} className="space-y-4">
        <TabsList className={tabsListClasses}>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="clients" disabled={!calendarReady}>
            Clients
          </TabsTrigger>
          <TabsTrigger value="review" disabled={!calendarReady || !hasClients}>
            Review
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className={tabSurfaceClasses}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              Step 1
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <h4 className="text-xl font-semibold text-slate-900">Connect the shared Google Calendar</h4>
            <p className="text-sm text-slate-600">
              Sign into PCA with your secondary Gmail, head to Configure → Calendar Connection, and choose the shared work calendar (should end with
              <code className="rounded bg-slate-100 px-1 py-0.5 ml-1">@group.calendar.google.com</code>). Once connected, PCA will stream sessions directly from that source.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onConnectCalendar} size="sm">
                Open Calendar Settings
              </Button>
              {calendarReady && (
                <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">
                  Connected
                </Badge>
              )}
            </div>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Use the secondary account only (no corporate logins).</li>
              <li>Share the work calendar with "Make changes to events" so PCA can tag metadata.</li>
              <li>Pick the shared calendar in the selector—Primary will not include your sessions.</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="clients" className={tabSurfaceClasses}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              Step 2
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <h4 className="text-xl font-semibold text-slate-900">Add your client roster</h4>
            <p className="text-sm text-slate-600">
              Head to the Clients tab and add everyone you coach. Start with the must-have names—the calendar matching engine only works when it can see client names or emails
              in the roster.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onAddClients} size="sm" variant={hasClients ? 'outline' : 'default'} disabled={!calendarReady}>
                {hasClients ? 'View Clients' : 'Add Clients'}
              </Button>
              {hasClients && (
                <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">
                  Roster Ready
                </Badge>
              )}
            </div>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Minimum: name + email. Extras (phone, goals) help future automation.</li>
              <li>Use the import helper or add manually—it takes seconds per athlete.</li>
              <li>Once saved, refresh the Schedule view to see matches roll in.</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="review" className={tabSurfaceClasses}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
              Step 3
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <h4 className="text-xl font-semibold text-slate-900">Review & launch</h4>
            <p className="text-sm text-slate-600">{reviewCopy}</p>
            <div className="grid gap-3">
              <div className={`flex items-center justify-between rounded-2xl border p-3 ${calendarReady ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                <span>Calendar connected</span>
                {calendarReady ? <CheckCircle2 className="h-5 w-5" /> : <ArrowRight className="h-4 w-4" />}
              </div>
              <div className={`flex items-center justify-between rounded-2xl border p-3 ${hasClients ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                <span>Clients added</span>
                {hasClients ? <CheckCircle2 className="h-5 w-5" /> : <ArrowRight className="h-4 w-4" />}
              </div>
            </div>
            {renderReviewActions()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
