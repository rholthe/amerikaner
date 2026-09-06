"use client";

import type { Kåring } from "@/lib/stats";
import { spillerTekstFarge } from "@/lib/palette";

interface Props {
  kåringer: Kåring[];
  /** Navnene til dem som kan dukke opp i kåringene. */
  spillere: { id: number; name: string }[];
  alleIder: number[];
  variant?: "stor" | "kompakt";
  /** Vis bare de N første kåringene. Resten faller bort. */
  antall?: number;
  tomTekst?: string;
}

/**
 * Kåringene regnes ut fra rådata hver gang. En kåring uten data faller bort av
 * seg selv, så tavla er aldri full av tomme kort tidlig på kvelden.
 */
export default function Statistikk({
  kåringer,
  spillere,
  alleIder,
  variant = "kompakt",
  antall,
  tomTekst = "Statistikken kommer så snart det er registrert noen giv.",
}: Props) {
  const navn = (id: number) => spillere.find((s) => s.id === id)?.name ?? "?";
  const stor = variant === "stor";
  const vist = antall ? kåringer.slice(0, antall) : kåringer;

  if (vist.length === 0) {
    return <p className="text-muted text-sm py-2">{tomTekst}</p>;
  }

  return (
    <div
      className={`grid gap-2.5 ${
        stor ? "grid-cols-2 2xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
      }`}
    >
      {vist.map((k) => {
        const topp = k.rader[0];
        const delt = k.rader.filter((r) => r.verdi === topp.verdi);
        const resten = k.rader.filter((r) => r.verdi !== topp.verdi).slice(0, 2);

        return (
          <div key={k.nøkkel} className="kort p-3.5 flex flex-col">
            <h3 className="merkelapp mb-2">{k.tittel}</h3>

            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`font-semibold truncate ${stor ? "text-xl" : "text-base"}`}
                style={
                  delt.length > 1
                    ? undefined
                    : { color: spillerTekstFarge(topp.playerId, alleIder) }
                }
              >
                {delt.length > 1
                  ? delt.map((r) => navn(r.playerId)).join(", ")
                  : navn(topp.playerId)}
              </span>
              <span
                className={`font-bold tabular-nums shrink-0 ${stor ? "text-3xl" : "text-2xl"}`}
              >
                {topp.visning}
              </span>
            </div>

            {/* Hintet gjelder én spiller, så det står bare når én står øverst. */}
            {topp.hint && delt.length === 1 && (
              <p className="text-xs text-muted mt-0.5">{topp.hint}</p>
            )}

            {resten.length > 0 && (
              <ul className="mt-2.5 pt-2.5 border-t border-line space-y-1">
                {resten.map((r) => (
                  <li
                    key={r.playerId}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="text-ink-2 truncate">{navn(r.playerId)}</span>
                    <span className="tabular-nums text-ink-2 shrink-0">{r.visning}</span>
                  </li>
                ))}
              </ul>
            )}

            {stor && <p className="text-xs text-muted mt-auto pt-2.5">{k.forklaring}</p>}
          </div>
        );
      })}
    </div>
  );
}
