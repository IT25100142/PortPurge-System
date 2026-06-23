import type { KillSource } from "../types";

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 60) {
    return "Just now";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  }

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatKillSource(source: KillSource): string {
  switch (source) {
    case "ui":
      return "UI";
    case "tray":
      return "Tray";
    case "group":
      return "Group";
    case "inspect":
      return "Inspect";
  }
}
