import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Avslutter kvelden. Sto det igjen påbegynte runder uten giv, ryddes de bort –
 * gutta rakk aldri å spille dem. Ble det ingen runder igjen i det hele tatt,
 * slettes kvelden også: en kveld uten runder er ikke en tilstand noen skjerm
 * skal måtte tegne, og den ville blitt liggende i historikken som en tom rad
 * ingen kan fjerne. Samme regel som når den siste runden slettes.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const matchId = Number((await params).id);

  const kveld = await prisma.match.findUnique({
    where: { id: matchId },
    include: { games: { include: { deals: { select: { id: true } } } } },
  });
  if (!kveld) return NextResponse.json({ error: "Ukjent kveld" }, { status: 404 });

  const tomme = kveld.games.filter((g) => g.deals.length === 0).map((g) => g.id);
  const blirTom = tomme.length === kveld.games.length;

  await prisma.$transaction(async (tx) => {
    if (tomme.length > 0) {
      await tx.game.deleteMany({ where: { id: { in: tomme } } });
    }
    if (blirTom) {
      await tx.matchPlayer.deleteMany({ where: { matchId } });
      await tx.match.delete({ where: { id: matchId } });
      return;
    }
    await tx.match.update({ where: { id: matchId }, data: { isFinished: true } });
  });

  return NextResponse.json(blirTom ? null : await hentKveld(matchId));
}
