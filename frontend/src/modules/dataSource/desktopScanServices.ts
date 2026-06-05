import { useEffect, useMemo, useState } from "react";

type ServiceState =
  | "pending"
  | "starting"
  | "healthy"
  | "stopping"
  | "stopped"
  | "failed";

export interface DesktopServiceStatus {
  name: string;
  state: ServiceState;
  port?: number;
  pid?: number;
  error?: string;
  startedAt?: number;
  healthCheckedAt?: number;
  restartCount?: number;
}

export interface DesktopScanServicesReadiness {
  desktopMode: boolean;
  loading: boolean;
  apiReady: boolean;
  fileWatcherReady: boolean;
  ready: boolean;
  alertType: "info" | "warning" | "error";
  message: string;
  description: string;
  statuses: Record<string, DesktopServiceStatus>;
}

const SCAN_SERVICE_NAME = "scan-control-plane";
const FILE_WATCHER_SERVICE_NAME = "file-watcher";

function getDesktopMode() {
  return typeof window !== "undefined" && Boolean(window.lazymind);
}

function isHealthy(status?: DesktopServiceStatus) {
  return status?.state === "healthy";
}

function hasFailed(status?: DesktopServiceStatus) {
  return status?.state === "failed";
}

function formatStatus(name: string, status?: DesktopServiceStatus) {
  if (!status) {
    return `${name}: not registered`;
  }
  const port = status.port ? `:${status.port}` : "";
  const error = status.error ? `, ${status.error}` : "";
  return `${name}${port}: ${status.state}${error}`;
}

function buildReadiness(
  desktopMode: boolean,
  loading: boolean,
  statuses: Record<string, DesktopServiceStatus>,
): DesktopScanServicesReadiness {
  const scanStatus = statuses[SCAN_SERVICE_NAME];
  const fileWatcherStatus = statuses[FILE_WATCHER_SERVICE_NAME];
  const apiReady = !desktopMode || isHealthy(scanStatus);
  const fileWatcherReady = !desktopMode || isHealthy(fileWatcherStatus);
  const ready = apiReady && fileWatcherReady;
  const failed = hasFailed(scanStatus) || hasFailed(fileWatcherStatus);

  if (!desktopMode) {
    return {
      desktopMode,
      loading,
      apiReady: true,
      fileWatcherReady: true,
      ready: true,
      alertType: "info",
      message: "",
      description: "",
      statuses,
    };
  }

  const description = [
    formatStatus(SCAN_SERVICE_NAME, scanStatus),
    formatStatus(FILE_WATCHER_SERVICE_NAME, fileWatcherStatus),
  ].join("; ");

  if (ready) {
    return {
      desktopMode,
      loading,
      apiReady,
      fileWatcherReady,
      ready,
      alertType: "info",
      message: "",
      description,
      statuses,
    };
  }

  return {
    desktopMode,
    loading,
    apiReady,
    fileWatcherReady,
    ready,
    alertType: failed ? "error" : "warning",
    message: failed ? "Data source services failed to start" : "Data source services are starting",
    description,
    statuses,
  };
}

export function useDesktopScanServices(): DesktopScanServicesReadiness {
  const desktopMode = getDesktopMode();
  const [loading, setLoading] = useState(desktopMode);
  const [statuses, setStatuses] = useState<Record<string, DesktopServiceStatus>>({});

  useEffect(() => {
    if (!desktopMode || !window.lazymind) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    window.lazymind
      .getAllServiceStatus()
      .then((nextStatuses) => {
        if (active) {
          setStatuses(nextStatuses || {});
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return window.lazymind.onServiceStatusChange((nextStatuses) => {
      setStatuses(nextStatuses || {});
      setLoading(false);
    });
  }, [desktopMode]);

  return useMemo(
    () => buildReadiness(desktopMode, loading, statuses),
    [desktopMode, loading, statuses],
  );
}
