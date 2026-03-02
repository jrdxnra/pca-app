'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SetupHubFlow } from '@/components/onboarding/SetupHubFlow';

interface SetupHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarReady: boolean;
  hasClients: boolean;
  onConnectCalendar: () => void;
  onAddClients: () => void;
  selectedCalendarLabel?: string;
}

export function SetupHubDialog({
  open,
  onOpenChange,
  calendarReady,
  hasClients,
  onConnectCalendar,
  onAddClients,
  selectedCalendarLabel,
}: SetupHubDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-0 bg-slate-950 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">Coach Setup Hub</DialogTitle>
          <DialogDescription className="text-slate-300">
            Tackle these checkpoints once. PCA will stay in sync after that.
          </DialogDescription>
        </DialogHeader>
        <SetupHubFlow
          calendarReady={calendarReady}
          hasClients={hasClients}
          onConnectCalendar={onConnectCalendar}
          onAddClients={onAddClients}
          selectedCalendarLabel={selectedCalendarLabel}
          layout="dialog"
          showHeader={false}
          onFinish={() => onOpenChange(false)}
          onDismiss={() => onOpenChange(false)}
          onRemindLater={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
