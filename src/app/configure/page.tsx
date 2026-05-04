"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

import { useState, useEffect, useRef, RefObject, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Dumbbell,
  Trash2,
  Edit,
  Save,
  X,
  Palette,
  Settings,
  Layers,
  Calendar as CalendarIcon,
  RefreshCw,
  Link,
  TestTube
} from 'lucide-react';
import { WorkoutStructureTemplateCard } from '@/components/configure/WorkoutStructureTemplateCard';
import { WorkoutStructureTemplateDialog } from '@/components/configure/WorkoutStructureTemplateDialog';
import { SetupHubFlow } from '@/components/onboarding/SetupHubFlow';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { WorkoutStructureTemplate } from '@/lib/types';
import { TestEventInput, LocationAbbreviation } from '@/lib/google-calendar/types';
import { initiateGoogleAuth, checkGoogleCalendarAuth, disconnectGoogleCalendar } from '@/lib/google-calendar/api-client';
import { updateCalendarSyncConfig } from '@/lib/firebase/services/calendarConfig';
import { getGlobalQueryClient } from '@/lib/react-query/queryClientInstance';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MapPin } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/toaster';
import { getAppTimezone, setAppTimezone, getBrowserTimezone, hasTimezoneChanged, COMMON_TIMEZONES, formatTimezoneLabel } from '@/lib/utils/timezone';
import { Clock } from 'lucide-react';
import { useSetupHubProgress } from '@/hooks/useSetupHubProgress';

const AVAILABLE_COLORS = [
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
];

interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
  description?: string;
  order?: number;
}

interface WorkoutCategory {
  id: string;
  name: string;
  color: string;
  order?: number;
}

interface WorkoutType {
  id: string;
  name: string;
  color: string;
  description: string;
  order?: number;
}

interface WorkoutIntent {
  id: string;
  key: string;
  name: string;
  color: string;
  description: string;
  order?: number;
}

interface WeekTemplate {
  id: string;
  name: string;
  color: string;
  days: {
    day: string;
    workoutCategory: string;
  }[];
  order?: number;
}

interface ChecklistAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface ChecklistStep {
  title: string;
  description: string;
  actions: ChecklistAction[];
  complete: boolean;
}

interface ChecklistSection {
  title: string;
  description: string;
  steps: ChecklistStep[];
}

interface PlannerEventType {
  id: string;
  name: string;
  color?: string;
}

interface PlannerCalendar {
  id: string;
  name: string;
}

