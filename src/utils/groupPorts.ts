import type { PortGroup, PortGroupKey, PortInfo } from "../types";

function resolveProcessName(processName: string): string {
  const trimmed = processName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unknown";
}

function toGroupKey(processName: string): PortGroupKey {
  return resolveProcessName(processName).toLowerCase();
}

export function groupByProcessName(ports: PortInfo[]): PortGroup[] {
  const buckets = new Map<PortGroupKey, PortInfo[]>();

  for (const port of ports) {
    const groupKey = toGroupKey(port.processName);
    const bucket = buckets.get(groupKey);
    if (bucket) {
      bucket.push(port);
    } else {
      buckets.set(groupKey, [port]);
    }
  }

  return Array.from(buckets.entries()).map(([groupKey, groupPorts]) => {
    const processName = resolveProcessName(groupPorts[0]?.processName ?? "");
    const uniquePids = [...new Set(groupPorts.map((port) => port.pid))];

    return {
      groupKey,
      processName,
      ports: groupPorts,
      portCount: groupPorts.length,
      pidCount: uniquePids.length,
      uniquePids,
    };
  });
}
