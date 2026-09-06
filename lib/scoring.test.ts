import { describe, expect, it } from "vitest";
import {
  AMERIKANER_POENG,
  avgjørRunde,
  beregnGiv,
  justeringsDiff,
  stikkForSpillerantall,
  stillinger,
  tvungenMeldingFor,
  tvungenStatus,
  validerGiv,
  type GivUtkast,
} from "./scoring";

const SONDRE = 1;
const MORTEN = 2;
const HAAKON = 3;
const RAGNAR = 4;
const BORDET = [SONDRE, MORTEN, HAAKON, RAGNAR];

function giv(over: Partial<GivUtkast> = {}): GivUtkast {
  return {
    kind: "melding",
    bidderId: SONDRE,
    partnerId: MORTEN,
    bid: 9,
    isAmerikaner: false,
    isForced: false,
    madeIt: true,
    stikk: {},
    deltakere: BORDET,
    ...over,
  };
}

function poeng(rader: ReturnType<typeof beregnGiv>): Record<number, number> {
  return Object.fromEntries(rader.map((r) => [r.playerId, r.points]));
}

describe("beregnGiv", () => {
  it("gir laget meldingen og motspillerne ett poeng per stikk", () => {
    // Eksempelet fra oppdraget: Sondre meldte 9, tok den med Morten,
    // Haakon fikk 3 stikk og Ragnar ingen.
    const rader = beregnGiv(giv({ stikk: { [HAAKON]: 3, [RAGNAR]: 0 } }));
    expect(poeng(rader)).toEqual({
      [SONDRE]: 9,
      [MORTEN]: 9,
      [HAAKON]: 3,
      [RAGNAR]: 0,
    });
  });

  it("gir laget minuspoeng ved bet, men motspillerne beholder stikkene sine", () => {
    const rader = beregnGiv(giv({ madeIt: false, stikk: { [HAAKON]: 3, [RAGNAR]: 2 } }));
    expect(poeng(rader)).toEqual({
      [SONDRE]: -9,
      [MORTEN]: -9,
      [HAAKON]: 3,
      [RAGNAR]: 2,
    });
  });

  it("gir 52 for klart amerikaner og null til motspillerne", () => {
    const rader = beregnGiv(
      giv({ isAmerikaner: true, partnerId: null, bid: null, stikk: {} }),
    );
    expect(poeng(rader)).toEqual({
      [SONDRE]: AMERIKANER_POENG,
      [MORTEN]: 0,
      [HAAKON]: 0,
      [RAGNAR]: 0,
    });
  });

  it("gir −52 for bet amerikaner, og motspillerne får stikkene sine", () => {
    const rader = beregnGiv(
      giv({
        isAmerikaner: true,
        partnerId: null,
        bid: null,
        madeIt: false,
        stikk: { [MORTEN]: 1, [HAAKON]: 2 },
      }),
    );
    expect(poeng(rader)).toEqual({
      [SONDRE]: -AMERIKANER_POENG,
      [MORTEN]: 1,
      [HAAKON]: 2,
      [RAGNAR]: 0,
    });
  });

  it("gir ingen rader når alle passet", () => {
    expect(beregnGiv(giv({ kind: "pass" }))).toEqual([]);
  });

  it("håndterer melder uten makker", () => {
    const rader = beregnGiv(giv({ partnerId: null, stikk: { [MORTEN]: 2, [HAAKON]: 1 } }));
    expect(poeng(rader)).toEqual({
      [SONDRE]: 9,
      [MORTEN]: 2,
      [HAAKON]: 1,
      [RAGNAR]: 0,
    });
  });

  it("takler tre og seks spillere uten å anta bordstørrelse", () => {
    const tre = beregnGiv(giv({ deltakere: [SONDRE, MORTEN, HAAKON], stikk: { [HAAKON]: 4 } }));
    expect(poeng(tre)).toEqual({ [SONDRE]: 9, [MORTEN]: 9, [HAAKON]: 4 });

    const seks = beregnGiv(
      giv({ deltakere: [1, 2, 3, 4, 5, 6], stikk: { 3: 1, 4: 1, 5: 0, 6: 2 } }),
    );
    expect(poeng(seks)).toEqual({ 1: 9, 2: 9, 3: 1, 4: 1, 5: 0, 6: 2 });
  });
});

describe("validerGiv", () => {
  const opts = { deltakereIKveld: BORDET, trickCount: 13 };

  it("er stille når alt stemmer", () => {
    expect(validerGiv(giv({ stikk: { [HAAKON]: 3 } }), opts)).toEqual([]);
  });

  it("advarer når laget ikke tok nok stikk til å ha klart meldingen", () => {
    const a = validerGiv(giv({ bid: 11, stikk: { [HAAKON]: 3, [RAGNAR]: 2 } }), opts);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("meldte 11");
  });

  it("advarer når motspillerne har flere stikk enn given har", () => {
    const a = validerGiv(giv({ stikk: { [HAAKON]: 9, [RAGNAR]: 9 } }), opts);
    expect(a.some((m) => m.includes("bare 13"))).toBe(true);
  });

  it("advarer når melder og makker er samme spiller", () => {
    const a = validerGiv(giv({ partnerId: SONDRE }), opts);
    expect(a.some((m) => m.includes("samme spiller"))).toBe(true);
  });

  it("advarer når en spiller ikke er med på kvelden", () => {
    const a = validerGiv(giv({ deltakere: [...BORDET, 99] }), opts);
    expect(a.some((m) => m.includes("ikke med på kvelden"))).toBe(true);
  });

  it("advarer på for få og for mange spillere", () => {
    expect(validerGiv(giv({ deltakere: [SONDRE, MORTEN] }), opts).length).toBeGreaterThan(0);
    expect(validerGiv(giv({ deltakere: [1, 2, 3, 4, 5, 6, 7] }), opts).length).toBeGreaterThan(0);
  });

  it("advarer når melder er valgt uten melding", () => {
    const a = validerGiv(giv({ bid: null }), opts);
    expect(a.some((m) => m.includes("melding mangler"))).toBe(true);
  });

  it("sier ingenting om en giv der alle passet", () => {
    expect(validerGiv(giv({ kind: "pass", bid: null }), opts)).toEqual([]);
  });
});

