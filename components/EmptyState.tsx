import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  onReset?: () => void;
}

export function EmptyState({ 
  title = "No Jobs Found", 
  description = "Try adjusting your filters or typing different search terms to discover roles.", 
  onReset 
}: EmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center text-center p-8 md:p-16 rounded-2xl bg-slate-900/20 border border-slate-800/80 backdrop-blur-sm gap-4">
      <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
        <Briefcase className="h-8 w-8 text-slate-500" strokeWidth={1.5} />
      </div>
      
      <div className="flex flex-col gap-1 max-w-md">
        <h3 className="font-display font-semibold text-lg text-white">
          {title}
        </h3>
        <p className="text-sm text-slate-400">
          {description}
        </p>
      </div>

      {onReset && (
        <Button 
          variant="outline" 
          onClick={onReset}
          className="border-slate-800 hover:bg-slate-900 text-xs font-semibold text-white px-5 py-2.5 rounded-xl cursor-pointer"
        >
          Reset All Filters
        </Button>
      )}
    </div>
  );
}
