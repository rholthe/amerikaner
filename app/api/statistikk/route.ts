import { NextResponse } from "next/server";
import { hentTotalStatistikk } from "@/lib/statsDb";
import type { StatistikkSvar } from "@/lib/typer";

// Åpen rute: lesing er åpen i denne appen, det er skriving som er PIN-beskyttet.
export const dynamic = "force-dynamic";

export async function GET() {
  const svar: StatistikkSvar = await hentTotalStatistikk();
  return NextResponse.json(svar);
}
