import { Sparkles } from "lucide-react";

export function FeaturedCompanies() {
  const companies = [
    { name: "LinkedIn", color: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/10" },
    { name: "Indeed", color: "text-blue-400", bg: "bg-blue-400/5", border: "border-blue-400/10" },
    { name: "Wellfound", color: "text-white", bg: "bg-slate-300/5", border: "border-slate-300/10" },
    { name: "Glassdoor", color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/10" },
    { name: "ZipRecruiter", color: "text-green-500", bg: "bg-green-500/5", border: "border-green-500/10" },
    { name: "Monster", color: "text-purple-400", bg: "bg-purple-500/5", border: "border-purple-500/10" },
  ];

  return (
    <div className="w-full flex flex-col gap-6 py-6 border-t border-slate-900">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-[0.2em] font-semibold">
        <Sparkles className="h-3 w-3 text-blue-500" />
        Indexed Aggregation Sources
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {companies.map((comp) => (
          <div
            key={comp.name}
            className={`flex items-center justify-center p-4 rounded-xl border ${comp.border} ${comp.bg} backdrop-blur-sm cursor-pointer hover:border-slate-700 hover:scale-[1.03] transition-all duration-300 group`}
          >
            <span className={`text-sm font-display font-bold ${comp.color} opacity-70 group-hover:opacity-100 transition-opacity`}>
              {comp.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
