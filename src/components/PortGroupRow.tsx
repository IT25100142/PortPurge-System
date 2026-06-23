import { ChevronDown, ChevronRight, Shield, Skull, Terminal } from "lucide-react";
import type { PortGroup, PortInfo } from "../types";
import { isProcessProtected, SMART_PROTECT_KILL_TITLE } from "../utils/isProcessProtected";
import { PortTableRow } from "./PortTableRow";

interface PortGroupRowProps {
  group: PortGroup;
  isExpanded: boolean;
  killingPid: number | null;
  protectedProcessNames: string[];
  onToggleExpand: () => void;
  onRequestKill: (port: PortInfo) => void;
  onRequestKillGroup: (group: PortGroup) => void;
  onRequestInspect: (port: PortInfo) => void;
}

export function PortGroupRow({
  group,
  isExpanded,
  killingPid,
  protectedProcessNames,
  onToggleExpand,
  onRequestKill,
  onRequestKillGroup,
  onRequestInspect,
}: PortGroupRowProps) {
  const processLabel = group.processName?.trim() || "Unknown";
  const isGroupKilling = group.uniquePids.some((pid) => killingPid === pid);
  const isProtected = isProcessProtected(group.processName, protectedProcessNames);

  return (
    <>
      <tr
        className={`hover:bg-slate-900/40 transition duration-150 animate-fade-in border-t border-slate-800/80 ${isGroupKilling ? "opacity-60" : ""} ${isProtected ? "opacity-60" : ""}`}
      >
        <td className="px-6 py-4">
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg glass-control text-slate-300 hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${processLabel} group`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden />
            )}
          </button>
        </td>

        <td className="px-6 py-4 text-slate-500 font-mono text-xs">—</td>

        <td className="px-6 py-4 text-slate-500 font-mono text-xs">—</td>

        <td className="px-6 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-100 truncate">{processLabel}</span>
            {isProtected && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800/60 border border-slate-700/60 text-slate-400"
                title={SMART_PROTECT_KILL_TITLE}
              >
                <Shield className="w-3 h-3" aria-hidden />
                Protected
              </span>
            )}
            <span className="shrink-0 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              {group.portCount} ports · {group.pidCount} PIDs
            </span>
          </div>
        </td>

        <td className="px-6 py-4 text-right">
          <button
            type="button"
            onClick={() => onRequestKillGroup(group)}
            disabled={isGroupKilling || isProtected}
            title={isProtected ? SMART_PROTECT_KILL_TITLE : undefined}
            className={`px-3 py-1.5 text-xs font-bold glass-control text-slate-300 transition duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 ml-auto disabled:opacity-50 ${
              isProtected
                ? "cursor-not-allowed"
                : "hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400 cursor-pointer"
            }`}
          >
            {isProtected ? (
              <Shield className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Skull className="w-3.5 h-3.5 text-slate-500 hover:text-inherit" />
            )}
            <span>Kill All</span>
          </button>
        </td>
      </tr>

      {isExpanded &&
        group.ports.map((portInfo) => (
          <PortTableRow
            key={`${group.groupKey}-${portInfo.port}-${portInfo.protocol}`}
            portInfo={portInfo}
            killingPid={killingPid}
            protectedProcessNames={protectedProcessNames}
            isNested
            onRequestKill={onRequestKill}
            onRequestInspect={onRequestInspect}
          />
        ))}
    </>
  );
}
