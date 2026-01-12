'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Program, ProgramWeek, ProgramWorkout } from '@/lib/types';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { EnhancedProgramBuilder } from '@/components/programs/EnhancedProgramBuilder';

export default function ProgramBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;
  
  const { programs, fetchPrograms, updateProgram } = useProgramStore();
  const { movements, fetchMovements } = useMovementStore();
  
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize program data
  useEffect(() => {
    const initializeProgram = async () => {
      setIsLoading(true);
      try {
        await fetchPrograms();
        await fetchMovements();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeProgram();
  }, [programId, fetchPrograms, fetchMovements]);

  // Set program once programs are loaded
  useEffect(() => {
    if (programs.length > 0 && !program) {
      const foundProgram = programs.find(p => p.id === programId);
      if (foundProgram) {
        setProgram(foundProgram);
      } else {
        // If program not found, create a basic structure
        const newProgram: Program = {
          id: programId,
          name: 'New Program',
          description: '',
          notes: '',
          isTemplate: true,
          createdBy: 'current-coach-id',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
          weeks: []
        };
        setProgram(newProgram);
      }
    }
  }, [programs, programId, program]);

  // Generate default weeks if none exist
  const ensureDefaultWeeks = (program: Program): Program => {
    if (!program.weeks || program.weeks.length === 0) {
      // Use the totalWeeks from the program if it exists, otherwise default to 4
      const weekCount = (program as any).totalWeeks || 4;
      const weeks: ProgramWeek[] = [];
      for (let i = 1; i <= weekCount; i++) {
        weeks.push({
          id: `week-${i}`,
          programId: program.id,
          ordinal: i,
          notes: '',
          workouts: [],
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        });
      }
      return { ...program, weeks };
    }
    return program;
  };

  // Generate default workout
  const generateDefaultWorkout = (weekId: string, ordinal: number): ProgramWorkout => {
    return {
      id: `workout-${weekId}-${ordinal}-${Date.now()}`,
      weekId: weekId,
      ordinal: ordinal,
      title: '',
      notes: '',
      rounds: [{
        id: `round-${Date.now()}`,
        workoutId: '',
        ordinal: 1,
        sets: 3,
        movementUsages: [],
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      }],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };
  };

  const handleSave = async () => {
    if (!program) return;
    
    try {
      await updateProgram(program);
    } catch (error) {
      console.error('Error saving program:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading program...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>Program not found</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Ensure program has default structure
  const programWithWeeks = ensureDefaultWeeks(program);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Enhanced Program Builder */}
      <EnhancedProgramBuilder
        program={programWithWeeks}
        onProgramUpdate={setProgram}
        onSave={handleSave}
        onCancel={() => router.back()}
        isSaving={isLoading}
      />

    </div>
  );
}