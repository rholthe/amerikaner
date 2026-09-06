// Tekstlig beskrivelse av en giv. Ligger i lib/ og ikke i en komponent fordi
// både server-rendrede historikksider og klientkomponentene trenger den – en
// funksjon eksportert fra en "use client"-modul blir en klientreferanse på
// serveren, og krasjer i det den kalles.
import type { GivDto } from "@/lib/typer";

export const TRUMF_VALG = ["♠", "♥", "♦", "♣", "NT"] as const;

/** Røde farger skal være røde, også i en liste med 40 giv. */
export function trumfFarge(trump: string | null | undefined): string | undefined {
  return trump === "♥" || trump === "♦" ? "var(--rod)" : undefined;
}

export function meldingTekst(g: Pick<GivDto, "bid" | "isAmerikaner">): string {
  if (g.isAmerikaner) return "amerikaner";
  return g.bid != null ? String(g.bid) : "?";
}

/** Én linje som beskriver given, uten poeng. */
export function beskrivGiv(g: GivDto, navn: (id: number) => string): string {
  if (g.kind === "pass") return "Alle passet – stokket om";
  if (g.kind === "justering") return g.note ? `Justering · ${g.note}` : "Justering av stillingen";

  const melder = g.bidderId ? navn(g.bidderId) : "Ukjent melder";
  const makker = g.partnerId ? ` med ${navn(g.partnerId)}` : " alene";
  const trumf = g.trump ? ` ${g.trump}` : "";
  const tvungen = g.isForced ? " · tvungen" : "";
  const utfall = g.madeIt === false ? "bet" : "klart";
  return `${melder} meldte ${meldingTekst(g)}${trumf}${makker}${tvungen} · ${utfall}`;
}
