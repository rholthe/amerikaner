import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const data = (await req.json().catch(() => ({}))) as {
    name?: string;
    nickname?: string | null;
    isActive?: boolean;
  };

  const oppdatering: { name?: string; nickname?: string | null; isActive?: boolean } = {};

  if (data.name !== undefined) {
    const navn = data.name.trim();
    if (navn === "" || navn.length > 40) {
      return NextResponse.json({ error: "Ugyldig navn" }, { status: 400 });
    }
    const opptatt = await prisma.player.findFirst({
      where: { name: navn, NOT: { id } },
    });
    if (opptatt) {
      return NextResponse.json({ error: "Navnet er allerede i bruk" }, { status: 409 });
    }
    oppdatering.name = navn;
  }

  if (data.nickname !== undefined) oppdatering.nickname = data.nickname?.trim() || null;
  if (data.isActive !== undefined) oppdatering.isActive = data.isActive;

  await prisma.player.update({ where: { id }, data: oppdatering });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);

  // Spillere som har spilt slettes aldri – historikken og statistikken skal
  // fortsatt stemme. De settes inaktive i stedet. Samme regel som i idiot.
  const antall = await prisma.dealScore.count({ where: { playerId: id } });
  if (antall > 0) {
    return NextResponse.json(
      { error: "Spilleren har registrerte giv og kan ikke slettes. Sett heller inaktiv." },
      { status: 409 },
    );
  }

  await prisma.matchPlayer.deleteMany({ where: { playerId: id } });
  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
