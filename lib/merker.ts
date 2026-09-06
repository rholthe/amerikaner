import type { SpillerStat } from "@/lib/stats";

export interface Merke {
  nøkkel: string;
  emoji: string;
  navn: string;
  /** Hva som skal til. Står også på merket man ikke har fått. */
  krav: string;
  oppnådd: boolean;
  /** Hvor langt man er kommet, når kravet er et tall. */
  framgang?: { nå: number; mål: number };
}

export interface MerkeGrunnlag {
  stat: SpillerStat;
  kvelder: number;
  kveldsseire: number;
  /** Lengste rekke med kvelder på rad der man vant minst én runde. */
  seiersrekke: number;
}

function merke(
  nøkkel: string,
  emoji: string,
  navn: string,
  krav: string,
  nå: number,
  mål: number,
): Merke {
  return {
    nøkkel,
    emoji,
    navn,
    krav,
    oppnådd: nå >= mål,
    framgang: { nå: Math.min(nå, mål), mål },
  };
}

/**
 * Merker regnes ut fra rådata som alt annet – ingenting lagres, så et merke som
 * endrer krav gjelder med en gang, og en slettet giv tar merket med seg.
 *
 * Kravene er satt lavt nok til at de første kommer på plass etter en kveld
 * eller to. Et merke ingen kan få er ikke et merke, det er pynt.
 */
export function merkerFor(g: MerkeGrunnlag): Merke[] {
  const s = g.stat;

  return [
    merke("debut", "🎴", "Debutant", "Spill din første giv", s.giv, 1),
    merke("kveldsseier", "👑", "Kveldens konge", "Vinn en spillekveld", g.kveldsseire, 1),
    merke("runde", "🏅", "Rundevinner", "Vinn en runde til 52", s.runderVunnet, 1),
    merke("femrunder", "🏆", "Storspiller", "Vinn fem runder", s.runderVunnet, 5),
    merke(
      "amerikaner",
      "🇺🇸",
      "Amerikaneren",
      "Meld og klar en amerikaner",
      s.amerikanereKlart,
      1,
    ),
    merke("alene", "🐺", "Ulven", "Meld og klar tre giv uten makker", s.meldtAleneKlart, 3),
    merke(
      "dristig",
      "🎯",
      "Den dristige",
      "Meld 12 eller mer og klar den",
      s.høyesteKlarte,
      12,
    ),
    merke("bet", "💀", "Bomberen", "Gå bet fem ganger – noen må jo prøve", s.meldingerBet, 5),
    merke(
      "makker",
      "🤝",
      "Den etterspurte",
      "Bli ropt som makker ti ganger",
      s.makkerGanger,
      10,
    ),
    merke(
      "palass",
      "🧱",
      "Muren",
      "Ta 50 stikk i motspill",
      s.stikk,
      50,
    ),
    merke("tvungen", "⛓️", "Tvangstrøya", "Klar tre tvungne giv", s.tvungneKlart, 3),
    merke("trofast", "📅", "Trofast", "Møt opp på ti spillekvelder", g.kvelder, 10),
    merke("rekke", "🔥", "På rad", "Vinn en runde tre kvelder på rad", g.seiersrekke, 3),
  ];
}
