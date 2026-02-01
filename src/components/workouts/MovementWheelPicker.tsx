import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Movement } from '@/lib/types';

interface MovementWheelPickerProps {
    value: string;
    onChange: (value: string) => void;
    movements: Movement[];
}

export function MovementWheelPicker({ value, onChange, movements }: MovementWheelPickerProps) {
    const [open, setOpen] = useState(false);
    // Find the selected movement to get the initial name
    const selectedMovement = movements.find(m => m.id === value);

    // Local state for the input text (search query)
    // Initialize with the selected movement name if it exists
    const [inputValue, setInputValue] = useState(selectedMovement?.name || '');

    // Update internal input value when the external value prop changes
    useEffect(() => {
        if (selectedMovement) {
            setInputValue(selectedMovement.name);
        } else if (!value) {
            setInputValue('');
        }
    }, [value, selectedMovement]);

    // Filter movements based on the input text
    // If the input matches the currently selected item exactly, show all (so user can pick a new one)
    const isExactMatch = selectedMovement && inputValue.toLowerCase() === selectedMovement.name.toLowerCase();

    const filteredMovements = isExactMatch
        ? movements
        : movements.filter(movement =>
            movement.name.toLowerCase().includes(inputValue.toLowerCase())
        );

    const handleSelect = (movement: Movement) => {
        onChange(movement.id);
        setInputValue(movement.name);
        setOpen(false);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setOpen(true);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative w-auto min-w-[100px]">
                    <Input
                        value={inputValue}
                        onChange={onInputChange}
                        onFocus={() => {
                            setOpen(true);
                        }}
                        onClick={() => setOpen(true)}
                        placeholder="Select Movement"
                        className="h-6 w-[100px] text-sm bg-white px-2 py-0 border border-gray-300 shadow-sm truncate"
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[200px] p-0"
                align="start"
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="overflow-y-auto p-1" style={{ maxHeight: '185px' }}>
                    {filteredMovements.length === 0 ? (
                        <div className="py-2 text-center text-sm text-muted-foreground">
                            No results found.
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredMovements.map((movement) => (
                                <button
                                    key={movement.id}
                                    onClick={() => handleSelect(movement)}
                                    className={cn(
                                        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        value === movement.id && "bg-accent/50"
                                    )}
                                >
                                    <span className="flex-1 text-left truncate">{movement.name}</span>
                                    {value === movement.id && (
                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
