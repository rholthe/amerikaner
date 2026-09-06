// All poenglogikk for amerikaner. Rene funksjoner, ingen database, ingen React.
// Både den manuelle registreringen og James-ruten (fase 3) kaller disse – endre
// aldri poengregler i en API-rute, endre dem her og oppdater testene.
//
// Se CLAUDE.md kapittel 1 for reglene. Kort:
//   Melder + makker klarer meldingen  → begge +melding
//   Melder + makker går bet           → begge −melding
//   Motspillere                       → +1 per stikk
//   Amerikaner (alle stikk alene)     → ±52
//   Runden går til 52; den med flest poeng vinner.

export const MÅL_POENG = 52;
export const AMERIKANER_POENG = 52;

export const MIN_SPILLERE = 3;
export const MAKS_SPILLERE = 6;

export type GivKind = "melding" | "pass" | "justering";
export type Rolle = "melder" | "makker" | "motspiller" | "justering";

export interface GivUtkast {
  kind: GivKind;
  bidderId: number | null;
  partnerId: number | null;
  /** Antall stikk meldt. Valgfri – en giv kan registreres med poeng alene. */
  bid: number | null;
  isAmerikaner: boolean;
  /** Tvungen giv – meldingen var bestemt på forhånd. Påvirker ikke poengene. */
  isForced: boolean;
  /** Klarte melder og makker meldingen? */
  madeIt: boolean;
  /** Stikk per motspiller: playerId → antall. */
  stikk: Record<number, number>;
  /** Hvem som spilte denne given. Kan avvike fra hvem som møtte opp. */
  deltakere: number[];
}

export interface GivRad {
  playerId: number;
  points: number;
  tricks: number | null;
  role: Rolle;
}

export function rolleFor(g: Pick<GivUtkast, "bidderId" | "partnerId">, playerId: number): Rolle {
  if (g.bidderId === playerId) return "melder";
  if (g.partnerId === playerId) return "makker";
  return "motspiller";
}

/**
 * Foreslåtte poeng for en giv. Resultatet er et *forslag* – den som registrerer
 * kan overstyre hvert enkelt tall før lagring, og det lagrede tallet er
 * sannheten. Derfor kaster denne aldri; ufullstendige giv gir bare 0-er.
 */
export function beregnGiv(g: GivUtkast): GivRad[] {
  if (g.kind === "pass") return [];

  const lagPoeng = g.isAmerikaner ? AMERIKANER_POENG : (g.bid ?? 0);
  const fortegn = g.madeIt ? 1 : -1;

  return g.deltakere.map((id) => {
    const role = rolleFor(g, id);

    if (role === "melder" || role === "makker") {
      return { playerId: id, points: fortegn * lagPoeng, tricks: null, role };
    }

    // Klarte melderen amerikaner, finnes det per definisjon ingen stikk igjen
    // å dele ut. Går han bet, får motspillerne stikkene sine som vanlig.
    const stikk = g.isAmerikaner && g.madeIt ? 0 : (g.stikk[id] ?? 0);
    return { playerId: id, points: stikk, tricks: stikk, role: "motspiller" as const };
  });
}

export interface ValiderOpts {
  /** Antall stikk i given, hvis kjent. Følger av spillerantallet. */
  trickCount?: number | null;
  /** Hvem som er med på kvelden. */
  deltakereIKveld: number[];
}

/**
 * Advarsler, ikke feil. Ingenting her skal blokkere lagring – en advarsel som
 * blokkerer er en advarsel som blir omgått. Kortet vises gult og mennesket
 * bestemmer.
 */
export function validerGiv(g: GivUtkast, opts: ValiderOpts): string[] {
  const a: string[] = [];
  if (g.kind !== "melding") return a;

  const n = g.deltakere.length;
  if (n < MIN_SPILLERE || n > MAKS_SPILLERE) {
    a.push(`${n} spillere i given – amerikaner spilles med ${MIN_SPILLERE}–${MAKS_SPILLERE}.`);
  }

  if (g.bidderId !== null && g.bidderId === g.partnerId) {
    a.push("Melder og makker er samme spiller.");
  }

  const ukjente = g.deltakere.filter((id) => !opts.deltakereIKveld.includes(id));
  if (ukjente.length > 0) {
    a.push(`${ukjente.length === 1 ? "En spiller" : `${ukjente.length} spillere`} i given er ikke med på kvelden.`);
  }

  if (g.bidderId !== null && !g.isAmerikaner && (g.bid === null || g.bid <= 0)) {
    a.push("Melder er valgt, men melding mangler.");
  }

  if (g.isForced) {
    if (g.isAmerikaner) {
      a.push("Given er merket som tvungen, men meldingen er amerikaner.");
    } else {
      const fast = tvungenMeldingFor(n);
      if (fast !== null && g.bid !== null && g.bid !== fast) {
        a.push(`Tvungen giv med ${n} spillere er ${fast}, ikke ${g.bid}.`);
      }
    }
  }

  const motstikk = g.deltakere
    .filter((id) => rolleFor(g, id) === "motspiller")
    .reduce((sum, id) => sum + (g.stikk[id] ?? 0), 0);

  if (opts.trickCount != null && opts.trickCount > 0) {
    if (motstikk > opts.trickCount) {
      a.push(`Motspillerne har ${motstikk} stikk, men given har bare ${opts.trickCount}.`);
    } else if (g.madeIt && g.bid !== null && !g.isAmerikaner) {
      const lagStikk = opts.trickCount - motstikk;
      if (lagStikk < g.bid) {
        a.push(`Laget tok ${lagStikk} stikk, men meldte ${g.bid}.`);
      }
    }
    if (g.isAmerikaner && g.madeIt && motstikk > 0) {
      a.push("Amerikaner er klart, men motspillerne står med stikk.");
    }
  }

  return a;
}

