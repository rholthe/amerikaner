import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const matchId = Number((await params).id);

  const kveld = await prisma.match.findUnique({ where: { id: matchId } });
  if (!kveld) return NextResponse.json({ error: "Ukjent kveld" }, { status: 404 });
  if (kveld.isFinished) {
    return NextResponse.json({ error: "Kvelden er avsluttet" }, { status: 409 });
  }

  // Idempotent: finnes det allerede en åpen runde, er det den vi skal stå i.
  // Storskjermen skal ikke kunne lage tomme runder ved dobbelttrykk.
  const åpen = await prisma.game.findFirst({
    where: { matchId, isFinished: false },
    orderBy: { gameNo: "desc" },
  });
  if (åpen) {
    return NextResponse.json(await hentKveld(matchId));
  }

  const forrige = await prisma.game.findFirst({
    where: { matchId },
    orderBy: { gameNo: "desc" },
  });

  await prisma.game.create({
    data: { matchId, gameNo: (forrige?.gameNo ?? 0) + 1 },
  });

  return NextResponse.json(await hentKveld(matchId), { status: 201 });
}
