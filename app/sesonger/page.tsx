"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { api, hentJson } from "@/lib/api";
import { formatDato } from "@/lib/dates";
import type { SesongDto } from "@/lib/sesong";

/** «2026/2027» for en sesong som går over nyttår, ellers «2026». */
function forslagNavn(): string {
  const nå = new Date();
  const år = nå.getFullYear();
  return nå.getMonth() >= 7 ? `${år}/${år + 1}` : `${år - 1}/${år}`;
}

/** «YYYY-MM-DD» av lokal dato. toISOString() ville flyttet 1. august til
 *  31. juli for alle som sitter øst for Greenwich. */
function isoDag(år: number, måned: number, dag: number): string {
  return `${år}-${String(måned).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

export default function SesongerSide() {
  const { data, mutate, isLoading } = useSWR<SesongDto[]>("/api/sesonger", hentJson);
  const [navn, setNavn] = useState(forslagNavn);
  // Sesongen følger skoleåret: 1. august til 30. juni.
  const [start, setStart] = useState(() => isoDag(new Date().getFullYear(), 8, 1));
  const [slutt, setSlutt] = useState(() => isoDag(new Date().getFullYear() + 1, 6, 30));
  const [redigerer, setRedigerer] = useState<number | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const sesonger = data ?? [];

  async function utfør(fn: () => Promise<SesongDto[]>) {
    setFeil(null);
    try {
      await mutate(await fn(), { revalidate: false });
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }

  return (
    <main className="min-h-dvh p-5 sm:p-8 max-w-2xl mx-auto">
      <header className="flex items-center gap-3 mb-2">
        <Link href="/" className="text-ink-2 hover:text-ink" aria-label="Tilbake">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-2xl font-semibold">Sesonger</h1>
      </header>
      <p className="text-sm text-ink-2 mb-8">
        En sesong er et datointervall. Kveldene finner sesongen sin selv, ut fra
        datoen – både de som allerede er spilt og de som kommer.
      </p>

      <section className="kort p-5 mb-8">
        <h2 className="merkelapp mb-4">Ny sesong</h2>
        <div className="space-y-3">
          <input
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder="Navn, f.eks. 2026/2027"
            maxLength={40}
            className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 outline-none focus:border-gold"
          />
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="merkelapp block mb-1.5">Fra</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-xl px-3 py-3 outline-none focus:border-gold tabular-nums"
              />
            </label>
            <label className="flex-1">
              <span className="merkelapp block mb-1.5">Til</span>
              <input
                type="date"
                value={slutt}
                onChange={(e) => setSlutt(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-xl px-3 py-3 outline-none focus:border-gold tabular-nums"
              />
            </label>
          </div>
          <button
            onClick={() =>
              utfør(() =>
                api.post<SesongDto[]>("/api/sesonger", {
                  name: navn,
                  startDate: start,
                  endDate: slutt,
                  isActive: true,
                }),
              )
            }
            disabled={!navn.trim()}
            className="knapp-gull w-full"
          >
            Opprett og gjør til inneværende
          </button>
        </div>
      </section>

      {feil && (
        <p className="mb-5 text-sm text-bad bg-bad/10 border border-bad/30 rounded-xl px-4 py-3">
          {feil}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted">Henter…</p>
      ) : sesonger.length === 0 ? (
        <p className="text-ink-2">Ingen sesonger enda.</p>
      ) : (
        <ul className="space-y-2">
          {sesonger.map((s) => (
            <li key={s.id} className="kort p-4">
              {redigerer === s.id ? (
                <RedigerSesong
                  sesong={s}
                  onAvbryt={() => setRedigerer(null)}
                  onLagre={async (endring) => {
                    await utfør(() => api.patch<SesongDto[]>(`/api/sesonger/${s.id}`, endring));
                    setRedigerer(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/sesong/${s.id}`} className="font-semibold hover:text-gold">
                      {s.name}
                      {s.isActive && (
                        <span className="ml-2 text-xs font-medium text-gold">inneværende</span>
                      )}
                    </Link>
                    <p className="text-xs text-muted tabular-nums mt-0.5">
                      {formatDato(s.startDate)} – {formatDato(s.endDate)} · {s.kvelder}{" "}
                      {s.kvelder === 1 ? "kveld" : "kvelder"} · {s.runder}{" "}
                      {s.runder === 1 ? "runde" : "runder"}
                    </p>
                  </div>

                  {!s.isActive && (
                    <button
                      onClick={() =>
                        utfør(() =>
                          api.patch<SesongDto[]>(`/api/sesonger/${s.id}`, { isActive: true }),
                        )
                      }
                      title="Gjør til inneværende sesong"
                      className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-gold hover:bg-surface-2"
                    >
                      <Check size={17} />
                    </button>
                  )}
                  <button
                    onClick={() => setRedigerer(s.id)}
                    aria-label={`Rediger ${s.name}`}
                    className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface-2"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        !confirm(
                          `Slette sesongen ${s.name}? Kveldene blir stående – de mister bare sesongen sin.`,
                        )
                      )
                        return;
                      utfør(() => api.delete<SesongDto[]>(`/api/sesonger/${s.id}`));
                    }}
                    aria-label={`Slett ${s.name}`}
                    className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-bad hover:bg-surface-2"
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link
                    href={`/sesong/${s.id}`}
                    className="text-muted hover:text-ink"
                    aria-label={`Åpne ${s.name}`}
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function RedigerSesong({
  sesong,
  onLagre,
  onAvbryt,
}: {
  sesong: SesongDto;
  onLagre: (endring: { name: string; startDate: string; endDate: string }) => Promise<void>;
  onAvbryt: () => void;
}) {
  const [navn, setNavn] = useState(sesong.name);
  const [start, setStart] = useState(sesong.startDate.slice(0, 10));
  const [slutt, setSlutt] = useState(sesong.endDate.slice(0, 10));

  return (
    <div className="space-y-3">
      <input
        value={navn}
        onChange={(e) => setNavn(e.target.value)}
        maxLength={40}
        className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 outline-none focus:border-gold"
      />
      <div className="flex gap-3">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="flex-1 bg-surface-2 border border-line rounded-xl px-3 py-2.5 outline-none focus:border-gold tabular-nums"
        />
        <input
          type="date"
          value={slutt}
          onChange={(e) => setSlutt(e.target.value)}
          className="flex-1 bg-surface-2 border border-line rounded-xl px-3 py-2.5 outline-none focus:border-gold tabular-nums"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onLagre({ name: navn, startDate: start, endDate: slutt })}
          className="knapp-gull flex-1"
        >
          Lagre
        </button>
        <button onClick={onAvbryt} className="knapp-stille border-transparent">
          Avbryt
        </button>
      </div>
      <p className="text-xs text-muted">
        Endrer du datoene, flytter kveldene seg til riktig sesong med det samme.
      </p>
    </div>
  );
}
