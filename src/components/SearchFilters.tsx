import { Search } from "lucide-react";

interface SearchFiltersProps {
  searchQuery: string;
  protocolFilter: "ALL" | "TCP" | "UDP";
  onSearchChange: (value: string) => void;
  onProtocolChange: (filter: "ALL" | "TCP" | "UDP") => void;
}

export function SearchFilters({
  searchQuery,
  protocolFilter,
  onSearchChange,
  onProtocolChange,
}: SearchFiltersProps) {
  return (
    <section className="glass-panel flex flex-col sm:flex-row gap-4 items-center justify-between p-4">
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by Port, PID, or Process Name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 glass-panel-inset text-sm text-slate-200 placeholder-slate-500 outline-none transition duration-200 focus-visible:border-indigo-500/80 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        />
      </div>

      <div className="flex gap-1.5 p-1 glass-control w-full sm:w-auto">
        {(["ALL", "TCP", "UDP"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onProtocolChange(filter)}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
              protocolFilter === filter
                ? "btn-primary"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
    </section>
  );
}
