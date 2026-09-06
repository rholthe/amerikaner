import { prisma } from "@/lib/prisma";
import { spillerStatistikk, type SpillerStat, type StatGiv } from "@/lib/stats";

export interface TotalStatistikk {
  spillere: { id: number; name: string }[];
  stat: SpillerStat[];
  kvelder: number;
}

/**
 * Karrieretall for alle spillere, regnet ut fra samtlige giv. Ligger her og
 * ikke i ruta fordi både /api/statistikk og forsiden trenger nøyaktig det
 * samme – statistikk regnes aldri ut i en API-rute.
 */
export async function hentTotalStatistikk(): Promise<TotalStatistikk> {
  const [spillere, giv, vunne, kvelder] = await Promise.all([
    prisma.player.findMany({ orderBy: { id: "asc" } }),
    prisma.deal.findMany({ include: { scores: true }, orderBy: { id: "asc" } }),
    prisma.game.findMany({ where: { NOT: { winnerId: null } }, select: { winnerId: true } }),
    prisma.match.count(),
  ]);

  const runderVunnet: Record<number, number> = {};
  for (const g of vunne) {
    if (g.winnerId != null) runderVunnet[g.winnerId] = (runderVunnet[g.winnerId] ?? 0) + 1;
  }

  const rader: StatGiv[] = giv.map((d) => ({
    kind: d.kind,
    bidderId: d.bidderId,
    partnerId: d.partnerId,
    bid: d.bid,
    isAmerikaner: d.isAmerikaner,
    madeIt: d.madeIt,
    scores: d.scores.map((s) => ({
      playerId: s.playerId,
      points: s.points,
      tricks: s.tricks,
    })),
  }));

  const stat = spillerStatistikk(
    rader,
    spillere.map((s) => s.id),
    runderVunnet,
  );

  return {
    spillere: spillere.map((s) => ({ id: s.id, name: s.name })),
    stat: [...stat.values()],
    kvelder,
  };
}
