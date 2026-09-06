import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld, hentRunde } from "@/lib/kveld";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Eneste stedet Game.winnerId skrives. avgjørRunde() foreslår, men runden
 * avsluttes aldri av seg selv – den siste given er den som oftest er feilhørt.
 */
export async function POST(req: Request, { params }: Ctx) {
  const rundeId = Number((await params).id);
  const { winnerId } = (await req.json().catch(() => ({}))) as { winnerId?: number };

  const runde = await hentRunde(rundeId);
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });

  const iKvelden = runde.match.players.map((p) => p.playerId);
  if (!Number.isInteger(winnerId) || !iKvelden.includes(winnerId!)) {
    return NextResponse.json({ error: "Velg en spiller som er med på kvelden" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: rundeId },
      data: { winnerId: winnerId!, isFinished: true },
    });

    // Ny runde bare hvis kvelden fortsatt pågår. Blir en gammel runde avgjort
    // i ettertid – slik den fra 5. september måtte – skal det ikke dukke opp en
    // tom runde i en kveld som for lengst er lagt bort.
    if (runde.match.isFinished) return;

    const neste = await tx.game.findFirst({
      where: { matchId: runde.matchId },
      orderBy: { gameNo: "desc" },
    });
    await tx.game.create({
      data: { matchId: runde.matchId, gameNo: (neste?.gameNo ?? 0) + 1 },
    });
  });

  return NextResponse.json(await hentKveld(runde.matchId));
}
