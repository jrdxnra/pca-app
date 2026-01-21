/**
 * Session Type Badge Component
 * 
 * Displays a styled badge indicating the session type:
 * - 1-on-1: Single client session
 * - Buddy: Two clients
 * - Group: Three or more clients
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { SessionType } from '@/lib/services/clientMatching';
import { Users } from 'lucide-react';

interface SessionTypeBadgeProps {
  sessionType: SessionType;
  clientCount?: number;
  showIcon?: boolean;
  variant?: 'default' | 'compact';
}

export function SessionTypeBadge({ 
  sessionType, 
  clientCount,
  showIcon = false,
  variant = 'default'
}: SessionTypeBadgeProps) {
  const getSessionConfig = () => {
    switch (sessionType) {
      case '1-on-1':
        return {
          variant: 'default' as const,
          label: variant === 'compact' ? '1:1' : '1-on-1',
          color: 'bg-blue-500 hover:bg-blue-600'
        };
      case 'buddy':
        return {
          variant: 'secondary' as const,
          label: variant === 'compact' ? 'Buddy' : 'Buddy (2)',
          color: 'bg-purple-500 hover:bg-purple-600'
        };
      case 'group':
        return {
          variant: 'outline' as const,
          label: variant === 'compact' ? 'Group' : `Group (${clientCount || '3+'})`,
          color: 'bg-green-500 hover:bg-green-600'
        };
    }
  };

  const config = getSessionConfig();

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {showIcon && <Users className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
