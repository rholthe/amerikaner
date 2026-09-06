// Validert kategorisk palett for mørk flate. Rekkefølgen er CVD-sikkerhets-
// mekanismen – ikke endre den. Samme palett som idiot-appen bruker.
const SERIE = [
  "#3987e5", // blå
  "#199e70", // aqua
  "#c98500", // gul
  "#008300", // grønn
  "#9085e9", // fiolett
  "#e66767", // rød
  "#d55181", // magenta
  "#d95926", // oransje
];

/** Fargen følger spilleren (id-rekkefølge), aldri rangeringen. */
export function spillerFarge(playerId: number, alleIder: number[]): string {
  const sortert = [...alleIder].sort((a, b) => a - b);
  const i = sortert.indexOf(playerId);
  return SERIE[(i < 0 ? 0 : i) % SERIE.length];
}

/**
 * Samme farge, men lysnet til den er lesbar som tekst. Paletten er laget for
 * flater – som tekst på et kort faller de mørkeste (grønn #008300) til 3.6:1,
 * altså under AA. Rekkefølgen i SERIE er sikkerhetsmekanismen og røres ikke;
 * i stedet blandes fargen mot hvitt til kontrasten holder.
 *
 * Bruk denne til navn og tall, og `spillerFarge` til søyler, prikker og fyll.
 */
const TEKST_FLATE = "#232329"; // --surface-2, den mørkeste flaten tekst står på
const MINSTE_KONTRAST = 4.5;

function kanaler(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminans(hex: string): number {
  const [r, g, b] = kanaler(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const [x, y] = [luminans(a), luminans(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function motHvitt(hex: string, andel: number): string {
  const ut = kanaler(hex)
    .map((v) => Math.round(v + (255 - v) * andel))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `#${ut}`;
}

const bufret = new Map<string, string>();

export function lesbarFarge(hex: string): string {
  const truffet = bufret.get(hex);
  if (truffet) return truffet;

  let farge = hex;
  for (let andel = 0; andel <= 0.9 && kontrast(farge, TEKST_FLATE) < MINSTE_KONTRAST; andel += 0.05) {
    farge = motHvitt(hex, andel);
  }
  bufret.set(hex, farge);
  return farge;
}

/** Spillerens farge, lysnet nok til å leses som tekst. */
export function spillerTekstFarge(playerId: number, alleIder: number[]): string {
  return lesbarFarge(spillerFarge(playerId, alleIder));
}
