import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { PortGroupRow } from "./PortGroupRow";
import { PortTableRow } from "./PortTableRow";
import type { PortGroup, PortGroupKey, PortInfo, SortLevel, TableSortConfig } from "../types";
import { sortFlatPorts, sortGroupedPorts } from "../utils/sortPorts";

type SortKey = keyof PortInfo;

interface PortTableProps {
  filteredPorts: PortInfo[];
  displayGroups?: PortGroup[] | null;
  groupByProcess: boolean;
  totalPortCount: number;
  searchQuery: string;
  protocolFilter: "ALL" | "TCP" | "UDP";
  isRefreshing: boolean;
  killingPid: number | null;
  protectedProcessNames: string[];
  onRequestKill: (port: PortInfo) => void;
  onRequestKillGroup: (group: PortGroup) => void;
  onRequestInspect: (port: PortInfo) => void;
  onClearFilters?: () => void;
}

export function PortTable({
  filteredPorts,
  displayGroups,
  groupByProcess,
  totalPortCount,
  searchQuery,
  protocolFilter,
  isRefreshing,
  killingPid,
  protectedProcessNames,
  onRequestKill,
  onRequestKillGroup,
  onRequestInspect,
  onClearFilters,
}: PortTableProps) {
  const [sortConfig, setSortConfig] = useState<TableSortConfig>({
    level: "child",
    key: "port",
    direction: "asc",
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<PortGroupKey>>(() => new Set());

  const hasActiveFilters = searchQuery.trim() !== "" || protocolFilter !== "ALL";
  const emptyVariant = totalPortCount === 0 ? "no-ports" : "no-results";
  const isGroupedView = groupByProcess && displayGroups !== null && displayGroups !== undefined;

  const tableLabel =
    isGroupedView && displayGroups.length > 0
      ? `Port list grouped by process (${displayGroups.length} groups)`
      : "Port list";

  const sortedPorts = useMemo(
    () => sortFlatPorts(filteredPorts, sortConfig),
    [filteredPorts, sortConfig],
  );

  const sortedGroups = useMemo(
    () => (displayGroups ? sortGroupedPorts(displayGroups, sortConfig) : []),
    [displayGroups, sortConfig],
  );

  const hasRows = isGroupedView ? sortedGroups.length > 0 : filteredPorts.length > 0;

  const handleSort = (key: SortKey, level: SortLevel) => {
    setSortConfig((prev) =>
      prev.key === key && prev.level === level
        ? { level, key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { level, key, direction: "asc" },
    );
  };

  const toggleGroupExpanded = useCallback((groupKey: PortGroupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const renderSortableHeader = (label: string, key: SortKey, level: SortLevel) => {
    const isActive = sortConfig.key === key && sortConfig.level === level;

    return (
      <th
        className="px-6 py-4 cursor-pointer hover:text-slate-200 transition-colors select-none"
        onClick={() => handleSort(key, level)}
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

  const groupLevel: SortLevel = isGroupedView ? "group" : "child";
  const childLevel: SortLevel = "child";

  return (
    <main className="glass-panel overflow-hidden relative">
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-slate-800/60">
          <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-violet-600 animate-shimmer" />
        </div>
      )}
      <div className="overflow-x-auto max-h-[min(60vh,480px)] overflow-y-auto">
        <table className="w-full border-collapse text-left" aria-label={tableLabel}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800/80 text-label bg-surface-base/90 backdrop-blur-md">
              {renderSortableHeader("Protocol", "protocol", childLevel)}
              {renderSortableHeader("Port", "port", childLevel)}
              {renderSortableHeader("PID", "pid", childLevel)}
              {renderSortableHeader("Process Name", "processName", groupLevel)}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
            {hasRows ? (
              isGroupedView ? (
                sortedGroups.map((group) => (
                  <PortGroupRow
                    key={group.groupKey}
                    group={group}
                    isExpanded={expandedGroups.has(group.groupKey)}
                    killingPid={killingPid}
                    protectedProcessNames={protectedProcessNames}
                    onToggleExpand={() => toggleGroupExpanded(group.groupKey)}
                    onRequestKill={onRequestKill}
                    onRequestKillGroup={onRequestKillGroup}
                    onRequestInspect={onRequestInspect}
                  />
                ))
              ) : (
                sortedPorts.map((portInfo) => (
                  <PortTableRow
                    key={`${portInfo.port}-${portInfo.protocol}`}
                    portInfo={portInfo}
                    killingPid={killingPid}
                    protectedProcessNames={protectedProcessNames}
                    onRequestKill={onRequestKill}
                    onRequestInspect={onRequestInspect}
                  />
                ))
              )
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
