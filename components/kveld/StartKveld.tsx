"use client";

import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Plus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { spillerFarge } from "@/lib/palette";
import { MAKS_SPILLERE, MIN_SPILLERE } from "@/lib/scoring";
import type { SpillerDto } from "@/lib/typer";

interface Props {
  spillere: SpillerDto[];
  onStart: (playerIds: number[], place: string) => Promise<unknown>;
}

export default function StartKveld({ spillere, onStart }: Props) {
  const { mutate } = useSWRConfig();
  const [valgt, setValgt] = useState<number[]>([]);
  const [sted, setSted] = useState("");
  const [nyttNavn, setNyttNavn] = useState("");
  const [visNy, setVisNy] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const aktive = spillere.filter((s) => s.isActive);
  const alleIder = spillere.map((s) => s.id);
  const nok = valgt.length >= MIN_SPILLERE && valgt.length <= MAKS_SPILLERE;

  async function leggTil() {
    const navn = nyttNavn.trim();
    if (!navn) return;
    setFeil(null);
    try {
      const ny = await api.post<SpillerDto>("/api/spillere", { name: navn });
      setNyttNavn("");
      setVisNy(false);
      await mutate("/api/kveld/aktiv");
      if (ny?.id) setValgt((v) => (v.includes(ny.id) ? v : [...v, ny.id]));
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Kunne ikke legge til spilleren");
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-semibold mb-1">Hvem spiller i kveld?</h2>
      <p className="text-ink-2 mb-6">
        Velg {MIN_SPILLERE}–{MAKS_SPILLERE} spillere. Rekkefølgen du velger dem i
        blir sitteplassene.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {aktive.map((s) => {
          const i = valgt.indexOf(s.id);
          const er = i >= 0;
          return (
            <button
              key={s.id}
              type="button"
              data-aktiv={er}
              onClick={() => setValgt(er ? valgt.filter((x) => x !== s.id) : [...valgt, s.id])}
              className="brikke min-h-14 text-lg"
              style={er ? { background: spillerFarge(s.id, alleIder) } : undefined}
            >
              {er && <span className="opacity-60 tabular-nums">{i + 1}</span>}
              {s.name}
            </button>
          );
        })}

        <button type="button" onClick={() => setVisNy(!visNy)} className="brikke min-h-14">
          <Plus size={17} /> Ny spiller
        </button>
      </div>

      {visNy && (
        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            value={nyttNavn}
            onChange={(e) => setNyttNavn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") leggTil();
            }}
            placeholder="Navn"
            maxLength={40}
            className="flex-1 bg-surface-2 border border-line rounded-xl px-4 py-3 outline-none focus:border-gold"
          />
          <button onClick={leggTil} className="knapp-gull">
            Legg til
          </button>
        </div>
      )}

      {aktive.length === 0 && (
        <p className="text-ink-2 mb-4 flex items-center gap-2">
          <Users size={16} /> Ingen aktive spillere enda – legg dem til over, eller
          under{" "}
          <Link href="/spillere" className="text-gold underline">
            Spillere
          </Link>
          .
        </p>
      )}

      <input
        value={sted}
        onChange={(e) => setSted(e.target.value)}
        placeholder="Sted (valgfritt)"
        className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 mb-4 outline-none focus:border-gold"
      />

      {feil && <p className="text-bad text-sm mb-4">{feil}</p>}

      <button
        onClick={async () => {
          setJobber(true);
          setFeil(null);
          try {
            await onStart(valgt, sted);
          } catch (e) {
            setFeil(e instanceof Error ? e.message : "Kunne ikke starte kvelden");
            setJobber(false);
          }
        }}
        disabled={!nok || jobber}
        className="knapp-gull w-full text-lg py-4"
      >
        {jobber ? "Starter…" : `Start kvelden${nok ? ` med ${valgt.length}` : ""}`}
      </button>
    </div>
  );
}
