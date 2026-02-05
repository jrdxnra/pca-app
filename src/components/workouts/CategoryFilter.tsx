"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Filter } from 'lucide-react';

interface CategoryFilterProps {
  categories: Array<{ id: string; name: string; color?: string }> | string[]; // Available workout categories (objects or strings)
  selectedCategories: string[];
  onSelectionChange: (categories: string[]) => void;
}

export function CategoryFilter({
  categories,
  selectedCategories = [],
  onSelectionChange
}: CategoryFilterProps) {
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

  // Normalize categories to always work with strings
  const normalizedCategories = categories.map(cat =>
    typeof cat === 'string' ? cat : cat.name
  );

  const handleToggle = (categoryName: string) => {
    if (selectedCategories.includes(categoryName)) {
      // Remove category
      onSelectionChange(selectedCategories.filter(c => c !== categoryName));
    } else {
      // Add category
      onSelectionChange([...selectedCategories, categoryName]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(normalizedCategories);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Don't render if no categories
  if (normalizedCategories.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs h-8 px-2 gap-1"
      >
        <Filter className="w-3 h-3" />
        Categories
        {selectedCategories.length > 0 && selectedCategories.length < normalizedCategories.length && (
          <span className="bg-indigo-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-1">
            {selectedCategories.length}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </Button>

      {isExpanded && (
        <div className="absolute left-0 z-50 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg py-1">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-200 flex items-center justify-between">
            <span>Filter by Category</span>
            <div className="flex gap-1">
              <button
                onClick={handleSelectAll}
                className="text-indigo-600 hover:text-indigo-700 text-xs"
              >
                All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleClearAll}
                className="text-gray-600 hover:text-gray-700 text-xs"
              >
                None
              </button>
            </div>
          </div>
          {normalizedCategories.map((categoryName, index) => {
            const categoryObj = typeof categories[index] === 'object' ? categories[index] as { id: string; name: string; color?: string } : null;
            const categoryId = categoryObj?.id || categoryName;

            return (
              <label
                key={categoryId}
                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(categoryName)}
                  onChange={() => handleToggle(categoryName)}
                  className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-1"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {categoryName}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

