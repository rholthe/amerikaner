import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SpillerDto } from "@/lib/typer";

export async function GET() {
  const spillere = await prisma.player.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { dealScores: true } } },
  });

  const svar: SpillerDto[] = spillere.map((p) => ({
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    isActive: p.isActive,
    givCount: p._count.dealScores,
  }));

  return NextResponse.json(svar);
}

export async function POST(req: Request) {
  const { name, nickname } = (await req.json().catch(() => ({}))) as {
    name?: string;
    nickname?: string;
  };

  const navn = (name ?? "").trim();
  if (navn === "" || navn.length > 40) {
    return NextResponse.json({ error: "Ugyldig navn" }, { status: 400 });
  }

  const finnes = await prisma.player.findUnique({ where: { name: navn } });
  if (finnes) {
    return NextResponse.json({ error: "Navnet er allerede i bruk" }, { status: 409 });
  }

  const spiller = await prisma.player.create({
    data: { name: navn, nickname: nickname?.trim() || null },
  });

  return NextResponse.json({ ...spiller, givCount: 0 }, { status: 201 });
}
