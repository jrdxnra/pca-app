import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MovementCategory } from '@/lib/types';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

interface CategoryWheelPickerProps {
    value: string;
    onChange: (value: string) => void;
    categories: MovementCategory[];
    tabIndex?: number;
}

export function CategoryWheelPicker({ value, onChange, categories, tabIndex }: CategoryWheelPickerProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Find the selected category
    const selectedCategory = categories.find(c => c.id === value);

    // Filter categories based on search
    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (categoryId: string) => {
        onChange(categoryId);
        setOpen(false);
        setSearchQuery(''); // Reset search after selection
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <SimpleTooltip content={selectedCategory?.name || 'Select Category'}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        tabIndex={tabIndex}
                        className="w-[30px] h-6 p-0 hover:bg-transparent focus:ring-0 shadow-none border-none"
                    >
                        {/* Color Circle Trigger */}
                        <div
                            className="w-4 h-4 rounded-full mx-auto border border-gray-200 shadow-sm transition-transform hover:scale-110"
                            style={{ backgroundColor: selectedCategory?.color || '#e2e8f0' }} // Fallback to slate-200
                        />
                        <span className="sr-only">Select Category</span>
                    </Button>
                </PopoverTrigger>
            </SimpleTooltip>
            <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
                <div className="flex flex-col">
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                            placeholder="Search category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex h-8 w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground border-none focus-visible:ring-0 px-0 shadow-none"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto p-1" style={{ maxHeight: '145px' }}>
                        {filteredCategories.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No category found.
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => handleSelect(category.id)}
                                        className={cn(
                                            "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                            value === category.id && "bg-accent/50"
                                        )}
                                    >
                                        <div
                                            className="mr-2 h-3 w-3 rounded-full border border-gray-200"
                                            style={{ backgroundColor: category.color }}
                                        />
                                        <span className="flex-1 text-left truncate">{category.name}</span>
                                        {value === category.id && (
                                            <Check className="ml-auto h-4 w-4 opacity-100" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
