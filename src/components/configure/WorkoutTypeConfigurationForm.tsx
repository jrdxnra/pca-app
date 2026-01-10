"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkoutTypeConfiguration } from '@/lib/types';

interface WorkoutTypeConfigurationFormProps {
  configuration: WorkoutTypeConfiguration;
  onChange: (configuration: WorkoutTypeConfiguration) => void;
  disabled?: boolean;
}

export function WorkoutTypeConfigurationForm({
  configuration,
  onChange,
  disabled = false
}: WorkoutTypeConfigurationFormProps) {
  const updateConfig = (updates: Partial<WorkoutTypeConfiguration>) => {
    onChange({ ...configuration, ...updates });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="grid grid-cols-2 gap-4">
        {/* Rep Range */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Rep Range</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={configuration.defaultRepRange?.min || ''}
              onChange={(e) => updateConfig({
                defaultRepRange: {
                  min: parseInt(e.target.value) || 0,
                  max: configuration.defaultRepRange?.max || 0
                }
              })}
              disabled={disabled}
              className="text-xs"
            />
            <Input
              type="number"
              placeholder="Max"
              value={configuration.defaultRepRange?.max || ''}
              onChange={(e) => updateConfig({
                defaultRepRange: {
                  min: configuration.defaultRepRange?.min || 0,
                  max: parseInt(e.target.value) || 0
                }
              })}
              disabled={disabled}
              className="text-xs"
            />
          </div>
        </div>

        {/* Rest Period */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Rest Period (seconds)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={configuration.defaultRestPeriod?.min || ''}
              onChange={(e) => updateConfig({
                defaultRestPeriod: {
                  min: parseInt(e.target.value) || 0,
                  max: configuration.defaultRestPeriod?.max || 0
                }
              })}
              disabled={disabled}
              className="text-xs"
            />
            <Input
              type="number"
              placeholder="Max"
              value={configuration.defaultRestPeriod?.max || ''}
              onChange={(e) => updateConfig({
                defaultRestPeriod: {
                  min: configuration.defaultRestPeriod?.min || 0,
                  max: parseInt(e.target.value) || 0
                }
              })}
              disabled={disabled}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Duration */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Duration (minutes)</Label>
          <Input
            type="number"
            placeholder="0"
            value={configuration.defaultDuration || ''}
            onChange={(e) => updateConfig({
              defaultDuration: parseInt(e.target.value) || undefined
            })}
            disabled={disabled}
            className="text-xs"
          />
        </div>

        {/* Structure */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Structure</Label>
          <Select
            value={configuration.defaultStructure || ''}
            onValueChange={(value) => updateConfig({
              defaultStructure: value as WorkoutTypeConfiguration['defaultStructure']
            })}
            disabled={disabled}
          >
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select structure" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="straight-sets">Straight Sets</SelectItem>
              <SelectItem value="supersets">Supersets</SelectItem>
              <SelectItem value="circuits">Circuits</SelectItem>
              <SelectItem value="amrap">AMRAP</SelectItem>
              <SelectItem value="emom">EMOM</SelectItem>
              <SelectItem value="intervals">Intervals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Work:Rest Ratio */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Work:Rest Ratio</Label>
          <Input
            type="text"
            placeholder="1:1"
            value={configuration.workRestRatio || ''}
            onChange={(e) => updateConfig({
              workRestRatio: e.target.value
            })}
            disabled={disabled}
            className="text-xs"
          />
        </div>

        {/* Focus Area */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Focus Area</Label>
          <Input
            type="text"
            placeholder="e.g., Dynamic warm-up"
            value={configuration.focusArea || ''}
            onChange={(e) => updateConfig({
              focusArea: e.target.value
            })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>

      {/* Toggle Options */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="useRPE"
            checked={configuration.useRPE || false}
            onChange={(e) => updateConfig({ useRPE: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4"
          />
          <Label htmlFor="useRPE" className="text-xs">Use RPE</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="usePercentage"
            checked={configuration.usePercentage || false}
            onChange={(e) => updateConfig({ usePercentage: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4"
          />
          <Label htmlFor="usePercentage" className="text-xs">Use Percentage</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="useTempo"
            checked={configuration.useTempo || false}
            onChange={(e) => updateConfig({ useTempo: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4"
          />
          <Label htmlFor="useTempo" className="text-xs">Use Tempo</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="useTime"
            checked={configuration.useTime || false}
            onChange={(e) => updateConfig({ useTime: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4"
          />
          <Label htmlFor="useTime" className="text-xs">Use Time</Label>
        </div>
      </div>
    </div>
  );
}

