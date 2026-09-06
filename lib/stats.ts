// Statistikk regnes alltid ut fra rådata – ingenting av dette lagres, og
// ingenting av det regnes ut i en API-rute. Funksjonene tar en liste giv og
// bryr seg ikke om den kommer fra én kveld, én sesong eller hele historikken;
// det er hele poenget med å ha dem her.

/** «1 melding», «3 meldinger» – flertall gjør kåringene lesbare. */
function antall(n: number, entall: string, flertall: string): string {
  return `${n} ${n === 1 ? entall : flertall}`;
}

/** Norsk desimaltegn. Snittmeldingen står midt i en norsk setning. */
function komma(n: number, desimaler = 1): string {
  return n.toFixed(desimaler).replace(".", ",");
}

export interface StatGiv {
  kind: string;
  bidderId: number | null;
  partnerId: number | null;
  bid: number | null;
  isAmerikaner: boolean;
  isForced: boolean;
  madeIt: boolean | null;
  scores: { playerId: number; points: number; tricks: number | null }[];
}

export interface SpillerStat {
  playerId: number;
  /** Antall giv spilleren var med på (justeringer teller ikke). */
  giv: number;
  /** Alle poeng, justeringer inkludert – dette er stillingens sannhet. */
  poeng: number;

  meldinger: number;
  meldingerKlart: number;
  meldingerBet: number;
  /** Tvungne giv man selv måtte melde. Egen kolonne fordi de ikke er valgt. */
  tvungne: number;
  tvungneKlart: number;
  /** Sum av tallmeldinger, for snittet. Amerikaner har ingen stikktall. */
  meldingSum: number;
  meldingerMedTall: number;
  meldtAlene: number;
  poengSomMelder: number;

  /** Ganger spilleren ble ropt som makker. */
  makkerGanger: number;
  makkerKlart: number;
  makkerBet: number;
  /** Poeng tjent på å bli ropt (bare de positive givene). */
  makkerTjent: number;
  /** Poeng tapt på å bli ropt, som positivt tall. */
  makkerTapt: number;

  stikk: number;
  poengSomMotspiller: number;

  amerikanereMeldt: number;
  amerikanereKlart: number;

  besteGiv: number;
  versteGiv: number;

  runderVunnet: number;
}

export function tomStat(playerId: number): SpillerStat {
  return {
    playerId,
    giv: 0,
    poeng: 0,
    meldinger: 0,
    meldingerKlart: 0,
    meldingerBet: 0,
    tvungne: 0,
    tvungneKlart: 0,
    meldingSum: 0,
    meldingerMedTall: 0,
    meldtAlene: 0,
    poengSomMelder: 0,
    makkerGanger: 0,
    makkerKlart: 0,
    makkerBet: 0,
    makkerTjent: 0,
    makkerTapt: 0,
    stikk: 0,
    poengSomMotspiller: 0,
    amerikanereMeldt: 0,
    amerikanereKlart: 0,
    besteGiv: 0,
    versteGiv: 0,
    runderVunnet: 0,
  };
}

/**
 * Statistikk per spiller. `deltakere` sikrer at også de som ikke har rukket å
 * få et poeng ennå får en rad – ellers ville tabellen skifte lengde underveis
 * i kvelden.
 */
