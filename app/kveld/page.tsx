"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { Flag, Home, MoreHorizontal, Plus } from "lucide-react";
import { hentJson } from "@/lib/api";
import { formatDato } from "@/lib/dates";
import { kåringer, spillerStatistikk, type StatGiv } from "@/lib/stats";
import type { GivDto, StatistikkSvar } from "@/lib/typer";
import Modal from "@/components/Modal";
import { useWakeLock } from "@/components/useWakeLock";
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

/**
 * Storskjermen. Tavla og givene står alltid framme; registreringsskjemaet
 * ligger i en modal man åpner selv – og som James etter hvert åpner for deg.
 * Mobilvisningen på /registrer er den andre halvdelen av det samme.
 */
export default function StorskjermSide() {
  const k = useKveld();
  useWakeLock(Boolean(k.kveld));

  const [visGiv, setVisGiv] = useState(false);
  const [visMeny, setVisMeny] = useState(false);
  const [redigerer, setRedigerer] = useState<GivDto | null>(null);
  const [justerer, setJusterer] = useState<number | null>(null);
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

  const totalKåringer = useMemo(
    () => (totalt ? kåringer(totalt.stat) : []),
    [totalt],
  );

  // «n» åpner registreringen. Den som sitter med tastaturet slipper å sikte.
  useEffect(() => {
    const ned = (e: KeyboardEvent) => {
      const mål = e.target as HTMLElement | null;
      if (mål && /^(INPUT|TEXTAREA|SELECT)$/.test(mål.tagName)) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setRedigerer(null);
        setVisGiv(true);
      }
    };
    window.addEventListener("keydown", ned);
    return () => window.removeEventListener("keydown", ned);
  }, []);

  if (k.isLoading) {
    return <main className="min-h-dvh grid place-items-center text-5xl text-gold">♠</main>;
  }

  if (!kveld || !runde || !k.status) {
    return (
      <main className="min-h-dvh p-6 sm:p-10 flex flex-col">
        <header className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-ink-2 hover:text-ink" aria-label="Hjem">
            <Home size={20} />
          </Link>
          <span className="text-gold text-xl leading-none">♠</span>
          <h1 className="font-semibold tracking-tight">Amerikaner</h1>
        </header>
        <div className="flex-1 grid place-items-center">
          <StartKveld spillere={k.spillere} onStart={k.startKveld} />
        </div>
        {k.feil && <p className="text-bad text-sm text-center">{k.feil}</p>}
      </main>
    );
  }

  const status = k.status;

  const statSpillere =
    statVisning === "totalt" && totalt ? totalt.spillere : kveld.spillere;

  return (
    <main className="min-h-dvh flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
        <Link href="/" className="flex items-baseline gap-2.5 shrink-0" aria-label="Forsiden">
          <span className="text-gold text-2xl leading-none">♠</span>
          <span className="font-bold tracking-tight uppercase text-lg">Amerikaner</span>
        </Link>

        <span className="text-ink-2 text-sm sm:text-base">
          {formatDato(kveld.date)}
          {kveld.place && ` · ${kveld.place}`}
        </span>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <div className="text-right leading-tight">
            <div className="text-gold font-semibold text-lg sm:text-xl">
              Runde {runde.gameNo}
            </div>
            <div className="text-muted text-xs sm:text-sm tabular-nums">
              giv {runde.giv.length + 1}
            </div>
          </div>

          <button
            onClick={() => {
              setRedigerer(null);
              setVisGiv(true);
            }}
            className="knapp-gull flex items-center gap-2"
          >
            <Plus size={18} /> Registrer giv
          </button>

          <button
            onClick={() => setVisMeny(true)}
            aria-label="Meny"
            className="w-12 h-12 grid place-items-center rounded-xl border border-line text-ink-2 hover:text-ink hover:border-line-sterk"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {k.feil && (
        <p className="mb-5 text-sm text-bad bg-bad/10 border border-bad/30 rounded-xl px-4 py-3">
          {k.feil}
        </p>
      )}

      {/* Utsatt avslutning skal ikke bli borte – runden er fortsatt i mål. */}
      {k.iMål && !k.spørOmVinner && status.forslagVinnerId != null && (
        <button
          onClick={k.gjenåpneAvslutning}
          className="mb-5 w-full flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-left hover:bg-gold/15"
        >
          <Flag size={18} className="text-gold shrink-0" />
          <span className="text-sm sm:text-base">
            Runden er i mål – {k.navn(status.forslagVinnerId)} har{" "}
            {status.stilling[status.forslagVinnerId]} poeng.
            <span className="text-gold-2 font-medium"> Avslutt runden</span>
          </span>
        </button>
      )}

      <div className="flex-1 grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section>
          <Tavle
            spillere={kveld.spillere}
            stilling={status.stilling}
            mål={runde.targetScore}
            runderVunnet={k.runderVunnet}
            alleIder={k.alleIder}
            variant="stor"
            onJuster={setJusterer}
          />
          <p className="mt-4 text-xs text-muted">
            Trykk på et tall for å rette stillingen. Rettingen lagres som en egen
            justeringsgiv, så den står synlig i historikken.
          </p>
        </section>

        <section className="space-y-8 min-w-0">
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
              variant="stor"
              onRediger={(g) => {
                setRedigerer(g);
                setVisGiv(true);
              }}
              onSlett={async (g) => {
                if (!confirm(`Slette giv ${g.dealNo}?`)) return;
                await k.slettGiv(g);
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="merkelapp">Kåringer</h2>
              <div className="flex gap-1 text-xs">
                {(["kveld", "totalt"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setStatVisning(v)}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      statVisning === v
                        ? "border-gold/50 bg-gold/10 text-gold-2"
                        : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {v === "kveld" ? "I kveld" : "Gjennom tidene"}
                  </button>
                ))}
              </div>
            </div>

            <Statistikk
              kåringer={statVisning === "totalt" ? totalKåringer : kveldsKåringer}
              spillere={statSpillere}
              alleIder={k.alleIder}
              variant="stor"
              antall={6}
              tomTekst={
                statVisning === "totalt"
                  ? "Henter tallene…"
                  : "Kåringene kommer så snart det er registrert noen giv i kveld."
              }
            />
          </div>
        </section>
      </div>

      {visGiv && (
        <Modal
          tittel={redigerer ? `Rett giv ${redigerer.dealNo}` : `Ny giv i runde ${runde.gameNo}`}
          undertittel={
            redigerer
              ? "Poengene skrives om, og runden regnes ut på nytt."
              : `Giv ${runde.giv.length + 1} · ${kveld.spillere.length} spillere`
          }
          onLukk={() => {
            setVisGiv(false);
            setRedigerer(null);
          }}
        >
          <GivSkjema
            key={redigerer ? `rediger-${redigerer.id}` : `ny-${runde.id}-${runde.giv.length}`}
            spillere={kveld.spillere}
            alleIder={k.alleIder}
            startVerdi={redigerer}
            stillingFør={k.stillingUten(redigerer?.id ?? null)}
            mål={runde.targetScore}
            lukkEtterLagring
            onAvbryt={() => {
              setVisGiv(false);
              setRedigerer(null);
            }}
            onLagre={async (body) => {
              if (redigerer) await k.rettGiv(redigerer, body);
              else await k.lagreGiv(body);
              setVisGiv(false);
              setRedigerer(null);
            }}
          />
        </Modal>
      )}

      {k.spørOmVinner && status.forslagVinnerId != null && (
        <RundeFerdig
          spillere={kveld.spillere}
          alleIder={k.alleIder}
          stilling={status.stilling}
          forslagVinnerId={status.forslagVinnerId}
          uavgjort={status.uavgjort}
          rundeNr={runde.gameNo}
          mål={runde.targetScore}
          onBekreft={k.avsluttRunde}
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
          denne="storskjerm"
          onAvsluttKveld={k.avsluttKveld}
          onLukk={() => setVisMeny(false)}
        />
      )}
    </main>
  );
}