// ── Stilling og avgjørelse ────────────────────────────────────────────────

export interface PoengRad {
  playerId: number;
  points: number;
}

export interface GivIRunde {
  scores: PoengRad[];
}

/** Stillingen summeres alltid fra givene. Den lagres aldri. */
export function stillinger(giv: GivIRunde[], deltakere: number[]): Record<number, number> {
  const sum: Record<number, number> = {};
  for (const id of deltakere) sum[id] = 0;
  for (const g of giv) {
    for (const rad of g.scores) {
      sum[rad.playerId] = (sum[rad.playerId] ?? 0) + rad.points;
    }
  }
  return sum;
}

export interface RundeStatus {
  stilling: Record<number, number>;
  /** Høyeste sum i runden, uansett om 52 er nådd. */
  ledendeId: number | null;
  /** Har noen nådd målet? */
  kanAvsluttes: boolean;
  /** Foreslått vinner: den høyeste av dem som har nådd målet. */
  forslagVinnerId: number | null;
  /** Flere delt på samme toppsum ≥ målet – da må mennesket velge. */
  uavgjort: number[];
}

/**
 * Foreslår, avgjør ikke. Game.winnerId skrives utelukkende av
 * /api/runde/[id]/avslutt etter en manuell bekreftelse – den siste given er den
 * som oftest er feilhørt, og en runde som avslutter seg selv på feil grunnlag
 * koster mer å rydde opp i enn ett ekstra trykk koster å gjøre.
 */
export function avgjørRunde(
  giv: GivIRunde[],
  deltakere: number[],
  mål: number = MÅL_POENG,
): RundeStatus {
  const stilling = stillinger(giv, deltakere);
  const ider = deltakere.filter((id) => id in stilling);

  let ledendeId: number | null = null;
  for (const id of ider) {
    if (ledendeId === null || stilling[id] > stilling[ledendeId]) ledendeId = id;
  }

  const oppnådd = ider.filter((id) => stilling[id] >= mål);
  if (oppnådd.length === 0) {
    return { stilling, ledendeId, kanAvsluttes: false, forslagVinnerId: null, uavgjort: [] };
  }

  const topp = Math.max(...oppnådd.map((id) => stilling[id]));
  const påTopp = oppnådd.filter((id) => stilling[id] === topp);

  return {
    stilling,
    ledendeId,
    kanAvsluttes: true,
    forslagVinnerId: påTopp[0],
    uavgjort: påTopp.length > 1 ? påTopp : [],
  };
}

/**
 * Retting av stillingen lagres som differanse, ikke som overskriving – slik
 * forblir summeringen eneste sannhet, og korrigeringen står synlig i
 * rundehistorikken.
 */
export function justeringsDiff(nåværendeSum: number, ønsketSum: number): number {
  return ønsketSum - nåværendeSum;
}

/** Antall stikk i en giv, gitt spillerantallet. Null når vi ikke vet. */
export function stikkForSpillerantall(n: number): number | null {
  // 4 spillere: 52 kort, 13 hver. 5 spillere: 52 + 3 jokere, 11 hver.
  // For 3 og 6 varierer husreglene, så vi gjetter ikke – et gjettet stikktall
  // her ville gitt falske advarsler på ekte giv.
  if (n === 4) return 13;
  if (n === 5) return 11;
  return null;
}

// ── Tvungne giv ───────────────────────────────────────────────────────────
//
// I en tvungen runde må alle spillerne etter tur klare en melding som er
// bestemt på forhånd. Med 4 spillere er den 9.
//
// Tallene for 3, 5 og 6 er skalert fra de 9 ved 4 spillere, i samme forhold
// som stikkene: legger man til færrest mulig jokere slik at kortstokken går opp
// i spillerantallet, får man 18, 13, 11 og 9 stikk – og det reproduserer begge
// stikktallene appen allerede kjenner (13 ved 4 og 11 ved 5). 9 av 13 er 69 %
// av stikkene, og samme andel gir tallene under.
//
// Dette er en husregel, ikke en spilleregel: meldingen kan alltid endres i
// skjemaet, og skal et annet tall gjelde fast, er det denne tabellen som endres.
export const TVUNGEN_MELDING: Record<number, number> = {
  3: 12,
  4: 9,
  5: 8,
  6: 6,
};

export function tvungenMeldingFor(antallSpillere: number): number | null {
  return TVUNGEN_MELDING[antallSpillere] ?? null;
}

/**
 * Hvor langt man er kommet i en tvungen runde. Utledes av givene som er lagret,
 * ikke av en knapp som står på – da overlever den både at siden lastes på nytt
 * og at noen andre ved bordet registrerer neste giv fra sin egen telefon.
 *
 * Returnerer null når det ikke pågår en tvungen runde.
 */
export function tvungenStatus(
  giv: { kind: GivKind | string; isForced: boolean }[],
  antallSpillere: number,
): { nr: number; av: number } | null {
  if (antallSpillere <= 0) return null;

  let påRad = 0;
  for (let i = giv.length - 1; i >= 0; i--) {
    if (!giv[i].isForced) break;
    påRad += 1;
  }

  // Modulo, ikke bare «< antallSpillere»: går det to tvungne runder rett etter
  // hverandre, skal telleren begynne på nytt og ikke bli stående på.
  const igjen = påRad % antallSpillere;
  return igjen === 0 ? null : { nr: igjen + 1, av: antallSpillere };
}
