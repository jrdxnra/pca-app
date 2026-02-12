"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Columns } from 'lucide-react';

interface ColumnVisibilityToggleProps {
  visibleColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  availableColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onToggle: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
}

export function ColumnVisibilityToggle({
  visibleColumns,
  availableColumns,
  onToggle
}: ColumnVisibilityToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Column labels for display
  const columnLabels = {
    tempo: 'Tempo',
    distance: 'Distance',
    rpe: 'RPE',
    percentage: 'Percentage'
  };

  // Get available columns that can be toggled
  const toggleableColumns = Object.entries(availableColumns)
    .filter(([_, isAvailable]) => isAvailable)
    .map(([column]) => column as keyof typeof visibleColumns);



  // Don't render if no columns are available to toggle
  if (toggleableColumns.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-6 w-6 text-gray-400 hover:text-indigo-600 transition-all hover:scale-110 bg-transparent border-0"
        title="Toggle Column Visibility"
      >
        <Columns className="h-6 w-6" />
      </Button>

      {isExpanded && (
        <div className="absolute right-0 z-50 mt-1 w-40 bg-white border border-gray-300 rounded-md shadow-lg py-1">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-200">
            Show Columns
          </div>
          {toggleableColumns.map((column) => (
            <label
              key={column}
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleColumns[column] || false}
                onChange={(e) => onToggle(column, e.target.checked)}
                className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-1"
              />
              <span className="ml-2 text-sm text-gray-700">
                {columnLabels[column]}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
