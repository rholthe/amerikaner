import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hentAktivKveld } from "@/lib/kveld";
import type { AktivKveldSvar, SpillerDto } from "@/lib/typer";

export const dynamic = "force-dynamic";

export async function GET() {
  const [kveld, spillere] = await Promise.all([
    hentAktivKveld(),
    prisma.player.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { dealScores: true } } },
    }),
  ]);

  const svar: AktivKveldSvar = {
    kveld,
    spillere: spillere.map(
      (p): SpillerDto => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        isActive: p.isActive,
        givCount: p._count.dealScores,
      }),
    ),
  };

  return NextResponse.json(svar);
}
