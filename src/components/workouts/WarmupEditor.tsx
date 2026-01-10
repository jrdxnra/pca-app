"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { ClientWorkoutWarmup } from '@/lib/types';

interface WarmupEditorProps {
  warmup: ClientWorkoutWarmup;
  index: number;
  onUpdate: (text: string) => void;
  onRemove: () => void;
  error?: string;
}

export function WarmupEditor({
  warmup,
  index,
  onUpdate,
  onRemove,
  error
}: WarmupEditorProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700">
        {warmup.ordinal}
      </div>
      
      <div className="flex-1">
        <Input
          value={warmup.text}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="e.g., 5 minutes light cardio"
          className={error ? 'border-red-500' : ''}
        />
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
