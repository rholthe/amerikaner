import { NextResponse } from "next/server";
import { hashPin, PIN_COOKIE } from "@/lib/pinHash";

const ETT_AAR = 365 * 24 * 60 * 60;

export async function POST(req: Request) {
  const pin = process.env.APP_PIN;
  if (!pin) {
    return NextResponse.json({ error: "APP_PIN mangler på serveren" }, { status: 500 });
  }

  const { pin: oppgitt } = (await req.json().catch(() => ({}))) as { pin?: string };

  // Liten brems mot gjetting. Appen står bak et privat domene og en delt PIN,
  // så dette er nok – men gratis er det også.
  await new Promise((r) => setTimeout(r, 250));

  if (oppgitt !== pin) {
    return NextResponse.json({ error: "Feil PIN-kode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PIN_COOKIE, await hashPin(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ETT_AAR,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
