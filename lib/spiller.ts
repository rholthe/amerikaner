import { prisma } from "@/lib/prisma";
import { kveldInclude, serialiserKveld } from "@/lib/kveld";
import { stillinger } from "@/lib/scoring";
import { makkerPar, spillerStatistikk, type SpillerStat, type StatGiv } from "@/lib/stats";
import type { MatriseRad } from "@/components/Makkermatrise";

export interface KveldsRad {
  id: number;
  date: string;
  place: string;
  poeng: number;
  runderVunnet: number;
  /** Plassering den kvelden: vunne runder først, poeng som skillekriterium. */
  plassering: number;
  antallSpillere: number;
  sesong: { id: number; name: string } | null;
}

export interface SesongRadForSpiller {
  id: number;
  name: string;
  isActive: boolean;
  kvelder: number;
  runderVunnet: number;
  poeng: number;
}

export interface SpillerProfil {
  id: number;
  name: string;
  nickname: string | null;
  isActive: boolean;
  stat: SpillerStat;
  kvelder: number;
  kveldsseire: number;
  /** Lengste rekke med kvelder på rad der man vant minst én runde. */
  seiersrekke: number;
  /** Alle som har vært med på en kveld sammen med spilleren. */
  medspillere: { id: number; name: string }[];
  par: MatriseRad[];
  sesonger: SesongRadForSpiller[];
  siste: KveldsRad[];
}

/**
 * Alt om én spiller, regnet ut fra givene. Laster kveldene spilleren faktisk
 * var med på – ikke hele historikken – slik at profilen ikke vokser med kvelder
 * han ikke har spilt.
 */
export async function hentSpillerProfil(id: number): Promise<SpillerProfil | null> {
  const spiller = await prisma.player.findUnique({ where: { id } });
  if (!spiller) return null;

  const rader = await prisma.match.findMany({
    where: { players: { some: { playerId: id } } },
    orderBy: { date: "desc" },
    include: { ...kveldInclude, season: true },
  });

  const kvelder = rader.map(serialiserKveld);
  const sesongFor = new Map(rader.map((m) => [m.id, m.season]));

  const alleGiv: StatGiv[] = kvelder.flatMap((k) => k.runder.flatMap((r) => r.giv));

  const runderVunnet: Record<number, number> = {};
  for (const k of kvelder) {
    for (const r of k.runder) {
      if (r.winnerId) runderVunnet[r.winnerId] = (runderVunnet[r.winnerId] ?? 0) + 1;
    }
  }

  const stat = spillerStatistikk(alleGiv, [id], runderVunnet).get(id)!;

  const medspillere = new Map<number, string>();
  for (const k of kvelder) for (const s of k.spillere) medspillere.set(s.id, s.name);

  const par: MatriseRad[] = [...makkerPar(alleGiv)].map(([nøkkel, v]) => ({ nøkkel, ...v }));

  // ── Per kveld ───────────────────────────────────────────────────────────
  const sesongSum = new Map<number, SesongRadForSpiller>();
  let kveldsseire = 0;

  const siste: KveldsRad[] = kvelder.map((k) => {
    const deltakere = k.spillere.map((s) => s.id);
    const poeng = stillinger(
      k.runder.flatMap((r) => r.giv.map((g) => ({ scores: g.scores }))),
      deltakere,
    );
    const vunnet: Record<number, number> = {};
    for (const r of k.runder) {
      if (r.winnerId) vunnet[r.winnerId] = (vunnet[r.winnerId] ?? 0) + 1;
    }

    const rangert = [...deltakere].sort(
      (a, b) => (vunnet[b] ?? 0) - (vunnet[a] ?? 0) || (poeng[b] ?? 0) - (poeng[a] ?? 0),
    );
    const plassering = rangert.indexOf(id) + 1;
    if (plassering === 1 && (vunnet[id] ?? 0) > 0) kveldsseire += 1;

    const sesong = sesongFor.get(k.id) ?? null;
    if (sesong) {
      const rad = sesongSum.get(sesong.id) ?? {
        id: sesong.id,
        name: sesong.name,
        isActive: sesong.isActive,
        kvelder: 0,
        runderVunnet: 0,
        poeng: 0,
      };
      rad.kvelder += 1;
      rad.runderVunnet += vunnet[id] ?? 0;
      rad.poeng += poeng[id] ?? 0;
      sesongSum.set(sesong.id, rad);
    }

    return {
      id: k.id,
      date: k.date,
      place: k.place,
      poeng: poeng[id] ?? 0,
      runderVunnet: vunnet[id] ?? 0,
      plassering,
      antallSpillere: deltakere.length,
      sesong: sesong ? { id: sesong.id, name: sesong.name } : null,
    };
  });

  // siste[] er nyeste først; rekka telles kronologisk.
  let rekke = 0;
  let lengsteRekke = 0;
  for (const k of [...siste].reverse()) {
    rekke = k.runderVunnet > 0 ? rekke + 1 : 0;
    lengsteRekke = Math.max(lengsteRekke, rekke);
  }

  return {
    id: spiller.id,
    name: spiller.name,
    nickname: spiller.nickname,
    isActive: spiller.isActive,
    stat,
    kvelder: kvelder.length,
    kveldsseire,
    seiersrekke: lengsteRekke,
    medspillere: [...medspillere].map(([mid, name]) => ({ id: mid, name })),
    par,
    sesonger: [...sesongSum.values()],
    siste,
  };
}
