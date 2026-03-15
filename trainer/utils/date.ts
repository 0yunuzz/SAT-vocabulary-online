export const todayKey = (date = new Date()): string => date.toISOString().slice(0, 10);

export const daysBetween = (fromIso?: string, toIso?: string): number => {
  if (!fromIso || !toIso) {
    return Number.POSITIVE_INFINITY;
  }

  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const diff = Math.abs(to - from);
  return Math.floor(diff / 86400000);
};

export const formatDuration = (ms: number): string => {
  if (!ms || Number.isNaN(ms)) {
    return "0s";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) {
    return "-";
  }

  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};
