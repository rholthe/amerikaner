import { prisma } from "@/lib/prisma";
import { kveldInclude, serialiserKveld } from "@/lib/kveld";
import { stillinger } from "@/lib/scoring";

export interface OversiktKveld {
  id: number;
  date: string;
  place: string;
  deltakere: number[];
  poeng: Record<number, number>;
  runderVunnet: Record<number, number>;
  antallGiv: number;
}

export interface Oversikt {
  /** Alle som har spilt i utvalget, sortert på id så fargene er stabile. */
  spillere: { id: number; name: string }[];
  /** Kveldene i stigende datorekkefølge – kurver leses fra venstre. */
  kvelder: OversiktKveld[];
  totaltRunder: Record<number, number>;
  totaltPoeng: Record<number, number>;
}

/** `null` betyr alle kvelder, uansett sesong. */
export async function hentOversikt(seasonId: number | null): Promise<Oversikt> {
  const rader = await prisma.match.findMany({
    where: seasonId === null ? {} : { seasonId },
    orderBy: { date: "asc" },
    include: kveldInclude,
  });

  const navn = new Map<number, string>();
  const totaltRunder: Record<number, number> = {};
  const totaltPoeng: Record<number, number> = {};

  const kvelder: OversiktKveld[] = rader.map(serialiserKveld).map((k) => {
    const deltakere = k.spillere.map((s) => s.id);
    for (const s of k.spillere) navn.set(s.id, s.name);

    const poeng = stillinger(
      k.runder.flatMap((r) => r.giv.map((g) => ({ scores: g.scores }))),
      deltakere,
    );
    const runderVunnet: Record<number, number> = {};
    for (const r of k.runder) {
      if (r.winnerId) runderVunnet[r.winnerId] = (runderVunnet[r.winnerId] ?? 0) + 1;
    }

    for (const id of deltakere) {
      totaltPoeng[id] = (totaltPoeng[id] ?? 0) + (poeng[id] ?? 0);
      totaltRunder[id] = (totaltRunder[id] ?? 0) + (runderVunnet[id] ?? 0);
    }

    return {
      id: k.id,
      date: k.date,
      place: k.place,
      deltakere,
      poeng,
      runderVunnet,
      antallGiv: k.runder.reduce(
        (n, r) => n + r.giv.filter((g) => g.kind === "melding").length,
        0,
      ),
    };
  });

  return {
    spillere: [...navn].map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id),
    kvelder,
    totaltRunder,
    totaltPoeng,
  };
}
