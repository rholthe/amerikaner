import { prisma } from "@/lib/prisma";
import type { GivDto, KveldDto, RundeDto } from "@/lib/typer";
import type { Rolle } from "@/lib/scoring";

export const kveldInclude = {
  players: { include: { player: true }, orderBy: { seatOrder: "asc" } },
  games: {
    orderBy: { gameNo: "asc" },
    include: {
      deals: {
        orderBy: { dealNo: "asc" },
        include: { scores: true },
      },
    },
  },
} as const;

type MedRelasjoner = Awaited<
  ReturnType<typeof prisma.match.findFirst<{ include: typeof kveldInclude }>>
>;

export function serialiserKveld(m: NonNullable<MedRelasjoner>): KveldDto {
  return {
    id: m.id,
    date: m.date.toISOString(),
    place: m.place,
    isFinished: m.isFinished,
    spillere: m.players.map((p) => ({ id: p.player.id, name: p.player.name })),
    runder: m.games.map(
      (g): RundeDto => ({
        id: g.id,
        gameNo: g.gameNo,
        targetScore: g.targetScore,
        winnerId: g.winnerId,
        isFinished: g.isFinished,
        giv: g.deals.map(
          (d): GivDto => ({
            id: d.id,
            dealNo: d.dealNo,
            kind: d.kind,
            bidderId: d.bidderId,
            partnerId: d.partnerId,
            bid: d.bid,
            trump: d.trump,
            tricksWon: d.tricksWon,
            trickCount: d.trickCount,
            isAmerikaner: d.isAmerikaner,
            isForced: d.isForced,
            madeIt: d.madeIt,
            note: d.note,
            source: d.source,
            scores: d.scores.map((s) => ({
              playerId: s.playerId,
              points: s.points,
              tricks: s.tricks,
              role: s.role as Rolle,
            })),
          }),
        ),
      }),
    ),
  };
}

export async function hentKveld(id: number): Promise<KveldDto | null> {
  const m = await prisma.match.findUnique({ where: { id }, include: kveldInclude });
  return m ? serialiserKveld(m) : null;
}

export async function hentAktivKveld(): Promise<KveldDto | null> {
  const m = await prisma.match.findFirst({
    where: { isFinished: false },
    orderBy: { id: "desc" },
    include: kveldInclude,
  });
  return m ? serialiserKveld(m) : null;
}

/** Runden en giv hører til, med kvelden rundt. Brukes av giv-rutene. */
export async function hentRunde(rundeId: number) {
  return prisma.game.findUnique({
    where: { id: rundeId },
    include: {
      deals: { include: { scores: true }, orderBy: { dealNo: "asc" } },
      match: { include: { players: true } },
    },
  });
}
