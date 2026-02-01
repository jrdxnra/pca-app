import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface RepWheelPickerProps {
    value: number | null;
    onChange: (value: number) => void;
}

export function RepWheelPicker({ value, onChange }: RepWheelPickerProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value?.toString() || '');

    // Generate options 1-100
    const options = Array.from({ length: 100 }, (_, i) => i + 1);

    // Sync input with external value
    useEffect(() => {
        if (value !== null && value !== undefined) {
            setInputValue(value.toString());
        } else {
            setInputValue('');
        }
    }, [value]);

    // Filter logic
    const isExactMatch = value?.toString() === inputValue;
    const filteredOptions = isExactMatch
        ? options
        : options.filter(opt => opt.toString().startsWith(inputValue));

    const handleSelect = (num: number) => {
        onChange(num);
        setInputValue(num.toString());
        setOpen(false);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        setOpen(true);

        // Optional: emit change immediately if it's a valid number? 
        // Or wait for selection? User might type "12" (1 then 2). 
        // Better to wait for selection OR blur. 
        // For now, let's keep it as a picker helper, but maybe verify binding?
        // Actually, if they type "12", they might expect it to save without clicking.
        // Let's stick to the autocomplete pattern: typing filters, clicking selects. 
        // But we could also try to parse on change if valid.
        // Let's try to parse:
        const parsed = parseInt(newVal);
        if (!isNaN(parsed) && parsed > 0) {
            onChange(parsed);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative w-full">
                    <Input
                        value={inputValue}
                        onChange={onInputChange}
                        onFocus={() => setOpen(true)}
                        onClick={() => setOpen(true)}
                        placeholder="Reps"
                        className="h-6 min-h-[24px] w-full text-sm bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm text-center"
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[60px] p-0"
                align="center"
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="overflow-y-auto p-1" style={{ maxHeight: '130px' }}>
                    {filteredOptions.length === 0 ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                            -
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredOptions.map((num) => (
                                <button
                                    key={num}
                                    onClick={() => handleSelect(num)}
                                    className={cn(
                                        "flex w-full items-center justify-center rounded-sm px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        value === num && "bg-accent/50 font-bold"
                                    )}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
