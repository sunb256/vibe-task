export type HeaderBandId = "zinc" | "navy" | "copper";

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
];

export function listHeaderBands() {
  return bandList;
}

export function getHeaderBand(bandId: HeaderBandId) {
  return bandList.find((band) => band.id === bandId) ?? bandList[0];
}
