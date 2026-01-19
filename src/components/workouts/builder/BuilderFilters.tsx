"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnVisibilityToggle } from '@/components/workouts/ColumnVisibilityToggle';
import { CategoryFilter } from '@/components/workouts/CategoryFilter';

interface BuilderFiltersProps {
  // Category filter
  viewMode: 'month' | 'week' | 'day';
  workoutCategories: any[];
  selectedCategories: string[];
  onCategorySelectionChange: (categories: string[]) => void;
}

export function BuilderFilters({
  viewMode,
  workoutCategories,
  selectedCategories,
  onCategorySelectionChange,
}: BuilderFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {/* Category Filter */}
      {viewMode === 'day' && workoutCategories.length > 0 && (
        <CategoryFilter
          categories={workoutCategories}
          selectedCategories={selectedCategories}
          onSelectionChange={onCategorySelectionChange}
        />
      )}
    </div>
  );
}