export function spillerStatistikk(
  giv: StatGiv[],
  deltakere: number[] = [],
  runderVunnet: Record<number, number> = {},
): Map<number, SpillerStat> {
  const ut = new Map<number, SpillerStat>();
  const hent = (id: number) => {
    let s = ut.get(id);
    if (!s) {
      s = tomStat(id);
      ut.set(id, s);
    }
    return s;
  };

  for (const id of deltakere) hent(id);

  for (const g of giv) {
    if (g.kind === "pass") continue;

    if (g.kind === "justering") {
      for (const sc of g.scores) hent(sc.playerId).poeng += sc.points;
      continue;
    }

    const klart = g.madeIt !== false;

    for (const sc of g.scores) {
      const s = hent(sc.playerId);
      s.giv += 1;
      s.poeng += sc.points;
      s.besteGiv = Math.max(s.besteGiv, sc.points);
      s.versteGiv = Math.min(s.versteGiv, sc.points);

      if (sc.playerId === g.bidderId) {
        s.meldinger += 1;
        s.poengSomMelder += sc.points;
        if (klart) s.meldingerKlart += 1;
        else s.meldingerBet += 1;
        if (g.partnerId == null) s.meldtAlene += 1;
        if (g.isForced) {
          s.tvungne += 1;
          if (klart) s.tvungneKlart += 1;
        }
        if (g.isAmerikaner) {
          s.amerikanereMeldt += 1;
          if (klart) s.amerikanereKlart += 1;
        } else if (g.bid != null && !g.isForced) {
          // Tvungne meldinger holdes utenfor snittet: snittmeldingen skal si
          // hvor høyt man tør å melde, ikke hva husreglene tvang en til.
          s.meldingSum += g.bid;
          s.meldingerMedTall += 1;
        }
      } else if (sc.playerId === g.partnerId) {
        s.makkerGanger += 1;
        if (klart) s.makkerKlart += 1;
        else s.makkerBet += 1;
        if (sc.points > 0) s.makkerTjent += sc.points;
        else s.makkerTapt += -sc.points;
      } else {
        s.stikk += sc.tricks ?? 0;
        s.poengSomMotspiller += sc.points;
      }
    }
  }

  for (const [id, n] of Object.entries(runderVunnet)) {
    hent(Number(id)).runderVunnet = n;
  }

  return ut;
}

/** Hvem roper hvem. Nøkkel: `${melderId}:${makkerId}`. Grunnlaget for matrisen. */
export function makkerPar(giv: StatGiv[]): Map<string, { ganger: number; klart: number }> {
  const ut = new Map<string, { ganger: number; klart: number }>();
  for (const g of giv) {
    if (g.kind !== "melding" || g.bidderId == null || g.partnerId == null) continue;
    const nøkkel = `${g.bidderId}:${g.partnerId}`;
    const rad = ut.get(nøkkel) ?? { ganger: 0, klart: 0 };
    rad.ganger += 1;
    if (g.madeIt !== false) rad.klart += 1;
    ut.set(nøkkel, rad);
  }
  return ut;
}

// ── Kåringer ──────────────────────────────────────────────────────────────

export interface KåringRad {
  playerId: number;
  /** Tallet det rangeres på. Alltid slik at høyest er «mest». */
  verdi: number;
  visning: string;
  hint?: string;
}

export interface Kåring {
  nøkkel: string;
  tittel: string;
  /** Én linje som forklarer hva tallet er, til den som ikke har sett det før. */
  forklaring: string;
  rader: KåringRad[];
}

function lag(
  nøkkel: string,
  tittel: string,
  forklaring: string,
  stat: SpillerStat[],
  velg: (s: SpillerStat) => KåringRad | null,
): Kåring | null {
  const rader = stat
    .map(velg)
    .filter((r): r is KåringRad => r !== null)
    .sort((a, b) => b.verdi - a.verdi);
  return rader.length === 0 ? null : { nøkkel, tittel, forklaring, rader };
}

/**
 * Alle kåringene vi kan regne ut, i den rekkefølgen de er verdt å vise.
 * Kåringer uten data faller bort av seg selv, så en kveld med tre giv viser
 * tre kort og ikke tolv tomme.
 */
