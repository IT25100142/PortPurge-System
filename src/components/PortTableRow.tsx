import { Hash, Search, Shield, Skull, Terminal } from "lucide-react";
import type { PortInfo } from "../types";
import { isProcessProtected, SMART_PROTECT_KILL_TITLE } from "../utils/isProcessProtected";

interface PortTableRowProps {
  portInfo: PortInfo;
  killingPid: number | null;
  protectedProcessNames: string[];
  isNested?: boolean;
  onRequestKill: (port: PortInfo) => void;
  onRequestInspect: (port: PortInfo) => void;
}

export function PortTableRow({
  portInfo,
  killingPid,
  protectedProcessNames,
  isNested = false,
  onRequestKill,
  onRequestInspect,
}: PortTableRowProps) {
  const isKilling = killingPid === portInfo.pid;
  const processLabel = portInfo.processName?.trim() || "Unknown";
  const isProtected = isProcessProtected(portInfo.processName, protectedProcessNames);

  return (
    <tr
      className={`hover:bg-slate-900/30 transition duration-150 animate-fade-in ${isKilling ? "opacity-40" : ""} ${isProtected ? "opacity-60" : ""} ${isNested ? "bg-slate-950/20" : ""}`}
    >
      <td className={`px-6 py-4 ${isNested ? "pl-10" : ""}`}>
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

      <td className="px-6 py-4 font-semibold text-slate-300 font-mono">{portInfo.pid}</td>

      <td
        className={`px-6 py-4 font-medium text-slate-100 flex items-center gap-2 ${isNested ? "pl-4" : ""}`}
      >
        <Terminal className="w-4 h-4 text-slate-500" />
        <span>{processLabel}</span>
        {isProtected && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800/60 border border-slate-700/60 text-slate-400"
            title={SMART_PROTECT_KILL_TITLE}
          >
            <Shield className="w-3 h-3" aria-hidden />
            Protected
          </span>
        )}
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
            disabled={isKilling || isProtected}
            title={isProtected ? SMART_PROTECT_KILL_TITLE : undefined}
            className={`px-3 py-1.5 text-xs font-bold glass-control text-slate-300 transition duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50 ${
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
            <span>Kill</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
