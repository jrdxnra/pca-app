"use client";

import { useNavigationLoading } from '@/hooks/useNavigationLoading';

/**
 * Navigation Loader
 * 
 * Shows a loading overlay during route transitions.
 */
export function NavigationLoader() {
  const isLoading = useNavigationLoading();
  
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
