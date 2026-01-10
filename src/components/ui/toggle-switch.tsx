"use client";

import React from 'react';

interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ToggleSwitch({ 
  id, 
  checked, 
  onChange, 
  disabled = false, 
  size = 'md' 
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-10 h-5', 
    lg: 'w-12 h-6'
  };
  
  const thumbClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        ${sizeClasses[size]}
        relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
    >
      <span
        className={`
          ${thumbClasses[size]}
          inline-block rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-full' : 'translate-x-0'}
        `}
      />
    </button>
  );
}
