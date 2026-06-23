import { Search } from "lucide-react";

interface SearchFiltersProps {
  searchQuery: string;
  protocolFilter: "ALL" | "TCP" | "UDP";
  groupByProcess: boolean;
  onSearchChange: (value: string) => void;
  onProtocolChange: (filter: "ALL" | "TCP" | "UDP") => void;
  onToggleGroupByProcess: () => void;
}

export function SearchFilters({
  searchQuery,
  protocolFilter,
  groupByProcess,
  onSearchChange,
  onProtocolChange,
  onToggleGroupByProcess,
}: SearchFiltersProps) {
  return (
    <section className="glass-panel flex flex-col lg:flex-row gap-4 items-center justify-between p-4">
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search ports, PIDs, or process names (fuzzy)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 glass-panel-inset text-sm text-slate-200 placeholder-slate-500 outline-none transition duration-200 focus-visible:border-indigo-500/80 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2 px-3.5 py-2 glass-control w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-xs text-slate-400 font-semibold">Group by Process</span>
          <button
            type="button"
            onClick={onToggleGroupByProcess}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
              groupByProcess ? "bg-indigo-600" : "bg-slate-800"
            }`}
            aria-pressed={groupByProcess}
            aria-label="Toggle group by process"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                groupByProcess ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex gap-1.5 p-1 glass-control w-full sm:w-auto">
        {(["ALL", "TCP", "UDP"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onProtocolChange(filter)}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
              protocolFilter === filter ? "btn-primary" : "text-slate-400 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
        </div>
      </div>
    </section>
  );
}
