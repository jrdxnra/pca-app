"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Users,
  Dumbbell,
  Calendar,
  Home,
  Zap,
  Wrench,
  Settings,
  Activity,
  LogOut,
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Schedule', href: '/programs', icon: Calendar },
  { name: 'Builder', href: '/workouts/builder', icon: Wrench },
  { name: 'Clients', href: '/clients', icon: Users },
];

const menuNavigation = [
  { name: 'Workouts', href: '/workouts', icon: Zap },
  { name: 'Movements', href: '/movements', icon: Dumbbell },
  { name: 'Configuration', href: '/configure', icon: Settings },
  { name: 'App Status', href: '/health', icon: Activity },
];

// Main Navigation - Left aligned with logo
export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1 md:space-x-2 lg:space-x-4">
      {mainNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center space-x-1 md:space-x-1.5 lg:space-x-2 px-2 md:px-2.5 lg:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ProfileMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    // Dynamic import to avoid SSR issues with Firebase
    import('@/lib/firebase/config').then(({ auth }) => {
      unsubscribe = auth.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { auth } = await import('@/lib/firebase/config');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
      setIsOpen(false);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="ml-2 h-10 w-10 animate-pulse rounded-full bg-muted" />
    );
  }

  // Not signed in state
  if (!user) {
    return (
      <Button
        onClick={handleSignIn}
        variant="outline"
        size="sm"
        className="ml-2 gap-2"
      >
        Sign In
      </Button>
    );
  }

  // Signed in state
  const photoUrl = user.photoURL;
  const displayName = user.displayName || user.email || 'User';
  const initial = displayName[0]?.toUpperCase() || 'U';

  return (
    <div className="relative ml-2">
      <Button
        variant="ghost"
        className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-muted-foreground/20"
        onClick={() => setIsOpen(!isOpen)}
        title={displayName}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Profile"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground font-medium text-lg">
            {initial}
          </div>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 rounded-md border bg-background shadow-lg z-50 p-1 flex flex-col max-h-[80vh] overflow-y-auto">
            {/* User Info */}
            <div className="px-3 py-2 text-sm text-foreground border-b mb-1">
              <div className="font-medium truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>

            {/* Mobile-Only Main Navigation */}
            <div className="md:hidden">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Menu
              </div>
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex w-full items-center px-2 py-2 text-sm rounded-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="h-px bg-border my-1 mx-2" />
            </div>

            {/* Secondary Navigation (Workouts, Config, etc.) */}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider md:hidden">
              Tools
            </div>
            {menuNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex w-full items-center px-2 py-2 text-sm rounded-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}

            <div className="h-px bg-border my-1" />

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center px-2 py-2 text-sm rounded-sm hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
