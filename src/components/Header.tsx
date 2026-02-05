"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Navigation, HamburgerMenu } from './Navigation';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { toastSuccess, toastError } from '@/components/ui/toaster';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);
  // Disable sticky header on programs/schedule pages
  const isSchedulePage = pathname?.startsWith('/programs');

  const { fetchEvents, isGoogleCalendarConnected, checkGoogleCalendarConnection } = useCalendarStore();

  const handleCalendarSync = async () => {
    // If not connected, navigate to configure page
    if (!isGoogleCalendarConnected) {
      router.push('/configure?tab=app');
      return;
    }

    // Otherwise, perform sync
    setIsSyncing(true);

    try {
      // Fetch events for a wide range (current month ± 2 weeks)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 14);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 28);
      endDate.setHours(23, 59, 59, 999);

      await fetchEvents({ start: startDate, end: endDate }, true); // force refresh

      // Re-check connection status after sync to catch any auth errors
      await checkGoogleCalendarConnection();
      const stillConnected = useCalendarStore.getState().isGoogleCalendarConnected;

      if (stillConnected) {
        toastSuccess('Calendar synced successfully!');
      } else {
        toastError('Calendar sync failed - authentication expired. Please reconnect in Configure → App Config.');
      }
    } catch (error) {
      console.error('Calendar sync error:', error);

      // Re-check connection status to catch auth errors
      await checkGoogleCalendarConnection();
      const stillConnected = useCalendarStore.getState().isGoogleCalendarConnected;

      if (!stillConnected) {
        toastError('Google Calendar authentication expired. Please reconnect in Configure → App Config.');
      } else {
        toastError('Failed to sync calendar. Please try again.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <header className={`${isSchedulePage ? 'relative' : 'fixed top-0 left-0 right-0'} z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`}>
        <div className="container mx-auto px-4">
          <div className="flex h-12 items-center justify-between">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center gap-6">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
                  PC+
                </div>
                <span className="text-xl font-bold hidden sm:inline">Performance Coach + App</span>
              </Link>

              {/* Main Navigation - Left aligned */}
              <Navigation />
            </div>

            {/* Right side - Sync Button and Hamburger Menu */}
            <div className="flex items-center gap-2">
              {/* Calendar Sync Button - Green when connected, Red when not */}
              <button
                onClick={handleCalendarSync}
                disabled={isSyncing}
                className={`p-2 rounded-md transition-colors disabled:opacity-50 ${isGoogleCalendarConnected
                  ? 'hover:bg-green-100 text-green-600 hover:text-green-700'
                  : 'hover:bg-red-100 text-red-600 hover:text-red-700'
                  }`}
                title={isGoogleCalendarConnected ? "Sync Google Calendar (Connected)" : "Click to connect Google Calendar"}
              >
                {isSyncing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CalendarClock className="h-5 w-5" />
                )}
              </button>

              {/* Hamburger Menu */}
              <HamburgerMenu />
            </div>
          </div>
        </div>
      </header>
      {/* Spacer to prevent content jump when fixed */}
      {!isSchedulePage && <div className="h-12" />}
    </>
  );
}
