"use client";

import { Flag } from "lucide-react";
import { spillerFarge } from "@/lib/palette";

interface Props {
  spillere: { id: number; name: string }[];
  stilling: Record<number, number>;
  mål: number;
  runderVunnet: Record<number, number>;
  alleIder: number[];
  /** «stor» er TV-en i stua, «kompakt» er mobilen ved bordet. */
  variant?: "stor" | "kompakt";
  onJuster?: (playerId: number) => void;
}

/**
 * Søylene skaleres mot målet, ikke mot lederen: det er avstanden til 52 som
 * avgjør spenningen, og en søyle som fyller seg mot en fast strek leses på tre
 * meters avstand. Fargen følger spilleren, aldri rangeringen.
 */
export default function Tavle({
  spillere,
  stilling,
  mål,
  runderVunnet,
  alleIder,
  variant = "kompakt",
  onJuster,
}: Props) {
  const stor = variant === "stor";
  const sortert = [...spillere].sort((a, b) => (stilling[b.id] ?? 0) - (stilling[a.id] ?? 0));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="merkelapp">Stilling i runden</h2>
        <span className="merkelapp text-gold">mot {mål}</span>
      </div>

      <ul className={stor ? "space-y-5" : "space-y-3"}>
        {sortert.map((s) => {
          const p = stilling[s.id] ?? 0;
          const andel = Math.max(0, Math.min(1, p / mål));
          const farge = spillerFarge(s.id, alleIder);
          const seire = runderVunnet[s.id] ?? 0;
          const igjen = mål - p;
          const iMål = p >= mål;

          return (
            <li key={s.id}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="shrink-0 rounded-full"
                    style={{
                      background: farge,
                      width: stor ? 14 : 10,
                      height: stor ? 14 : 10,
                    }}
                  />
                  <span
                    className="font-semibold uppercase tracking-wide truncate"
                    style={{ fontSize: stor ? "clamp(1.25rem, 2.2vw, 2.25rem)" : "1.0625rem" }}
                  >
                    {s.name}
                  </span>
                  {iMål && <Flag size={stor ? 22 : 15} className="shrink-0 text-gold" />}
                </div>

                <button
                  onClick={onJuster ? () => onJuster(s.id) : undefined}
                  disabled={!onJuster}
                  title={onJuster ? "Trykk for å rette stillingen" : undefined}
                  className="font-bold tabular-nums leading-none enabled:hover:text-gold transition shrink-0"
                  style={{
                    fontSize: stor ? "clamp(2rem, 4.5vw, 4.5rem)" : "1.75rem",
                    color: p < 0 ? "var(--bad)" : undefined,
                  }}
                >
                  {p}
                </button>
              </div>

              <div
                className="mt-2 rounded-full bg-surface-2 overflow-hidden"
                style={{ height: stor ? 16 : 8 }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${andel * 100}%`, background: farge }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-3">
                <div className="flex gap-1" title={`${seire} runder vunnet i kveld`}>
                  {Array.from({ length: seire }).map((_, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gold"
                      style={{ width: stor ? 10 : 7, height: stor ? 10 : 7 }}
                    />
                  ))}
                </div>
                <span className={`tabular-nums ${stor ? "text-sm" : "text-xs"} text-muted`}>
                  {iMål ? "i mål" : `${igjen} igjen`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
