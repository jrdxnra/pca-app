"use client";

import { useState } from 'react';
import { Check, X } from 'lucide-react';

interface MovementConfigurationToggleProps {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  measureOptions?: string[];
  measureValue?: string;
  onMeasureChange?: (value: string) => void;
}

export function MovementConfigurationToggle({
  name,
  value,
  onChange,
  measureOptions,
  measureValue,
  onMeasureChange,
}: MovementConfigurationToggleProps) {
  const handleToggle = () => {
    onChange(!value);
  };

  return (
    <div className={`flex ${measureOptions ? 'border rounded-md ml-1' : ''}`}>
      {/* Toggle Switch */}
      <div className="px-2 items-center text-center">
        <label htmlFor={`${name}_switch`} className="block text-sm font-medium leading-6 text-gray-900 mb-1">
          {name}
        </label>
        <button
          id={`${name}_switch`}
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            value ? 'bg-primary' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={value}
        >
          <span className="sr-only">Use {name}</span>
          <span
            className={`pointer-events-none relative inline-block h-5 w-5 ${
              value ? 'translate-x-5' : 'translate-x-0'
            } transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
          >
            {value ? (
              <span
                className={`absolute inset-0 flex h-full w-full items-center justify-center ${
                  value ? 'opacity-100 duration-200 ease-in' : 'opacity-0 transition-opacity duration-100 ease-out'
                }`}
                aria-hidden="true"
              >
                <Check className="h-3 w-3 text-primary" />
              </span>
            ) : (
              <span
                className={`absolute inset-0 flex h-full w-full items-center justify-center ${
                  value ? 'opacity-0 duration-100 ease-out' : 'opacity-100 transition-opacity duration-200 ease-in'
                }`}
                aria-hidden="true"
              >
                <X className="h-3 w-3 text-gray-400" />
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Measure Dropdown (if provided) */}
      {measureOptions && (
        <div className="mr-1 mb-1">
          <label htmlFor={`${name}-measure`} className="block text-sm font-light leading-6 text-gray-900 mb-1">
            Measure
          </label>
          <select
            id={`${name}-measure`}
            name={`${name}-measure`}
            disabled={!value}
            value={measureValue || measureOptions[0]}
            onChange={(e) => onMeasureChange?.(e.target.value)}
            className="block w-20 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {measureOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
