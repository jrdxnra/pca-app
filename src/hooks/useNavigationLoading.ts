"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Hook to track navigation loading state
 * 
 * Shows loading state when navigating between routes.
 * Uses pathname and searchParams changes to detect navigation.
 */
export function useNavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  useEffect(() => {
    // If pathname changed, we're navigating
    if (pathname !== prevPath) {
      setIsLoading(true);
      setPrevPath(pathname);
      
      // Clear loading after a short delay (navigation should be fast)
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [pathname, prevPath]);

  // Also track searchParams changes
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return isLoading;
}
