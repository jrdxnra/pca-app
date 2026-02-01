import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface DistanceUnitPickerProps {
    value: string;
    onChange: (value: string) => void;
}

const DISTANCE_UNITS = ['mi', 'km', 'm', 'yd', 'ft'];

export function DistanceUnitPicker({ value, onChange }: DistanceUnitPickerProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || 'mi');

    // Update input when value prop changes externally
    React.useEffect(() => {
        setInputValue(value || 'mi');
    }, [value]);

    const filteredUnits = DISTANCE_UNITS.filter(unit =>
        unit.toLowerCase().includes(inputValue.toLowerCase())
    );

    const handleSelect = (unit: string) => {
        onChange(unit);
        setInputValue(unit);
        setOpen(false);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setOpen(true);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative w-5 h-6">
                    <Input
                        value={inputValue}
                        onChange={onInputChange}
                        onFocus={() => setOpen(true)}
                        onClick={() => setOpen(true)}
                        className="h-6 w-5 text-sm text-center bg-white px-0 py-0 border-0 rounded-none focus:ring-0 shadow-none hover:bg-gray-50 cursor-pointer"
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[60px] p-0"
                align="start"
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="overflow-y-auto p-1" style={{ maxHeight: '130px' }}>
                    {filteredUnits.length === 0 ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                            -
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredUnits.map((unit) => (
                                <button
                                    key={unit}
                                    onClick={() => handleSelect(unit)}
                                    className={cn(
                                        "flex w-full items-center justify-center rounded-sm px-1 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        value === unit && "bg-accent/50"
                                    )}
                                >
                                    <span className="text-center truncate">{unit}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
