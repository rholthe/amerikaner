import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const matchId = Number((await params).id);

  const kveld = await prisma.match.findUnique({
    where: { id: matchId },
    include: { games: { include: { deals: true } } },
  });
  if (!kveld) return NextResponse.json({ error: "Ukjent kveld" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // En påbegynt runde uten giv er bare støy i historikken – gutta rakk aldri
    // å spille den. En runde med giv står, selv om ingen nådde 52.
    const tomme = kveld.games.filter((g) => g.deals.length === 0).map((g) => g.id);
    if (tomme.length > 0) {
      await tx.game.deleteMany({ where: { id: { in: tomme } } });
    }
    await tx.match.update({ where: { id: matchId }, data: { isFinished: true } });
  });

  return NextResponse.json(await hentKveld(matchId));
}
