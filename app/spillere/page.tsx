"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { api, hentJson } from "@/lib/api";
import { spillerFarge } from "@/lib/palette";
import type { SpillerDto } from "@/lib/typer";

export default function SpillereSide() {
  const { data, mutate, isLoading } = useSWR<SpillerDto[]>("/api/spillere", hentJson);
  const [nyttNavn, setNyttNavn] = useState("");
  const [redigerer, setRedigerer] = useState<number | null>(null);
  const [utkast, setUtkast] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const spillere = data ?? [];
  const alleIder = spillere.map((s) => s.id);

  async function utfør(fn: () => Promise<unknown>) {
    setFeil(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }

  return (
    <main className="min-h-dvh p-6 sm:p-10 max-w-2xl mx-auto">
      <header className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-ink-2 hover:text-ink" aria-label="Tilbake">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-2xl font-semibold">Spillere</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const navn = nyttNavn.trim();
          if (!navn) return;
          utfør(async () => {
            await api.post("/api/spillere", { name: navn });
            setNyttNavn("");
          });
        }}
        className="flex gap-2 mb-6"
      >
        <input
          value={nyttNavn}
          onChange={(e) => setNyttNavn(e.target.value)}
          placeholder="Nytt spillernavn"
          maxLength={40}
          className="flex-1 bg-surface-2 border border-line rounded-xl px-4 py-3 outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={nyttNavn.trim() === ""}
          className="bg-gold text-black font-semibold rounded-xl px-5 disabled:opacity-40 flex items-center gap-2"
        >
          <Plus size={18} /> Legg til
        </button>
      </form>

      {feil && (
        <p className="mb-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">
          {feil}
        </p>
      )}

      {isLoading ? (
        <p className="text-ink-2">Laster…</p>
      ) : (
        <ul className="space-y-2">
          {spillere.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: spillerFarge(s.id, alleIder) }}
              />

              {redigerer === s.id ? (
                <>
                  <input
                    autoFocus
                    value={utkast}
                    onChange={(e) => setUtkast(e.target.value)}
                    maxLength={40}
                    className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-1.5 outline-none focus:border-gold"
                  />
                  <button
                    onClick={() =>
                      utfør(async () => {
                        await api.patch(`/api/spillere/${s.id}`, { name: utkast });
                        setRedigerer(null);
                      })
                    }
                    className="text-good"
                    aria-label="Lagre"
                  >
                    <Check size={20} />
                  </button>
                  <button
                    onClick={() => setRedigerer(null)}
                    className="text-ink-2"
                    aria-label="Avbryt"
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRedigerer(s.id);
                      setUtkast(s.name);
                    }}
                    className={`flex-1 text-left font-medium ${s.isActive ? "" : "text-muted line-through"}`}
                  >
                    {s.name}
                  </button>

                  <Link
                    href={`/spillere/${s.id}`}
                    className="text-xs text-muted hover:text-gold tabular-nums flex items-center gap-1"
                    title={`Profilen til ${s.name}`}
                  >
                    {s.givCount} giv <ChevronRight size={13} />
                  </Link>

                  <button
                    onClick={() =>
                      utfør(() =>
                        api.patch(`/api/spillere/${s.id}`, { isActive: !s.isActive }),
                      )
                    }
                    className={`text-xs rounded-full px-3 py-1 border ${
                      s.isActive
                        ? "border-good/40 text-good"
                        : "border-line text-muted"
                    }`}
                  >
                    {s.isActive ? "Aktiv" : "Inaktiv"}
                  </button>

                  {/* Spillere som har spilt kan ikke slettes – APIet svarer 409.
                      Knappen skjules når den likevel ikke ville virket. */}
                  {s.givCount === 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Slette ${s.name}?`)) {
                          utfør(() => api.delete(`/api/spillere/${s.id}`));
                        }
                      }}
                      className="text-muted hover:text-bad"
                      aria-label={`Slett ${s.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted">
        Spillere som har spilt giv kan ikke slettes – da forsvant historikken
        deres. Sett dem inaktive i stedet, så blir de borte fra listene når en ny
        kveld starter.
      </p>
    </main>
  );
}
