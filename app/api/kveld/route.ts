import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";
import { veggklokkeSomUtc } from "@/lib/dates";
import { MAKS_SPILLERE, MIN_SPILLERE } from "@/lib/scoring";

export async function POST(req: Request) {
  const { playerIds, place, date } = (await req.json().catch(() => ({}))) as {
    playerIds?: number[];
    place?: string;
    date?: string;
  };

  const ider = [...new Set((playerIds ?? []).map(Number))];
  if (ider.length < MIN_SPILLERE || ider.length > MAKS_SPILLERE) {
    return NextResponse.json(
      { error: `En kveld må ha ${MIN_SPILLERE}–${MAKS_SPILLERE} spillere.` },
      { status: 400 },
    );
  }

  const finnes = await prisma.player.count({ where: { id: { in: ider } } });
  if (finnes !== ider.length) {
    return NextResponse.json({ error: "Ukjent spiller i lista" }, { status: 400 });
  }

  const åpen = await prisma.match.findFirst({ where: { isFinished: false } });
  if (åpen) {
    return NextResponse.json(
      { error: "Det pågår allerede en kveld. Avslutt den først.", matchId: åpen.id },
      { status: 409 },
    );
  }

  // Kveld og første runde opprettes sammen – en kveld uten runde er en tilstand
  // ingen skjerm skal måtte tegne.
  const dato = date ? new Date(date) : veggklokkeSomUtc();

  // Kvelden havner i sesongen som dekker datoen. Finnes ingen, står den uten –
  // og kommer inn igjen av seg selv når en sesong opprettes rundt den.
  const sesong = await prisma.season.findFirst({
    where: { startDate: { lte: dato }, endDate: { gte: dato } },
    orderBy: { isActive: "desc" },
  });

  const kveld = await prisma.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        seasonId: sesong?.id ?? null,
        date: dato,
        place: (place ?? "").trim(),
        players: {
          create: ider.map((playerId, i) => ({ playerId, seatOrder: i })),
        },
      },
    });
    await tx.game.create({ data: { matchId: m.id, gameNo: 1 } });
    return m;
  });

  return NextResponse.json(await hentKveld(kveld.id), { status: 201 });
}
