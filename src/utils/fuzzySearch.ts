import type { PortInfo } from "../types";

function normalizeProcessName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unknown";
}

function buildHaystack(port: PortInfo): string {
  const processName = normalizeProcessName(port.processName);
  return `${processName}:${port.port}:${port.pid}:${port.protocol}`.toLowerCase();
}

function isOrderedSubsequence(needle: string, haystack: string): boolean {
  let haystackIndex = 0;
  for (const char of needle) {
    const matchIndex = haystack.indexOf(char, haystackIndex);
    if (matchIndex === -1) {
      return false;
    }
    haystackIndex = matchIndex + 1;
  }
  return true;
}

export function portMatchesFuzzyQuery(port: PortInfo, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, "");
  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = buildHaystack(port);

  if (normalizedQuery.length === 1) {
    return haystack.includes(normalizedQuery);
  }

  return isOrderedSubsequence(normalizedQuery, haystack);
}

export function filterPortsByFuzzyQuery(ports: PortInfo[], query: string): PortInfo[] {
  return ports.filter((port) => portMatchesFuzzyQuery(port, query));
}