describe("stillinger og avgjørRunde", () => {
  const enGiv = (p: Record<number, number>) => ({
    scores: Object.entries(p).map(([id, points]) => ({ playerId: Number(id), points })),
  });

  it("summerer givene og nullstiller ingen", () => {
    const s = stillinger(
      [enGiv({ [SONDRE]: 9, [MORTEN]: 9, [HAAKON]: 3 }), enGiv({ [SONDRE]: -7, [HAAKON]: 4 })],
      BORDET,
    );
    expect(s).toEqual({ [SONDRE]: 2, [MORTEN]: 9, [HAAKON]: 7, [RAGNAR]: 0 });
  });

  it("holder runden åpen under 52", () => {
    const r = avgjørRunde([enGiv({ [SONDRE]: 43, [MORTEN]: 38 })], BORDET);
    expect(r.kanAvsluttes).toBe(false);
    expect(r.forslagVinnerId).toBeNull();
    expect(r.ledendeId).toBe(SONDRE);
  });

  it("foreslår vinner når noen passerer 52", () => {
    const r = avgjørRunde([enGiv({ [SONDRE]: 54, [MORTEN]: 38 })], BORDET);
    expect(r.kanAvsluttes).toBe(true);
    expect(r.forslagVinnerId).toBe(SONDRE);
    expect(r.uavgjort).toEqual([]);
  });

  it("lar den med flest poeng vinne når to passerer 52 samtidig", () => {
    const r = avgjørRunde([enGiv({ [SONDRE]: 53, [MORTEN]: 58 })], BORDET);
    expect(r.forslagVinnerId).toBe(MORTEN);
  });

  it("melder uavgjort når to står likt på topp over 52", () => {
    const r = avgjørRunde([enGiv({ [SONDRE]: 55, [MORTEN]: 55 })], BORDET);
    expect(r.kanAvsluttes).toBe(true);
    expect(r.uavgjort).toEqual([SONDRE, MORTEN]);
  });

  it("avslutter runden på et klart amerikaner alene", () => {
    const rader = beregnGiv(giv({ isAmerikaner: true, partnerId: null, bid: null }));
    const r = avgjørRunde([{ scores: rader }], BORDET);
    expect(r.kanAvsluttes).toBe(true);
    expect(r.forslagVinnerId).toBe(SONDRE);
  });
});

describe("justeringsDiff", () => {
  it("lagrer differansen, ikke den nye summen", () => {
    expect(justeringsDiff(19, 23)).toBe(4);
    expect(justeringsDiff(30, 23)).toBe(-7);
  });
});

describe("stikkForSpillerantall", () => {
  it("kjenner 4 og 5 spillere, og gjetter ikke på resten", () => {
    expect(stikkForSpillerantall(4)).toBe(13);
    expect(stikkForSpillerantall(5)).toBe(11);
    expect(stikkForSpillerantall(3)).toBeNull();
    expect(stikkForSpillerantall(6)).toBeNull();
  });
});

describe("tvungne giv", () => {
  const tvungen = (isForced: boolean) => ({ kind: "melding" as const, isForced });

  it("har en forhåndsbestemt melding for hvert lovlige spillerantall", () => {
    // 9 ved 4 spillere er husregelen; resten er skalert i samme forhold som
    // stikkene. Se kommentaren i scoring.ts.
    expect(tvungenMeldingFor(3)).toBe(12);
    expect(tvungenMeldingFor(4)).toBe(9);
    expect(tvungenMeldingFor(5)).toBe(8);
    expect(tvungenMeldingFor(6)).toBe(6);
    expect(tvungenMeldingFor(7)).toBeNull();
  });

  it("er ikke i gang når ingen tvungen giv er registrert", () => {
    expect(tvungenStatus([], 4)).toBeNull();
    expect(tvungenStatus([tvungen(false), tvungen(false)], 4)).toBeNull();
  });

  it("teller seg gjennom bordet og gir seg når alle har hatt sin", () => {
    expect(tvungenStatus([tvungen(true)], 4)).toEqual({ nr: 2, av: 4 });
    expect(tvungenStatus([tvungen(true), tvungen(true)], 4)).toEqual({ nr: 3, av: 4 });
    expect(tvungenStatus(Array(3).fill(tvungen(true)), 4)).toEqual({ nr: 4, av: 4 });
    // Fjerde tvungne giv fullfører runden – da skal knappen slå seg av.
    expect(tvungenStatus(Array(4).fill(tvungen(true)), 4)).toBeNull();
  });

  it("begynner på nytt når en ny tvungen runde følger rett etter", () => {
    expect(tvungenStatus(Array(5).fill(tvungen(true)), 4)).toEqual({ nr: 2, av: 4 });
    expect(tvungenStatus(Array(8).fill(tvungen(true)), 4)).toBeNull();
  });

  it("teller bare de tvungne givene på slutten av runden", () => {
    const giv = [tvungen(true), tvungen(true), tvungen(false), tvungen(true)];
    expect(tvungenStatus(giv, 4)).toEqual({ nr: 2, av: 4 });
  });
});
