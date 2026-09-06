import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dagSlutt, dagStart, hentSesonger, tildelKvelder } from "@/lib/sesong";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await hentSesonger());
}

export async function POST(req: Request) {
  const { name, startDate, endDate, isActive } = (await req.json().catch(() => ({}))) as {
    name?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  };

  const navn = (name ?? "").trim();
  if (!navn || navn.length > 40) {
    return NextResponse.json({ error: "Ugyldig sesongnavn" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Sesongen må ha start- og sluttdato" }, { status: 400 });
  }

  const start = dagStart(startDate);
  const slutt = dagSlutt(endDate);
  if (!(start < slutt)) {
    return NextResponse.json({ error: "Sluttdatoen må være etter startdatoen" }, { status: 400 });
  }

  const sesong = await prisma.$transaction(async (tx) => {
    // Bare én sesong kan være den inneværende – ellers ville forsiden hatt to
    // svar på hvilken sesong som pågår.
    if (isActive) {
      await tx.season.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    return tx.season.create({
      data: { name: navn, startDate: start, endDate: slutt, isActive: Boolean(isActive) },
    });
  });

  await tildelKvelder(sesong.id);
  return NextResponse.json(await hentSesonger(), { status: 201 });
}
