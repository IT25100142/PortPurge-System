export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  processName: string;
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
