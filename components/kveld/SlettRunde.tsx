"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";

interface Props {
  rundeId: number;
  rundeNr: number;
  antallGiv: number;
  /** Er dette den eneste runden igjen, ryker hele kvelden med. */
  sisteRunde: boolean;
  /** Uten denne navigerer knappen selv – slik brukes den fra historikksiden,
   *  som er server-rendret og ikke kan sende med en funksjon. */
  onSlettet?: (slettetKveld: boolean) => void | Promise<void>;
  className?: string;
}

/**
 * Sletting av en runde er det eneste i appen som fjerner registrerte poeng for
 * godt. Derfor spør den om PIN-en på nytt: innloggingscookien varer et år, og
 * en telefon som ligger og slenger på bordet skal ikke kunne slette kvelden.
 */
export default function SlettRunde({
  rundeId,
  rundeNr,
  antallGiv,
  sisteRunde,
  onSlettet,
  className = "",
}: Props) {
  const router = useRouter();
  const [åpen, setÅpen] = useState(false);
  const [pin, setPin] = useState("");
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function slett() {
    setJobber(true);
    setFeil(null);
    try {
      const svar = await api.delete<{ slettetKveld: boolean }>(`/api/runde/${rundeId}`, {
        pin,
      });
      setÅpen(false);
      setPin("");
      if (onSlettet) await onSlettet(svar.slettetKveld);
      else if (svar.slettetKveld) router.push("/");
      else router.refresh();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Kunne ikke slette runden");
      setJobber(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setPin("");
          setFeil(null);
          setJobber(false);
          setÅpen(true);
        }}
        className={`inline-flex items-center gap-1.5 text-xs text-muted hover:text-bad ${className}`}
      >
        <Trash2 size={14} /> Slett runden
      </button>

      {åpen && (
        <Modal
          tittel={`Slett runde ${rundeNr}`}
          undertittel={
            antallGiv === 0
              ? "Runden er tom."
              : `${antallGiv} ${antallGiv === 1 ? "giv" : "giv"} og alle poengene i dem forsvinner for godt.`
          }
          bredde="smal"
          onLukk={() => setÅpen(false)}
        >
          {sisteRunde && (
            <p className="flex gap-2.5 text-sm text-gold-2 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 mb-5">
              <TriangleAlert size={17} className="shrink-0 mt-0.5" />
              <span>
                Dette er den eneste runden igjen på kvelden.{" "}
                <b>Hele kvelden slettes</b> – også hvem som var med.
              </span>
            </p>
          )}

          <label htmlFor="slett-pin" className="merkelapp block mb-2">
            Skriv PIN for å bekrefte
          </label>
          <input
            id="slett-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin && !jobber) slett();
            }}
            className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-2xl tracking-[0.4em] tabular-nums text-center outline-none focus:border-gold"
          />

          {feil && <p className="mt-3 text-sm text-bad">{feil}</p>}

          <div className="flex gap-2 mt-6">
            <button
              onClick={slett}
              disabled={jobber || pin.length === 0}
              className="knapp-gull flex-1"
              style={{ background: "var(--bad)", color: "#000" }}
            >
              {jobber ? "Sletter…" : sisteRunde ? "Slett runden og kvelden" : `Slett runde ${rundeNr}`}
            </button>
            <button onClick={() => setÅpen(false)} className="knapp-stille border-transparent">
              Avbryt
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
