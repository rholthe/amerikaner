import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dagSlutt, dagStart, hentSesonger, tildelKvelder } from "@/lib/sesong";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { name, startDate, endDate, isActive } = (await req.json().catch(() => ({}))) as {
    name?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  };

  const sesong = await prisma.season.findUnique({ where: { id } });
  if (!sesong) return NextResponse.json({ error: "Ukjent sesong" }, { status: 404 });

  const navn = name === undefined ? undefined : name.trim();
  if (navn !== undefined && (navn === "" || navn.length > 40)) {
    return NextResponse.json({ error: "Ugyldig sesongnavn" }, { status: 400 });
  }

  const start = startDate ? dagStart(startDate) : sesong.startDate;
  const slutt = endDate ? dagSlutt(endDate) : sesong.endDate;
  if (!(start < slutt)) {
    return NextResponse.json({ error: "Sluttdatoen må være etter startdatoen" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.season.updateMany({
        where: { isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }
    await tx.season.update({
      where: { id },
      data: {
        ...(navn !== undefined ? { name: navn } : {}),
        startDate: start,
        endDate: slutt,
        ...(isActive === undefined ? {} : { isActive }),
      },
    });
  });

  // Datoene kan ha flyttet seg, så tilhørigheten regnes ut på nytt.
  await tildelKvelder(id);
  return NextResponse.json(await hentSesonger());
}

/**
 * Sletter sesongen, ikke kveldene i den. Kvelder er registrerte poeng; en
 * sesong er bare et datointervall rundt dem, og skal kunne rettes opp uten at
 * noe går tapt. Kveldene blir stående uten sesong og kommer inn igjen så snart
 * en sesong dekker datoen deres.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const sesong = await prisma.season.findUnique({ where: { id } });
  if (!sesong) return NextResponse.json({ error: "Ukjent sesong" }, { status: 404 });

  await prisma.$transaction([
    prisma.match.updateMany({ where: { seasonId: id }, data: { seasonId: null } }),
    prisma.season.delete({ where: { id } }),
  ]);

  return NextResponse.json(await hentSesonger());
}
