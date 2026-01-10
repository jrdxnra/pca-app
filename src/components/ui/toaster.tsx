"use client";

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Global toast state
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach(listener => listener([...toasts]));
}

/**
 * Show a toast notification
 */
export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newToast: Toast = { id, message, type, duration };
  
  toasts = [...toasts, newToast];
  notifyListeners();
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  
  return id;
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
}

/**
 * Helper functions for common toast types
 */
export const toastSuccess = (message: string, duration?: number) => toast(message, 'success', duration);
export const toastError = (message: string, duration?: number) => toast(message, 'error', duration ?? 6000);
export const toastWarning = (message: string, duration?: number) => toast(message, 'warning', duration);
export const toastInfo = (message: string, duration?: number) => toast(message, 'info', duration);

/**
 * Hook to subscribe to toast changes
 */
function useToasts() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);
  
  useEffect(() => {
    toastListeners.push(setCurrentToasts);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setCurrentToasts);
    };
  }, []);
  
  return currentToasts;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

/**
 * Toast container component - renders all active toasts
 */
export function Toaster() {
  const currentToasts = useToasts();
  
  if (currentToasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {currentToasts.map((t) => {
        const Icon = icons[t.type];
        
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right-full duration-300',
              styles[t.type]
            )}
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconStyles[t.type])} />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Toaster;





