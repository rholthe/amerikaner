import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld, hentRunde } from "@/lib/kveld";
import { justeringsDiff, stillinger } from "@/lib/scoring";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Retting av stillingen. Lagrer differansen som en egen giv med
 * kind = "justering", ikke som en overskriving av et beregnet tall – slik
 * forblir summeringen eneste sannhet, og korrigeringen står synlig i
 * rundehistorikken og kan angres.
 */
export async function POST(req: Request, { params }: Ctx) {
  const rundeId = Number((await params).id);
  const { playerId, nySum, note } = (await req.json().catch(() => ({}))) as {
    playerId?: number;
    nySum?: number;
    note?: string;
  };

  if (!Number.isInteger(playerId) || !Number.isFinite(nySum)) {
    return NextResponse.json({ error: "Ugyldig justering" }, { status: 400 });
  }

  const runde = await hentRunde(rundeId);
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });

  const iKvelden = runde.match.players.map((p) => p.playerId);
  if (!iKvelden.includes(playerId!)) {
    return NextResponse.json({ error: "Spilleren er ikke med på kvelden" }, { status: 400 });
  }

  const stilling = stillinger(
    runde.deals.map((d) => ({ scores: d.scores.map((s) => ({ playerId: s.playerId, points: s.points })) })),
    iKvelden,
  );

  const diff = justeringsDiff(stilling[playerId!] ?? 0, Math.trunc(nySum!));
  if (diff === 0) {
    return NextResponse.json({ error: "Stillingen er allerede den du oppga" }, { status: 400 });
  }

  const nesteNr = (runde.deals.at(-1)?.dealNo ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    const giv = await tx.deal.create({
      data: {
        gameId: rundeId,
        dealNo: nesteNr,
        kind: "justering",
        note: note?.trim() || null,
      },
    });
    await tx.dealScore.create({
      data: { dealId: giv.id, playerId: playerId!, points: diff, role: "justering" },
    });
  });

  return NextResponse.json(await hentKveld(runde.matchId));
}
