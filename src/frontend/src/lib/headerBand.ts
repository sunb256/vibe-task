export type HeaderBandId =
  | "zinc"
  | "navy"
  | "copper"
  | "forest"
  | "plum"
  | "charcoal"
  | "custom";

type HeaderBand = {
  id: HeaderBandId;
  label: string;
  description: string;
  background: string;
  border: string;
};

export const defaultBandId: HeaderBandId = "zinc";

const bandList: HeaderBand[] = [
  {
    id: "zinc",
    label: "Graphite",
    description: "既定のモノトーン帯です。",
    background: "rgba(9, 9, 11, 0.94)",
    border: "#27272a",
  },
  {
    id: "navy",
    label: "Navy",
    description: "青みのある落ち着いた帯です。",
    background: "rgba(30, 41, 59, 0.94)",
    border: "#334155",
  },
  {
    id: "copper",
    label: "Copper",
    description: "少し暖色寄りの帯です。",
    background: "rgba(120, 53, 15, 0.94)",
    border: "#92400e",
  },
  {
    id: "forest",
    label: "Forest",
    description: "深い緑の帯です。",
    background: "rgba(20, 83, 45, 0.94)",
    border: "#166534",
  },
  {
    id: "plum",
    label: "Plum",
    description: "紫みのある暗色帯です。",
    background: "rgba(76, 29, 149, 0.94)",
    border: "#6d28d9",
  },
  {
    id: "charcoal",
    label: "Charcoal",
    description: "青みを抑えた濃いグレー帯です。",
    background: "rgba(28, 25, 23, 0.94)",
    border: "#44403c",
  },
  {
    id: "custom",
    label: "Custom",
    description: "任意の色コードを固定ヘッダへ適用します。",
    background: "rgba(31, 41, 55, 0.94)",
    border: "#374151",
  },
];

export function listHeaderBands() {
  return bandList;
}

export function getHeaderBand(bandId: HeaderBandId) {
  return bandList.find((band) => band.id === bandId) ?? bandList[0];
}

export function normalizeCustomHeaderColor(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : "";
}

export function resolveHeaderBandStyle(bandId: HeaderBandId, customColor = "") {
  const color = normalizeCustomHeaderColor(customColor);
  if (bandId !== "custom" || !color) {
    return getHeaderBand(bandId);
  }
  return {
    ...getHeaderBand("custom"),
    background: toRgba(color, 0.94),
    border: darkenColor(color, 0.22),
  };
}

function toRgba(color: string, alpha: number) {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return getHeaderBand("custom").background;
  }
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

function darkenColor(color: string, amount: number) {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return getHeaderBand("custom").border;
  }
  const ratio = Math.max(0, Math.min(1, 1 - amount));
  const red = Math.round(rgb.red * ratio);
  const green = Math.round(rgb.green * ratio);
  const blue = Math.round(rgb.blue * ratio);
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function parseHexColor(color: string) {
  const value = normalizeCustomHeaderColor(color);
  if (!value) {
    return null;
  }
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}