// Horizontal Day Item Component for Week Templates
function HorizontalDayItem({
  day,
  index,
  onUpdate,
  onDelete
}: {
  day: { day: string; workoutCategory: string };
  index: number;
  onUpdate: (index: number, updates: Partial<{ day: string; workoutCategory: string }>) => void;
  onDelete: (index: number) => void;
}) {
  const workoutTypes = ['Workout', 'Cardio Day', 'Conditioning'];

  return (
    <div className="flex items-center gap-2 p-2 border rounded bg-gray-50">
      <div className="flex items-center gap-2 flex-1">
        <Input
          value={day.day}
          onChange={(e) => onUpdate(index, { day: e.target.value })}
          className="w-24 text-sm"
        />
        <Select
          value={day.workoutCategory}
          onValueChange={(value) => onUpdate(index, { workoutCategory: value })}
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workoutTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(index)}
        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Helper function to count workout days by category for WeekTemplate
function getWorkoutDaysSummary(template: WeekTemplate): string {
  const categoryCounts: Record<string, number> = {};

  template.days.forEach(day => {
    const category = day.workoutCategory?.trim();
    if (category && category.toLowerCase() !== 'rest day') {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  });

  const parts: string[] = [];
  Object.entries(categoryCounts).forEach(([category, count]) => {
    // Handle pluralization
    let label = category.toLowerCase();
    if (category === 'Cardio Day') {
      label = count === 1 ? 'cardio day' : 'cardio days';
    } else if (category === 'Workout') {
      label = count === 1 ? 'workout' : 'workouts';
    } else {
      label = count === 1 ? label : `${label}s`;
    }
    parts.push(`${count} ${label}`);
  });

  return parts.join(', ') || 'No workouts';
}

function inferRoundCategoryHints(sectionName?: string, focusArea?: string, defaultStructure?: string): string[] {
  const text = `${sectionName || ''} ${focusArea || ''} ${defaultStructure || ''}`.toLowerCase();

  if (/(cool\s?down|recovery|stretch|breath|mobility)/.test(text)) {
    return ['Mobility', 'Recovery', 'Stretching'];
  }

  if (/(warm\s?-?up|prep|activation|movement prep|ballistic)/.test(text)) {
    return ['Prep', 'Warm-Up', 'Activation', 'Mobility'];
  }

  if (/(strength|main lift|squat|hinge|push|pull|power)/.test(text)) {
    return ['Strength', 'Power', 'Primary Lifts'];
  }

  if (/(condition|metcon|esd|engine|cardio|amrap|emom|circuit|interval)/.test(text)) {
    return ['Conditioning', 'Cardio', 'Work Capacity'];
  }

  if (/(accessory|hypertrophy|bodybuilding|assist)/.test(text)) {
    return ['Accessory', 'Hypertrophy', 'Stability'];
  }

  return ['Strength', 'Conditioning', 'Mobility'];
}

function inferSectionIntentKey(section: {
  workoutTypeName?: string;
  configuration?: {
    focusArea?: string;
    defaultStructure?: string;
  };
}): string {
  const text = `${section.workoutTypeName || ''} ${section.configuration?.focusArea || ''} ${section.configuration?.defaultStructure || ''}`
    .toLowerCase();

  if (/(amrap)/.test(text)) return 'amrap';
  if (/(emom|e\d+mom|every\s*\d+\s*minute\s*on\s*the\s*minute)/.test(text)) return 'emom';
  if (/(test|assessment|benchmark|max out|1rm)/.test(text)) return 'testing';
  if (/(rehab|prehab|corrective|return to play|physio)/.test(text)) return 'rehab';
  if (/(cool\s?down|downreg|breathwork|recovery block)/.test(text)) return 'cooldown';
  if (/(recovery|restore|mobility flow|reset)/.test(text)) return 'recovery';
  if (/(movement skill|skill|technique|mechanics)/.test(text)) return 'skill';
  if (/(warm\s?-?up|movement prep|prep|activation|pillar prep)/.test(text)) return 'prep';
  if (/(ballistic|potentiation|primer)/.test(text)) return 'potentiation';
  if (/(speed|accel|sprint|velocity|agility)/.test(text)) return 'speed';
  if (/(plyo|jump|bound|hop|landing)/.test(text)) return 'plyo';
  if (/(power|olympic|clean|snatch|throw)/.test(text)) return 'power';
  if (/(hypertrophy|bodybuilding|volume)/.test(text)) return 'hypertrophy';
  if (/(accessory|assist|isolation)/.test(text)) return 'accessory';
  if (/(core|trunk|anti-rotation|anti rotation|anti-extension|anti extension)/.test(text)) return 'core';
  if (/(condition|metcon|engine|esd|cardio|interval|finisher|circuit)/.test(text)) return 'conditioning';
  if (/(strength|main lift|primary|secondary|squat|hinge|push|pull)/.test(text)) return 'strength';

  return 'strength';
}

function resolveIntentForSection(
  section: {
    workoutTypeName?: string;
    configuration?: {
      focusArea?: string;
      defaultStructure?: string;
    };
  },
  intents: WorkoutIntent[]
): WorkoutIntent | undefined {
  if (!intents.length) return undefined;

  const inferredKey = inferSectionIntentKey(section);
  const byKey = intents.find((intent) => intent.key?.trim().toLowerCase() === inferredKey);
  if (byKey) return byKey;

  const aliasMap: Record<string, string[]> = {
    potentiation: ['ballistics'],
    conditioning: ['capacity', 'cardio'],
    rehab: ['prehab'],
  };

  const aliases = aliasMap[inferredKey] || [];
  const byAlias = intents.find((intent) => {
    const key = intent.key?.trim().toLowerCase() || '';
    const name = intent.name?.trim().toLowerCase() || '';
    return aliases.includes(key) || aliases.includes(name);
  });
  if (byAlias) return byAlias;

  return intents[0];
}

function buildSectionConfigDefaults(section: {
  workoutTypeName?: string;
  configuration?: {
    defaultRepRange?: { min: number; max: number };
    defaultRestPeriod?: { min: number; max: number };
    defaultDuration?: number;
    defaultStructure?: 'straight-sets' | 'supersets' | 'circuits' | 'amrap' | 'emom' | 'intervals';
    useRPE?: boolean;
    usePercentage?: boolean;
    useTempo?: boolean;
    useTime?: boolean;
    workRestRatio?: string;
    focusArea?: string;
  };
}) {
  const inferredIntent = inferSectionIntentKey(section);
  const current = section.configuration || {};

  const defaults: {
    defaultRepRange?: { min: number; max: number };
    defaultRestPeriod?: { min: number; max: number };
    defaultDuration?: number;
    defaultStructure?: 'straight-sets' | 'supersets' | 'circuits' | 'amrap' | 'emom' | 'intervals';
    useRPE?: boolean;
    usePercentage?: boolean;
    useTempo?: boolean;
    useTime?: boolean;
    workRestRatio?: string;
    focusArea?: string;
  } = {};

  if (!current.defaultStructure) {
    const structureByIntent: Record<string, 'straight-sets' | 'supersets' | 'circuits' | 'amrap' | 'emom' | 'intervals'> = {
      prep: 'circuits',
      potentiation: 'intervals',
      skill: 'straight-sets',
      speed: 'intervals',
      plyo: 'intervals',
      power: 'straight-sets',
      strength: 'straight-sets',
      hypertrophy: 'supersets',
      accessory: 'supersets',
      core: 'circuits',
      conditioning: 'circuits',
      amrap: 'amrap',
      emom: 'emom',
      testing: 'straight-sets',
      rehab: 'straight-sets',
      recovery: 'circuits',
      cooldown: 'circuits',
    };
    defaults.defaultStructure = structureByIntent[inferredIntent] || 'straight-sets';
  }

  if (!current.focusArea?.trim()) {
    const focusByIntent: Record<string, string> = {
      prep: 'Dynamic warm-up and activation',
      potentiation: 'Neural primer and explosive readiness',
      skill: 'Movement quality and technical precision',
      speed: 'Acceleration and velocity quality',
      plyo: 'Reactive force and landing mechanics',
      power: 'Explosive force production',
      strength: 'Primary strength development',
      hypertrophy: 'Targeted volume and tissue capacity',
      accessory: 'Structural balance and weak-link support',
      core: 'Bracing and trunk control',
      conditioning: 'Energy system development',
      amrap: 'Sustainable density and pacing',
      emom: 'Paced repeatability under fatigue',
      testing: 'Benchmark performance and output tracking',
      rehab: 'Symptom-guided control and progression',
      recovery: 'Low-intensity restoration and mobility',
      cooldown: 'Downregulation and recovery',
    };
    defaults.focusArea = focusByIntent[inferredIntent] || 'Session development';
  }

  if (typeof current.defaultDuration !== 'number' || current.defaultDuration <= 0) {
    const durationByIntent: Record<string, number> = {
      prep: 10,
      potentiation: 8,
      skill: 12,
      speed: 12,
      plyo: 10,
      power: 12,
      strength: 20,
      hypertrophy: 15,
      accessory: 12,
      core: 10,
      conditioning: 15,
      amrap: 12,
      emom: 12,
      testing: 15,
      rehab: 12,
      recovery: 10,
      cooldown: 8,
    };
    defaults.defaultDuration = durationByIntent[inferredIntent] || 12;
  }

  if (!current.defaultRepRange && ['strength', 'hypertrophy', 'accessory', 'power'].includes(inferredIntent)) {
    if (inferredIntent === 'strength') defaults.defaultRepRange = { min: 3, max: 6 };
    if (inferredIntent === 'power') defaults.defaultRepRange = { min: 2, max: 5 };
    if (inferredIntent === 'hypertrophy') defaults.defaultRepRange = { min: 8, max: 12 };
    if (inferredIntent === 'accessory') defaults.defaultRepRange = { min: 10, max: 15 };
  }

  if (!current.defaultRestPeriod && ['strength', 'power', 'hypertrophy', 'accessory'].includes(inferredIntent)) {
    if (inferredIntent === 'strength') defaults.defaultRestPeriod = { min: 90, max: 180 };
    if (inferredIntent === 'power') defaults.defaultRestPeriod = { min: 90, max: 150 };
    if (inferredIntent === 'hypertrophy') defaults.defaultRestPeriod = { min: 45, max: 90 };
    if (inferredIntent === 'accessory') defaults.defaultRestPeriod = { min: 30, max: 75 };
  }

  if (!current.workRestRatio && ['potentiation', 'speed', 'plyo', 'conditioning', 'recovery', 'cooldown'].includes(inferredIntent)) {
    defaults.workRestRatio = inferredIntent === 'conditioning' ? '1:1' : '1:2';
  }

  if (typeof current.useRPE !== 'boolean' && ['strength', 'hypertrophy', 'accessory', 'power'].includes(inferredIntent)) {
    defaults.useRPE = true;
  }
  if (typeof current.useTime !== 'boolean' && ['conditioning', 'amrap', 'emom', 'recovery', 'cooldown', 'prep'].includes(inferredIntent)) {
    defaults.useTime = true;
  }

  return defaults;
}

function buildRoundGuidance(section: {
  workoutTypeName?: string;
  configuration?: {
    focusArea?: string;
    defaultStructure?: string;
  };
}): string {
  const categories = inferRoundCategoryHints(
    section.workoutTypeName,
    section.configuration?.focusArea,
    section.configuration?.defaultStructure
  );

  const focus = section.configuration?.focusArea?.trim();
  const structure = section.configuration?.defaultStructure;

  const parts = [
    focus ? `Intent: ${focus}.` : undefined,
    `Relevant categories: ${categories.join(', ')}.`,
    structure ? `Preferred structure: ${structure}.` : undefined,
    section.workoutTypeName ? `Keep movement selection aligned to ${section.workoutTypeName}.` : undefined,
  ].filter(Boolean);

  return parts.join(' ');
}

function isLegacyAutoTemplateDescription(description?: string): boolean {
  if (!description) return false;

  const normalized = description.trim();
  const lower = normalized.toLowerCase();
  const genericLegacyPattern = /^workout structure template with configurable rounds and .* guidance\.?$/i;
  return (
    genericLegacyPattern.test(normalized) ||
    (normalized.startsWith('Session flow: ') &&
      normalized.includes('Use this template to keep round intent and movement categories consistent.')) ||
    lower.includes('structured session template with configurable rounds')
  );
}

function getPresetTemplateDescription(name?: string): string | undefined {
  const key = normalizePeriodName(name);

  const presets: Record<string, string> = {
    exos:
      'A comprehensive athletic session targeting the full spectrum of performance. We open with Pillar Prep to prime the nervous system and core, transition into high-fidelity Movement Skills, and anchor the session with tiered Strength blocks before finishing with aerobic or anaerobic ESD output.',
    exostheperformancestandard:
      'A comprehensive athletic session targeting the full spectrum of performance. We open with Pillar Prep to prime the nervous system and core, transition into high-fidelity Movement Skills, and anchor the session with tiered Strength blocks before finishing with aerobic or anaerobic ESD output.',
    thebig3:
      'Focused on the mastery of the Squat, Bench, and Deadlift. This flow prioritizes maximal force production in the Primary lift, followed by Secondary variations to address technical breakdown, and finishes with Accessory work to build structural balance and hypertrophy.',
    thebig3powerliftingfoundation:
      'Focused on the mastery of the Squat, Bench, and Deadlift. This flow prioritizes maximal force production in the Primary lift, followed by Secondary variations to address technical breakdown, and finishes with Accessory work to build structural balance and hypertrophy.',
    metabolicresistance:
      'Designed to maximize caloric burn and muscular endurance without sacrificing movement quality. By sandwiching Strength and ESD between movement prep and a high-intensity Finisher, this flow keeps the heart rate elevated while challenging postural integrity under fatigue.',
    speedagility:
      'A CNS-heavy session focused on displacement and reactive power. Following explosive ballistics and movement prep, we prioritize Energy System Development (ESD) while the athlete is fresh to ensure max velocity, closing with moderate strength work to reinforce the brakes.',
    speedandagility:
      'A CNS-heavy session focused on displacement and reactive power. Following explosive ballistics and movement prep, we prioritize Energy System Development (ESD) while the athlete is fresh to ensure max velocity, closing with moderate strength work to reinforce the brakes.',
    powerdevelopment:
      'A session dedicated to Rate of Force Development (RFD). This flow moves from low-level ballistics to high-impact Plyometrics, teaching the athlete to absorb and redirect force efficiently, followed by a primary strength block to provide the necessary horsepower.',
    cardio:
      'A dedicated energy system session utilizing time-based variables. Moving from a general warm-up into AMRAP and EMOM protocols, the goal is to sustain specific intensities and improve recovery cycles between bouts of high output.',
    activerecovery:
      'A low-intensity session focused on restoration and joint health. We utilize Pillar Prep and Movement Skill to address nagging stiff spots, followed by Pre-Hab to shore up weak links and a dedicated Cool Down to downregulate the nervous system.',
  };

  return presets[key];
}

function shouldRewriteTemplateDescription(description?: string, templateName?: string): boolean {
  const preset = getPresetTemplateDescription(templateName);
  if (preset && description?.trim() !== preset) return true;

  if (!description?.trim()) return true;
  if (isLegacyAutoTemplateDescription(description)) return true;

  const text = description.trim();
  const lower = text.toLowerCase();

  // Rewrite prior generic formats that do not provide a whole-session picture.
  if (lower.startsWith('session flow:') && !lower.includes('round-by-round blueprint:')) {
    return true;
  }

  if (text.length < 140) {
    return true;
  }

  return false;
}

function normalizePeriodName(name?: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getPresetPeriodDescription(name?: string): string | undefined {
  const key = normalizePeriodName(name);

  const presets: Record<string, string> = {
    basebuilding:
      'Objective: establish a broad aerobic and structural foundation. Programming emphasizes high-volume, low-to-moderate intensity work to build work capacity and joint integrity so the athlete can tolerate more specialized training later.',
    generalpreparation:
      'Objective: establish a broad aerobic and structural foundation. Programming emphasizes high-volume, low-to-moderate intensity work to build work capacity and joint integrity so the athlete can tolerate more specialized training later.',
    basebuildinggeneralpreparation:
      'Objective: establish a broad aerobic and structural foundation. Programming emphasizes high-volume, low-to-moderate intensity work to build work capacity and joint integrity so the athlete can tolerate more specialized training later.',
    strengthphase:
      'Objective: improve maximal strength through higher-intensity compound lifts and lower total volume. Success is measured by increased absolute load capacity and stronger high-threshold motor unit recruitment.',
    maximalstrength:
      'Objective: improve maximal strength through higher-intensity compound lifts and lower total volume. Success is measured by increased absolute load capacity and stronger high-threshold motor unit recruitment.',
    peaking:
      'Objective: maximize competition readiness through high specificity and fatigue management. Volume is tapered aggressively while intensity stays high so performance can peak with sharp technique and full recovery.',
    competitionprep:
      'Objective: maximize competition readiness through high specificity and fatigue management. Volume is tapered aggressively while intensity stays high so performance can peak with sharp technique and full recovery.',
    gpp:
      'Objective: improve versatility and recovery with broad, non-specific movement exposure across planes and energy systems. This phase addresses imbalances, reduces burnout risk, and maintains a resilient athletic base.',
    generalphysicalpreparation:
      'Objective: improve versatility and recovery with broad, non-specific movement exposure across planes and energy systems. This phase addresses imbalances, reduces burnout risk, and maintains a resilient athletic base.',
    spp:
      'Objective: bridge general fitness to sport performance by matching the metabolic and biomechanical demands of competition. Assistance work is selected for direct transfer to competition-style movement execution.',
    specificphysicalpreparation:
      'Objective: bridge general fitness to sport performance by matching the metabolic and biomechanical demands of competition. Assistance work is selected for direct transfer to competition-style movement execution.',
    hypertrophy:
      'Objective: increase muscle cross-sectional area via higher rep ranges and increased set volume. Mechanical tension and metabolic stress are prioritized to build tissue capacity for later force-focused phases.',
    hypertrophyphase:
      'Objective: increase muscle cross-sectional area via higher rep ranges and increased set volume. Mechanical tension and metabolic stress are prioritized to build tissue capacity for later force-focused phases.',
    musclegrowth:
      'Objective: increase muscle cross-sectional area via higher rep ranges and increased set volume. Mechanical tension and metabolic stress are prioritized to build tissue capacity for later force-focused phases.',
    power:
      'Objective: improve velocity and rate of force development. Programming uses moderate loads moved with maximal intent, plyometrics, and explosive variations to convert strength into usable sport speed.',
    powerphase:
      'Objective: improve velocity and rate of force development. Programming uses moderate loads moved with maximal intent, plyometrics, and explosive variations to convert strength into usable sport speed.',
    velocityrfd:
      'Objective: improve velocity and rate of force development. Programming uses moderate loads moved with maximal intent, plyometrics, and explosive variations to convert strength into usable sport speed.',
    maintenance:
      'Objective: preserve strength, size, and movement quality with minimum effective dose. Volume is reduced while intensity is maintained enough to limit detraining during competition season or high life stress.',
    sustainingqualities:
      'Objective: preserve strength, size, and movement quality with minimum effective dose. Volume is reduced while intensity is maintained enough to limit detraining during competition season or high life stress.',
    accumulation:
      'Objective: create a high-volume overload through progressive tonnage and time under tension. This high-fatigue block pushes recovery limits to drive supercompensation before a deload or intensification phase.',
    volumeloading:
      'Objective: create a high-volume overload through progressive tonnage and time under tension. This high-fatigue block pushes recovery limits to drive supercompensation before a deload or intensification phase.',
  };

  return presets[key];
}

function shouldRewritePeriodDescription(period: Pick<Period, 'name' | 'description'>): boolean {
  const description = period.description?.trim();
  const preset = getPresetPeriodDescription(period.name);

  if (!description) return true;

  // If we have a canonical preset for this phase name, rewrite until it matches.
  if (preset && description !== preset) return true;

  const lower = description.toLowerCase();

  // Catch earlier generic generations and short descriptions.
  if (lower.includes('use this period to group related week templates')) return true;
  if (lower.startsWith('training phase for ') && lower.includes('define the main adaptation target')) return true;
  if (lower.startsWith('phase intent:') && lower.includes('program week templates in')) return true;
  if (description.length < 130) return true;

  return false;
}

function buildTemplateDescriptionWithContext(
  template: WorkoutStructureTemplate,
  availableWorkoutTypes: WorkoutType[]
): string {
  const preset = getPresetTemplateDescription(template.name);
  if (preset) {
    return preset;
  }

  const sortedSections = (template.sections || []).slice().sort((a, b) => a.order - b.order);
  const flowParts = sortedSections.map((section) => section.workoutTypeName).filter(Boolean);
  const flow = flowParts.join(' -> ');

  if (flowParts.length === 0) {
    return 'Structured session template with configurable rounds, intent, and movement guidance.';
  }

  const workoutTypeDescriptionMap = Object.fromEntries(
    (availableWorkoutTypes || [])
      .filter((workoutType) => Boolean(workoutType.name?.trim()))
      .map((workoutType) => [
        workoutType.name.trim().toLowerCase(),
        (workoutType.description || '').trim(),
      ])
  );

  const allCategoryHints = sortedSections
    .flatMap((section) =>
      inferRoundCategoryHints(
        section.workoutTypeName,
        section.configuration?.focusArea,
        section.configuration?.defaultStructure
      )
    )
    .filter(Boolean);

  const uniqueCategoryHints = Array.from(new Set(allCategoryHints)).slice(0, 5);

  const structureModes = Array.from(
    new Set(
      sortedSections
        .map((section) => section.configuration?.defaultStructure)
        .filter(
          (mode): mode is 'straight-sets' | 'supersets' | 'circuits' | 'amrap' | 'emom' | 'intervals' =>
            Boolean(mode)
        )
    )
  );

  const totalDurationMinutes = sortedSections.reduce((sum, section) => {
    const minutes = section.configuration?.defaultDuration;
    return sum + (typeof minutes === 'number' && minutes > 0 ? minutes : 0);
  }, 0);

  const roundHighlights = sortedSections
    .slice(0, 4)
    .map((section) => {
      const focus = section.configuration?.focusArea?.trim();
      const typeDescription = workoutTypeDescriptionMap[(section.workoutTypeName || '').toLowerCase()];
      const structure = section.configuration?.defaultStructure;
      const duration = section.configuration?.defaultDuration;
      const categories = inferRoundCategoryHints(section.workoutTypeName, focus, structure).slice(0, 2).join('/');
      const emphasis = focus || typeDescription || categories;
      const formatCue = [duration ? `${duration}m` : undefined, structure].filter(Boolean).join(', ');
      return emphasis
        ? `${section.workoutTypeName} (${emphasis}${formatCue ? `; ${formatCue}` : ''})`
        : `${section.workoutTypeName}${formatCue ? ` (${formatCue})` : ''}`;
    })
    .join(' -> ');

  const openingBlock = sortedSections[0]?.workoutTypeName;
  const closingBlock = sortedSections[sortedSections.length - 1]?.workoutTypeName;

  const pieces = [
    `Session flow: ${flow}.`,
    openingBlock && closingBlock
      ? `Designed to open with ${openingBlock} and finish with ${closingBlock} so the session has a clear ramp and landing.`
      : undefined,
    uniqueCategoryHints.length > 0
      ? `Movement emphasis: ${uniqueCategoryHints.join(', ')}.`
      : undefined,
    structureModes.length > 0
      ? `Primary structures: ${structureModes.join(', ')}.`
      : undefined,
    totalDurationMinutes > 0
      ? `Estimated working time across sections: ~${totalDurationMinutes} minutes.`
      : undefined,
    roundHighlights ? `Round-by-round blueprint: ${roundHighlights}.` : undefined,
  ].filter(Boolean);

  return pieces.join(' ');
}

function buildPeriodDescription(period: Pick<Period, 'name' | 'focus'>): string {
  const preset = getPresetPeriodDescription(period.name);
  if (preset) {
    return preset;
  }

  const periodName = period.name?.trim() || 'this phase';
  const focus = period.focus?.trim();

  if (focus) {
    return `Phase goal for ${periodName}: ${focus}. Weekly programming should bias exercise selection, set/rep exposure, and intensity toward this goal, then layer assistance work to support weak links. Use weekly check-ins to track readiness, performance trend, and tolerance so loading can be progressed, held, or deloaded with intent.`;
  }

  return `Training phase: ${periodName}. Define one primary adaptation target for this block, then align week templates so session stress and movement choices reinforce that target. Review week-over-week output, recovery, and adherence to decide progression pace and when to transition to the next phase.`;
}

function buildWorkoutTypeDescription(workoutType: Pick<WorkoutType, 'name'>): string {
  const name = workoutType.name?.trim() || 'Workout Type';
  const key = normalizePeriodName(name);

  const presets: Record<string, string> = {
    ppmbballistics:
      'High-velocity drills designed to ignite the core and prime the nervous system for explosive movement.',
    movementprep:
      'Dynamic patterning and mobility work tailored to the specific biomechanical demands of the session.',
    strength1:
      'The main lift of the day; prioritizes maximal force production and technical proficiency under high loads.',
    strength2:
      'Supplemental movements designed to reinforce the primary lift and build structural volume.',
    esd:
      'Target-specific conditioning protocols used to improve aerobic capacity or anaerobic power.',
    prehab:
      'Corrective exercises targeting weak links like joint stability and tissue quality to ensure long-term durability.',
    accessory:
      'Focused work on isolated muscle groups to improve balance, shore up weaknesses, and drive hypertrophy.',
    amrap:
      'AMRAP (As Many Reps/Rounds As Possible). DDS cue: fixed section clock (8-20 minutes), continuous cycling through repeatable movements, and sustainable pacing over all-out sprinting. DDS format hint: format=AMRAP cadence=continuous scoring=rounds+reps. Example: AMRAP 12: 10 KB swings, 8 push-ups, 6 goblet squats.',
    emom:
      'EMOM (Every Minute On the Minute). DDS cue: each movement block runs on a strict 60-second cadence; finish assigned work inside the minute, then use remaining time to reset before the next minute. DDS format hint: format=EMOM cadence=60s workWindow=withinMinute transition=onMinute. Example: 12-minute EMOM alternating odd/even minutes.',
    e2mom:
      'E2MOM (Every 2 Minutes On the Minute). DDS cue: each movement block runs on a strict 120-second cadence; complete work early, recover in the remaining window, then rotate on the next 2-minute mark. DDS format hint: format=EMOM cadence=120s workWindow=withinCadence transition=every2Minutes. Example: E2MOM x 8 rounds alternating two movements.',
    e2om:
      'E2MOM (Every 2 Minutes On the Minute). DDS cue: each movement block runs on a strict 120-second cadence; complete work early, recover in the remaining window, then rotate on the next 2-minute mark. DDS format hint: format=EMOM cadence=120s workWindow=withinCadence transition=every2Minutes. Example: E2MOM x 8 rounds alternating two movements.',
    rft:
      'Rounds For Time. A task-oriented conditioning block where the goal is to complete prescribed volume as quickly as possible.',
    tabata:
      'A high-intensity interval protocol (20s Work / 10s Rest) designed to drive peak metabolic distress.',
    chipper:
      'A high-volume, one-way list of movements that tests mental grit and physical endurance.',
    ladder:
      'A rep scheme that scales up or down to allow high volume accumulation while managing technical breakdown.',
    finisher:
      'A terminal high-effort block designed to maximize metabolic stress and empty the tank.',
    forquality:
      'A non-competitive block prioritizing perfect execution, tempo, and mind-muscle connection over speed or load.',
    linear:
      'Work focused on single-direction force, typically emphasizing straight-line speed or vertical displacement.',
    multi:
      'Multi-directional movement patterns involving lateral, rotational, and change-of-direction demands.',
    plyometrics:
      'High-impact drills focusing on the stretch-shortening cycle to improve reactive power and elasticity.',
    hinge:
      'Lower-body emphasis prioritizing posterior-chain dominance through hinge patterns and hip extension force.',
    squat:
      'Lower-body emphasis prioritizing anterior-chain loading and squat mechanics under control and intent.',
    push:
      'Upper-body organization around push-dominant patterns to build pressing strength and structural balance.',
    pull:
      'Upper-body organization around pull-dominant patterns to build back strength, scapular control, and balance.',
    chestback:
      'A high-intensity superset approach focusing on antagonistic muscle groups for balanced torso development.',
    sharms:
      'Targeted isolation of the shoulder girdle and arms to drive hypertrophy and local muscular endurance.',
    cooldown:
      'A downregulation phase using low-intensity movement and mobility to shift the body into a recovery-dominant state.',
    amrap10:
      'A fixed-duration metabolic window (10 minutes) used to measure and track anaerobic work capacity over time.',
    amrap12:
      'A fixed-duration metabolic window (12 minutes) used to measure and track anaerobic work capacity over time.',
  };

  if (presets[key]) {
    return presets[key];
  }

  const text = name.toLowerCase();

  if (/(warm\s?-?up|prep|activation)/.test(text)) {
    return 'Prepares tissues and movement patterns for the main session with progressive intensity.';
  }

  if (/(strength|main|primary|lift|power)/.test(text)) {
    return 'Primary strength or power block focused on quality reps, intent, and progressive overload.';
  }

  if (/(condition|metcon|engine|cardio|esd|amrap|emom|interval)/.test(text)) {
    return 'Conditioning block to build work capacity, pacing control, and aerobic/anaerobic fitness.';
  }

  if (/(accessory|hypertrophy|assist)/.test(text)) {
    return 'Accessory work to improve muscular balance, tissue tolerance, and targeted hypertrophy.';
  }

  if (/(cool\s?down|recovery|mobility|stretch)/.test(text)) {
    return 'Cooldown and recovery block to downregulate, restore mobility, and support session-to-session readiness.';
  }

  return `${name} phase used to organize session intent, movement focus, and loading strategy.`;
}

function shouldRewriteWorkoutTypeDescription(workoutType: Pick<WorkoutType, 'name' | 'description'>): boolean {
  const nextDescription = buildWorkoutTypeDescription(workoutType);
  const current = workoutType.description?.trim();
  const key = normalizePeriodName(workoutType.name);
  const hasPresetKey = [
    'ppmbballistics', 'movementprep', 'strength1', 'strength2', 'esd', 'prehab', 'accessory',
    'amrap', 'emom', 'e2mom', 'e2om', 'rft', 'tabata', 'chipper', 'ladder', 'finisher', 'forquality',
    'linear', 'multi', 'plyometrics', 'hinge', 'squat', 'push', 'pull', 'chestback', 'sharms',
    'cooldown', 'amrap10', 'amrap12'
  ].includes(key);

  if (!current) return true;

  // For known taxonomy blocks, keep them aligned with canonical copy.
  if (hasPresetKey && current !== nextDescription) return true;

  if (current !== nextDescription) {
    const lower = current.toLowerCase();
    if (lower.includes('phase used to organize session intent, movement focus, and loading strategy')) {
      return true;
    }

    // Respect custom manual descriptions unless they are generic legacy text.
    if (current.length > 40) {
      return false;
    }

    return true;
  }

  return false;
}

// Sortable Item Component
function SortableItem({
  item,
  onEdit,
  onDelete,
  index,
  type
}: {
  item: Period | WeekTemplate | WorkoutCategory | WorkoutType | WorkoutIntent;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  index: number;
  type: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
      <div className="flex items-center gap-3 flex-1">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <div>
          <h4 className="font-semibold flex items-center gap-2 leading-tight">
            {item.name}
            {'days' in item && Array.isArray(item.days) && (
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {getWorkoutDaysSummary(item as WeekTemplate)}
              </span>
            )}
          </h4>
          {'focus' in item && (
            <p className="text-sm text-gray-600 leading-tight">{item.focus}</p>
          )}
          {'description' in item && (
            <p className="text-sm text-gray-600 leading-tight">{item.description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(item)}
        >
          <Edit className="h-4 w-4 icon-edit" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(item.id)}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  // Normalize location key for comparison (lowercase, trimmed, collapsed spaces)
  const normalizeLocationKey = (input: string) => {
    if (!input) return '';
    return input.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  // Preserve original casing for display
  const preserveOriginalCasing = (original: string, normalized: string): string => {
    return original.trim().replace(/\s+/g, ' ');
  };

  const {
    periods,
    weekTemplates,
    workoutCategories,
    workoutTypes,
    workoutIntents,
    workoutStructureTemplates,
    businessHours,
    loading: configLoading,
    fetchAll: fetchAllConfig,
    addPeriod,
    updatePeriod,
    deletePeriod,
    addWeekTemplate,
    updateWeekTemplate,
    deleteWeekTemplate,
    addWorkoutCategory,
    updateWorkoutCategory,
    deleteWorkoutCategory,
    addWorkoutType,
    updateWorkoutType,
    deleteWorkoutType,
    addWorkoutIntent,
    updateWorkoutIntent,
    deleteWorkoutIntent,
    addWorkoutStructureTemplate,
    updateWorkoutStructureTemplate,
    deleteWorkoutStructureTemplate,
    fetchBusinessHours,
    updateBusinessHours
  } = useConfigurationStore();

  const {
    calendars,
    config: calendarConfig,
    loading: calendarLoading,
    error: calendarError,
    fetchCalendars,
    updateConfig: updateCalendarConfig,
    createTestEvent,
    clearAllTestEvents,
    clearError: clearCalendarError
  } = useCalendarStore();

  const { clients, fetchClients } = useClientStore();
  const { movements, fetchMovements } = useMovementStore();
  const router = useRouter();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Google Calendar auth state - sync with store so Header and Configure stay in sync
  const storeIsConnected = useCalendarStore(state => state.isGoogleCalendarConnected);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(storeIsConnected);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const oauthToastShownRef = useRef(false);  // Track if we've already shown the OAuth success toast
  const calendarSectionRef = useRef<HTMLDivElement | null>(null);
  const businessHoursSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerMetadataSectionRef = useRef<HTMLDivElement | null>(null);
  const locationSectionRef = useRef<HTMLDivElement | null>(null);
  const periodsSectionRef = useRef<HTMLDivElement | null>(null);
  const weekTemplatesSectionRef = useRef<HTMLDivElement | null>(null);
  const workoutCategoriesSectionRef = useRef<HTMLDivElement | null>(null);
  const workoutStructuresSectionRef = useRef<HTMLDivElement | null>(null);
  const workoutTypesSectionRef = useRef<HTMLDivElement | null>(null);
  const workoutIntentsSectionRef = useRef<HTMLDivElement | null>(null);
  const calendarReady = Boolean(isGoogleCalendarConnected && calendarConfig.selectedCalendarId);
  const hasClients = clients.length > 0;
  const selectedCalendarSummary = calendars.find(calendar => calendar.id === calendarConfig.selectedCalendarId)?.summary;
  const selectedCalendarLabel = selectedCalendarSummary || calendarConfig.selectedCalendarId;
  const { needsSetup: needsSetupHub, isLoading: onboardingLoading } = useSetupHubProgress(calendarReady, hasClients);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checklistCompleteRef = useRef(false);
  const hasInitializedChecklistStateRef = useRef(false);
  const hasBackfilledInitialDescriptionsRef = useRef(false);
  const isBackfillingInitialDescriptionsRef = useRef(false);
  const confettiColors = ['#6366F1', '#10B981', '#FBBF24', '#F472B6'];

  // Sync local state with store state when it changes
  useEffect(() => {
    setIsGoogleCalendarConnected(storeIsConnected);
  }, [storeIsConnected]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'workout' | 'app' | 'setup'>('workout');

  // Read tab from URL query param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'app' || tabParam === 'workout' || tabParam === 'setup') {
        setActiveTab(tabParam as 'workout' | 'app' | 'setup');
      }
    }
  }, []);

  const handleScrollToCalendarSettings = () => {
    setActiveTab('app');

    requestAnimationFrame(() => {
      calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleGoToClients = () => {
    router.push('/clients');
  };

  const handleSetupHubFinish = () => {
    router.push('/schedule');
  };

  const scrollToSection = (tab: 'app' | 'workout', sectionRef: RefObject<HTMLDivElement | null>) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleScrollToBusinessHours = () => scrollToSection('app', businessHoursSectionRef);
  const handleScrollToPlannerMetadata = () => scrollToSection('app', plannerMetadataSectionRef);
  const handleScrollToLocation = () => scrollToSection('app', locationSectionRef);
  const handleScrollToPeriods = () => scrollToSection('workout', periodsSectionRef);
  const handleScrollToWeekTemplates = () => scrollToSection('workout', weekTemplatesSectionRef);
  const handleScrollToWorkoutCategories = () => scrollToSection('workout', workoutCategoriesSectionRef);
  const handleScrollToWorkoutStructures = () => scrollToSection('workout', workoutStructuresSectionRef);
  const handleScrollToWorkoutTypes = () => scrollToSection('workout', workoutTypesSectionRef);
  const handleScrollToWorkoutIntents = () => scrollToSection('workout', workoutIntentsSectionRef);
  const handleGoToMovements = () => router.push('/movements');

  // Planner metadata state (must be declared before derived checklist booleans)
  const [plannerEventTypes, setPlannerEventTypes] = useState<PlannerEventType[]>([]);
  const [plannerCalendars, setPlannerCalendars] = useState<PlannerCalendar[]>([]);
  const [plannerMetadataLoading, setPlannerMetadataLoading] = useState(false);
  const [plannerMetadataSaving, setPlannerMetadataSaving] = useState(false);
  const [plannerMetadataError, setPlannerMetadataError] = useState<string | null>(null);
  const [newPlannerEventType, setNewPlannerEventType] = useState('');
  const [newPlannerCalendar, setNewPlannerCalendar] = useState('');

  const hasConfiguredBusinessHours = Boolean(
    (businessHours?.daysOfWeek?.length ?? 0) > 0 &&
    Object.keys(businessHours?.dayHours ?? {}).length > 0
  );
  const hasPlannerEventType = plannerEventTypes.length > 0;
  const hasPlannerCalendar = plannerCalendars.length > 0;
  const hasLocationAlias = Boolean((calendarConfig.locationAbbreviations ?? []).some(abbr => !abbr.ignored && abbr.abbreviation?.trim()));
  const hasWorkoutCategory = workoutCategories.length > 0;
  const hasMovement = (movements?.length ?? 0) > 0;
  const hasWorkoutType = workoutTypes.length > 0;
  const hasWorkoutIntent = workoutIntents.length > 0;
  const hasWorkoutStructure = workoutStructureTemplates.length > 0;
  const hasLinkedStructure = workoutCategories.some(category => Boolean(category.linkedWorkoutStructureTemplateId));
  const hasWeekTemplate = weekTemplates.length > 0;
  const hasPeriod = periods.length > 0;

  const setupTaskSections: ChecklistSection[] = [
    {
      title: 'Calendar display defaults',
      description: 'Lock in the window and locations that define how your schedule renders everywhere in PCA.',
      steps: [
        {
          title: 'Update your business hours',
          description: 'Set the earliest start and latest end time your gym operates. The schedule grid only renders events inside this window, so coaches see a focused view and the app knows the boundaries for auto-populating workout slots.',
          complete: hasConfiguredBusinessHours,
          actions: [
            { label: 'Business Hours', onClick: handleScrollToBusinessHours, variant: 'default' },
          ],
        },
        {
          title: 'Create at least one event type',
          description: 'Define a class/session type in App Calendar Settings so planning filters and color tags have a default taxonomy from day one.',
          complete: hasPlannerEventType,
          actions: [
            { label: 'Event Types', onClick: handleScrollToPlannerMetadata, variant: 'default' },
          ],
        },
        {
          title: 'Create at least one planner calendar',
          description: 'Add a planner calendar bucket so sessions have a destination calendar from the first scheduling pass.',
          complete: hasPlannerCalendar,
          actions: [
            { label: 'Planner Calendars', onClick: handleScrollToPlannerMetadata, variant: 'default' },
          ],
        },
        {
          title: 'Update your first location',
          description: 'Map the long Google Calendar location text to a short label (e.g., "Iron Warehouse" -> "IW"). The schedule and PDFs will use the friendly alias.',
          complete: hasLocationAlias,
          actions: [
            { label: 'Location Manager', onClick: handleScrollToLocation, variant: 'default' },
          ],
        },
      ],
    },
    {
      title: 'Create your own category + movement',
      description: 'Add at least one workout category (strength, skill, conditioning, etc.) and pair it with a movement in the Movements area so templates can reference actual exercises.',
      steps: [
        {
          title: 'Create your own workout category',
          description: 'Stand up a category such as Strength, Conditioning, or Recovery so weeks and workouts have meaningful labels.',
          complete: hasWorkoutCategory,
          actions: [
            { label: 'Workout Categories', onClick: handleScrollToWorkoutCategories, variant: 'default' },
          ],
        },
        {
          title: 'Add at least one movement',
          description: 'Add a movement (or import from the library) so templates can reference actual exercises when you build structures.',
          complete: hasMovement,
          actions: [
            { label: 'Open Movements', onClick: handleGoToMovements, variant: 'default' },
          ],
        }
      ],
    },
    {
      title: 'Create your own workout type',
      description: 'Define labels like "Strength Block" or "Recovery Circuit" that appear when logging or filtering workouts. Each type can use its own color for quick scanning.',
      steps: [
        {
          title: 'Create your own workout type',
          description: 'Define labels like "Strength Block" or "Recovery Circuit" that appear when logging or filtering workouts.',
          complete: hasWorkoutType,
          actions: [
            { label: 'Workout Types', onClick: handleScrollToWorkoutTypes, variant: 'default' },
          ],
        },
      ],
    },
    {
      title: 'Create your own workout structure',
      description: 'Build a reusable structure (warm-up, strength superset, finisher, etc.) so coaches can drop in complete sessions with one click.',
      steps: [
        {
          title: 'Create your own workout structure',
          description: 'Lay out the blocks that make up a training session and save them for re-use.',
          complete: hasWorkoutStructure,
          actions: [
            { label: 'Structure Templates', onClick: handleScrollToWorkoutStructures, variant: 'default' },
          ],
        },
        {
          title: 'Link a structure to a category',
          description: 'Inside each workout category card you can set a default structure template so the Builder pre-populates fields automatically.',
          complete: hasLinkedStructure,
          actions: [
            { label: 'Open Categories', onClick: handleScrollToWorkoutCategories, variant: 'default' },
          ],
        },
      ],
    },
    {
      title: 'Create your section intents',
      description: 'Define section intent taxonomy (prep, strength, conditioning, etc.) so +Fill uses explicit section intent instead of name guessing.',
      steps: [
        {
          title: 'Review workout intents',
          description: 'Validate your workout intent list and descriptions; these are selectable on each structure template section.',
          complete: hasWorkoutIntent,
          actions: [
            { label: 'Workout Intents', onClick: handleScrollToWorkoutIntents, variant: 'default' },
          ],
        },
      ],
    },
    {
      title: 'Create your own week template',
      description: 'Lay out how many strength, conditioning, or recovery days you run in a week. Templates speed up assigning programs to new clients.',
      steps: [
        {
          title: 'Create your own week template',
          description: 'Design a week blueprint that mixes the right categories across seven days.',
          complete: hasWeekTemplate,
          actions: [
            { label: 'Week Templates', onClick: handleScrollToWeekTemplates, variant: 'default' },
          ],
        },
      ],
    },
    {
      title: 'Create your own period',
      description: 'Periods define larger cycles (e.g., Hypertrophy Q2). They bundle multiple week templates and keep reporting grouped by phase.',
      steps: [
        {
          title: 'Create your own period',
          description: 'Combine week templates into macro cycles so the roster stays aligned to the same theme.',
          complete: hasPeriod,
          actions: [
            { label: 'Periods', onClick: handleScrollToPeriods, variant: 'default' },
          ],
        },
      ],
    },
  ];

  const totalChecklistSteps = setupTaskSections.reduce((sectionAcc, section) => sectionAcc + section.steps.length, 0);
  const completedChecklistSteps = setupTaskSections.reduce((sectionAcc, section) => (
    sectionAcc + section.steps.filter(step => step.complete).length
  ), 0);
  const checklistProgressPercent = totalChecklistSteps === 0
    ? 0
    : Math.round((completedChecklistSteps / totalChecklistSteps) * 100);
  const checklistComplete = totalChecklistSteps > 0 && completedChecklistSteps === totalChecklistSteps;

  useEffect(() => {
    // Wait until setup-related data has finished loading so we don't treat initial hydration
    // as a "new completion" for users who completed setup long ago.
    if (onboardingLoading || configLoading) {
      return;
    }

    if (!hasInitializedChecklistStateRef.current) {
      checklistCompleteRef.current = checklistComplete;
      hasInitializedChecklistStateRef.current = true;
      return;
    }

    if (checklistComplete && !checklistCompleteRef.current) {
      setShowCelebration(true);
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      celebrationTimeoutRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 4500);
    } else if (!checklistComplete && checklistCompleteRef.current) {
      setShowCelebration(false);
    }

    checklistCompleteRef.current = checklistComplete;

    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, [checklistComplete, onboardingLoading, configLoading]);

  // Location management state
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [editingLocation, setEditingLocation] = useState<LocationAbbreviation | null>(null);
  const [locationAbbreviationInput, setLocationAbbreviationInput] = useState('');
  const [showIgnoredLocations, setShowIgnoredLocations] = useState(false);

  // Timezone settings state
  const [appTimezone, setAppTimezoneState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getAppTimezone();
    }
    return 'America/Los_Angeles';
  });
  const [showTimezonePrompt, setShowTimezonePrompt] = useState(false);
  const [signedInGoogleEmail, setSignedInGoogleEmail] = useState<string | null>(null);

  // Keyword input states (local state to allow typing commas)
  const [coachingKeywordsInput, setCoachingKeywordsInput] = useState('');
  const [classKeywordsInput, setClassKeywordsInput] = useState('');
  const [coachingColor, setCoachingColor] = useState('blue');
  const [classColor, setClassColor] = useState('purple');

  // Sync keyword inputs from config on mount and when config changes
  useEffect(() => {
    if (calendarConfig.coachingKeywords) {
      setCoachingKeywordsInput(calendarConfig.coachingKeywords.join(', '));
    }
    if (calendarConfig.classKeywords) {
      setClassKeywordsInput(calendarConfig.classKeywords.join(', '));
    }
    if (calendarConfig.coachingColor) {
      setCoachingColor(calendarConfig.coachingColor);
    }
    if (calendarConfig.classColor) {
      setClassColor(calendarConfig.classColor);
    }
  }, [calendarConfig.coachingKeywords, calendarConfig.classKeywords, calendarConfig.coachingColor, calendarConfig.classColor]);

  // Handle OAuth callback redirect - check if we just completed OAuth
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const connected = params.get('connected');
      const hasError = params.get('error');

      if (connected === 'true' && !oauthToastShownRef.current) {
        // We just completed OAuth, force re-check the connection status
        console.log('OAuth redirect detected, force re-checking auth status...');
        oauthToastShownRef.current = true;  // Mark that we've shown the toast
        setCheckingAuth(true);

        const storeState = useCalendarStore.getState();
        await storeState.checkGoogleCalendarConnection();

        const isConnected = useCalendarStore.getState().isGoogleCalendarConnected;
        setIsGoogleCalendarConnected(isConnected);
        setCheckingAuth(false);

        if (isConnected) {
          toastSuccess('Google Calendar connected successfully!');

          // Invalidate React Query caches so other pages will refetch with the new connection status
          const queryClient = getGlobalQueryClient();
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
          }
        }

        // Clean URL: remove query params so this doesn't run again on refresh
        // Use replaceState to update the browser history without reloading
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      } else if (hasError) {
        console.error('OAuth error:', hasError);
        const decodedError = decodeURIComponent(hasError);
        toastError(`Google Calendar connection failed: ${decodedError}`);
        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }
    };

    // Delay to ensure DOM is ready
    const timeoutId = setTimeout(handleOAuthCallback, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fetch configuration on mount
  useEffect(() => {
    fetchAllConfig();
    fetchCalendars();
    fetchClients();
    fetchBusinessHours();
    fetchMovements();

    // Check Google Calendar auth status using the store's connection check
    // This ensures we use the same logic as the Header sync button
    const storeState = useCalendarStore.getState();
    storeState.checkGoogleCalendarConnection().then(() => {
      const connected = useCalendarStore.getState().isGoogleCalendarConnected;
      setIsGoogleCalendarConnected(connected);
      setCheckingAuth(false);
    });

    // Check if browser timezone differs from app timezone
    if (hasTimezoneChanged()) {
      const savedTimezone = getAppTimezone();
      const browserTimezone = getBrowserTimezone();
      // Only show prompt if timezone was previously set (not default)
      if (savedTimezone !== 'America/Los_Angeles' || browserTimezone !== 'America/Los_Angeles') {
        setShowTimezonePrompt(true);
      }
    }
  }, [fetchAllConfig, fetchCalendars, fetchClients, fetchBusinessHours, fetchMovements]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const subscribeToAuth = async () => {
      const { auth } = await import('@/lib/firebase/config');

      const updateSignedInEmail = (user: { email?: string | null; providerData?: Array<{ email?: string | null }> } | null) => {
        const providerEmail = user?.providerData?.find((provider) => provider?.email)?.email || null;
        setSignedInGoogleEmail(user?.email || providerEmail || null);
      };

      updateSignedInEmail(auth.currentUser);
      unsubscribe = auth.onAuthStateChanged((user) => {
        updateSignedInEmail(user);
      });
    };

    subscribeToAuth().catch((error) => {
      console.error('Failed to load signed-in account email:', error);
      setSignedInGoogleEmail(null);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // One-time starter backfill: add first-pass descriptions/context for existing periods/templates
  useEffect(() => {
    if (hasBackfilledInitialDescriptionsRef.current || isBackfillingInitialDescriptionsRef.current) {
      return;
    }

    if (periods.length === 0 && workoutStructureTemplates.length === 0 && workoutTypes.length === 0) {
      return;
    }

    const periodsNeedingDescriptionRewrite = periods.filter((period) =>
      shouldRewritePeriodDescription(period)
    );
    const templatesNeedingUpdate = workoutStructureTemplates.filter((template) => {
      const missingOrWeakTemplateDescription = shouldRewriteTemplateDescription(template.description, template.name);
      const missingSectionGuidance = (template.sections || []).some(
        (section) => !section.configuration?.aiGuidance?.trim()
      );
      const missingSectionIntent = (template.sections || []).some(
        (section) => !section.workoutIntentId && !section.workoutIntentKey && !section.workoutIntentName
      );
      const missingSectionDefaults = (template.sections || []).some((section) => {
        const config = section.configuration || {};
        return !config.defaultStructure || !config.focusArea?.trim() || !config.defaultDuration;
      });
      return missingOrWeakTemplateDescription || missingSectionGuidance || missingSectionIntent || missingSectionDefaults;
    });

    const workoutTypesMissingDescription = workoutTypes.filter(
      (workoutType) => shouldRewriteWorkoutTypeDescription(workoutType)
    );

    if (
      periodsNeedingDescriptionRewrite.length === 0 &&
      templatesNeedingUpdate.length === 0 &&
      workoutTypesMissingDescription.length === 0
    ) {
      hasBackfilledInitialDescriptionsRef.current = true;
      return;
    }

    isBackfillingInitialDescriptionsRef.current = true;

    (async () => {
      try {
        let periodUpdates = 0;
        let templateUpdates = 0;
        let workoutTypeUpdates = 0;

        for (const period of periodsNeedingDescriptionRewrite) {
          await updatePeriod(period.id, { description: buildPeriodDescription(period) });
          periodUpdates += 1;
        }

        for (const template of templatesNeedingUpdate) {
          const nextDescription =
            shouldRewriteTemplateDescription(template.description, template.name)
              ? buildTemplateDescriptionWithContext(template, workoutTypes)
              : template.description;
          const nextSections = (template.sections || []).map((section) => {
            const hasGuidance = Boolean(section.configuration?.aiGuidance?.trim());
            const hasIntent = Boolean(section.workoutIntentId || section.workoutIntentKey || section.workoutIntentName);
            const matchedIntent = hasIntent ? undefined : resolveIntentForSection(section, workoutIntents);
            const defaultConfig = buildSectionConfigDefaults(section);
            const mergedConfig = {
              ...(section.configuration || {}),
              ...defaultConfig,
            };

            if (hasGuidance && hasIntent && Object.keys(defaultConfig).length === 0) return section;

            return {
              ...section,
              workoutIntentId: matchedIntent?.id ?? section.workoutIntentId,
              workoutIntentKey: matchedIntent?.key ?? section.workoutIntentKey,
              workoutIntentName: matchedIntent?.name ?? section.workoutIntentName,
              configuration: {
                ...mergedConfig,
                aiGuidance: hasGuidance ? section.configuration?.aiGuidance : buildRoundGuidance({
                  ...section,
                  configuration: mergedConfig,
                }),
              },
            };
          });

          await updateWorkoutStructureTemplate(template.id, {
            description: nextDescription,
            sections: nextSections,
          });
          templateUpdates += 1;
        }

        for (const workoutType of workoutTypesMissingDescription) {
          await updateWorkoutType(workoutType.id, {
            description: buildWorkoutTypeDescription(workoutType),
          });
          workoutTypeUpdates += 1;
        }

        if (periodUpdates > 0 || templateUpdates > 0 || workoutTypeUpdates > 0) {
          toastSuccess(
            `Added starter descriptions/context (${periodUpdates} period${periodUpdates === 1 ? '' : 's'}, ${templateUpdates} template${templateUpdates === 1 ? '' : 's'}, ${workoutTypeUpdates} workout type${workoutTypeUpdates === 1 ? '' : 's'}).`
          );
        }
      } catch (error) {
        console.error('Error backfilling starter descriptions/context:', error);
        toastError('Failed to add starter descriptions/context');
      } finally {
        hasBackfilledInitialDescriptionsRef.current = true;
        isBackfillingInitialDescriptionsRef.current = false;
      }
    })();
  }, [periods, workoutStructureTemplates, workoutTypes, workoutIntents, updatePeriod, updateWorkoutStructureTemplate, updateWorkoutType]);

  // Fetch unique locations from calendar events
  useEffect(() => {
    const fetchUniqueLocations = async () => {
      if (!calendarConfig.selectedCalendarId) {
        setUniqueLocations([]);
        return;
      }

      try {
        // Fetch events for a wide date range to get all locations
        const today = new Date();
        const startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3); // 3 months back
        const endDate = new Date(today);
        endDate.setMonth(today.getMonth() + 3); // 3 months forward

        const { fetchEvents } = useCalendarStore.getState();
        await fetchEvents({ start: startDate, end: endDate });

        // Get events from store
        const { events, config } = useCalendarStore.getState();

        // Extract locations from ALL events (not just coaching sessions)
        // This ensures we capture all locations including ones that might not be classified as coaching yet
        const locations = events
          .map(event => (event.location ? normalizeLocationKey(event.location) : ''))
          .filter((location): location is string => !!location && location.trim() !== '');

        // Get unique locations
        const unique = Array.from(new Set(locations));
        setUniqueLocations(unique.sort());
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    if (activeTab === 'app' && isGoogleCalendarConnected) {
      fetchUniqueLocations();
    }
  }, [activeTab, isGoogleCalendarConnected, calendarConfig.selectedCalendarId]);

  // Check auth status after OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');

    if (connected === 'true') {
      setIsGoogleCalendarConnected(true);
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      console.error('Google Calendar connection error:', error);
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Test Google Calendar connection by trying to fetch events
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setSyncError(null);

    try {
      // Try to fetch events for a small date range to test connection
      const now = new Date();
      const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

      const response = await fetch(
        `/api/calendar/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&calendarId=primary`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setSyncError('Authentication expired. Please reconnect Google Calendar.');
          setIsGoogleCalendarConnected(false);
          // Update store so Header sync button also knows
          useCalendarStore.setState({ isGoogleCalendarConnected: false });
        } else {
          setSyncError(errorData.error || 'Failed to fetch calendar events. Please check your connection.');
        }
        return;
      }

      // Connection is working
      setSyncError(null);
      setIsGoogleCalendarConnected(true);
      // Update store so Header sync button also knows
      useCalendarStore.setState({ isGoogleCalendarConnected: true });
      toastSuccess('Google Calendar connection is working!');
    } catch (error) {
      console.error('Error testing connection:', error);
      setSyncError('Failed to test connection. Please try again or reconnect.');
    } finally {
      setTestingConnection(false);
    }
  };

  // Handle Google Calendar connection
  const handleConnectGoogleCalendar = async () => {
    try {
      setTestingConnection(true);
      const { auth } = await import('@/lib/firebase/config');

      // Wait a moment for auth to initialize if it hasn't
      let currentUser = auth.currentUser;
      if (!currentUser) {
        // Simple retry once after 500ms
        await new Promise(resolve => setTimeout(resolve, 500));
        currentUser = auth.currentUser;
      }

      if (!currentUser) {
        toastError('You must be signed in to connect Google Calendar. Please refresh or sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      await initiateGoogleAuth(idToken);
    } catch (error) {
      console.error('Error initiating Google Calendar connection:', error);
      toastError(error instanceof Error ? error.message : 'Failed to connect to Google Calendar. Please try again.');
    } finally {
      setTestingConnection(false);
    }
  };

  // Handle Google Calendar disconnection
  const handleDisconnectGoogleCalendar = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? You will need to reconnect to create events.')) {
      return;
    }

    try {
      await disconnectGoogleCalendar();
      setIsGoogleCalendarConnected(false);
      setSyncError(null);
      // Refresh calendar store
      const storeState = useCalendarStore.getState();
      await storeState.checkGoogleCalendarConnection();
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toastError('Failed to disconnect Google Calendar. Please try again.');
    }
  };

  // State for forms - track editing IDs instead of showing forms at top
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingWorkoutTypeId, setEditingWorkoutTypeId] = useState<string | null>(null);
  const [editingWorkoutIntentId, setEditingWorkoutIntentId] = useState<string | null>(null);
  const [editingWorkoutStructureTemplate, setEditingWorkoutStructureTemplate] = useState<WorkoutStructureTemplate | null>(null);

  // For new items (show form at top)
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [showNewWorkoutTypeForm, setShowNewWorkoutTypeForm] = useState(false);
  const [showNewWorkoutIntentForm, setShowNewWorkoutIntentForm] = useState(false);
  const [showWorkoutStructureTemplateForm, setShowWorkoutStructureTemplateForm] = useState(false);

  // Temporary editing state for inline editing
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WeekTemplate | null>(null);
  const [editingCategory, setEditingCategory] = useState<WorkoutCategory | null>(null);
  const [editingWorkoutType, setEditingWorkoutType] = useState<WorkoutType | null>(null);
  const [editingWorkoutIntent, setEditingWorkoutIntent] = useState<WorkoutIntent | null>(null);

  // Calendar configuration state
  const [showTestEventForm, setShowTestEventForm] = useState(false);
  const [testEventData, setTestEventData] = useState<TestEventInput>({
    summary: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    location: '',
    description: ''
  });
  const [selectedTestClient, setSelectedTestClient] = useState<string>('none');
  const [selectedTestCategory, setSelectedTestCategory] = useState<string>('none');
  const [selectedTestStructure, setSelectedTestStructure] = useState<string>('none');

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#6b7280'
  ];

  // Period handlers
  const handleAddPeriod = () => {
    const tempId = `temp_${Date.now()}`;
    setEditingPeriod({
      id: tempId,
      name: '',
      color: '#3b82f6',
      focus: '',
      description: '',
      order: periods.length
    });
    setShowNewPeriodForm(true);
  };

  const handleEditPeriod = (period: Period) => {
    setEditingPeriod({ ...period });
    setEditingPeriodId(period.id);
  };

  const handleSavePeriod = async () => {
    if (editingPeriod) {
      try {
        if (editingPeriod.id.startsWith('temp_')) {
          // New period
          const description = editingPeriod.description?.trim() || buildPeriodDescription(editingPeriod);
          await addPeriod({
            name: editingPeriod.name,
            color: editingPeriod.color,
            focus: editingPeriod.focus,
            description,
            order: editingPeriod.order || 0
          });
          setShowNewPeriodForm(false);
        } else {
          // Update existing
          const description = editingPeriod.description?.trim() || buildPeriodDescription(editingPeriod);
          await updatePeriod(editingPeriod.id, {
            name: editingPeriod.name,
            color: editingPeriod.color,
            focus: editingPeriod.focus,
            description,
            order: editingPeriod.order
          });
          setEditingPeriodId(null);
        }
        setEditingPeriod(null);
        toastSuccess('Period saved');
      } catch (error) {
        console.error('Error saving period:', error);
        toastError('Failed to save period');
      }
    }
  };

  const handleCancelPeriod = () => {
    setEditingPeriod(null);
    setEditingPeriodId(null);
    setShowNewPeriodForm(false);
  };

  const handleDeletePeriod = (id: string) => {
    deletePeriod(id);
  };

  // Week Template handlers
  const handleAddWeekTemplate = () => {
    const tempId = `temp_${Date.now()}`;
    setEditingTemplate({
      id: tempId,
      name: '',
      color: '#10b981',
      days: [
        { day: 'Monday', workoutCategory: 'Workout' },
        { day: 'Wednesday', workoutCategory: 'Workout' },
        { day: 'Friday', workoutCategory: 'Workout' }
      ],
      order: weekTemplates.length
    });
    setShowNewTemplateForm(true);
  };

  const handleEditWeekTemplate = (template: WeekTemplate) => {
    setEditingTemplate({ ...template });
    setEditingTemplateId(template.id);
  };

  const handleSaveWeekTemplate = async () => {
    if (editingTemplate) {
      try {
        // Filter out rest days before saving
        const activeDays = editingTemplate.days.filter(day =>
          day.workoutCategory && day.workoutCategory.toLowerCase() !== 'rest day'
        );

        if (editingTemplate.id.startsWith('temp_')) {
          // New template
          await addWeekTemplate({
            name: editingTemplate.name,
            color: editingTemplate.color,
            days: activeDays,
            order: editingTemplate.order || 0
          });
          setShowNewTemplateForm(false);
        } else {
          // Update existing
          await updateWeekTemplate(editingTemplate.id, {
            name: editingTemplate.name,
            color: editingTemplate.color,
            days: activeDays,
            order: editingTemplate.order
          });
          setEditingTemplateId(null);
        }
        setEditingTemplate(null);
        toastSuccess('Week template saved');
      } catch (error) {
        console.error('Error saving week template:', error);
        toastError('Failed to save week template');
      }
    }
  };

  const handleCancelWeekTemplate = () => {
    setEditingTemplate(null);
    setEditingTemplateId(null);
    setShowNewTemplateForm(false);
  };

  const handleDeleteWeekTemplate = (id: string) => {
    deleteWeekTemplate(id);
  };

  const updateTemplateDay = (index: number, updates: Partial<{ day: string; workoutCategory: string }>) => {
    if (editingTemplate) {
      const updatedDays = [...editingTemplate.days];
      updatedDays[index] = { ...updatedDays[index], ...updates };
      setEditingTemplate({ ...editingTemplate, days: updatedDays });
    }
  };

  const deleteTemplateDay = (index: number) => {
    if (editingTemplate) {
      const updatedDays = editingTemplate.days.filter((_, i) => i !== index);
      setEditingTemplate({ ...editingTemplate, days: updatedDays });
    }
  };

  const addTemplateDay = () => {
    if (editingTemplate) {
      setEditingTemplate({
        ...editingTemplate,
        days: [...editingTemplate.days, { day: '', workoutCategory: 'Workout' }]
      });
    }
  };

  // Workout Category handlers
  const handleAddCategory = () => {
    const tempId = `temp_${Date.now()}`;
    setEditingCategory({
      id: tempId,
      name: '',
      color: '#f59e0b',
      order: workoutCategories.length
    });
    setShowNewCategoryForm(true);
  };

  const handleEditCategory = (category: WorkoutCategory) => {
    setEditingCategory({ ...category });
    setEditingCategoryId(category.id);
  };

  const handleSaveCategory = async () => {
    if (editingCategory) {
      try {
        if (editingCategory.id.startsWith('temp_')) {
          // New category
          await addWorkoutCategory({
            name: editingCategory.name,
            color: editingCategory.color,
            order: editingCategory.order || 0
          });
          setShowNewCategoryForm(false);
        } else {
          // Update existing
          await updateWorkoutCategory(editingCategory.id, {
            name: editingCategory.name,
            color: editingCategory.color,
            order: editingCategory.order
          });
          setEditingCategoryId(null);
        }
        setEditingCategory(null);
        toastSuccess('Workout category saved');
      } catch (error) {
        console.error('Error saving workout category:', error);
        toastError('Failed to save workout category');
      }
    }
  };

  const handleCancelCategory = () => {
    setEditingCategory(null);
    setEditingCategoryId(null);
    setShowNewCategoryForm(false);
  };

  const handleDeleteCategory = (id: string) => {
    deleteWorkoutCategory(id);
  };

  // Workout Type handlers
  const handleAddWorkoutType = () => {
    const tempId = `temp_${Date.now()}`;
    setEditingWorkoutType({
      id: tempId,
      name: '',
      color: '#8b5cf6',
      description: '',
      order: workoutTypes.length
    });
    setShowNewWorkoutTypeForm(true);
  };

  const handleEditWorkoutType = (workoutType: WorkoutType) => {
    setEditingWorkoutType({ ...workoutType });
    setEditingWorkoutTypeId(workoutType.id);
  };

  const handleSaveWorkoutType = async () => {
    if (editingWorkoutType) {
      try {
        const description = editingWorkoutType.description?.trim() || buildWorkoutTypeDescription(editingWorkoutType);

        if (editingWorkoutType.id.startsWith('temp_')) {
          // New workout type
          await addWorkoutType({
            name: editingWorkoutType.name,
            color: editingWorkoutType.color,
            description,
            order: editingWorkoutType.order || 0
          });
          setShowNewWorkoutTypeForm(false);
        } else {
          // Update existing
          await updateWorkoutType(editingWorkoutType.id, {
            name: editingWorkoutType.name,
            color: editingWorkoutType.color,
            description,
            order: editingWorkoutType.order
          });
          setEditingWorkoutTypeId(null);
        }
        setEditingWorkoutType(null);
        toastSuccess('Workout type saved');
      } catch (error) {
        console.error('Error saving workout type:', error);
        toastError('Failed to save workout type');
      }
    }
  };

  const handleCancelWorkoutType = () => {
    setEditingWorkoutType(null);
    setEditingWorkoutTypeId(null);
    setShowNewWorkoutTypeForm(false);
  };

  const handleDeleteWorkoutType = (id: string) => {
    deleteWorkoutType(id);
  };

  // Workout Intent handlers
  const toIntentKey = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleAddWorkoutIntent = () => {
    const tempId = `temp_${Date.now()}`;
    setEditingWorkoutIntent({
      id: tempId,
      key: '',
      name: '',
      color: '#14b8a6',
      description: '',
      order: workoutIntents.length,
    });
    setShowNewWorkoutIntentForm(true);
  };

  const handleEditWorkoutIntent = (workoutIntent: WorkoutIntent) => {
    setEditingWorkoutIntent({ ...workoutIntent });
    setEditingWorkoutIntentId(workoutIntent.id);
  };

  const handleSaveWorkoutIntent = async () => {
    if (!editingWorkoutIntent) return;

    try {
      const normalizedKey = toIntentKey(editingWorkoutIntent.key || editingWorkoutIntent.name);

      if (!normalizedKey) {
        toastWarning('Intent key is required');
        return;
      }

      const duplicate = workoutIntents.find((intent) =>
        intent.id !== editingWorkoutIntent.id && intent.key === normalizedKey
      );
      if (duplicate) {
        toastWarning('Intent key must be unique');
        return;
      }

      const payload = {
        key: normalizedKey,
        name: editingWorkoutIntent.name,
        color: editingWorkoutIntent.color,
        description: editingWorkoutIntent.description,
        order: editingWorkoutIntent.order || 0,
      };

      if (editingWorkoutIntent.id.startsWith('temp_')) {
        await addWorkoutIntent(payload);
        setShowNewWorkoutIntentForm(false);
      } else {
        await updateWorkoutIntent(editingWorkoutIntent.id, payload);
        setEditingWorkoutIntentId(null);
      }

      setEditingWorkoutIntent(null);
      toastSuccess('Workout intent saved');
    } catch (error) {
      console.error('Error saving workout intent:', error);
      toastError('Failed to save workout intent');
    }
  };

  const handleCancelWorkoutIntent = () => {
    setEditingWorkoutIntent(null);
    setEditingWorkoutIntentId(null);
    setShowNewWorkoutIntentForm(false);
  };

  const handleDeleteWorkoutIntent = (id: string) => {
    deleteWorkoutIntent(id);
  };

  // Calendar configuration handlers
  const loadPlannerMetadata = useCallback(async () => {
    setPlannerMetadataLoading(true);
    setPlannerMetadataError(null);
    try {
      const response = await fetch('/api/planner/bootstrap', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load planner metadata');
      }

      const eventTypes = Array.isArray(payload?.eventTypes) ? payload.eventTypes : [];
      const calendars = Array.isArray(payload?.calendars) ? payload.calendars : [];

      setPlannerEventTypes(eventTypes);
      setPlannerCalendars(calendars);
    } catch (error) {
      console.error('Failed to load planner metadata:', error);
      setPlannerMetadataError(error instanceof Error ? error.message : 'Failed to load planner metadata');
    } finally {
      setPlannerMetadataLoading(false);
    }
  }, []);

  const createPlannerEventType = async () => {
    const name = newPlannerEventType.trim();
    if (!name) return;

    setPlannerMetadataSaving(true);
    try {
      const response = await fetch('/api/planner/admin/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create event type');
      }

      setNewPlannerEventType('');
      toastSuccess('Event type created');
      await loadPlannerMetadata();
    } catch (error) {
      console.error('Failed to create planner event type:', error);
      toastError(error instanceof Error ? error.message : 'Failed to create event type');
    } finally {
      setPlannerMetadataSaving(false);
    }
  };

  const createPlannerCalendar = async () => {
    const name = newPlannerCalendar.trim();
    if (!name) return;

    setPlannerMetadataSaving(true);
    try {
      const response = await fetch('/api/planner/admin/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create calendar');
      }

      setNewPlannerCalendar('');
      toastSuccess('Planner calendar created');
      await loadPlannerMetadata();
    } catch (error) {
      console.error('Failed to create planner calendar:', error);
      toastError(error instanceof Error ? error.message : 'Failed to create planner calendar');
    } finally {
      setPlannerMetadataSaving(false);
    }
  };

  const deletePlannerEventType = async (eventTypeId: string) => {
    if (!window.confirm('Delete this event type?')) {
      return;
    }

    setPlannerMetadataSaving(true);
    try {
      const response = await fetch(`/api/planner/admin/event-types?event_type_id=${encodeURIComponent(eventTypeId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete event type');
      }

      toastSuccess('Event type deleted');
      await loadPlannerMetadata();
    } catch (error) {
      console.error('Failed to delete planner event type:', error);
      toastError(error instanceof Error ? error.message : 'Failed to delete event type');
    } finally {
      setPlannerMetadataSaving(false);
    }
  };

  const deletePlannerCalendar = async (calendarId: string) => {
    if (!window.confirm('Delete this planner calendar?')) {
      return;
    }

    setPlannerMetadataSaving(true);
    try {
      const response = await fetch(`/api/planner/admin/calendars?calendar_id=${encodeURIComponent(calendarId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete planner calendar');
      }

      toastSuccess('Planner calendar deleted');
      await loadPlannerMetadata();
    } catch (error) {
      console.error('Failed to delete planner calendar:', error);
      toastError(error instanceof Error ? error.message : 'Failed to delete planner calendar');
    } finally {
      setPlannerMetadataSaving(false);
    }
  };

  useEffect(() => {
    void loadPlannerMetadata();
  }, [loadPlannerMetadata]);

  const handleCreateTestEvent = async () => {
    if (!testEventData.date || !testEventData.startTime || !testEventData.endTime) {
      toastWarning('Please fill in date and time fields');
      return;
    }

    if (!selectedTestClient || selectedTestClient === 'none') {
      toastWarning('Please select a client.');
      return;
    }

    try {
      // Use the summary field for event title (contains keywords like "Personal Training")
      // Client name is stored separately and will be used for display in month view
      const eventTitle = testEventData.summary || 'Session';

      // Create the calendar event
      await createTestEvent({
        ...testEventData,
        summary: eventTitle,
        // Store additional metadata in description for now
        description: `${testEventData.description || ''}${testEventData.description ? '\n\n' : ''}[Metadata: client=${selectedTestClient}, category=${selectedTestCategory}, structure=${selectedTestStructure}]`
      });

      // Reset form
      setTestEventData({
        summary: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        location: '',
        description: ''
      });
      setSelectedTestClient('none');
      setSelectedTestCategory('none');
      setSelectedTestStructure('none');
      setShowTestEventForm(false);

      toastSuccess('Test event created successfully!');
    } catch (error) {
      console.error('Failed to create test event:', error);
      toastError('Failed to create test event.');
    }
  };

  // Location abbreviation handlers
  const handleAddLocationAbbreviation = (original: string) => {
    const normalizedOriginal = normalizeLocationKey(original);
    const abbreviations = calendarConfig.locationAbbreviations || [];
    const existing = abbreviations.find(abbr => normalizeLocationKey(abbr.original) === normalizedOriginal);

    if (existing) {
      setEditingLocation({ ...existing, original: normalizeLocationKey(existing.original) });
      setLocationAbbreviationInput(existing.abbreviation);
    } else {
      const newAbbr: LocationAbbreviation = {
        original: normalizedOriginal,
        abbreviation: normalizedOriginal // Default to original, user can edit
      };
      setEditingLocation(newAbbr);
      setLocationAbbreviationInput(normalizedOriginal);
    }
  };

  const handleSaveLocationAbbreviation = async () => {
    if (!editingLocation) return;

    try {
      const abbreviations = calendarConfig.locationAbbreviations || [];
      const normalizedOriginal = normalizeLocationKey(editingLocation.original);
      const existingIndex = abbreviations.findIndex(abbr => normalizeLocationKey(abbr.original) === normalizedOriginal);
      const existing = existingIndex >= 0 ? abbreviations[existingIndex] : undefined;

      const updatedAbbr: LocationAbbreviation = {
        original: normalizedOriginal,
        abbreviation: locationAbbreviationInput.trim() || normalizedOriginal,
        // Preserve ignored state when editing an existing / N/A entry, default to false if undefined
        ignored: existing?.ignored ?? editingLocation.ignored ?? false
      };

      let updatedAbbreviations: LocationAbbreviation[];
      if (existingIndex >= 0) {
        updatedAbbreviations = [...abbreviations];
        updatedAbbreviations[existingIndex] = updatedAbbr;
      } else {
        updatedAbbreviations = [...abbreviations, updatedAbbr];
      }

      // Normalize all abbreviations before saving - preserve original casing but use normalized for comparison
      const normalizedAbbreviations = updatedAbbreviations.map(a => {
        // Preserve original casing for display
        const originalDisplay = a.original.trim().replace(/\s+/g, ' ');
        const normalizedKey = normalizeLocationKey(a.original);

        const normalized: LocationAbbreviation = {
          original: originalDisplay, // Keep original casing for display
          abbreviation: (a.abbreviation || '').trim() || originalDisplay,
        };
        // Only include ignored if it's explicitly true or false (not undefined)
        if (a.ignored !== undefined) {
          normalized.ignored = a.ignored;
        }
        return { normalized, normalizedKey };
      }).filter(item => item.normalizedKey.length > 0);

      // Deduplicate by normalized key (keep the last one if duplicates exist)
      const deduplicatedMap = new Map<string, LocationAbbreviation>();
      for (const item of normalizedAbbreviations) {
        deduplicatedMap.set(item.normalizedKey, item.normalized);
      }
      const deduplicatedAbbreviations = Array.from(deduplicatedMap.values());

      // Update local state immediately
      updateCalendarConfig({ locationAbbreviations: deduplicatedAbbreviations });

      // Also save directly to Firebase to ensure persistence
      await updateCalendarSyncConfig({ locationAbbreviations: deduplicatedAbbreviations });

      toastSuccess('Location abbreviation saved');
      setEditingLocation(null);
      setLocationAbbreviationInput('');
    } catch (error) {
      console.error('Error saving location abbreviation:', error);
      toastError('Failed to save location abbreviation. Please try again.');
    }
  };

  const handleDeleteLocationAbbreviation = (original: string) => {
    const abbreviations = calendarConfig.locationAbbreviations || [];
    const key = normalizeLocationKey(original);
    const updated = abbreviations.filter(abbr => normalizeLocationKey(abbr.original) !== key);
    updateCalendarConfig({ locationAbbreviations: updated });
  };

  const getLocationDisplay = (location: string): string => {
    const abbreviations = calendarConfig.locationAbbreviations || [];
    const key = normalizeLocationKey(location);
    const abbr = abbreviations.find(a => normalizeLocationKey(a.original) === key);
    // If location is ignored, return empty string (don't display)
    if (abbr?.ignored) return '';
    return abbr ? abbr.abbreviation : location;
  };

  const handleToggleLocationIgnored = (original: string) => {
    const normalizedOriginal = normalizeLocationKey(original);
    const abbreviations = calendarConfig.locationAbbreviations || [];
    const existingIndex = abbreviations.findIndex(abbr => normalizeLocationKey(abbr.original) === normalizedOriginal);

    let updatedAbbreviations: LocationAbbreviation[];
    if (existingIndex >= 0) {
      // Toggle ignored status
      updatedAbbreviations = [...abbreviations];
      updatedAbbreviations[existingIndex] = {
        ...updatedAbbreviations[existingIndex],
        ignored: !updatedAbbreviations[existingIndex].ignored
      };
    } else {
      // Create new entry marked as ignored
      updatedAbbreviations = [...abbreviations, {
        original: normalizedOriginal,
        abbreviation: normalizedOriginal,
        ignored: true
      }];
    }

    updateCalendarConfig({ locationAbbreviations: updatedAbbreviations });
  };

  const handleSaveCoachingKeywords = async () => {
    try {
      const keywordArray = coachingKeywordsInput.split(',').map(k => k.trim()).filter(k => k);
      // Ensure we always pass an array, never undefined
      updateCalendarConfig({
        coachingKeywords: keywordArray.length > 0 ? keywordArray : [],
        coachingColor
      });
      toastSuccess('Coaching session settings saved');
    } catch (error) {
      console.error('Error saving coaching keywords:', error);
      toastError('Failed to save coaching settings. Please try again.');
    }
  };

  const handleSaveClassKeywords = async () => {
    try {
      const keywordArray = classKeywordsInput.split(',').map(k => k.trim()).filter(k => k);
      // Ensure we always pass an array, never undefined
      updateCalendarConfig({
        classKeywords: keywordArray.length > 0 ? keywordArray : [],
        classColor
      });
      toastSuccess('Class session settings saved');
    } catch (error) {
      console.error('Error saving class keywords:', error);
      toastError('Failed to save class settings. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      // Handle different types of drag operations
      if (active.id.startsWith('period-')) {
        const oldIndex = periods.findIndex((item) => item.id === active.id.replace('period-', ''));
        const newIndex = periods.findIndex((item) => item.id === over.id.replace('period-', ''));
        const reordered = arrayMove(periods, oldIndex, newIndex);
        // Update order for all items
        reordered.forEach((item, index) => {
          updatePeriod(item.id, { order: index });
        });
      } else if (active.id.startsWith('template-')) {
        const oldIndex = weekTemplates.findIndex((item) => item.id === active.id.replace('template-', ''));
        const newIndex = weekTemplates.findIndex((item) => item.id === over.id.replace('template-', ''));
        const reordered = arrayMove(weekTemplates, oldIndex, newIndex);
        // Update order for all items
        reordered.forEach((item, index) => {
          updateWeekTemplate(item.id, { order: index });
        });
      } else if (active.id.startsWith('category-')) {
        const oldIndex = workoutCategories.findIndex((item) => item.id === active.id.replace('category-', ''));
        const newIndex = workoutCategories.findIndex((item) => item.id === over.id.replace('category-', ''));
        const reordered = arrayMove(workoutCategories, oldIndex, newIndex);
        // Update order for all items
        reordered.forEach((item, index) => {
          updateWorkoutCategory(item.id, { order: index });
        });
      } else if (active.id.startsWith('workoutType-')) {
        const oldIndex = workoutTypes.findIndex((item) => item.id === active.id.replace('workoutType-', ''));
        const newIndex = workoutTypes.findIndex((item) => item.id === over.id.replace('workoutType-', ''));
        const reordered = arrayMove(workoutTypes, oldIndex, newIndex);
        // Update order for all items
        reordered.forEach((item, index) => {
          updateWorkoutType(item.id, { order: index });
        });
      } else if (active.id.startsWith('workoutIntent-')) {
        const oldIndex = workoutIntents.findIndex((item) => item.id === active.id.replace('workoutIntent-', ''));
        const newIndex = workoutIntents.findIndex((item) => item.id === over.id.replace('workoutIntent-', ''));
        const reordered = arrayMove(workoutIntents, oldIndex, newIndex);
        reordered.forEach((item, index) => {
          updateWorkoutIntent(item.id, { order: index });
        });
      }
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto px-4 pt-1 pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration</h1>
        <p className="text-gray-600">Manage your periods, templates, categories, and workout types.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'workout' | 'app' | 'setup')}>
        <TabsList className="mb-6 flex flex-wrap gap-2">
          <TabsTrigger value="workout">Workout Config.</TabsTrigger>
          <TabsTrigger value="app">App Config.</TabsTrigger>
          <TabsTrigger value="setup">Coach Setup Hub</TabsTrigger>
        </TabsList>

        <TabsContent value="workout">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Periods Section */}
              <div ref={periodsSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 icon-period" />
                    Periods
                  </h3>
                  <Button variant="outline" onClick={handleAddPeriod} size="sm">
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Period
                  </Button>
                </div>

                {/* New Period Form (at top) */}
                {showNewPeriodForm && editingPeriod && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 px-3">
                      <CardTitle className="text-base">Add Period</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Period name"
                          value={editingPeriod.name}
                          onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                        <Input
                          placeholder="Focus"
                          value={editingPeriod.focus}
                          onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, focus: e.target.value } : null)}
                        />
                      </div>
                      <Input
                        placeholder="Description"
                        value={editingPeriod.description || ''}
                        onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, description: e.target.value } : null)}
                      />
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Color:</label>
                        <div className="flex gap-2">
                          {colors.map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded-full border-2 ${editingPeriod.color === color ? 'border-gray-900' : 'border-gray-300'
                                }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditingPeriod(prev => prev ? { ...prev, color } : null)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={handleSavePeriod} className="flex-1">
                          <Save className="h-4 w-4 mr-2 icon-success" />
                          Save Period
                        </Button>
                        <Button variant="outline" onClick={handleCancelPeriod} className="flex-1">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Periods List */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={periods.map(p => `period-${p.id}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {periods.map((period) => (
                        editingPeriodId === period.id && editingPeriod ? (
                          <Card key={period.id} className="py-0">
                            <CardContent className="space-y-4 p-0 px-3 py-2">
                              <div className="grid grid-cols-2 gap-4">
                                <Input
                                  placeholder="Period name"
                                  value={editingPeriod.name}
                                  onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                                <Input
                                  placeholder="Focus"
                                  value={editingPeriod.focus}
                                  onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, focus: e.target.value } : null)}
                                />
                              </div>
                              <Input
                                placeholder="Description"
                                value={editingPeriod.description || ''}
                                onChange={(e) => setEditingPeriod(prev => prev ? { ...prev, description: e.target.value } : null)}
                              />
                              <div className="flex items-center gap-4">
                                <label className="text-sm font-medium">Color:</label>
                                <div className="flex gap-2">
                                  {colors.map((color) => (
                                    <button
                                      key={color}
                                      className={`w-6 h-6 rounded-full border-2 ${editingPeriod.color === color ? 'border-gray-900' : 'border-gray-300'
                                        }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => setEditingPeriod(prev => prev ? { ...prev, color } : null)}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={handleSavePeriod} className="flex-1">
                                  <Save className="h-4 w-4 mr-2 icon-success" />
                                  Save
                                </Button>
                                <Button variant="outline" onClick={handleCancelPeriod} className="flex-1">
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <SortableItem
                            key={period.id}
                            item={period}
                            onEdit={handleEditPeriod}
                            onDelete={handleDeletePeriod}
                            index={periods.indexOf(period)}
                            type="period"
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Week Templates Section */}
              <div ref={weekTemplatesSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5 icon-template" />
                    Week Templates
                  </h3>
                  <Button variant="outline" onClick={handleAddWeekTemplate} size="sm">
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Template
                  </Button>
                </div>

                {/* New Week Template Form (at top) */}
                {showNewTemplateForm && editingTemplate && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 px-3">
                      <CardTitle className="text-base">Add Week Template</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Template name"
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium">Color:</label>
                          <div className="flex gap-2">
                            {colors.map((color) => (
                              <button
                                key={color}
                                className={`w-6 h-6 rounded-full border-2 ${editingTemplate.color === color ? 'border-gray-900' : 'border-gray-300'
                                  }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingTemplate(prev => prev ? { ...prev, color } : null)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Workout Days:</label>
                          <Button onClick={addTemplateDay} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-1.5 icon-add" />
                            Add Day
                          </Button>
                        </div>
                        {editingTemplate.days
                          .filter(day => day.workoutCategory && day.workoutCategory.toLowerCase() !== 'rest day')
                          .map((day, index) => {
                            const originalIndex = editingTemplate.days.indexOf(day);
                            return (
                              <HorizontalDayItem
                                key={originalIndex}
                                day={day}
                                index={originalIndex}
                                onUpdate={updateTemplateDay}
                                onDelete={deleteTemplateDay}
                              />
                            );
                          })}
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={handleSaveWeekTemplate} className="flex-1">
                          <Save className="h-4 w-4 mr-2 icon-success" />
                          Save Template
                        </Button>
                        <Button variant="outline" onClick={handleCancelWeekTemplate} className="flex-1">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Week Templates List */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={weekTemplates.map(t => `template-${t.id}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {weekTemplates.map((template) => (
                        editingTemplateId === template.id && editingTemplate ? (
                          <Card key={template.id} className="py-0">
                            <CardContent className="space-y-4 p-0 px-3 py-2">
                              <div className="grid grid-cols-2 gap-4">
                                <Input
                                  placeholder="Template name"
                                  value={editingTemplate.name}
                                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                                <div className="flex items-center gap-4">
                                  <label className="text-sm font-medium">Color:</label>
                                  <div className="flex gap-2">
                                    {colors.map((color) => (
                                      <button
                                        key={color}
                                        className={`w-6 h-6 rounded-full border-2 ${editingTemplate.color === color ? 'border-gray-900' : 'border-gray-300'
                                          }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setEditingTemplate(prev => prev ? { ...prev, color } : null)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium">Workout Days:</label>
                                  <Button onClick={addTemplateDay} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                                    Add Day
                                  </Button>
                                </div>
                                {editingTemplate.days
                                  .filter(day => day.workoutCategory && day.workoutCategory.toLowerCase() !== 'rest day')
                                  .map((day, index) => {
                                    const originalIndex = editingTemplate.days.indexOf(day);
                                    return (
                                      <HorizontalDayItem
                                        key={originalIndex}
                                        day={day}
                                        index={originalIndex}
                                        onUpdate={updateTemplateDay}
                                        onDelete={deleteTemplateDay}
                                      />
                                    );
                                  })}
                              </div>

                              <div className="flex gap-2">
                                <Button variant="outline" onClick={handleSaveWeekTemplate} className="flex-1">
                                  <Save className="h-4 w-4 mr-2 icon-success" />
                                  Save
                                </Button>
                                <Button variant="outline" onClick={handleCancelWeekTemplate} className="flex-1">
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <SortableItem
                            key={template.id}
                            item={template}
                            onEdit={handleEditWeekTemplate}
                            onDelete={handleDeleteWeekTemplate}
                            index={weekTemplates.indexOf(template)}
                            type="template"
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Workout Categories Section */}
              <div ref={workoutCategoriesSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 icon-workout" />
                    Workout Categories
                  </h3>
                  <Button variant="outline" onClick={handleAddCategory} size="sm">
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Category
                  </Button>
                </div>

                {/* New Category Form (at top) */}
                {showNewCategoryForm && editingCategory && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 px-3">
                      <CardTitle className="text-base">Add Workout Category</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3">
                      <Input
                        placeholder="Category name"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                      />
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Color:</label>
                        <div className="flex gap-2">
                          {colors.map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded-full border-2 ${editingCategory.color === color ? 'border-gray-900' : 'border-gray-300'
                                }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditingCategory(prev => prev ? { ...prev, color } : null)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={handleSaveCategory} className="flex-1">
                          <Save className="h-4 w-4 mr-2 icon-success" />
                          Save Category
                        </Button>
                        <Button variant="outline" onClick={handleCancelCategory} className="flex-1">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Categories List */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={workoutCategories.map(c => `category-${c.id}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {workoutCategories.map((category) => (
                        editingCategoryId === category.id && editingCategory ? (
                          <Card key={category.id} className="py-0">
                            <CardContent className="space-y-4 p-0 px-3 py-2">
                              <Input
                                placeholder="Category name"
                                value={editingCategory.name}
                                onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                              />
                              <div className="flex items-center gap-4">
                                <label className="text-sm font-medium">Color:</label>
                                <div className="flex gap-2">
                                  {colors.map((color) => (
                                    <button
                                      key={color}
                                      className={`w-6 h-6 rounded-full border-2 ${editingCategory.color === color ? 'border-gray-900' : 'border-gray-300'
                                        }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => setEditingCategory(prev => prev ? { ...prev, color } : null)}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={handleSaveCategory} className="flex-1">
                                  <Save className="h-4 w-4 mr-2 icon-success" />
                                  Save
                                </Button>
                                <Button variant="outline" onClick={handleCancelCategory} className="flex-1">
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <div key={category.id} className="px-3 py-2 border rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                <div>
                                  <h4 className="font-semibold leading-tight">{category.name}</h4>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  <Edit className="h-4 w-4 icon-edit" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Linked Template Dropdown */}
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-700">Linked Template:</label>
                              <Select
                                value={category.linkedWorkoutStructureTemplateId || 'none'}
                                onValueChange={(value) => {
                                  updateWorkoutCategory(category.id, {
                                    linkedWorkoutStructureTemplateId: value === 'none' ? '' : value
                                  });
                                }}
                              >
                                <SelectTrigger className="w-48 h-8 text-xs">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {workoutStructureTemplates.map((template) => (
                                    <SelectItem key={template.id} value={template.id}>
                                      {template.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Workout Structure Templates Section */}
              <div ref={workoutStructuresSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5 icon-workout" />
                    Workout Structure Templates
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingWorkoutStructureTemplate(null);
                      setShowWorkoutStructureTemplateForm(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Template
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {workoutStructureTemplates.map((template) => (
                    <WorkoutStructureTemplateCard
                      key={template.id}
                      template={template}
                      workoutTypes={workoutTypes}
                      workoutIntents={workoutIntents}
                      onEdit={(template) => {
                        setEditingWorkoutStructureTemplate(template);
                        setShowWorkoutStructureTemplateForm(true);
                      }}
                      onDelete={deleteWorkoutStructureTemplate}
                      onUpdateSection={(templateId, sectionIndex, updates) => {
                        // Handle section updates
                        const template = workoutStructureTemplates.find(t => t.id === templateId);
                        if (template) {
                          const updatedSections = [...template.sections];
                          updatedSections[sectionIndex] = { ...updatedSections[sectionIndex], ...updates };
                          updateWorkoutStructureTemplate(templateId, { sections: updatedSections });
                        }
                      }}
                      onReorderSections={(templateId, fromIndex, toIndex) => {
                        // Handle section reordering
                        const template = workoutStructureTemplates.find(t => t.id === templateId);
                        if (template) {
                          const updatedSections = [...template.sections];
                          const [movedSection] = updatedSections.splice(fromIndex, 1);
                          updatedSections.splice(toIndex, 0, movedSection);
                          // Update order indices
                          const reorderedSections = updatedSections.map((section, index) => ({
                            ...section,
                            order: index
                          }));
                          updateWorkoutStructureTemplate(templateId, { sections: reorderedSections });
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Workout Types Section */}
              <div ref={workoutTypesSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="h-5 w-5 icon-settings" />
                    Workout Types
                  </h3>
                  <Button variant="outline" onClick={handleAddWorkoutType} size="sm">
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Workout Type
                  </Button>
                </div>

                {/* New Workout Type Form (at top) */}
                {showNewWorkoutTypeForm && editingWorkoutType && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 px-3">
                      <CardTitle className="text-base">Add Workout Type</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Workout type name"
                          value={editingWorkoutType.name}
                          onChange={(e) => setEditingWorkoutType(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                        <Input
                          placeholder="Description"
                          value={editingWorkoutType.description}
                          onChange={(e) => setEditingWorkoutType(prev => prev ? { ...prev, description: e.target.value } : null)}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Color:</label>
                        <div className="flex gap-2">
                          {colors.map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded-full border-2 ${editingWorkoutType.color === color ? 'border-gray-900' : 'border-gray-300'
                                }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditingWorkoutType(prev => prev ? { ...prev, color } : null)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={handleSaveWorkoutType} className="flex-1">
                          <Save className="h-4 w-4 mr-2 icon-success" />
                          Save Workout Type
                        </Button>
                        <Button variant="outline" onClick={handleCancelWorkoutType} className="flex-1">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Workout Types List */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={workoutTypes.map(w => `workoutType-${w.id}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {workoutTypes.map((workoutType) => (
                        editingWorkoutTypeId === workoutType.id && editingWorkoutType ? (
                          <Card key={workoutType.id} className="py-0">
                            <CardContent className="space-y-4 p-0 px-3 py-2">
                              <div className="grid grid-cols-2 gap-4">
                                <Input
                                  placeholder="Workout type name"
                                  value={editingWorkoutType.name}
                                  onChange={(e) => setEditingWorkoutType(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                                <Input
                                  placeholder="Description"
                                  value={editingWorkoutType.description}
                                  onChange={(e) => setEditingWorkoutType(prev => prev ? { ...prev, description: e.target.value } : null)}
                                />
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="text-sm font-medium">Color:</label>
                                <div className="flex gap-2">
                                  {colors.map((color) => (
                                    <button
                                      key={color}
                                      className={`w-6 h-6 rounded-full border-2 ${editingWorkoutType.color === color ? 'border-gray-900' : 'border-gray-300'
                                        }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => setEditingWorkoutType(prev => prev ? { ...prev, color } : null)}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={handleSaveWorkoutType} className="flex-1">
                                  <Save className="h-4 w-4 mr-2 icon-success" />
                                  Save
                                </Button>
                                <Button variant="outline" onClick={handleCancelWorkoutType} className="flex-1">
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <SortableItem
                            key={workoutType.id}
                            item={workoutType}
                            onEdit={handleEditWorkoutType}
                            onDelete={handleDeleteWorkoutType}
                            index={workoutTypes.indexOf(workoutType)}
                            type="workoutType"
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Workout Intents Section */}
              <div ref={workoutIntentsSectionRef}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5 icon-settings" />
                    Workout Intents
                  </h3>
                  <Button variant="outline" onClick={handleAddWorkoutIntent} size="sm">
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Add Workout Intent
                  </Button>
                </div>

                {showNewWorkoutIntentForm && editingWorkoutIntent && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3 px-3">
                      <CardTitle className="text-base">Add Workout Intent</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-3">
                      <div className="grid grid-cols-3 gap-4">
                        <Input
                          placeholder="Intent name"
                          value={editingWorkoutIntent.name}
                          onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                        <Input
                          placeholder="Intent key (e.g. strength)"
                          value={editingWorkoutIntent.key}
                          onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, key: e.target.value } : null)}
                        />
                        <Input
                          placeholder="Description"
                          value={editingWorkoutIntent.description}
                          onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, description: e.target.value } : null)}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Color:</label>
                        <div className="flex gap-2">
                          {colors.map((color) => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded-full border-2 ${editingWorkoutIntent.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditingWorkoutIntent(prev => prev ? { ...prev, color } : null)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" onClick={handleSaveWorkoutIntent} className="flex-1">
                          <Save className="h-4 w-4 mr-2 icon-success" />
                          Save Workout Intent
                        </Button>
                        <Button variant="outline" onClick={handleCancelWorkoutIntent} className="flex-1">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={workoutIntents.map(w => `workoutIntent-${w.id}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {workoutIntents.map((workoutIntent) => (
                        editingWorkoutIntentId === workoutIntent.id && editingWorkoutIntent ? (
                          <Card key={workoutIntent.id} className="py-0">
                            <CardContent className="space-y-4 p-0 px-3 py-2">
                              <div className="grid grid-cols-3 gap-4">
                                <Input
                                  placeholder="Intent name"
                                  value={editingWorkoutIntent.name}
                                  onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                                <Input
                                  placeholder="Intent key"
                                  value={editingWorkoutIntent.key}
                                  onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, key: e.target.value } : null)}
                                />
                                <Input
                                  placeholder="Description"
                                  value={editingWorkoutIntent.description}
                                  onChange={(e) => setEditingWorkoutIntent(prev => prev ? { ...prev, description: e.target.value } : null)}
                                />
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="text-sm font-medium">Color:</label>
                                <div className="flex gap-2">
                                  {colors.map((color) => (
                                    <button
                                      key={color}
                                      className={`w-6 h-6 rounded-full border-2 ${editingWorkoutIntent.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => setEditingWorkoutIntent(prev => prev ? { ...prev, color } : null)}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={handleSaveWorkoutIntent} className="flex-1">
                                  <Save className="h-4 w-4 mr-2 icon-success" />
                                  Save
                                </Button>
                                <Button variant="outline" onClick={handleCancelWorkoutIntent} className="flex-1">
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <SortableItem
                            key={workoutIntent.id}
                            item={workoutIntent}
                            onEdit={handleEditWorkoutIntent}
                            onDelete={handleDeleteWorkoutIntent}
                            index={workoutIntents.indexOf(workoutIntent)}
                            type="workoutIntent"
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

        </TabsContent>

        <TabsContent value="app">
          {/* Google Calendar Configuration Section */}
          <div className="mt-4">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Link className="h-6 w-6" />
                Google Calendar Integration
              </h2>
              <p className="text-gray-600">Configure Google Calendar sync and test event creation.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Google Account & Authentication */}
              <div ref={calendarSectionRef}>
                <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Google Account Connection</span>
                    {!checkingAuth && (
                      <Badge
                        variant={
                          syncError
                            ? "destructive"
                            : isGoogleCalendarConnected
                              ? "default"
                              : "secondary"
                        }
                        className={
                          syncError
                            ? "bg-red-600"
                            : isGoogleCalendarConnected
                              ? "bg-green-600"
                              : ""
                        }
                      >
                        {syncError
                          ? 'Sync Error'
                          : isGoogleCalendarConnected
                            ? 'Connected'
                            : 'Not Connected'}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {checkingAuth ? (
                    <div className="flex items-center justify-center p-4">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      <span className="text-sm text-gray-600">Checking connection...</span>
                    </div>
                  ) : isGoogleCalendarConnected ? (
                    <>
                      {/* Calendar Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Selected Calendar
                        </label>
                        <Select
                          value={calendarConfig.selectedCalendarId || 'none'}
                          onValueChange={(value) => {
                            updateCalendarConfig({
                              selectedCalendarId: value === 'none' ? undefined : value
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a calendar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {calendars.map((calendar) => (
                              <SelectItem key={calendar.id} value={calendar.id}>
                                {calendar.summary} {calendar.primary && '(Primary)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sync Status */}
                      {calendarConfig.selectedCalendarId && !syncError && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-700">
                            ✓ Calendar sync enabled - events will appear on Schedule page
                          </p>
                        </div>
                      )}

                      {/* Sync Error */}
                      {syncError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800 mb-1">
                                ⚠️ Sync Error
                              </p>
                              <p className="text-sm text-red-700 mb-2">
                                {syncError}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnectGoogleCalendar}
                                className="text-red-700 border-red-300 hover:bg-red-100"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Reconnect Google Calendar
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Test Connection Button */}
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestConnection}
                          disabled={testingConnection}
                          className="w-full mb-2"
                        >
                          {testingConnection ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Testing Connection...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Test Connection
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectGoogleCalendar}
                          className="text-gray-600 w-full"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Disconnect Google Calendar
                        </Button>
                        <p className="text-xs text-gray-400 mt-2">
                          If you see sync errors, click &quot;Test Connection&quot; to verify, or disconnect and reconnect to refresh permissions
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Not connected state */}
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Connect your Google Calendar to sync coaching sessions and events.
                        </p>
                        {signedInGoogleEmail && (
                          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
                            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                              Signed-in account
                            </p>
                            <p className="mt-1 text-sm text-blue-900">
                              Calendar will try to connect as <span className="font-medium">{signedInGoogleEmail}</span>.
                            </p>
                            <p className="mt-1 text-xs text-blue-700">
                              If Google shows a different profile first, use the account chooser to switch before approving access.
                            </p>
                          </div>
                        )}
                        <Button onClick={handleConnectGoogleCalendar}>
                          <Link className="h-4 w-4 mr-2" />
                          Connect Google Calendar
                        </Button>
                      </div>

                      {/* Permissions info - only show when not connected */}
                      <div className="pt-3 border-t">
                        <p className="text-xs font-medium text-gray-500 mb-2">Required Permissions:</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">Read events</Badge>
                          <Badge variant="outline" className="text-xs">Create events</Badge>
                          <Badge variant="outline" className="text-xs">Modify events</Badge>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
                </Card>
              </div>

              {/* Calendar Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Event Detection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Keywords to automatically categorize calendar events.
                  </p>

                  {/* Coaching Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`w-4 h-4 rounded-full ${AVAILABLE_COLORS.find(c => c.value === coachingColor)?.class || 'bg-blue-500'} ring-offset-2 hover:ring-2 focus:ring-2 ring-gray-400 outline-none transition-all`}
                            type="button"
                            aria-label="Pick color for coaching sessions"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="flex gap-2">
                            {AVAILABLE_COLORS.map((color) => (
                              <button
                                key={color.value}
                                className={`w-6 h-6 rounded-full ${color.class} hover:scale-110 transition-transform ${coachingColor === color.value ? 'ring-2 ring-offset-2 ring-gray-900' : ''}`}
                                onClick={() => setCoachingColor(color.value)}
                                title={color.name}
                                type="button"
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <label className="text-sm font-medium text-gray-700">
                        Coaching Sessions
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Personal Training, PT, Training Session, Workout"
                        value={coachingKeywordsInput}
                        onChange={(e) => setCoachingKeywordsInput(e.target.value)}
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveCoachingKeywords}
                        variant="outline"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* Class Session Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`w-4 h-4 rounded-full ${AVAILABLE_COLORS.find(c => c.value === classColor)?.class || 'bg-purple-500'} ring-offset-2 hover:ring-2 focus:ring-2 ring-gray-400 outline-none transition-all`}
                            type="button"
                            aria-label="Pick color for class sessions"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="flex gap-2">
                            {AVAILABLE_COLORS.map((color) => (
                              <button
                                key={color.value}
                                className={`w-6 h-6 rounded-full ${color.class} hover:scale-110 transition-transform ${classColor === color.value ? 'ring-2 ring-offset-2 ring-gray-900' : ''}`}
                                onClick={() => setClassColor(color.value)}
                                title={color.name}
                                type="button"
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <label className="text-sm font-medium text-gray-700">
                        Class Sessions
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Class, Group Class, Group Training"
                        value={classKeywordsInput}
                        onChange={(e) => setClassKeywordsInput(e.target.value)}
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveClassKeywords}
                        variant="outline"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    Separate keywords with commas. Events matching these keywords will be color-coded on the schedule.
                  </p>

                  {/* Error Display */}
                  {calendarError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-red-600">{calendarError}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearCalendarError}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>

          {/* App Calendar Settings Section */}
          <div className="mt-12 border-t pt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <CalendarIcon className="h-6 w-6" />
                App Calendar Settings
              </h2>
              <p className="text-gray-600">Configure how the calendar displays in the app.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Timezone Settings */}
              <Card className="lg:h-[26rem] flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span>Timezone</span>
                    </div>
                    <Badge variant="outline" className="font-normal">
                      {formatTimezoneLabel(appTimezone)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto">
                  {/* Timezone Status */}
                  {getBrowserTimezone() !== appTimezone ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">🔒 Locked to {formatTimezoneLabel(appTimezone)}</span>
                        </p>
                        <p className="text-xs text-blue-700">
                          Your device shows {formatTimezoneLabel(getBrowserTimezone())} but all times will display in {formatTimezoneLabel(appTimezone)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const browserTz = getBrowserTimezone();
                            setAppTimezone(browserTz);
                            setAppTimezoneState(browserTz);
                            toastSuccess(`Timezone updated to ${formatTimezoneLabel(browserTz)}`);
                            setTimeout(() => {
                              window.location.reload();
                            }, 500);
                          }}
                          className="w-fit text-xs"
                        >
                          Switch to {formatTimezoneLabel(getBrowserTimezone())}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✓ Matches your current location ({formatTimezoneLabel(appTimezone)})
                      </p>
                    </div>
                  )}

                  {/* Timezone Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Timezone
                    </label>
                    <Select
                      value={appTimezone}
                      onValueChange={(value) => {
                        setAppTimezone(value);
                        setAppTimezoneState(value);
                        toastSuccess(`Timezone updated to ${formatTimezoneLabel(value)}`);
                        setTimeout(() => {
                          window.location.reload();
                        }, 500);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Note */}
                  <p className="text-xs text-gray-500">
                    All times will display in this timezone, even when traveling. This keeps your schedule consistent regardless of your current location.
                  </p>
                </CardContent>
              </Card>

              {/* Business Hours Settings */}
              <div ref={businessHoursSectionRef} className="lg:h-[26rem]">
                <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span>Business Hours</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 min-h-0 flex-col space-y-1 overflow-y-auto">
                  <p className="text-xs text-gray-500 pb-1">
                    Only these hours will be displayed on the calendar view.
                  </p>

                  <div className="flex items-center justify-between text-xs font-medium text-gray-600 pb-0.5 border-b">
                    <span className="w-24">Day</span>
                    <div className="flex gap-2">
                      <span className="w-20 text-center">Start</span>
                      <span className="w-20 text-center">End</span>
                    </div>
                  </div>

                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                    const isSelected = (businessHours?.daysOfWeek ?? [1, 2, 3, 4, 5]).includes(index);
                    const dayHour = businessHours?.dayHours?.[index] ?? { startHour: 7, endHour: 20 };

                    return (
                      <div
                        key={day}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 w-24">
                          <button
                            type="button"
                            onClick={async () => {
                              const currentDays = businessHours?.daysOfWeek ?? [1, 2, 3, 4, 5];
                              const currentDayHours = businessHours?.dayHours ?? {};
                              const newDays = currentDays.includes(index)
                                ? currentDays.filter(d => d !== index).sort()
                                : [...currentDays, index].sort();

                              // If adding day, initialize with default hours
                              if (!currentDays.includes(index) && !currentDayHours[index]) {
                                currentDayHours[index] = { startHour: 7, endHour: 20 };
                              }

                              try {
                                await updateBusinessHours({
                                  daysOfWeek: newDays,
                                  dayHours: currentDayHours
                                });
                                toastSuccess('Business hours updated');
                              } catch (error) {
                                console.error('Error updating business hours:', error);
                              }
                            }}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-primary border-primary'
                              : 'bg-background border-input hover:border-primary/50'
                              }`}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <label
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              const currentDays = businessHours?.daysOfWeek ?? [1, 2, 3, 4, 5];
                              const currentDayHours = businessHours?.dayHours ?? {};
                              const newDays = currentDays.includes(index)
                                ? currentDays.filter(d => d !== index).sort()
                                : [...currentDays, index].sort();

                              if (!currentDays.includes(index) && !currentDayHours[index]) {
                                currentDayHours[index] = { startHour: 7, endHour: 20 };
                              }

                              try {
                                await updateBusinessHours({
                                  daysOfWeek: newDays,
                                  dayHours: currentDayHours
                                });
                                toastSuccess('Business hours updated');
                              } catch (error) {
                                console.error('Error updating business hours:', error);
                              }
                            }}
                          >
                            {day}
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={dayHour.startHour.toString()}
                            onValueChange={async (value) => {
                              try {
                                const currentDayHours = { ...(businessHours?.dayHours ?? {}) };
                                currentDayHours[index] = {
                                  startHour: parseInt(value),
                                  endHour: currentDayHours[index]?.endHour ?? 20
                                };
                                await updateBusinessHours({
                                  daysOfWeek: businessHours?.daysOfWeek ?? [1, 2, 3, 4, 5],
                                  dayHours: currentDayHours
                                });
                                toastSuccess('Business hours updated');
                              } catch (error) {
                                console.error('Error updating business hours:', error);
                              }
                            }}
                            disabled={!isSelected}
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              className="max-h-[200px] [&>*]:scroll-smooth"
                              style={{ scrollBehavior: 'smooth' }}
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {new Date(2000, 0, 1, i).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    hour12: true,
                                    timeZone: getAppTimezone()
                                  })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={dayHour.endHour.toString()}
                            onValueChange={async (value) => {
                              try {
                                const currentDayHours = { ...(businessHours?.dayHours ?? {}) };
                                currentDayHours[index] = {
                                  startHour: currentDayHours[index]?.startHour ?? 7,
                                  endHour: parseInt(value)
                                };
                                await updateBusinessHours({
                                  daysOfWeek: businessHours?.daysOfWeek ?? [1, 2, 3, 4, 5],
                                  dayHours: currentDayHours
                                });
                                toastSuccess('Business hours updated');
                              } catch (error) {
                                console.error('Error updating business hours:', error);
                              }
                            }}
                            disabled={!isSelected}
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              className="max-h-[200px] [&>*]:scroll-smooth"
                              style={{ scrollBehavior: 'smooth' }}
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {new Date(2000, 0, 1, i).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    hour12: true,
                                    timeZone: getAppTimezone()
                                  })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
                </Card>
              </div>

              <div ref={plannerMetadataSectionRef} className="lg:h-[26rem]">
                {plannerMetadataError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {plannerMetadataError}
                  </div>
                )}

                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        <span>Event Types</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={newPlannerEventType}
                        onChange={(e) => setNewPlannerEventType(e.target.value)}
                        placeholder="Add event type"
                        className="text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void createPlannerEventType();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => void createPlannerEventType()}
                        disabled={plannerMetadataSaving || !newPlannerEventType.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {plannerEventTypes.map((eventType) => (
                        <div key={eventType.id} className="flex items-center justify-between rounded border px-3 py-2">
                          <span className="text-sm text-gray-700">{eventType.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => void deletePlannerEventType(eventType.id)}
                            disabled={plannerMetadataSaving}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {!plannerMetadataLoading && plannerEventTypes.length === 0 && (
                        <p className="text-xs text-gray-500">No event types yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:h-[26rem]">
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">Planner Calendars</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={newPlannerCalendar}
                        onChange={(e) => setNewPlannerCalendar(e.target.value)}
                        placeholder="Add planner calendar"
                        className="text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void createPlannerCalendar();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => void createPlannerCalendar()}
                        disabled={plannerMetadataSaving || !newPlannerCalendar.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {plannerCalendars.map((calendar) => (
                        <div key={calendar.id} className="flex items-center justify-between rounded border px-3 py-2">
                          <span className="text-sm text-gray-700">{calendar.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => void deletePlannerCalendar(calendar.id)}
                            disabled={plannerMetadataSaving}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {!plannerMetadataLoading && plannerCalendars.length === 0 && (
                        <p className="text-xs text-gray-500">No planner calendars yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Location Management Section */}
          <div className="mt-12 border-t pt-8" ref={locationSectionRef}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin className="h-6 w-6" />
                Location Management
              </h2>
              <p className="text-gray-600">Manage location abbreviations for calendar events. Create shorter display names for long location names.</p>
            </div>

            {!isGoogleCalendarConnected ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">Connect Google Calendar to see and manage locations from your events.</p>
                </CardContent>
              </Card>
            ) : uniqueLocations.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">No locations found in calendar events. Locations will appear here once events with locations are synced.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location Abbreviations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Active Locations */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {uniqueLocations
                      .filter(location => {
                        const existingAbbr = calendarConfig.locationAbbreviations?.find(abbr => normalizeLocationKey(abbr.original) === normalizeLocationKey(location));
                        return !existingAbbr?.ignored;
                      })
                      .map((location) => {
                        const existingAbbr = calendarConfig.locationAbbreviations?.find(abbr => normalizeLocationKey(abbr.original) === normalizeLocationKey(location));
                        const isEditing = normalizeLocationKey(editingLocation?.original || '') === normalizeLocationKey(location);

                        return (
                          <div key={location} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate" title={location}>
                                  {location}
                                </p>
                                {existingAbbr && !isEditing && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Display: <span className="font-medium">{existingAbbr.abbreviation}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <>
                                    <Input
                                      value={locationAbbreviationInput}
                                      onChange={(e) => setLocationAbbreviationInput(e.target.value)}
                                      placeholder="Abbreviation"
                                      className="w-32 h-8"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={handleSaveLocationAbbreviation}
                                      className="h-8"
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingLocation(null);
                                        setLocationAbbreviationInput('');
                                      }}
                                      className="h-8"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleLocationIgnored(location)}
                                      className="h-8"
                                    >
                                      N/A
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAddLocationAbbreviation(location)}
                                      className="h-8"
                                    >
                                      {existingAbbr ? <Edit className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                      {existingAbbr ? 'Edit' : 'Add'}
                                    </Button>
                                    {existingAbbr && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteLocationAbbreviation(location)}
                                        className="h-8 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Ignored Locations - Collapsible Section (Always visible like Bluetooth settings) */}
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => setShowIgnoredLocations(!showIgnoredLocations)}
                      className="flex items-center justify-between w-full text-left mb-2 p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {showIgnoredLocations ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          N/A Locations
                        </span>
                        <Badge variant="secondary" className="bg-gray-300 text-gray-700 text-xs font-medium">
                          {(() => {
                            // Count unique ignored locations
                            const ignoredAbbrs = (calendarConfig.locationAbbreviations ?? []).filter(abbr => abbr.ignored);
                            const seen = new Set<string>();
                            for (const abbr of ignoredAbbrs) {
                              seen.add(normalizeLocationKey(abbr.original));
                            }
                            return seen.size;
                          })()}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-2">
                          (Click to {showIgnoredLocations ? 'hide' : 'expand'})
                        </span>
                      </div>
                    </button>

                    {showIgnoredLocations && (
                      <div className="space-y-2 mt-2">
                        {/* Empty state */}
                        {(() => {
                          // Count unique ignored locations
                          const ignoredAbbrs = (calendarConfig.locationAbbreviations ?? []).filter(abbr => abbr.ignored);
                          const seen = new Set<string>();
                          for (const abbr of ignoredAbbrs) {
                            seen.add(normalizeLocationKey(abbr.original));
                          }
                          return seen.size;
                        })() === 0 ? (
                          <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                            No locations marked as N/A. Click the &quot;N/A&quot; button on any location above to hide it from the calendar display.
                          </p>
                        ) : (
                          /* Show ALL ignored locations from saved config - deduplicated */
                          (() => {
                            // Deduplicate ignored locations by normalized key
                            const ignoredAbbrs = (calendarConfig.locationAbbreviations ?? []).filter(abbr => abbr.ignored);
                            const seen = new Set<string>();
                            const uniqueIgnored: LocationAbbreviation[] = [];

                            for (const abbr of ignoredAbbrs) {
                              const normalizedKey = normalizeLocationKey(abbr.original);
                              if (!seen.has(normalizedKey)) {
                                seen.add(normalizedKey);
                                uniqueIgnored.push(abbr);
                              }
                            }

                            return uniqueIgnored;
                          })().map((existingAbbr) => {
                            const location = existingAbbr.original;
                            const isEditing = normalizeLocationKey(editingLocation?.original || '') === normalizeLocationKey(location);

                            return (
                              <div key={location} className="p-3 border rounded-lg bg-gray-50 opacity-75">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-gray-400 truncate" title={location}>
                                        {location}
                                      </p>
                                      <Badge variant="secondary" className="bg-gray-200 text-gray-600 text-xs">
                                        N/A
                                      </Badge>
                                    </div>
                                    {!isEditing && (
                                      <p className="text-xs text-gray-400 mt-1">
                                        Display: <span className="font-medium">{existingAbbr.abbreviation}</span>
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1 italic">
                                      Location will not be displayed in schedule
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <Input
                                          value={locationAbbreviationInput}
                                          onChange={(e) => setLocationAbbreviationInput(e.target.value)}
                                          placeholder="Abbreviation"
                                          className="w-32 h-8"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={handleSaveLocationAbbreviation}
                                          className="h-8"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingLocation(null);
                                            setLocationAbbreviationInput('');
                                          }}
                                          className="h-8"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleToggleLocationIgnored(location)}
                                          className="h-8 bg-gray-600 hover:bg-gray-700"
                                        >
                                          Show
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleAddLocationAbbreviation(location)}
                                          className="h-8"
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteLocationAbbreviation(location)}
                                          className="h-8 text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="setup">
          <div className="mt-4 space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Coach Setup Hub</h2>
              <p className="text-gray-600">Complete these core checks once, then finish the checklist to align planner, locations, and workouts for your business.</p>
              <div>
                {onboardingLoading || typeof needsSetupHub === 'undefined' ? (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 w-fit">
                    Checking setup...
                  </Badge>
                ) : needsSetupHub ? (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                    Setup needed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 w-fit">
                    Setup complete
                  </Badge>
                )}
              </div>
            </div>

            <SetupHubFlow
              calendarReady={calendarReady}
              hasClients={hasClients}
              onConnectCalendar={handleScrollToCalendarSettings}
              onAddClients={handleGoToClients}
              selectedCalendarLabel={selectedCalendarLabel || undefined}
              layout="page"
              showHeader={false}
              onFinish={handleSetupHubFinish}
              onDismiss={() => setActiveTab('app')}
            />

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <span>{completedChecklistSteps}/{totalChecklistSteps} complete</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${checklistProgressPercent}%` }}
                    />
                  </div>
                  <span className="w-12 text-xs text-right text-gray-500">{checklistProgressPercent}%</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Build the rest of your system</h3>
                <p className="text-gray-600">Once calendar + clients are synced, walk down this checklist so workouts, templates, and locations match your business.</p>
              </div>
              <div className="space-y-4">
                {setupTaskSections.map((section, sectionIndex) => (
                  <Card key={section.title} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                          {sectionIndex + 1}
                        </div>
                        <div>
                          <CardTitle className="text-base">{section.title}</CardTitle>
                          <p className="text-sm text-gray-600">{section.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {section.steps.map((step) => (
                        <div key={`${section.title}-${step.title}`} className="rounded-xl border border-gray-200 bg-white/80 p-4">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${step.complete ? 'bg-emerald-500 text-white' : 'border border-gray-400 text-transparent'}`}>
                              {step.complete ? '✓' : ''}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                              <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {step.actions.map((action) => (
                              <Button
                                key={`${section.title}-${step.title}-${action.label}`}
                                variant={action.variant ?? 'outline'}
                                size="sm"
                                onClick={action.onClick}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Workout Structure Template Dialog */}
      <WorkoutStructureTemplateDialog
        open={showWorkoutStructureTemplateForm}
        onOpenChange={setShowWorkoutStructureTemplateForm}
        template={editingWorkoutStructureTemplate || undefined}
        workoutTypes={workoutTypes}
        workoutIntents={workoutIntents}
        onSave={(templateData) => {
          const sectionsWithGuidance = (templateData.sections || []).map((section) => {
            const hasGuidance = Boolean(section.configuration?.aiGuidance?.trim());
            if (hasGuidance) return section;

            return {
              ...section,
              configuration: {
                ...(section.configuration || {}),
                aiGuidance: buildRoundGuidance(section),
              },
            };
          });

          const normalizedTemplateData = {
            ...templateData,
            description: templateData.description?.trim() || buildTemplateDescriptionWithContext({
              ...(editingWorkoutStructureTemplate || {
                id: 'temp',
                createdAt: new Date() as any,
                updatedAt: new Date() as any,
              }),
              ...templateData,
              sections: sectionsWithGuidance,
            } as WorkoutStructureTemplate, workoutTypes),
            sections: sectionsWithGuidance,
          };

          if (editingWorkoutStructureTemplate) {
            updateWorkoutStructureTemplate(editingWorkoutStructureTemplate.id, normalizedTemplateData);
          } else {
            addWorkoutStructureTemplate(normalizedTemplateData);
          }
          setEditingWorkoutStructureTemplate(null);
          setShowWorkoutStructureTemplateForm(false);
        }}
      />
    </div>
    {showCelebration && (
      <>
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="rounded-3xl bg-white/90 px-6 py-4 text-center shadow-2xl border border-indigo-100">
            <p className="text-sm font-semibold text-indigo-600">All setup tasks complete</p>
            <p className="text-2xl font-bold text-gray-900">Nice work!</p>
          </div>
        </div>
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={`confetti-${index}`}
              className="confetti-piece"
              style={{
                left: `${(index / 24) * 100}%`,
                animationDelay: `${index * 0.08}s`,
                backgroundColor: confettiColors[index % confettiColors.length],
              }}
            />
          ))}
        </div>
        <style jsx>{`
          .confetti-piece {
            position: absolute;
            top: -10px;
            width: 8px;
            height: 16px;
            border-radius: 2px;
            animation: confettiFall 2.8s ease-in forwards;
          }
          @keyframes confettiFall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(120vh) rotate(360deg);
              opacity: 0;
            }
          }
        `}</style>
      </>
    )}
    </>
  );
}