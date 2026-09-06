import { prisma } from "@/lib/prisma";
import { kveldInclude, serialiserKveld } from "@/lib/kveld";
import { stillinger } from "@/lib/scoring";
import { spillerStatistikk, type StatGiv } from "@/lib/stats";
import type { KveldDto } from "@/lib/typer";

export interface SesongDto {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  kvelder: number;
  runder: number;
}

/**
 * En sesong er et datointervall. «YYYY-MM-DD» blir til naiv veggklokketid i
 * UTC-feltet, samme konvensjon som resten av appen (se lib/dates.ts) – ellers
 * ville en kveld registrert 31. desember kl. 22 falt utenfor sesongen sin.
 */
export function dagStart(dato: string): Date {
  return new Date(`${dato.slice(0, 10)}T00:00:00.000Z`);
}

export function dagSlutt(dato: string): Date {
  return new Date(`${dato.slice(0, 10)}T23:59:59.999Z`);
}

/**
 * Kvelden hører til sesongen som dekker datoen dens. Tilhørigheten lagres i
 * Match.seasonId, men regnes ut på nytt hver gang en sesong endres – ellers
 * ville en rettet sluttdato latt kvelder bli liggende i feil sesong, og det er
 * nøyaktig den typen to-sannheter appen ellers unngår.
 */
export async function tildelKvelder(seasonId: number): Promise<number> {
  const sesong = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!sesong) return 0;

  const iPerioden = { gte: sesong.startDate, lte: sesong.endDate };

  const [tilordnet, fjernet] = await prisma.$transaction([
    prisma.match.updateMany({
      where: { date: iPerioden, OR: [{ seasonId: null }, { seasonId }] },
      data: { seasonId },
    }),
    prisma.match.updateMany({
      where: { seasonId, NOT: { date: iPerioden } },
      data: { seasonId: null },
    }),
  ]);

  return tilordnet.count + fjernet.count;
}

export async function hentSesonger(): Promise<SesongDto[]> {
  const sesonger = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    include: { matches: { include: { games: { select: { id: true } } } } },
  });

  return sesonger.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    isActive: s.isActive,
    kvelder: s.matches.length,
    runder: s.matches.reduce((n, m) => n + m.games.length, 0),
  }));
}

// ── Sesongtabellen ────────────────────────────────────────────────────────

export interface SesongRad {
  playerId: number;
  name: string;
  /** Rangeringen: vunne runder først, totalpoeng som skillekriterium. */
  runderVunnet: number;
  poeng: number;
  kvelder: number;
  kveldsseire: number;
  giv: number;
  meldinger: number;
  meldingerKlart: number;
}

export interface SesongData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  kvelder: KveldDto[];
  tabell: SesongRad[];
  /** Alle giv i sesongen, klar for lib/stats. */
  giv: StatGiv[];
  runderVunnet: Record<number, number>;
  antallGiv: number;
  antallRunder: number;
}

/**
 * Hvem som vant kvelden: flest vunne runder, med poengene den kvelden som
 * skillekriterium. Samme regel som sesongtabellen, ett nivå ned.
 */
export function kveldsvinner(kveld: KveldDto): number | null {
  const vunnet: Record<number, number> = {};
  for (const r of kveld.runder) {
    if (r.winnerId) vunnet[r.winnerId] = (vunnet[r.winnerId] ?? 0) + 1;
  }
  const kandidater = Object.keys(vunnet).map(Number);
  if (kandidater.length === 0) return null;

  const poeng = stillinger(
    kveld.runder.flatMap((r) => r.giv.map((g) => ({ scores: g.scores }))),
    kveld.spillere.map((s) => s.id),
  );

  return kandidater.sort(
    (a, b) => vunnet[b] - vunnet[a] || (poeng[b] ?? 0) - (poeng[a] ?? 0),
  )[0];
}

export async function hentSesong(id: number): Promise<SesongData | null> {
  const sesong = await prisma.season.findUnique({
    where: { id },
    include: { matches: { orderBy: { date: "desc" }, include: kveldInclude } },
  });
  if (!sesong) return null;

  const kvelder = sesong.matches.map(serialiserKveld);
  const giv: StatGiv[] = kvelder.flatMap((k) => k.runder.flatMap((r) => r.giv));

  const runderVunnet: Record<number, number> = {};
  const kveldsseire: Record<number, number> = {};
  const kveldstelling: Record<number, number> = {};
  const navn = new Map<number, string>();

  for (const k of kvelder) {
    for (const s of k.spillere) {
      navn.set(s.id, s.name);
      kveldstelling[s.id] = (kveldstelling[s.id] ?? 0) + 1;
    }
    for (const r of k.runder) {
      if (r.winnerId) runderVunnet[r.winnerId] = (runderVunnet[r.winnerId] ?? 0) + 1;
    }
    const vinner = kveldsvinner(k);
    if (vinner !== null) kveldsseire[vinner] = (kveldsseire[vinner] ?? 0) + 1;
  }

  const stat = spillerStatistikk(giv, [...navn.keys()], runderVunnet);

  const tabell: SesongRad[] = [...stat.values()]
    .map((s) => ({
      playerId: s.playerId,
      name: navn.get(s.playerId) ?? "?",
      runderVunnet: s.runderVunnet,
      poeng: s.poeng,
      kvelder: kveldstelling[s.playerId] ?? 0,
      kveldsseire: kveldsseire[s.playerId] ?? 0,
      giv: s.giv,
      meldinger: s.meldinger,
      meldingerKlart: s.meldingerKlart,
    }))
    // Runden er spillets naturlige seiersenhet, så den rangerer. Totalpoeng
    // skiller, slik at en kveld med mange korte runder ikke teller mindre enn
    // en kveld med få lange.
    .sort((a, b) => b.runderVunnet - a.runderVunnet || b.poeng - a.poeng);

  return {
    id: sesong.id,
    name: sesong.name,
    startDate: sesong.startDate.toISOString(),
    endDate: sesong.endDate.toISOString(),
    isActive: sesong.isActive,
    kvelder,
    tabell,
    giv,
    runderVunnet,
    antallGiv: giv.filter((g) => g.kind === "melding").length,
    antallRunder: kvelder.reduce((n, k) => n + k.runder.length, 0),
  };
}
