import { useState, useMemo, useCallback } from "react";
import type { PortInfo, PortGroup } from "../types";
import { filterPortsByFuzzyQuery } from "../utils/fuzzySearch";
import { groupByProcessName } from "../utils/groupPorts";

export function usePortViewModel(ports: PortInfo[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<"ALL" | "TCP" | "UDP">("ALL");
  const [groupByProcess, setGroupByProcess] = useState(false);

  const toggleGroupByProcess = useCallback(() => {
    setGroupByProcess((prev) => !prev);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setProtocolFilter("ALL");
  }, []);

  const filteredPorts = useMemo(() => {
    const searchFiltered = filterPortsByFuzzyQuery(ports, searchQuery);
    return searchFiltered.filter(
      (port) => protocolFilter === "ALL" || port.protocol.toUpperCase() === protocolFilter,
    );
  }, [ports, searchQuery, protocolFilter]);

  const displayGroups = useMemo((): PortGroup[] | null => {
    if (!groupByProcess) {
      return null;
    }
    return groupByProcessName(filteredPorts);
  }, [filteredPorts, groupByProcess]);

  const tcpCount = useMemo(
    () => ports.filter((p) => p.protocol.toUpperCase() === "TCP").length,
    [ports],
  );

  const udpCount = useMemo(
    () => ports.filter((p) => p.protocol.toUpperCase() === "UDP").length,
    [ports],
  );

  return {
    searchQuery,
    setSearchQuery,
    protocolFilter,
    setProtocolFilter,
    groupByProcess,
    setGroupByProcess,
    toggleGroupByProcess,
    clearFilters,
    filteredPorts,
    displayGroups,
    tcpCount,
    udpCount,
  };
}
