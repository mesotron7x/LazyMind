const FALSE_VALUES = new Set(["0", "false", "no", "n", "off", "disabled", "disable"]);

export function isEvoModeEnabled() {
  const normalized = String(import.meta.env.VITE_LAZYMIND_EVO_MODE ?? "true")
    .trim()
    .toLowerCase();

  return !FALSE_VALUES.has(normalized);
}
