"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { Flag, ListOrdered, MoreHorizontal, PlusCircle, ScrollText, Trophy } from "lucide-react";
import { hentJson } from "@/lib/api";
import { formatDato } from "@/lib/dates";
import { spillerFarge } from "@/lib/palette";
import { stillinger } from "@/lib/scoring";
import { kåringer, spillerStatistikk, type StatGiv } from "@/lib/stats";
import type { GivDto, StatistikkSvar } from "@/lib/typer";
import { useKveld } from "@/components/kveld/useKveld";
import Tavle from "@/components/kveld/Tavle";
import GivSkjema from "@/components/kveld/GivSkjema";
import GivListe from "@/components/kveld/GivListe";
import JusterModal from "@/components/kveld/JusterModal";
import RundeFerdig from "@/components/kveld/RundeFerdig";
import StartKveld from "@/components/kveld/StartKveld";
import Statistikk from "@/components/kveld/Statistikk";
import SlettRunde from "@/components/kveld/SlettRunde";
import KveldMeny from "@/components/kveld/KveldMeny";

type Fane = "giv" | "stilling" | "historikk" | "tall";

const FANER: { id: Fane; navn: string; Ikon: typeof PlusCircle }[] = [
  { id: "giv", navn: "Ny giv", Ikon: PlusCircle },
  { id: "stilling", navn: "Stilling", Ikon: ListOrdered },
  { id: "historikk", navn: "Giv", Ikon: ScrollText },
  { id: "tall", navn: "Tall", Ikon: Trophy },
];

/**
 * Mobilen ved bordet. Dette er hovedveien inn med data – storskjermen på
 * /kveld viser det samme, men registrerer bare når man ber om det.
 */
