import type { CSSProperties } from "react";

export type AppSettings = {
  headerColor: string;
};

export const defaultAppSettings: AppSettings = {
  headerColor: "#09090b",
};

export const headerColorPresets = [
  "#09090b",
  "#1d4ed8",
  "#0f766e",
  "#b45309",
  "#be123c",
];

export function createTopBarStyle(settings?: AppSettings | null): CSSProperties {
  const headerColor = settings?.headerColor ?? defaultAppSettings.headerColor;
  const textColor = pickTextColor(headerColor);
  return {
    "--topbar-bg": headerColor,
    "--topbar-border": toRgba(textColor, 0.18),
    "--topbar-hover": toRgba(textColor, 0.12),
    "--topbar-ink": textColor,
    "--topbar-muted": toRgba(textColor, 0.72),
  } as CSSProperties;
}

function pickTextColor(color: string) {
  const rgb = parseHex(color);
  if (!rgb) {
    return "#ffffff";
  }
  const [red, green, blue] = rgb;
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  return luminance > 160 ? "#09090b" : "#ffffff";
}

function toRgba(color: string, alpha: number) {
  const rgb = parseHex(color);
  if (!rgb) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const [red, green, blue] = rgb;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function parseHex(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return null;
  }
  const value = color.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ] as const;
}
