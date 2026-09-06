"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  beregnGiv,
  stikkForSpillerantall,
  tvungenMeldingFor,
  validerGiv,
  type GivUtkast,
} from "@/lib/scoring";
import { TRUMF_VALG, trumfFarge } from "@/lib/givTekst";
import type { GivBody } from "@/lib/givInput";
import type { GivDto } from "@/lib/typer";
import { spillerFarge, spillerTekstFarge } from "@/lib/palette";

interface Props {
  spillere: { id: number; name: string }[];
  alleIder: number[];
  startVerdi?: GivDto | null;
  /** Stillingen før denne given. Gir «etter given»-linja under skjemaet. */
  stillingFør?: Record<number, number>;
  mål?: number;
  /** Hvor langt bordet er kommet i en pågående tvungen runde, fra
   *  `tvungenStatus()`. Null når det ikke pågår en. */
  tvungenPågår?: { nr: number; av: number } | null;
  onLagre: (body: GivBody) => Promise<void>;
  onAvbryt?: () => void;
  /** Sant når skjemaet står i en modal som lukker seg selv etter lagring. */
  lukkEtterLagring?: boolean;
}

function Brikke({
  aktiv,
  farge,
  onClick,
  className = "",
  children,
}: {
  aktiv: boolean;
  farge?: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-aktiv={aktiv}
      onClick={onClick}
      className={`brikke ${className}`}
      style={aktiv ? { background: farge ?? "var(--gold)" } : undefined}
    >
      {children}
    </button>
  );
}

