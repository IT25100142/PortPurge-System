import { Activity, Server, Terminal } from "lucide-react";

interface MetricsBarProps {
  totalCount: number;
  tcpCount: number;
  udpCount: number;
}

export function MetricsBar({ totalCount, tcpCount, udpCount }: MetricsBarProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="glass-panel p-5 flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
        <div className="space-y-1">
          <span className="text-label">Active Sockets</span>
          <h2 className="text-3xl font-extrabold text-white tabular-nums">{totalCount}</h2>
        </div>
        <div className="p-3.5 glass-control text-indigo-400 group-hover:scale-110 transition duration-300">
          <Activity className="w-5 h-5" />
        </div>
      </div>

      <div className="glass-panel p-5 flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
        <div className="space-y-1">
          <span className="text-label">TCP Listeners</span>
          <h2 className="text-3xl font-extrabold text-white tabular-nums">{tcpCount}</h2>
        </div>
        <div className="p-3.5 glass-control text-violet-400 group-hover:scale-110 transition duration-300">
          <Server className="w-5 h-5" />
        </div>
      </div>

      <div className="glass-panel p-5 flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
        <div className="space-y-1">
          <span className="text-label">UDP Binds</span>
          <h2 className="text-3xl font-extrabold text-white tabular-nums">{udpCount}</h2>
        </div>
        <div className="p-3.5 glass-control text-pink-400 group-hover:scale-110 transition duration-300">
          <Terminal className="w-5 h-5" />
        </div>
      </div>
    </section>
  );
}
