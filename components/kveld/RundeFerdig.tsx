"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import Modal from "@/components/Modal";
import { spillerFarge } from "@/lib/palette";

interface Props {
  spillere: { id: number; name: string }[];
  alleIder: number[];
  stilling: Record<number, number>;
  forslagVinnerId: number;
  uavgjort: number[];
  rundeNr: number;
  mål: number;
  onBekreft: (winnerId: number) => Promise<void>;
  onUtsett: () => void;
}

/**
 * Runden avsluttes aldri av seg selv. Den siste given er den som oftest er
 * feilregistrert, og en runde som avslutter seg selv på feil grunnlag koster
 * mer å rydde opp i enn ett ekstra trykk koster å gjøre.
 *
 * Derfor er dette en modal og ikke et kort i en kolonne: forrige versjon lot
 * spørsmålet stå ved siden av skjemaet, og da var det ikke åpenbart at runden
 * måtte bekreftes for å bli lagret.
 */
export default function RundeFerdig({
  spillere,
  alleIder,
  stilling,
  forslagVinnerId,
  uavgjort,
  rundeNr,
  mål,
  onBekreft,
  onUtsett,
}: Props) {
  const [valgt, setValgt] = useState(forslagVinnerId);
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const navn = (id: number) => spillere.find((s) => s.id === id)?.name ?? "?";
  const kandidater = [...spillere].sort(
    (a, b) => (stilling[b.id] ?? 0) - (stilling[a.id] ?? 0),
  );

  return (
    <Modal
      tittel={`Runde ${rundeNr} er i mål`}
      undertittel={
        uavgjort.length > 1
          ? `${uavgjort.map(navn).join(" og ")} står likt på ${stilling[uavgjort[0]]} poeng.`
          : `${navn(forslagVinnerId)} passerte ${mål}.`
      }
      bredde="smal"
      onLukk={onUtsett}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="w-16 h-16 shrink-0 rounded-2xl grid place-items-center"
          style={{ background: spillerFarge(valgt, alleIder) }}
        >
          <Flag size={30} className="text-black" />
        </span>
        <div>
          <div className="text-4xl font-bold tabular-nums leading-none">
            {stilling[valgt] ?? 0}
          </div>
          <div className="text-ink-2 text-sm mt-1">poeng · {navn(valgt)}</div>
        </div>
      </div>

      <p className="merkelapp mb-2">Hvem vant runden?</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {kandidater.map((s) => (
          <button
            key={s.id}
            type="button"
            data-aktiv={valgt === s.id}
            onClick={() => setValgt(s.id)}
            className="brikke"
            style={valgt === s.id ? { background: spillerFarge(s.id, alleIder) } : undefined}
          >
            {s.name}
            <span className="tabular-nums opacity-70">{stilling[s.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {feil && <p className="text-sm text-bad mb-4">{feil}</p>}

      <button
        onClick={async () => {
          setJobber(true);
          setFeil(null);
          try {
            await onBekreft(valgt);
          } catch (e) {
            setFeil(e instanceof Error ? e.message : "Kunne ikke lagre runden");
            setJobber(false);
          }
        }}
        disabled={jobber}
        className="knapp-gull w-full text-base"
      >
        {jobber ? "Lagrer…" : `${navn(valgt)} vant · lagre og start runde ${rundeNr + 1}`}
      </button>

      <p className="text-xs text-muted mt-3 text-center">
        Runden lagres med vinneren, poengene nullstilles og en ny runde begynner.
      </p>

      <button onClick={onUtsett} className="knapp-stille w-full mt-4 border-transparent">
        Ikke ferdig – spill videre
      </button>
    </Modal>
  );
}