function Teller({
  verdi,
  sett,
  min = 0,
  maks = 20,
}: {
  verdi: number;
  sett: (n: number) => void;
  min?: number;
  maks?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => sett(Math.max(min, verdi - 1))}
        disabled={verdi <= min}
        className="w-11 h-11 rounded-xl bg-surface-2 border border-line grid place-items-center hover:border-line-sterk disabled:opacity-30"
        aria-label="Færre"
      >
        <Minus size={18} />
      </button>
      <span className="w-10 text-center text-xl font-semibold tabular-nums">{verdi}</span>
      <button
        type="button"
        onClick={() => sett(Math.min(maks, verdi + 1))}
        disabled={verdi >= maks}
        className="w-11 h-11 rounded-xl bg-surface-2 border border-line grid place-items-center hover:border-line-sterk disabled:opacity-30"
        aria-label="Flere"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function Felt({
  tittel,
  hjelp,
  children,
}: {
  tittel: string;
  hjelp?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="merkelapp">{tittel}</h3>
        {hjelp && <span className="text-xs text-muted tabular-nums">{hjelp}</span>}
      </div>
      {children}
    </div>
  );
}

export default function GivSkjema({
  spillere,
  alleIder,
  startVerdi,
  stillingFør,
  mål = 52,
  tvungenPågår = null,
  onLagre,
  onAvbryt,
  lukkEtterLagring = false,
}: Props) {
  // En påbegynt tvungen runde skal fortsette uten at noen må huske å trykke:
  // knappen står på til alle har hatt sin, og faller så tilbake til av.
  const [tvungen, setTvungen] = useState(
    startVerdi ? startVerdi.isForced : tvungenPågår !== null,
  );
  const [melderId, setMelderId] = useState<number | null>(startVerdi?.bidderId ?? null);
  const [makkerId, setMakkerId] = useState<number | null>(startVerdi?.partnerId ?? null);
  const [melding, setMelding] = useState<number | null>(
    startVerdi?.bid ?? (tvungenPågår ? tvungenMeldingFor(spillere.length) : null),
  );
  const [trumf, setTrumf] = useState<string | null>(startVerdi?.trump ?? null);
  const [amerikaner, setAmerikaner] = useState(startVerdi?.isAmerikaner ?? false);
  const [klarte, setKlarte] = useState(startVerdi?.madeIt !== false);
  const [sitterOver, setSitterOver] = useState<number[]>(() => {
    if (!startVerdi) return [];
    const med = new Set(startVerdi.scores.map((s) => s.playerId));
    return spillere.filter((s) => !med.has(s.id)).map((s) => s.id);
  });
  const [stikk, setStikk] = useState<Record<number, number>>(() => {
    const ut: Record<number, number> = {};
    for (const s of startVerdi?.scores ?? []) if (s.tricks != null) ut[s.playerId] = s.tricks;
    return ut;
  });
  const [overstyrt, setOverstyrt] = useState<Record<number, number> | null>(null);
  const [visPoengfelt, setVisPoengfelt] = useState(false);
  const [visFlere, setVisFlere] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const nullstillPoeng = () => setOverstyrt(null);

  const deltakere = useMemo(
    () => spillere.filter((s) => !sitterOver.includes(s.id)).map((s) => s.id),
    [spillere, sitterOver],
  );

  const trickCount = stikkForSpillerantall(deltakere.length);
  const maksMelding = trickCount ?? 13;

  const utkast: GivUtkast = useMemo(
    () => ({
      kind: "melding",
      bidderId: melderId,
      partnerId: makkerId,
      bid: amerikaner ? null : melding,
      isAmerikaner: amerikaner,
      isForced: tvungen,
      madeIt: klarte,
      stikk,
      deltakere,
    }),
    [melderId, makkerId, melding, amerikaner, tvungen, klarte, stikk, deltakere],
  );

  const beregnet = useMemo(() => beregnGiv(utkast), [utkast]);
  const advarsler = useMemo(
    () => validerGiv(utkast, { trickCount, deltakereIKveld: spillere.map((s) => s.id) }),
    [utkast, trickCount, spillere],
  );

  const poeng = useMemo(() => {
    const ut: Record<number, number> = {};
    for (const r of beregnet) ut[r.playerId] = overstyrt?.[r.playerId] ?? r.points;
    return ut;
  }, [beregnet, overstyrt]);

  const motspillere = deltakere.filter((id) => id !== melderId && id !== makkerId);
  const motstikk = motspillere.reduce((sum, id) => sum + (stikk[id] ?? 0), 0);
  const lagStikk = trickCount != null ? trickCount - motstikk : null;

  // Konsekvensen vises før den inntreffer: det er her en feil melding blir
  // oppdaget, og en giv som avslutter runden skal aldri kunne snike seg inn.
  const etter = useMemo(() => {
    if (!stillingFør) return null;
    const ut: { id: number; sum: number }[] = [];
    for (const s of spillere) {
      ut.push({ id: s.id, sum: (stillingFør[s.id] ?? 0) + (poeng[s.id] ?? 0) });
    }
    return ut.sort((a, b) => b.sum - a.sum);
  }, [stillingFør, poeng, spillere]);

  const iMålEtter = etter?.filter((e) => e.sum >= mål) ?? [];

  const navn = (id: number) => spillere.find((s) => s.id === id)?.name ?? "?";
  const klar = melderId !== null && (amerikaner || melding !== null);

  const fastMelding = tvungenMeldingFor(deltakere.length);
  // Teller bare på en ny giv: retter man en gammel tvungen giv, sier statusen
  // noe om slutten av runden, ikke om den given man står i.
  const tvungenTeller =
    tvungen && !startVerdi
      ? (tvungenPågår ?? { nr: 1, av: spillere.length })
      : null;

  function nullstill() {
    setMelderId(null);
    setMakkerId(null);
    setMelding(null);
    setTvungen(false);
    setAmerikaner(false);
    setKlarte(true);
    setTrumf(null);
    setStikk({});
    setOverstyrt(null);
    setVisPoengfelt(false);
  }

  async function lagre(kind: "melding" | "pass") {
    setJobber(true);
    setFeil(null);
    try {
      await onLagre({
        kind,
        bidderId: kind === "pass" ? null : melderId,
        partnerId: kind === "pass" ? null : makkerId,
        bid: kind === "pass" || amerikaner ? null : melding,
        trump: kind === "pass" ? null : trumf,
        isAmerikaner: kind === "pass" ? false : amerikaner,
        isForced: kind === "pass" ? false : tvungen,
        madeIt: klarte,
        trickCount,
        deltakere,
        stikk,
        poeng: kind === "pass" ? null : poeng,
      });
      if (!startVerdi && !lukkEtterLagring) nullstill();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Kunne ikke lagre");
    } finally {
      setJobber(false);
    }
  }

  return (
    <div className="space-y-6">
      <Felt tittel="Melder">
        <div className="flex flex-wrap gap-2">
          {spillere.map((s) => (
            <Brikke
              key={s.id}
              aktiv={melderId === s.id}
              farge={spillerFarge(s.id, alleIder)}
              onClick={() => {
                const ny = melderId === s.id ? null : s.id;
                setMelderId(ny);
                if (makkerId === s.id) setMakkerId(null);
                if (ny !== null && sitterOver.includes(s.id)) {
                  setSitterOver(sitterOver.filter((x) => x !== s.id));
                }
                nullstillPoeng();
              }}
            >
              {s.name}
            </Brikke>
          ))}
        </div>
      </Felt>

      {melderId !== null && (
        <>
          <Felt tittel="Makker">
            <div className="flex flex-wrap gap-2">
              <Brikke
                aktiv={makkerId === null}
                onClick={() => {
                  setMakkerId(null);
                  nullstillPoeng();
                }}
              >
                Alene
              </Brikke>
              {spillere
                .filter((s) => s.id !== melderId && deltakere.includes(s.id))
                .map((s) => (
                  <Brikke
                    key={s.id}
                    aktiv={makkerId === s.id}
                    farge={spillerFarge(s.id, alleIder)}
                    onClick={() => {
                      setMakkerId(makkerId === s.id ? null : s.id);
                      setAmerikaner(false);
                      nullstillPoeng();
                    }}
                  >
                    {s.name}
                  </Brikke>
                ))}
            </div>
          </Felt>

          <Felt
            tittel="Melding"
            hjelp={trickCount ? `${trickCount} stikk i given` : "ukjent antall stikk"}
          >
            {tvungenTeller && (
              <p className="mb-2.5 text-sm text-gold-2 bg-gold/10 border border-gold/30 rounded-xl px-3.5 py-2.5">
                Tvungen runde · giv {tvungenTeller.nr} av {tvungenTeller.av}
                {fastMelding !== null && <> · alle skal melde {fastMelding}</>}
              </p>
            )}

            {!amerikaner && (
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {Array.from({ length: maksMelding }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-aktiv={melding === n}
                    onClick={() => {
                      setMelding(melding === n ? null : n);
                      nullstillPoeng();
                    }}
                    className="brikke px-0 tabular-nums"
                    style={melding === n ? { background: "var(--gold)" } : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Brikke
                aktiv={amerikaner}
                onClick={() => {
                  const ny = !amerikaner;
                  setAmerikaner(ny);
                  if (ny) {
                    setMakkerId(null);
                    setMelding(null);
                    setTvungen(false);
                  }
                  nullstillPoeng();
                }}
              >
                Amerikaner · 52
              </Brikke>

              <Brikke
                aktiv={tvungen}
                onClick={() => {
                  const ny = !tvungen;
                  setTvungen(ny);
                  if (ny) {
                    setAmerikaner(false);
                    if (fastMelding !== null) setMelding(fastMelding);
                  }
                  nullstillPoeng();
                }}
              >
                Tvungen{fastMelding !== null && ` · ${fastMelding}`}
              </Brikke>

              <div className="flex gap-1.5 ml-auto">
                {TRUMF_VALG.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrumf(trumf === t ? null : t)}
                    className={`brikke px-3 text-lg ${
                      trumf === t ? "border-gold bg-gold/15" : ""
                    }`}
                    style={{
                      color:
                        trumfFarge(t) ?? (trumf === t ? "var(--gold)" : undefined),
                    }}
                    aria-label={`Trumf ${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </Felt>

          <Felt tittel="Resultat">
            <div className="grid grid-cols-2 gap-2">
              <Brikke
                aktiv={klarte}
                farge="var(--good)"
                className="min-h-14 text-base"
                onClick={() => {
                  setKlarte(true);
                  nullstillPoeng();
                }}
              >
                Klarte den
              </Brikke>
              <Brikke
                aktiv={!klarte}
                farge="var(--bad)"
                className="min-h-14 text-base"
                onClick={() => {
                  setKlarte(false);
                  nullstillPoeng();
                }}
              >
                Bet
              </Brikke>
            </div>
          </Felt>

          {motspillere.length > 0 && !(amerikaner && klarte) && (
            <Felt
              tittel="Stikk til motspillerne"
              hjelp={
                lagStikk != null
                  ? `laget tok ${lagStikk} av ${trickCount}`
                  : `${motstikk} stikk fordelt`
              }
            >
              <div className="space-y-2">
                {motspillere.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: spillerFarge(id, alleIder) }}
                      />
                      <span className="truncate">{navn(id)}</span>
                    </span>
                    <Teller
                      verdi={stikk[id] ?? 0}
                      sett={(n) => {
                        setStikk({ ...stikk, [id]: n });
                        nullstillPoeng();
                      }}
                      maks={trickCount ?? 13}
                    />
                  </div>
                ))}
              </div>
            </Felt>
          )}
        </>
      )}

      {/* Poeng er sannheten som lagres, så de vises alltid – men feltene for å
          overstyre dem ligger bak et trykk, fordi de sjelden trengs. */}
      {melderId !== null && (
        <div className="kort p-4">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="merkelapp">Poeng som lagres</h3>
            <button
              type="button"
              onClick={() => setVisPoengfelt(!visPoengfelt)}
              className="text-xs text-muted hover:text-ink flex items-center gap-1.5"
            >
              <SlidersHorizontal size={13} />
              {visPoengfelt ? "Skjul" : "Rett poeng"}
            </button>
          </div>

          {visPoengfelt ? (
            <div className="flex flex-wrap gap-3">
              {deltakere.map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <span
                    className="text-sm truncate max-w-24"
                    style={{ color: spillerTekstFarge(id, alleIder) }}
                  >
                    {navn(id)}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={poeng[id] ?? 0}
                    onChange={(e) => setOverstyrt({ ...poeng, [id]: Number(e.target.value) || 0 })}
                    className="w-20 bg-surface-2 border border-line rounded-lg px-2 py-2 text-right tabular-nums font-semibold outline-none focus:border-gold"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {deltakere.map((id) => (
                <span key={id} className="flex items-baseline gap-1.5">
                  <span className="text-sm" style={{ color: spillerTekstFarge(id, alleIder) }}>
                    {navn(id)}
                  </span>
                  <span
                    className={`font-bold tabular-nums text-lg ${
                      (poeng[id] ?? 0) < 0 ? "text-bad" : ""
                    }`}
                  >
                    {(poeng[id] ?? 0) > 0 ? "+" : ""}
                    {poeng[id] ?? 0}
                  </span>
                </span>
              ))}
            </div>
          )}

          {overstyrt && (
            <p className="mt-3 text-xs text-muted flex items-center gap-2">
              Poengene er overstyrt manuelt.
              <button
                type="button"
                onClick={nullstillPoeng}
                className="text-gold hover:underline flex items-center gap-1"
              >
                <RotateCcw size={11} /> regn ut på nytt
              </button>
            </p>
          )}
        </div>
      )}

      {/* Stillingen etter given. Uten denne oppdages en feilregistrert
          sluttgiv først når runden allerede er avsluttet på feil grunnlag. */}
      {etter && melderId !== null && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            iMålEtter.length > 0
              ? "border-gold/50 bg-gold/10"
              : "border-line bg-surface-2"
          }`}
        >
          <div className="merkelapp mb-2">Stillingen etter given</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {etter.map((e) => (
              <span key={e.id} className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-sm" style={{ color: spillerTekstFarge(e.id, alleIder) }}>
                  {navn(e.id)}
                </span>
                <span className={`font-semibold ${e.sum >= mål ? "text-gold-2" : ""}`}>
                  {e.sum}
                </span>
                {e.sum >= mål && <span className="text-gold">⚑</span>}
              </span>
            ))}
          </div>
          {iMålEtter.length > 0 && (
            <p className="mt-2 text-sm text-gold-2 font-medium">
              {iMålEtter.length > 1
                ? `${iMålEtter.map((e) => navn(e.id)).join(" og ")} passerer ${mål}.`
                : `${navn(iMålEtter[0].id)} passerer ${mål} – runden er i mål etter denne given.`}
            </p>
          )}
        </div>
      )}

      {advarsler.length > 0 && (
        <ul className="text-sm text-gold-2 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 space-y-1">
          {advarsler.map((a) => (
            <li key={a}>⚠ {a}</li>
          ))}
        </ul>
      )}

      {feil && (
        <p className="text-sm text-bad bg-bad/10 border border-bad/30 rounded-xl px-4 py-3">
          {feil}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => lagre("melding")}
          disabled={jobber || !klar}
          className="knapp-gull flex-1 min-w-40"
        >
          {jobber ? "Lagrer…" : startVerdi ? `Lagre endring i giv ${startVerdi.dealNo}` : "Lagre giv"}
        </button>

        {!startVerdi && (
          <button
            onClick={() => lagre("pass")}
            disabled={jobber}
            className="knapp-stille"
            title="Ingen meldte – stokk om"
          >
            Alle passet
          </button>
        )}

        {onAvbryt && (
          <button onClick={onAvbryt} className="knapp-stille border-transparent">
            Avbryt
          </button>
        )}
      </div>

      {/* Sjelden bruk, derfor sammenslått: hvem som sitter over denne given. */}
      {!startVerdi && spillere.length > 3 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setVisFlere(!visFlere)}
            className="text-xs text-muted hover:text-ink"
          >
            {visFlere ? "Skjul" : "Sitter noen over?"}
          </button>
          {visFlere && (
            <div className="mt-3 flex flex-wrap gap-2">
              {spillere.map((s) => (
                <Brikke
                  key={s.id}
                  aktiv={sitterOver.includes(s.id)}
                  farge="var(--ink-2)"
                  onClick={() => {
                    setSitterOver(
                      sitterOver.includes(s.id)
                        ? sitterOver.filter((x) => x !== s.id)
                        : [...sitterOver, s.id],
                    );
                    if (melderId === s.id) setMelderId(null);
                    if (makkerId === s.id) setMakkerId(null);
                    nullstillPoeng();
                  }}
                >
                  {s.name}
                </Brikke>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
