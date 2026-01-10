"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Dumbbell, Copy, Edit, Trash2 } from 'lucide-react';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import Link from 'next/link';

export default function WorkoutsPage() {
  const {
    workoutTemplates,
    loading,
    error,
    searchTerm,
    fetchWorkoutTemplates,
    searchTemplates,
    setSearchTerm,
    duplicateTemplate,
    removeWorkoutTemplate,
    startBuilder,
    clearError,
  } = useWorkoutStore();

  const [localSearchTerm, setLocalSearchTerm] = useState('');

  useEffect(() => {
    fetchWorkoutTemplates();
  }, [fetchWorkoutTemplates]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchTemplates(localSearchTerm);
  };

  const handleClearSearch = () => {
    setLocalSearchTerm('');
    setSearchTerm('');
    fetchWorkoutTemplates();
  };

  const handleDuplicate = async (templateId: string, name: string) => {
    const newName = prompt(`Enter name for duplicated workout:`, `${name} (Copy)`);
    if (newName) {
      try {
        await duplicateTemplate(templateId, newName, 'current-user');
      } catch (error) {
        console.error('Failed to duplicate template:', error);
      }
    }
  };

  const handleDelete = async (templateId: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      try {
        await removeWorkoutTemplate(templateId);
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleCreateNew = () => {
    startBuilder();
  };

  return (
    <div className="w-full px-1 pt-1 pb-4 space-y-2">
      {/* Toolbar */}
      <Card className="py-2">
        <CardContent className="py-1 px-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left - Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 icon-builder" />
                <Input
                  placeholder="Search templates..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Button type="submit" size="sm" disabled={loading}>
                Search
              </Button>
              {searchTerm && (
                <Button type="button" variant="outline" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
            </form>

            {/* Right - Actions */}
            <div className="flex items-center gap-2">
              <Link href="/workouts/builder">
                <Button variant="outline" size="sm" onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-1.5 icon-add" />
                  Create Workout
                </Button>
              </Link>
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
              <Button variant="outline" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading workout templates...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      {!loading && (
        <>
          {/* Results Count */}
          {searchTerm && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {workoutTemplates.length} templates for "{searchTerm}"
              </p>
            </div>
          )}

          {/* Empty State */}
          {workoutTemplates.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Dumbbell className="h-12 w-12 icon-builder mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No workout templates found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm 
                      ? "Try adjusting your search terms or clear the search to see all templates."
                      : "Get started by creating your first workout template."
                    }
                  </p>
                  <Link href="/workouts/builder">
                    <Button variant="outline" onClick={handleCreateNew}>
                      <Plus className="h-4 w-4 mr-1.5 icon-add" />
                      Create Your First Workout
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Templates Grid */}
          {workoutTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workoutTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{template.name || 'Untitled Workout'}</span>
                      {template.isPublic && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Public
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {template.rounds.length} rounds • {template.type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Rounds Preview */}
                      <div>
                        <p className="text-sm font-medium mb-2">Rounds:</p>
                        <div className="space-y-1">
                          {template.rounds.slice(0, 3).map((round, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{round.name}</span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {round.exercises.length} exercises
                              </span>
                            </div>
                          ))}
                          {template.rounds.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{template.rounds.length - 3} more rounds
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Total Exercises */}
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          Total exercises: {template.rounds.reduce((total, round) => total + round.exercises.length, 0)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Link href={`/workouts/builder?template=${template.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-4 w-4 mr-2 icon-edit" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDuplicate(template.id, template.name)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(template.id, template.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
