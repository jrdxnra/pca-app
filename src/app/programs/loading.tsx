import { Loader2, Calendar } from 'lucide-react';

export default function ProgramsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <Loader2 className="h-6 w-6 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm text-muted-foreground">Loading schedule...</p>
      </div>
    </div>
  );
}





