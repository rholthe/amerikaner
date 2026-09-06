import { beregnGiv, rolleFor, type GivRad, type GivUtkast } from "./scoring";

export interface GivBody {
  kind?: "melding" | "pass";
  bidderId?: number | null;
  partnerId?: number | null;
  bid?: number | null;
  trump?: string | null;
  isAmerikaner?: boolean;
  isForced?: boolean;
  madeIt?: boolean;
  trickCount?: number | null;
  deltakere?: number[];
  stikk?: Record<string, number>;
  /** Endelige poeng. Er de satt, vinner de over det beregnede – det som lagres
   *  er sannheten, og den som registrerer skal kunne overstyre et tall. */
  poeng?: Record<string, number> | null;
  note?: string | null;
  source?: string;
}

export interface TolketGiv {
  utkast: GivUtkast;
  rader: GivRad[];
  trickCount: number | null;
  tricksWon: number | null;
}

function tallKart(o: Record<string, number> | undefined | null): Record<number, number> {
  const ut: Record<number, number> = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    const id = Number(k);
    if (Number.isInteger(id) && Number.isFinite(v)) ut[id] = Math.trunc(v);
  }
  return ut;
}

export function tolkGiv(body: GivBody, deltakereIKveld: number[]): TolketGiv {
  const deltakere =
    Array.isArray(body.deltakere) && body.deltakere.length > 0
      ? body.deltakere.map(Number)
      : deltakereIKveld;

  const utkast: GivUtkast = {
    kind: body.kind === "pass" ? "pass" : "melding",
    bidderId: body.bidderId ?? null,
    partnerId: body.partnerId ?? null,
    bid: body.bid ?? null,
    isAmerikaner: Boolean(body.isAmerikaner),
    isForced: Boolean(body.isForced),
    madeIt: body.madeIt !== false,
    stikk: tallKart(body.stikk),
    deltakere,
  };

  const overstyrt = tallKart(body.poeng);
  const rader: GivRad[] =
    body.poeng && Object.keys(overstyrt).length > 0
      ? deltakere.map((id) => ({
          playerId: id,
          points: overstyrt[id] ?? 0,
          tricks: utkast.stikk[id] ?? null,
          role: rolleFor(utkast, id),
        }))
      : beregnGiv(utkast);

  const trickCount = body.trickCount ?? null;
  const motstikk = deltakere
    .filter((id) => rolleFor(utkast, id) === "motspiller")
    .reduce((sum, id) => sum + (utkast.stikk[id] ?? 0), 0);

  return {
    utkast,
    rader: utkast.kind === "pass" ? [] : rader,
    trickCount,
    tricksWon: trickCount != null ? trickCount - motstikk : null,
  };
}
