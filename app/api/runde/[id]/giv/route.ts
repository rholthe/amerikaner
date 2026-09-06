import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld, hentRunde } from "@/lib/kveld";
import { tolkGiv, type GivBody } from "@/lib/givInput";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const rundeId = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as GivBody;

  const runde = await hentRunde(rundeId);
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });
  if (runde.isFinished) {
    return NextResponse.json({ error: "Runden er avsluttet" }, { status: 409 });
  }

  const iKvelden = runde.match.players.map((p) => p.playerId);
  const { utkast, rader, trickCount, tricksWon } = tolkGiv(body, iKvelden);

  const ukjent = utkast.deltakere.filter((id) => !iKvelden.includes(id));
  if (ukjent.length > 0) {
    return NextResponse.json(
      { error: "Given inneholder spillere som ikke er med på kvelden" },
      { status: 400 },
    );
  }

  const nesteNr = (runde.deals.at(-1)?.dealNo ?? 0) + 1;

  // Giv og poengrader skrives sammen eller ikke i det hele tatt.
  await prisma.$transaction(async (tx) => {
    const giv = await tx.deal.create({
      data: {
        gameId: rundeId,
        dealNo: nesteNr,
        kind: utkast.kind,
        bidderId: utkast.kind === "pass" ? null : utkast.bidderId,
        partnerId: utkast.kind === "pass" ? null : utkast.partnerId,
        bid: utkast.kind === "pass" ? null : utkast.bid,
        trump: body.trump?.trim() || null,
        trickCount,
        tricksWon,
        isAmerikaner: utkast.isAmerikaner,
        madeIt: utkast.kind === "pass" ? null : utkast.madeIt,
        note: body.note?.trim() || null,
        source: body.source === "james" ? "james" : "manuell",
      },
    });

    if (rader.length > 0) {
      await tx.dealScore.createMany({
        data: rader.map((r) => ({
          dealId: giv.id,
          playerId: r.playerId,
          points: r.points,
          tricks: r.tricks,
          role: r.role,
        })),
      });
    }
  });

  return NextResponse.json(await hentKveld(runde.matchId), { status: 201 });
}
