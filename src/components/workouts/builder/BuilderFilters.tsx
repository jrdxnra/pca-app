"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnVisibilityToggle } from '@/components/workouts/ColumnVisibilityToggle';
import { CategoryFilter } from '@/components/workouts/CategoryFilter';

interface BuilderFiltersProps {
  // Column visibility
  visibleColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onColumnVisibilityChange: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
  
  // Category filter
  viewMode: 'month' | 'week' | 'day';
  workoutCategories: any[];
  selectedCategories: string[];
  onCategorySelectionChange: (categories: string[]) => void;
  
  // Week order
  weekOrder: 'ascending' | 'descending';
  onWeekOrderChange: (order: 'ascending' | 'descending') => void;
}

export function BuilderFilters({
  visibleColumns,
  onColumnVisibilityChange,
  viewMode,
  workoutCategories,
  selectedCategories,
  onCategorySelectionChange,
  weekOrder,
  onWeekOrderChange,
}: BuilderFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
      {/* Left side - Column Toggle and Category Filter */}
      <div className="flex items-center gap-2">
        <ColumnVisibilityToggle
          visibleColumns={visibleColumns}
          availableColumns={{
            tempo: true,
            distance: true,
            rpe: true,
            percentage: true
          }}
          onToggle={onColumnVisibilityChange}
        />
        {viewMode === 'day' && workoutCategories.length > 0 && (
          <CategoryFilter
            categories={workoutCategories}
            selectedCategories={selectedCategories}
            onSelectionChange={onCategorySelectionChange}
          />
        )}
      </div>

      {/* Right side - Week Order */}
      <div className="flex items-center gap-2">
        <label htmlFor="weekOrder" className="text-sm font-medium">Week order:</label>
        <Select 
          value={weekOrder} 
          onValueChange={(value) => onWeekOrderChange(value as 'ascending' | 'descending')}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ascending">Ascending</SelectItem>
            <SelectItem value="descending">Descending</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
