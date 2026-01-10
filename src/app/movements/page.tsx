"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Dumbbell, Palette } from 'lucide-react';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { AddCategoryDialog } from '@/components/movements/AddCategoryDialog';
import { EditCategoryDialog } from '@/components/movements/EditCategoryDialog';
import { AddMovementDialog } from '@/components/movements/AddMovementDialog';
import { MovementList } from '@/components/movements/MovementList';

export default function MovementsPage() {
  const {
    categories,
    selectedCategory,
    loading: categoriesLoading,
    error: categoriesError,
    fetchCategories,
    setSelectedCategory,
    clearError: clearCategoriesError,
    initializeDefaults,
  } = useMovementCategoryStore();

  const {
    movements,
    loading: movementsLoading,
    error: movementsError,
    fetchMovementsByCategory,
    clearError: clearMovementsError,
  } = useMovementStore();

  useEffect(() => {
    const initializeData = async () => {
      await fetchCategories();
      // If no categories exist, initialize defaults
      if (categories.length === 0) {
        await initializeDefaults();
      }
    };
    
    initializeData();
  }, [fetchCategories, initializeDefaults, categories.length]);

  useEffect(() => {
    if (selectedCategory) {
      fetchMovementsByCategory(selectedCategory.id);
    }
  }, [selectedCategory, fetchMovementsByCategory]);

  const handleCategorySelect = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategory(category);
    }
  };

  const loading = categoriesLoading || movementsLoading;
  const error = categoriesError || movementsError;

  return (
    <div className="w-full px-1 pt-1 pb-4 space-y-2">
      {/* Toolbar */}
      <Card className="py-2">
        <CardContent className="py-1 px-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left - Category selector (visible on all screens) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 icon-workout" />
                <span className="text-sm font-medium">Category:</span>
              </div>
              <Select 
                value={selectedCategory?.id || ''} 
                onValueChange={handleCategorySelect}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select category">
                    {selectedCategory && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: selectedCategory.color }}
                        />
                        <span className="truncate">{selectedCategory.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-2">
              {selectedCategory && (
                <AddMovementDialog 
                  categoryId={selectedCategory.id}
                />
              )}
              <AddCategoryDialog />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  clearCategoriesError();
                  clearMovementsError();
                }}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && categories.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading movement catalog...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading || categories.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Desktop Category Sidebar */}
          <aside className="hidden lg:block lg:w-64 shrink-0">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="h-4 w-4 icon-workout" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.length === 0 ? (
                  <div className="text-center py-8">
                    <Dumbbell className="h-12 w-12 icon-workout mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No categories yet.
                    </p>
                  </div>
                ) : (
                  categories.map((category) => (
                    <div
                      key={category.id}
                      onClick={() => setSelectedCategory(category)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent min-w-0 ${
                        selectedCategory?.id === category.id 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="flex-1 font-medium text-sm truncate">{category.name}</span>
                      <EditCategoryDialog category={category} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1">
            {!selectedCategory ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Dumbbell className="h-12 w-12 icon-workout mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {categories.length === 0 ? 'No categories yet' : 'Select a category'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {categories.length === 0 
                        ? 'Create your first movement category to get started.'
                        : 'Choose a category from the dropdown above to view movements.'
                      }
                    </p>
                    {categories.length === 0 && (
                      <AddCategoryDialog 
                        trigger={
                          <Button variant="outline">
                            <Plus className="h-4 w-4 mr-1.5 icon-add" />
                            Create First Category
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      <div>
                        <CardTitle className="text-lg">{selectedCategory.name}</CardTitle>
                        <CardDescription>
                          {movements.length} movement{movements.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                    </div>
                    <EditCategoryDialog category={selectedCategory} />
                  </div>
                </CardHeader>
                <CardContent>
                  <MovementList 
                    movements={movements}
                    categoryId={selectedCategory.id}
                    categoryColor={selectedCategory.color}
                    loading={movementsLoading}
                  />
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      ) : null}
    </div>
  );
}