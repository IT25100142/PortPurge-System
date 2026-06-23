import type { PortGroup, PortInfo, TableSortConfig } from "../types";

export function comparePorts(a: PortInfo, b: PortInfo, config: TableSortConfig): number {
  const multiplier = config.direction === "asc" ? 1 : -1;
  const { key } = config;

  if (key === "port" || key === "pid") {
    return (a[key] - b[key]) * multiplier;
  }

  const aVal = a[key] ?? "";
  const bVal = b[key] ?? "";
  return String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" }) * multiplier;
}

export function sortFlatPorts(ports: PortInfo[], config: TableSortConfig): PortInfo[] {
  return [...ports].sort((a, b) => comparePorts(a, b, config));
}

function compareGroups(a: PortGroup, b: PortGroup, config: TableSortConfig): number {
  const multiplier = config.direction === "asc" ? 1 : -1;
  const aName = a.processName?.trim() || "Unknown";
  const bName = b.processName?.trim() || "Unknown";
  return aName.localeCompare(bName, undefined, { sensitivity: "base" }) * multiplier;
}

export function sortGroupedPorts(groups: PortGroup[], config: TableSortConfig): PortGroup[] {
  if (config.level === "group") {
    return [...groups]
      .sort((a, b) => compareGroups(a, b, config))
      .map((group) => ({ ...group, ports: [...group.ports] }));
  }

  return groups.map((group) => ({
    ...group,
    ports: sortFlatPorts(group.ports, config),
  }));
}
