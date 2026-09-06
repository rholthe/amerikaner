"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

interface Props {
  navn: string;
  nåværende: number;
  onLagre: (nySum: number, note: string) => Promise<void>;
  onLukk: () => void;
}

/**
 * Retting av stillingen. Differansen lagres som en egen justeringsgiv, ikke som
 * en overskriving – slik forblir summeringen eneste sannhet, og korrigeringen
 * står synlig i rundehistorikken og kan angres.
 */
export default function JusterModal({ navn, nåværende, onLagre, onLukk }: Props) {
  const [sum, setSum] = useState(String(nåværende));
  const [note, setNote] = useState("");
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const ny = Number(sum);
  const gyldig = Number.isFinite(ny) && sum.trim() !== "";
  const diff = gyldig ? ny - nåværende : 0;

  return (
    <Modal
      tittel="Rett stillingen"
      undertittel={`${navn} står på ${nåværende} poeng i denne runden.`}
      bredde="smal"
      onLukk={onLukk}
    >
      <label className="merkelapp block mb-2">Riktig sum</label>
      <input
        type="number"
        inputMode="numeric"
        autoFocus
        value={sum}
        onChange={(e) => setSum(e.target.value)}
        className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-3xl font-bold tabular-nums text-right outline-none focus:border-gold"
      />

      <p className="mt-3 text-sm text-ink-2">
        Lagres som en justeringsgiv på{" "}
        <span className={`font-semibold ${diff < 0 ? "text-bad" : "text-good"}`}>
          {diff > 0 ? "+" : ""}
          {diff}
        </span>{" "}
        poeng, med notatet under.
      </p>

      <label className="merkelapp block mt-5 mb-2">Notat (valgfritt)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="f.eks. glemte giv 4"
        className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 outline-none focus:border-gold"
      />

      {feil && <p className="mt-3 text-sm text-bad">{feil}</p>}

      <div className="flex gap-2 mt-6">
        <button
          onClick={async () => {
            setJobber(true);
            setFeil(null);
            try {
              await onLagre(ny, note);
            } catch (e) {
              setFeil(e instanceof Error ? e.message : "Kunne ikke lagre");
              setJobber(false);
            }
          }}
          disabled={jobber || diff === 0 || !gyldig}
          className="knapp-gull flex-1"
        >
          {jobber ? "Lagrer…" : "Lagre justering"}
        </button>
        <button onClick={onLukk} className="knapp-stille border-transparent">
          Avbryt
        </button>
      </div>
    </Modal>
  );
}
