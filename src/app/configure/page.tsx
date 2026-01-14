"use client";

import { useState, useEffect } from 'react';
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
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { WorkoutStructureTemplate } from '@/lib/types';
import { TestEventInput, LocationAbbreviation } from '@/lib/google-calendar/types';
import { initiateGoogleAuth, checkGoogleCalendarAuth, disconnectGoogleCalendar } from '@/lib/google-calendar/api-client';
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

interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
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

// Sortable Item Component
function SortableItem({ 
  item, 
  onEdit, 
  onDelete,
  index,
  type
}: { 
  item: Period | WeekTemplate | WorkoutCategory | WorkoutType; 
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
  const normalizeLocationKey = (input: string) => (input || '').trim().replace(/\\s+/g, ' ');

  const {
    periods,
    weekTemplates,
    workoutCategories,
    workoutTypes,
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Google Calendar auth state (must be declared before useEffect that uses it)
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'workout' | 'app'>('workout');
  
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

  // Keyword input states (local state to allow typing commas)
  const [coachingKeywordsInput, setCoachingKeywordsInput] = useState('');
  const [classKeywordsInput, setClassKeywordsInput] = useState('');
  
  // Sync keyword inputs from config on mount and when config changes
  useEffect(() => {
    if (calendarConfig.coachingKeywords) {
      setCoachingKeywordsInput(calendarConfig.coachingKeywords.join(', '));
    }
    if (calendarConfig.classKeywords) {
      setClassKeywordsInput(calendarConfig.classKeywords.join(', '));
    }
  }, [calendarConfig.coachingKeywords, calendarConfig.classKeywords]);

  // Fetch configuration on mount
  useEffect(() => {
    fetchAllConfig();
    fetchCalendars();
    fetchClients();
    fetchBusinessHours();
    
    // Check Google Calendar auth status
    checkGoogleCalendarAuth().then(connected => {
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
  }, [fetchAllConfig, fetchCalendars, fetchClients, fetchBusinessHours]);

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
        
        // Filter to only coaching session events (workouts)
        const coachingEvents = events.filter(event => {
          // Check if it's a coaching session
          if (event.isCoachingSession) return true;
          
          // Check if it has a client assigned (from our app)
          if (event.preConfiguredClient) return true;
          
          // Check if it has a linked workout
          if (event.linkedWorkoutId) return true;
          
          // Check if it matches coaching keywords
          const title = event.summary?.toLowerCase() || '';
          const matchesKeyword = config.coachingKeywords.some(keyword => 
            title.includes(keyword.toLowerCase())
          );
          if (matchesKeyword) return true;
          
          return false;
        });
        
        // Extract locations only from coaching events
        const locations = coachingEvents
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

  // Handle Google Calendar connection
  const handleConnectGoogleCalendar = async () => {
    try {
      await initiateGoogleAuth();
    } catch (error) {
      console.error('Error initiating Google Calendar connection:', error);
      toastError('Failed to connect to Google Calendar. Please try again.');
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
      // Refresh calendar store
      const { checkGoogleCalendarConnection } = useCalendarStore.getState();
      await checkGoogleCalendarConnection();
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
  const [editingWorkoutStructureTemplate, setEditingWorkoutStructureTemplate] = useState<WorkoutStructureTemplate | null>(null);
  
  // For new items (show form at top)
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [showNewWorkoutTypeForm, setShowNewWorkoutTypeForm] = useState(false);
  const [showWorkoutStructureTemplateForm, setShowWorkoutStructureTemplateForm] = useState(false);
  
  // Temporary editing state for inline editing
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WeekTemplate | null>(null);
  const [editingCategory, setEditingCategory] = useState<WorkoutCategory | null>(null);
  const [editingWorkoutType, setEditingWorkoutType] = useState<WorkoutType | null>(null);
  
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
          await addPeriod({
            name: editingPeriod.name,
            color: editingPeriod.color,
            focus: editingPeriod.focus,
            order: editingPeriod.order || 0
          });
          setShowNewPeriodForm(false);
        } else {
          // Update existing
          await updatePeriod(editingPeriod.id, {
            name: editingPeriod.name,
            color: editingPeriod.color,
            focus: editingPeriod.focus,
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
        if (editingWorkoutType.id.startsWith('temp_')) {
          // New workout type
          await addWorkoutType({
            name: editingWorkoutType.name,
            color: editingWorkoutType.color,
            description: editingWorkoutType.description,
            order: editingWorkoutType.order || 0
          });
          setShowNewWorkoutTypeForm(false);
        } else {
          // Update existing
          await updateWorkoutType(editingWorkoutType.id, {
            name: editingWorkoutType.name,
            color: editingWorkoutType.color,
            description: editingWorkoutType.description,
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

  // Calendar configuration handlers
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
    
    const abbreviations = calendarConfig.locationAbbreviations || [];
    const normalizedOriginal = normalizeLocationKey(editingLocation.original);
    const existingIndex = abbreviations.findIndex(abbr => normalizeLocationKey(abbr.original) === normalizedOriginal);
    const existing = existingIndex >= 0 ? abbreviations[existingIndex] : undefined;
    
    const updatedAbbr: LocationAbbreviation = {
      original: normalizedOriginal,
      abbreviation: locationAbbreviationInput.trim() || normalizedOriginal,
      // Preserve ignored state when editing an existing / N/A entry
      ignored: existing?.ignored ?? editingLocation.ignored
    };
    
    let updatedAbbreviations: LocationAbbreviation[];
    if (existingIndex >= 0) {
      updatedAbbreviations = [...abbreviations];
      updatedAbbreviations[existingIndex] = updatedAbbr;
    } else {
      updatedAbbreviations = [...abbreviations, updatedAbbr];
    }
    
    updateCalendarConfig({ locationAbbreviations: updatedAbbreviations });
    toastSuccess('Location abbreviation saved');
    setEditingLocation(null);
    setLocationAbbreviationInput('');
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
    const keywordArray = coachingKeywordsInput.split(',').map(k => k.trim()).filter(k => k);
    updateCalendarConfig({ coachingKeywords: keywordArray });
    toastSuccess('Coaching session keywords saved');
  };

  const handleSaveClassKeywords = async () => {
    const keywordArray = classKeywordsInput.split(',').map(k => k.trim()).filter(k => k);
    // Ensure we don't pass undefined - use empty array if no keywords
    updateCalendarConfig({ classKeywords: keywordArray.length > 0 ? keywordArray : [] });
    toastSuccess('Class session keywords saved');
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
    <div className="container mx-auto px-4 pt-1 pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration</h1>
        <p className="text-gray-600">Manage your periods, templates, categories, and workout types.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'workout' | 'app')}>
        <TabsList className="mb-6">
          <TabsTrigger value="workout">Workout Config.</TabsTrigger>
          <TabsTrigger value="app">App Config.</TabsTrigger>
        </TabsList>

        <TabsContent value="workout">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Periods Section */}
          <div>
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Color:</label>
                    <div className="flex gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded-full border-2 ${
                            editingPeriod.color === color ? 'border-gray-900' : 'border-gray-300'
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
                      <Card key={period.id} className="p-4">
                        <CardContent className="space-y-4 p-0">
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
                          <div className="flex items-center gap-4">
                            <label className="text-sm font-medium">Color:</label>
                            <div className="flex gap-2">
                              {colors.map((color) => (
                                <button
                                  key={color}
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    editingPeriod.color === color ? 'border-gray-900' : 'border-gray-300'
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
          <div>
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Week Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                            className={`w-6 h-6 rounded-full border-2 ${
                              editingTemplate.color === color ? 'border-gray-900' : 'border-gray-300'
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
                      <Card key={template.id} className="p-4">
                        <CardContent className="space-y-4 p-0">
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
                                    className={`w-6 h-6 rounded-full border-2 ${
                                      editingTemplate.color === color ? 'border-gray-900' : 'border-gray-300'
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
          <div>
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Workout Category</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          className={`w-6 h-6 rounded-full border-2 ${
                            editingCategory.color === color ? 'border-gray-900' : 'border-gray-300'
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
                      <Card key={category.id} className="p-4">
                        <CardContent className="space-y-4 p-0">
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
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    editingCategory.color === color ? 'border-gray-900' : 'border-gray-300'
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
          <div>
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
          <div>
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add Workout Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          className={`w-6 h-6 rounded-full border-2 ${
                            editingWorkoutType.color === color ? 'border-gray-900' : 'border-gray-300'
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
                      <Card key={workoutType.id} className="p-4">
                        <CardContent className="space-y-4 p-0">
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
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    editingWorkoutType.color === color ? 'border-gray-900' : 'border-gray-300'
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Google Account & Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Google Account Connection</span>
                {!checkingAuth && (
                  <Badge 
                    variant={isGoogleCalendarConnected ? "default" : "secondary"}
                    className={isGoogleCalendarConnected ? "bg-green-600" : ""}
                  >
                    {isGoogleCalendarConnected ? 'Connected' : 'Not Connected'}
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
                  {calendarConfig.selectedCalendarId && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✓ Calendar sync enabled - events will appear on Schedule page
                      </p>
                    </div>
                  )}

                  {/* Disconnect option */}
                  <div className="pt-2 border-t">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectGoogleCalendar}
                      className="text-gray-600"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Disconnect Google Calendar
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">
                      If you see permission errors, disconnect and reconnect to grant write permissions
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
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
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
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timezone Settings */}
              <Card>
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
                <CardContent className="space-y-4">
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span>Business Hours</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
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
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                              isSelected
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
                  
                  <p className="text-xs text-gray-500 pt-1 mt-1">
                    Only these hours will be displayed on the calendar view.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Location Management Section */}
          <div className="mt-12 border-t pt-8">
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
                          {calendarConfig.locationAbbreviations?.filter(abbr => abbr.ignored).length ?? 0}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-2">
                          (Click to {showIgnoredLocations ? 'hide' : 'expand'})
                        </span>
                      </div>
                    </button>
                    
                    {showIgnoredLocations && (
                      <div className="space-y-2 mt-2">
                        {/* Empty state */}
                        {(calendarConfig.locationAbbreviations?.filter(abbr => abbr.ignored).length ?? 0) === 0 ? (
                          <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                            No locations marked as N/A. Click the "N/A" button on any location above to hide it from the calendar display.
                          </p>
                        ) : (
                          /* Show ALL ignored locations from saved config */
                          (calendarConfig.locationAbbreviations ?? [])
                            .filter(abbr => abbr.ignored)
                            .map((existingAbbr) => {
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
      </Tabs>

      {/* Workout Structure Template Dialog */}
      <WorkoutStructureTemplateDialog
        open={showWorkoutStructureTemplateForm}
        onOpenChange={setShowWorkoutStructureTemplateForm}
        template={editingWorkoutStructureTemplate || undefined}
        workoutTypes={workoutTypes}
        onSave={(templateData) => {
          if (editingWorkoutStructureTemplate) {
            updateWorkoutStructureTemplate(editingWorkoutStructureTemplate.id, templateData);
          } else {
            addWorkoutStructureTemplate(templateData);
          }
          setEditingWorkoutStructureTemplate(null);
          setShowWorkoutStructureTemplateForm(false);
        }}
      />
    </div>
  );
}