export default function RegistrerSide() {
  const k = useKveld();

  const [fane, setFane] = useState<Fane>("giv");
  const [redigerer, setRedigerer] = useState<GivDto | null>(null);
  const [justerer, setJusterer] = useState<number | null>(null);
  const [visMeny, setVisMeny] = useState(false);
  const [statVisning, setStatVisning] = useState<"kveld" | "totalt">("kveld");

  const { data: totalt } = useSWR<StatistikkSvar>(
    statVisning === "totalt" ? "/api/statistikk" : null,
    hentJson,
  );

  const kveld = k.kveld;
  const runde = k.runde;

  const kveldsKåringer = useMemo(() => {
    if (!kveld) return [];
    const giv: StatGiv[] = kveld.runder.flatMap((r) => r.giv);
    return kåringer(spillerStatistikk(giv, k.deltakere, k.runderVunnet).values());
  }, [kveld, k.deltakere, k.runderVunnet]);

  const totalKåringer = useMemo(() => (totalt ? kåringer(totalt.stat) : []), [totalt]);

  if (k.isLoading) {
    return <main className="min-h-dvh grid place-items-center text-5xl text-gold">♠</main>;
  }

  if (!kveld || !runde || !k.status) {
    return (
      <main className="min-h-dvh p-5 flex flex-col">
        <header className="flex items-center gap-2 mb-8">
          <Link href="/" className="text-gold text-xl leading-none" aria-label="Forsiden">
            ♠
          </Link>
          <h1 className="font-semibold tracking-tight">Amerikaner</h1>
        </header>
        <div className="flex-1">
          <StartKveld spillere={k.spillere} onStart={k.startKveld} />
        </div>
        {k.feil && <p className="text-bad text-sm text-center mt-4">{k.feil}</p>}
      </main>
    );
  }

  const status = k.status;

  const statSpillere =
    statVisning === "totalt" && totalt ? totalt.spillere : kveld.spillere;

  const rangert = [...kveld.spillere].sort(
    (a, b) => (status.stilling[b.id] ?? 0) - (status.stilling[a.id] ?? 0),
  );

  return (
    <main className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="text-gold text-xl leading-none" aria-label="Forsiden">
            ♠
          </Link>
          <div className="min-w-0 leading-tight">
            <div className="font-semibold">
              Runde {runde.gameNo}
              <span className="text-muted font-normal"> · giv {runde.giv.length + 1}</span>
            </div>
            <div className="text-xs text-muted truncate">
              {formatDato(kveld.date)}
              {kveld.place && ` · ${kveld.place}`}
            </div>
          </div>
          <button
            onClick={() => setVisMeny(true)}
            aria-label="Meny"
            className="ml-auto w-11 h-11 grid place-items-center rounded-xl border border-line text-ink-2"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Stillingen skal være synlig uansett hvilken fane man står i. */}
        <div className="flex gap-3.5 px-4 pb-2.5 overflow-x-auto text-xs">
          {rangert.map((s) => (
            <span key={s.id} className="flex items-baseline gap-1.5 shrink-0">
              <span
                className="w-2 h-2 rounded-full self-center"
                style={{ background: spillerFarge(s.id, k.alleIder) }}
              />
              <span className="text-ink-2">{s.name}</span>
              <span className="font-semibold tabular-nums">
                {status.stilling[s.id] ?? 0}
              </span>
            </span>
          ))}
        </div>
      </header>

      {k.feil && (
        <p className="m-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded-xl px-4 py-3">
          {k.feil}
        </p>
      )}

      {k.iMål && !k.spørOmVinner && status.forslagVinnerId != null && (
        <button
          onClick={k.gjenåpneAvslutning}
          className="mx-4 mt-4 w-[calc(100%-2rem)] flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-left"
        >
          <Flag size={17} className="text-gold shrink-0" />
          <span className="text-sm">
            Runden er i mål – {k.navn(status.forslagVinnerId)} har{" "}
            {status.stilling[status.forslagVinnerId]} poeng.
            <span className="text-gold-2 font-medium"> Avslutt runden</span>
          </span>
        </button>
      )}

      <div className="px-4 py-5">
        {fane === "giv" && (
          <>
            {redigerer && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
                <span className="text-sm text-gold-2">Retter giv {redigerer.dealNo}</span>
                <button
                  onClick={() => setRedigerer(null)}
                  className="text-sm text-ink-2 underline"
                >
                  Avbryt
                </button>
              </div>
            )}
            <GivSkjema
              key={redigerer ? `rediger-${redigerer.id}` : `ny-${runde.id}-${runde.giv.length}`}
              spillere={kveld.spillere}
              alleIder={k.alleIder}
              startVerdi={redigerer}
              stillingFør={k.stillingUten(redigerer?.id ?? null)}
              mål={runde.targetScore}
              tvungenPågår={k.tvungenPågår}
              onAvbryt={redigerer ? () => setRedigerer(null) : undefined}
              onLagre={async (body) => {
                if (redigerer) {
                  await k.rettGiv(redigerer, body);
                  setRedigerer(null);
                } else {
                  await k.lagreGiv(body);
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}

        {fane === "stilling" && (
          <>
            <Tavle
              spillere={kveld.spillere}
              stilling={status.stilling}
              mål={runde.targetScore}
              runderVunnet={k.runderVunnet}
              alleIder={k.alleIder}
              onJuster={setJusterer}
            />
            <p className="mt-4 text-xs text-muted">
              Trykk på et tall for å rette stillingen. Rettingen lagres som en egen
              justeringsgiv, så den står synlig i historikken.
            </p>
          </>
        )}

        {fane === "historikk" && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="merkelapp">Giv i runde {runde.gameNo}</h2>
                <SlettRunde
                  rundeId={runde.id}
                  rundeNr={runde.gameNo}
                  antallGiv={runde.giv.length}
                  sisteRunde={kveld.runder.length === 1}
                  onSlettet={() => k.oppdater()}
                />
              </div>
              <GivListe
                giv={runde.giv}
                spillere={kveld.spillere}
                alleIder={k.alleIder}
                onRediger={(g) => {
                  setRedigerer(g);
                  setFane("giv");
                  window.scrollTo({ top: 0 });
                }}
                onSlett={async (g) => {
                  if (!confirm(`Slette giv ${g.dealNo}?`)) return;
                  await k.slettGiv(g);
                }}
              />
            </div>

            {[...kveld.runder]
              .filter((r) => r.id !== runde.id && r.giv.length > 0)
              .reverse()
              .map((r) => {
                const stilling = stillinger(
                  r.giv.map((g) => ({ scores: g.scores })),
                  k.deltakere,
                );
                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h2 className="merkelapp">
                        Runde {r.gameNo}
                        {r.winnerId ? ` · ${k.navn(r.winnerId)} vant` : " · ikke avgjort"}
                      </h2>
                      <SlettRunde
                        rundeId={r.id}
                        rundeNr={r.gameNo}
                        antallGiv={r.giv.length}
                        sisteRunde={kveld.runder.length === 1}
                        onSlettet={() => k.oppdater()}
                      />
                    </div>
                    <p className="text-xs text-muted mb-3 tabular-nums">
                      {[...k.deltakere]
                        .sort((a, b) => (stilling[b] ?? 0) - (stilling[a] ?? 0))
                        .map((id) => `${k.navn(id)} ${stilling[id] ?? 0}`)
                        .join(" · ")}
                    </p>
                    <GivListe
                      giv={r.giv}
                      spillere={kveld.spillere}
                      alleIder={k.alleIder}
                      nyesteFørst={false}
                    />
                  </div>
                );
              })}
          </div>
        )}

        {fane === "tall" && (
          <>
            <div className="flex gap-1 text-xs mb-4">
              {(["kveld", "totalt"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setStatVisning(v)}
                  className={`px-3 py-2 rounded-lg border transition ${
                    statVisning === v
                      ? "border-gold/50 bg-gold/10 text-gold-2"
                      : "border-line text-muted"
                  }`}
                >
                  {v === "kveld" ? "I kveld" : "Gjennom tidene"}
                </button>
              ))}
            </div>
            <Statistikk
              kåringer={statVisning === "totalt" ? totalKåringer : kveldsKåringer}
              spillere={statSpillere}
              alleIder={k.alleIder}
              tomTekst={
                statVisning === "totalt"
                  ? "Henter tallene…"
                  : "Kåringene kommer så snart det er registrert noen giv i kveld."
              }
            />
          </>
        )}
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line trygg-bunn">
        <div className="flex">
          {FANER.map(({ id, navn, Ikon }) => (
            <button
              key={id}
              onClick={() => setFane(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition ${
                fane === id ? "text-gold" : "text-muted"
              }`}
            >
              <Ikon size={21} />
              <span className="text-[11px] font-medium">{navn}</span>
            </button>
          ))}
        </div>
      </nav>

      {k.spørOmVinner && status.forslagVinnerId != null && (
        <RundeFerdig
          spillere={kveld.spillere}
          alleIder={k.alleIder}
          stilling={status.stilling}
          forslagVinnerId={status.forslagVinnerId}
          uavgjort={status.uavgjort}
          rundeNr={runde.gameNo}
          mål={runde.targetScore}
          onBekreft={async (id) => {
            await k.avsluttRunde(id);
            setFane("giv");
          }}
          onUtsett={k.utsettAvslutning}
        />
      )}

      {justerer !== null && (
        <JusterModal
          navn={k.navn(justerer)}
          nåværende={status.stilling[justerer] ?? 0}
          onLukk={() => setJusterer(null)}
          onLagre={async (nySum, note) => {
            await k.juster(justerer, nySum, note);
            setJusterer(null);
          }}
        />
      )}

      {visMeny && (
        <KveldMeny
          kveld={kveld}
          denne="mobil"
          onAvsluttKveld={k.avsluttKveld}
          onLukk={() => setVisMeny(false)}
        />
      )}
    </main>
  );
}
