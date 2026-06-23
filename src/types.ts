export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  processName: string;
}

export interface ProcessDetails {
  pid: number;
  processName: string;
  executablePath: string | null;
  commandLine: string | null;
  memoryBytes: number | null;
  user: string | null;
  startedAt: string | null;
  permissionsLimited: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
  permissionDenied?: boolean;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}
