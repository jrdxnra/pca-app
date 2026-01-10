"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Dumbbell, 
  Calendar, 
  Home,
  Menu,
  X,
  Zap,
  Wrench,
  Settings
} from 'lucide-react';
import { useState } from 'react';

const mainNavigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Schedule', href: '/programs', icon: Calendar },
  { name: 'Builder', href: '/workouts/builder', icon: Wrench },
  { name: 'Clients', href: '/clients', icon: Users },
];

const menuNavigation = [
  { name: 'Workouts', href: '/workouts', icon: Zap },
  { name: 'Movements', href: '/movements', icon: Dumbbell },
  { name: 'Configuration', href: '/configure', icon: Settings },
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

// Hamburger Menu - Right aligned
export function HamburgerMenu() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);

  return (
    <>
      <div 
        className="relative"
        onMouseEnter={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setDesktopMenuOpen(true);
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setDesktopMenuOpen(false);
          }
        }}
      >
        <Button
          variant="ghost"
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              setMobileMenuOpen(!mobileMenuOpen);
            }
          }}
          className="relative h-12 w-12 p-0 font-bold flex items-center justify-center"
        >
          <div className="w-full h-full flex items-center justify-center">
            {(mobileMenuOpen || desktopMenuOpen) ? (
              <X style={{ width: '1.75rem', height: '1.75rem', strokeWidth: 3 }} />
            ) : (
              <Menu style={{ width: '1.75rem', height: '1.75rem', strokeWidth: 3 }} />
            )}
          </div>
        </Button>

        {/* Desktop Dropdown Menu */}
        <div 
          className={cn(
            "hidden md:block absolute top-full right-0 w-56 bg-background border rounded-lg shadow-lg z-50 transition-all duration-200",
            desktopMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          style={{ marginTop: '-12px', paddingTop: '12px' }}
        >
          <div className="py-2">
            {menuNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 bg-black/20 z-40" 
            onClick={() => setMobileMenuOpen(false)}
          />
          
          <div className="md:hidden fixed top-16 left-0 right-0 bg-background border-b shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-2">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors w-full',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              {menuNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-colors w-full',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
