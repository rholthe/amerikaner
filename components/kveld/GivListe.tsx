"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { GivDto } from "@/lib/typer";
import { beskrivGiv } from "@/lib/givTekst";
import { spillerTekstFarge } from "@/lib/palette";

interface Props {
  giv: GivDto[];
  spillere: { id: number; name: string }[];
  alleIder?: number[];
  /** «stor» er TV-en, «kompakt» er mobilen. */
  variant?: "stor" | "kompakt";
  /** Nyeste giv først. Av på historikksider der man leser runden kronologisk. */
  nyesteFørst?: boolean;
  onRediger?: (giv: GivDto) => void;
  onSlett?: (giv: GivDto) => void;
  tomTekst?: string;
}

/**
 * Beskrivelsen og poengene står på hver sin linje. Én linje ser ryddigere ut
 * på en vid skjerm, men da er det beskrivelsen som forsvinner i det bordet
 * blir fullt eller skjermen smal – og da er lista ubrukelig.
 */
export default function GivListe({
  giv,
  spillere,
  alleIder,
  variant = "kompakt",
  nyesteFørst = true,
  onRediger,
  onSlett,
  tomTekst = "Ingen giv registrert i denne runden enda.",
}: Props) {
  const navn = (id: number) => spillere.find((s) => s.id === id)?.name ?? "?";
  const ider = alleIder ?? spillere.map((s) => s.id);
  const stor = variant === "stor";

  if (giv.length === 0) {
    return <p className="text-muted text-sm py-2">{tomTekst}</p>;
  }

  const rekkefølge = nyesteFørst ? [...giv].reverse() : giv;

  return (
    <ul className="space-y-1.5">
      {rekkefølge.map((g) => {
        const justering = g.kind === "justering";
        const poeng = g.scores.filter((s) => s.points !== 0);
        return (
          <li
            key={g.id}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
              justering ? "border-gold/25 bg-gold/5" : "border-line bg-surface-2"
            }`}
          >
            <span
              className={`text-muted tabular-nums shrink-0 text-center ${
                stor ? "w-8 text-lg leading-7" : "w-6 leading-6"
              }`}
            >
              {g.dealNo}
            </span>

            <div className="flex-1 min-w-0">
              {/* Ikke truncate: «med Morten · bet» er halve poenget med linja. */}
              <p className={`text-ink-2 ${stor ? "text-base leading-7" : "text-sm leading-6"}`}>
                {beskrivGiv(g, navn)}
              </p>

              {poeng.length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums font-medium text-sm">
                  {poeng.map((s) => (
                    <span key={s.playerId} className="whitespace-nowrap">
                      <span style={{ color: spillerTekstFarge(s.playerId, ider) }}>
                        {navn(s.playerId)}
                      </span>{" "}
                      <span className={s.points < 0 ? "text-bad" : "text-ink"}>
                        {s.points > 0 ? "+" : ""}
                        {s.points}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </div>

            {(onRediger || onSlett) && (
              <div className="flex shrink-0 gap-0.5">
                {onRediger && !justering && (
                  <button
                    onClick={() => onRediger(g)}
                    className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface-3"
                    aria-label={`Rett giv ${g.dealNo}`}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {onSlett && (
                  <button
                    onClick={() => onSlett(g)}
                    className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-bad hover:bg-surface-3"
                    aria-label={`Slett giv ${g.dealNo}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
