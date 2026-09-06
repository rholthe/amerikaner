import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sletter en hel runde med alle givene i den. Dette er den eneste ruta i appen
 * som fjerner registrerte poeng for godt, og derfor den eneste som krever
 * PIN-en på nytt selv om man allerede er logget inn – cookien varer et år, og
 * en telefon som ligger på bordet skal ikke kunne slette kvelden ved et uhell.
 *
 * Er dette den siste runden på kvelden, slettes kvelden også. En kveld uten
 * runder er ikke en tilstand noen skjerm skal måtte tegne, og den ville blitt
 * liggende igjen i historikken som en tom rad ingen kan fjerne.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const forventet = process.env.APP_PIN;
  if (!forventet) {
    return NextResponse.json({ error: "APP_PIN mangler på serveren" }, { status: 500 });
  }

  const rundeId = Number((await params).id);
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  // Samme brems mot gjetting som /api/pin.
  await new Promise((r) => setTimeout(r, 250));
  if (pin !== forventet) {
    return NextResponse.json({ error: "Feil PIN-kode" }, { status: 401 });
  }

  const runde = await prisma.game.findUnique({
    where: { id: rundeId },
    include: { match: { include: { games: { select: { id: true, gameNo: true } } } } },
  });
  if (!runde) return NextResponse.json({ error: "Ukjent runde" }, { status: 404 });

  const matchId = runde.matchId;
  const resten = runde.match.games
    .filter((g) => g.id !== rundeId)
    .sort((a, b) => a.gameNo - b.gameNo);
  const sisteRunde = resten.length === 0;

  // Barna slettes eksplisitt i stedet for å stole på ON DELETE CASCADE:
  // SQLite håndhever fremmednøkler bare når PRAGMA foreign_keys står på, og
  // det er ikke noe vi vil at riktigheten av en sletting skal henge på.
  await prisma.$transaction(async (tx) => {
    const giv = await tx.deal.findMany({ where: { gameId: rundeId }, select: { id: true } });
    const givIder = giv.map((d) => d.id);
    if (givIder.length > 0) {
      await tx.dealScore.deleteMany({ where: { dealId: { in: givIder } } });
      await tx.deal.deleteMany({ where: { id: { in: givIder } } });
    }
    await tx.game.delete({ where: { id: rundeId } });

    if (sisteRunde) {
      await tx.matchPlayer.deleteMany({ where: { matchId } });
      await tx.match.delete({ where: { id: matchId } });
      return;
    }

    // Renummerering i stigende rekkefølge: hver runde flyttes nedover til et
    // nummer som nettopp ble ledig, så @@unique([matchId, gameNo]) holder hele
    // veien. «Runde 2» i historikken er da alltid den andre runden som ble
    // spilt, slik givnummereringen også er.
    for (const [i, g] of resten.entries()) {
      if (g.gameNo !== i + 1) {
        await tx.game.update({ where: { id: g.id }, data: { gameNo: i + 1 } });
      }
    }
  });

  return NextResponse.json({
    slettetKveld: sisteRunde,
    kveld: sisteRunde ? null : await hentKveld(matchId),
  });
}
