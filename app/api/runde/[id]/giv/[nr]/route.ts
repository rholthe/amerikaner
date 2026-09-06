import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld, hentRunde } from "@/lib/kveld";
import { tolkGiv, type GivBody } from "@/lib/givInput";

type Ctx = { params: Promise<{ id: string; nr: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id, nr } = await params;
  const rundeId = Number(id);
  const dealNo = Number(nr);
  const body = (await req.json().catch(() => ({}))) as GivBody;

  const runde = await hentRunde(rundeId);
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });

  const giv = runde.deals.find((d) => d.dealNo === dealNo);
  if (!giv) return NextResponse.json({ error: "Ukjent giv" }, { status: 404 });

  const iKvelden = runde.match.players.map((p) => p.playerId);
  const { utkast, rader, trickCount, tricksWon } = tolkGiv(body, iKvelden);

  await prisma.$transaction(async (tx) => {
    await tx.dealScore.deleteMany({ where: { dealId: giv.id } });
    await tx.deal.update({
      where: { id: giv.id },
      data: {
        kind: utkast.kind,
        bidderId: utkast.kind === "pass" ? null : utkast.bidderId,
        partnerId: utkast.kind === "pass" ? null : utkast.partnerId,
        bid: utkast.kind === "pass" ? null : utkast.bid,
        trump: body.trump?.trim() || null,
        trickCount,
        tricksWon,
        isAmerikaner: utkast.isAmerikaner,
        isForced: utkast.kind === "pass" ? false : utkast.isForced,
        madeIt: utkast.kind === "pass" ? null : utkast.madeIt,
        note: body.note?.trim() || null,
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

  return NextResponse.json(await hentKveld(runde.matchId));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, nr } = await params;
  const rundeId = Number(id);
  const dealNo = Number(nr);

  const runde = await hentRunde(rundeId);
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });

  const giv = runde.deals.find((d) => d.dealNo === dealNo);
  if (!giv) return NextResponse.json({ error: "Ukjent giv" }, { status: 404 });

  // Givene renummereres etter sletting, slik at «giv 5» i historikken alltid er
  // den femte given som ble spilt. Uten dette ville nummereringen fått hull, og
  // en muntlig korreksjon som «rett giv fem» ville pekt på feil rad.
  await prisma.$transaction(async (tx) => {
    await tx.deal.delete({ where: { id: giv.id } });
    const etter = runde.deals.filter((d) => d.dealNo > dealNo);
    for (const d of etter) {
      await tx.deal.update({ where: { id: d.id }, data: { dealNo: d.dealNo - 1 } });
    }
  });

  return NextResponse.json(await hentKveld(runde.matchId));
}
