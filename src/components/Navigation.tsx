"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getActiveMembership, MASTER_UID } from '@/lib/firebase/services/memberships';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  Users,
  Calendar,
  Home,
  Zap,
  Wrench,
  Settings,
  Activity,
  LogOut,
  Shield,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  requireMaster?: boolean;
  requireSkillSandboxAccess?: boolean;
};

type NavigationAccess = {
  canAccessSkillSandbox: boolean;
  isMasterUser: boolean;
};

const mainNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Schedule', href: '/programs', icon: Calendar },
  { name: 'Builder', href: '/workouts/builder', icon: Wrench },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Movements', href: '/movements', icon: Activity },
  { name: 'Planner', href: '/admin/planner', icon: Calendar },
  { name: 'Workout Skills', href: '/admin/skill-sandbox', icon: Zap, requireSkillSandboxAccess: true },
];

const menuNavigation: NavigationItem[] = [
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Configuration', href: '/configure', icon: Settings },
  { name: 'App Status', href: '/health', icon: Activity, requireMaster: true },
];

export function useNavigationAccess(): NavigationAccess {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<NavigationAccess>({
    canAccessSkillSandbox: false,
    isMasterUser: false,
  });

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      if (loading) return;

      if (!user) {
        if (!cancelled) {
          setAccess({
            canAccessSkillSandbox: false,
            isMasterUser: false,
          });
        }
        return;
      }

      const isMasterUser = user.uid === MASTER_UID;

      if (isMasterUser) {
        if (!cancelled) {
          setAccess({
            canAccessSkillSandbox: true,
            isMasterUser: true,
          });
        }
        return;
      }

      try {
        const membership = await getActiveMembership(user.uid);
        if (!cancelled) {
          setAccess({
            canAccessSkillSandbox: membership?.role === 'owner' || membership?.role === 'coach',
            isMasterUser: false,
          });
        }
      } catch (error) {
        console.error('Error loading skill sandbox access:', error);
        if (!cancelled) {
          setAccess({
            canAccessSkillSandbox: false,
            isMasterUser: false,
          });
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return access;
}

function filterNavigation(items: NavigationItem[], isMasterUser: boolean, canAccessSkillSandbox: boolean) {
  return items.filter((item) => {
    if (item.requireMaster && !isMasterUser) {
      return false;
    }

    if (item.requireSkillSandboxAccess && !canAccessSkillSandbox) {
      return false;
    }

    return true;
  });
}

// Main Navigation - Left aligned with logo
export function Navigation({ access }: { access: NavigationAccess }) {
  const pathname = usePathname();
  const isPlannerPage = pathname?.startsWith('/admin/planner');
  const { canAccessSkillSandbox, isMasterUser } = access;
  const navItems = filterNavigation(mainNavigation, isMasterUser, canAccessSkillSandbox);

  return (
    <nav
      className={cn(
        'items-center space-x-1 md:space-x-2 lg:space-x-4',
        isPlannerPage
          ? 'flex min-w-0 overflow-x-auto whitespace-nowrap'
          : 'hidden md:flex'
      )}
    >
      {navItems.map((item) => {
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

export function ProfileMenu({ access }: { access: NavigationAccess }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { canAccessSkillSandbox, isMasterUser } = access;
  const visibleMainNavigation = filterNavigation(mainNavigation, isMasterUser, canAccessSkillSandbox);
  const visibleMenuNavigation = filterNavigation(menuNavigation, isMasterUser, canAccessSkillSandbox);

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
            <Link href="/profile" className="block px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground border-b mb-1 transition-colors group cursor-pointer" onClick={() => setIsOpen(false)}>
              <div className="font-medium truncate group-hover:underline">{displayName}</div>
              <div className="text-xs text-muted-foreground group-hover:text-foreground truncate transition-colors">{user.email}</div>
            </Link>

            {/* Mobile-Only Main Navigation */}
            <div className="md:hidden">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Menu
              </div>
              {visibleMainNavigation.map((item) => {
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
            {visibleMenuNavigation.map((item) => {
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

            {/* Admin Tab - Only for Master Admin */}
            {isMasterUser && (
              <>
                <div className="h-px bg-border my-1 mx-2" />
                <Link
                  href="/admin"
                  className={cn(
                    'flex w-full items-center px-2 py-2 text-sm rounded-sm transition-colors',
                    pathname === '/admin'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Shield className="mr-3 h-4 w-4" />
                  Admin
                </Link>
              </>
            )}

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
