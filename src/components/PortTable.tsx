import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Hash, Search, Skull, Terminal } from "lucide-react";
import { EmptyState } from "./EmptyState";
import type { PortInfo } from "../types";

type SortKey = keyof PortInfo;
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

function comparePorts(a: PortInfo, b: PortInfo, { key, direction }: SortConfig): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (key === "port" || key === "pid") {
    return (a[key] - b[key]) * multiplier;
  }

  const aVal = a[key] ?? "";
  const bVal = b[key] ?? "";
  return String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" }) * multiplier;
}

interface PortTableProps {
  filteredPorts: PortInfo[];
  totalPortCount: number;
  searchQuery: string;
  protocolFilter: "ALL" | "TCP" | "UDP";
  isRefreshing: boolean;
  killingPid: number | null;
  onRequestKill: (port: PortInfo) => void;
  onRequestInspect: (port: PortInfo) => void;
  onClearFilters?: () => void;
}

export function PortTable({
  filteredPorts,
  totalPortCount,
  searchQuery,
  protocolFilter,
  isRefreshing,
  killingPid,
  onRequestKill,
  onRequestInspect,
  onClearFilters,
}: PortTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "port", direction: "asc" });

  const hasActiveFilters = searchQuery.trim() !== "" || protocolFilter !== "ALL";

  const emptyVariant = totalPortCount === 0 ? "no-ports" : "no-results";

  const sortedPorts = useMemo(
    () => [...filteredPorts].sort((a, b) => comparePorts(a, b, sortConfig)),
    [filteredPorts, sortConfig],
  );

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const renderSortableHeader = (label: string, key: SortKey) => {
    const isActive = sortConfig.key === key;

    return (
      <th
        className="px-6 py-4 cursor-pointer hover:text-slate-200 transition-colors select-none"
        onClick={() => handleSort(key)}
      >
        <span
          className={`inline-flex items-center gap-1 ${isActive ? "text-accent-primary" : "text-slate-400"}`}
        >
          {label}
          {isActive &&
            (sortConfig.direction === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" aria-hidden />
            ))}
        </span>
      </th>
    );
  };

  return (
    <main className="glass-panel overflow-hidden relative">
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-slate-800/60">
          <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-violet-600 animate-shimmer" />
        </div>
      )}
      <div className="overflow-x-auto max-h-[min(60vh,480px)] overflow-y-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800/80 text-label bg-surface-base/90 backdrop-blur-md">
              {renderSortableHeader("Protocol", "protocol")}
              {renderSortableHeader("Port", "port")}
              {renderSortableHeader("PID", "pid")}
              {renderSortableHeader("Process Name", "processName")}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
            {filteredPorts.length > 0 ? (
              sortedPorts.map((portInfo) => {
                const isKilling = killingPid === portInfo.pid;

                return (
                  <tr
                    key={`${portInfo.port}-${portInfo.protocol}`}
                    className={`hover:bg-slate-900/30 transition duration-150 animate-fade-in ${isKilling ? "opacity-40" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase border ${
                          portInfo.protocol.toUpperCase() === "TCP"
                            ? "bg-violet-500/5 border-violet-500/20 text-violet-400"
                            : "bg-pink-500/5 border-pink-500/20 text-pink-400"
                        }`}
                      >
                        {portInfo.protocol}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-bold text-white font-mono flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{portInfo.port}</span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-300 font-mono">
                      {portInfo.pid}
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-100 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-slate-500" />
                      <span>{portInfo.processName}</span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onRequestInspect(portInfo)}
                          disabled={isKilling}
                          className="px-3 py-1.5 text-xs font-bold glass-control text-slate-300 hover:bg-indigo-950/20 hover:border-indigo-900/40 hover:text-indigo-400 transition duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                        >
                          <Search className="w-3.5 h-3.5 text-slate-500 hover:text-inherit" />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestKill(portInfo)}
                          disabled={isKilling}
                          className="px-3 py-1.5 text-xs font-bold glass-control text-slate-300 hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400 transition duration-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                        >
                          <Skull className="w-3.5 h-3.5 text-slate-500 hover:text-inherit" />
                          <span>Kill</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    variant={emptyVariant}
                    onClearFilters={hasActiveFilters ? onClearFilters : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