export function kåringer(stat: Iterable<SpillerStat>): Kåring[] {
  const alle = [...stat];

  return [
    lag("klart", "Klarte meldingen", "Ganger man selv meldte og laget kom i mål.", alle, (s) =>
      s.meldingerKlart === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.meldingerKlart,
            visning: `${s.meldingerKlart}`,
            hint: `av ${antall(s.meldinger, "melding", "meldinger")}`,
          },
    ),

    lag("bet", "Gikk bet", "Ganger man meldte og laget ikke nådde meldingen.", alle, (s) =>
      s.meldingerBet === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.meldingerBet,
            visning: `${s.meldingerBet}`,
            hint: `av ${antall(s.meldinger, "melding", "meldinger")}`,
          },
    ),

    lag(
      "treffprosent",
      "Meldingsprosent",
      "Hvor ofte meldingen holder. Fra tre meldinger og opp.",
      alle,
      (s) =>
        s.meldinger < 3
          ? null
          : {
              playerId: s.playerId,
              verdi: Math.round((s.meldingerKlart / s.meldinger) * 100),
              visning: `${Math.round((s.meldingerKlart / s.meldinger) * 100)} %`,
              hint: `${s.meldingerKlart} av ${s.meldinger}`,
            },
    ),

    lag("snittmelding", "Snittmelding", "Hvor høyt man pleier å melde – de dristige mot de forsiktige.", alle, (s) =>
      s.meldingerMedTall < 2
        ? null
        : {
            playerId: s.playerId,
            verdi: s.meldingSum / s.meldingerMedTall,
            visning: komma(s.meldingSum / s.meldingerMedTall),
            hint: antall(s.meldingerMedTall, "melding", "meldinger"),
          },
    ),

    lag("makkerTjent", "Tjent på å bli ropt", "Poeng hentet inn i givene man ble ropt som makker.", alle, (s) =>
      s.makkerTjent === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.makkerTjent,
            visning: `+${s.makkerTjent}`,
            hint: `${s.makkerKlart} klart av ${s.makkerGanger}`,
          },
    ),

    lag("makkerTapt", "Tapt på å bli ropt", "Poeng man har mistet på å bli tatt med på et lag som gikk bet.", alle, (s) =>
      s.makkerTapt === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.makkerTapt,
            visning: `−${s.makkerTapt}`,
            hint: `${s.makkerBet} bet av ${s.makkerGanger}`,
          },
    ),

    lag("tvungne", "Tvungne giv klart", "Ganger man kom i mål med en melding man ikke valgte selv.", alle, (s) =>
      s.tvungne === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.tvungneKlart,
            visning: `${s.tvungneKlart}`,
            hint: `av ${antall(s.tvungne, "tvungen giv", "tvungne giv")}`,
          },
    ),

    lag("ropt", "Mest ettertraktet", "Ganger man ble ropt som makker.", alle, (s) =>
      s.makkerGanger === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.makkerGanger,
            visning: `${s.makkerGanger}`,
            hint: `${s.makkerKlart} av dem klart`,
          },
    ),

    lag("stikk", "Stikk i motspill", "Stikk tatt når man ikke var med på laget.", alle, (s) =>
      s.stikk === 0
        ? null
        : { playerId: s.playerId, verdi: s.stikk, visning: `${s.stikk}` },
    ),

    lag("besteGiv", "Største giv", "Flest poeng i én enkelt giv.", alle, (s) =>
      s.besteGiv <= 0
        ? null
        : { playerId: s.playerId, verdi: s.besteGiv, visning: `+${s.besteGiv}` },
    ),

    lag("versteGiv", "Verste smell", "Flest poeng tapt i én enkelt giv.", alle, (s) =>
      s.versteGiv >= 0
        ? null
        : { playerId: s.playerId, verdi: -s.versteGiv, visning: `−${-s.versteGiv}` },
    ),

    lag("amerikaner", "Amerikanere", "Ganger man meldte alle stikk alene.", alle, (s) =>
      s.amerikanereMeldt === 0
        ? null
        : {
            playerId: s.playerId,
            verdi: s.amerikanereMeldt,
            visning: `${s.amerikanereMeldt}`,
            hint: `${s.amerikanereKlart} klart`,
          },
    ),

    lag("alene", "Meldte alene", "Ganger man tok meldingen uten å rope makker.", alle, (s) =>
      s.meldtAlene === 0
        ? null
        : { playerId: s.playerId, verdi: s.meldtAlene, visning: `${s.meldtAlene}` },
    ),

    lag("runder", "Runder vunnet", "Runder til 52 man har tatt.", alle, (s) =>
      s.runderVunnet === 0
        ? null
        : { playerId: s.playerId, verdi: s.runderVunnet, visning: `${s.runderVunnet}` },
    ),
  ].filter((k): k is Kåring => k !== null);
}
