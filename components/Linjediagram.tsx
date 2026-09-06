"use client";

import { useEffect, useRef, useState } from "react";

export interface Serie {
  id: number;
  navn: string;
  farge: string;
  /** Én verdi per punkt på x-aksen. null = spilte ikke den kvelden. */
  verdier: (number | null)[];
}

interface Props {
  tittel: string;
  forklaring?: string;
  /** Etikettene på x-aksen, én per punkt. */
  merkelapper: string[];
  serier: Serie[];
  /** Tegn en nullstrek når verdiene kan være negative. */
  visNull?: boolean;
  høyde?: number;
}

const PAD = { topp: 14, høyre: 74, bunn: 30, venstre: 40 };

/**
 * Linjediagram i ren SVG. Ingen diagrambibliotek: to linjediagrammer trenger
 * ikke 100 kB javascript, og her har vi full kontroll på markspesifikasjonene –
 * 2 px linjer, hårfine heltrukne hjelpelinjer, 9 px endepunkt med 2 px ring i
 * flatefargen så de er lesbare der linjene krysser.
 *
 * Identiteten hviler aldri på fargen alene: hver linje har navnet sitt ved
 * enden, det er alltid en tegnforklaring, og tallene står i en tabell under.
 * Det er også svaret på at paletten vår har ett fargepar (gull og grønn) som
 * ligger i 6–8-båndet for fargeblindhet – lovlig kun med slik sekundærkoding.
 */
export default function Linjediagram({
  tittel,
  forklaring,
  merkelapper,
  serier,
  visNull = false,
  høyde = 260,
}: Props) {
  const boks = useRef<HTMLDivElement>(null);
  const [bredde, setBredde] = useState(720);
  const [aktiv, setAktiv] = useState<number | null>(null);

  useEffect(() => {
    const el = boks.current;
    if (!el) return;
    const oppdater = () => setBredde(el.clientWidth);
    oppdater();
    const ro = new ResizeObserver(oppdater);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = merkelapper.length;
  if (n < 2 || serier.length === 0) {
    return (
      <figure className="kort p-5">
        <figcaption className="mb-1 font-semibold">{tittel}</figcaption>
        <p className="text-muted text-sm">
          Kurven tegner seg fra og med den andre kvelden.
        </p>
      </figure>
    );
  }

  const tall = serier.flatMap((s) => s.verdier).filter((v): v is number => v !== null);
  const rå = { min: Math.min(...tall, visNull ? 0 : Infinity), maks: Math.max(...tall, 0) };
  const spenn = Math.max(1, rå.maks - rå.min);
  const min = rå.min - spenn * 0.08;
  const maks = rå.maks + spenn * 0.08;

  const b = Math.max(320, bredde);
  const plotB = b - PAD.venstre - PAD.høyre;
  const plotH = høyde - PAD.topp - PAD.bunn;

  const x = (i: number) => PAD.venstre + (n === 1 ? plotB / 2 : (i / (n - 1)) * plotB);
  const y = (v: number) => PAD.topp + plotH - ((v - min) / (maks - min)) * plotH;

  // Runde tall på y-aksen, ikke tilfeldige desimaler.
  const steg = Math.max(1, Math.ceil((maks - min) / 4));
  const merker: number[] = [];
  for (let v = Math.ceil(rå.min / steg) * steg; v <= rå.maks + steg * 0.5; v += steg) {
    merker.push(v);
  }

  // Vis hver k-te dato så etikettene ikke kolliderer.
  const hopp = Math.max(1, Math.ceil((n * 62) / plotB));

  // Endepunktene får navnet sitt, men to linjer som ender på samme verdi ville
  // skrevet oppå hverandre. Etikettene skyves derfor fra hverandre til de har
  // en linjehøyde imellom – ellers er direktemerkingen verdiløs akkurat der den
  // trengs mest, i tetten.
  const MIN_AVSTAND = 15;
  const endepunkter = serier
    .map((s) => {
      const i = s.verdier.reduce<number>((a, v, k) => (v !== null ? k : a), -1);
      return i < 0 ? null : { serie: s, i, y: y(s.verdier[i]!) };
    })
    .filter((e): e is { serie: Serie; i: number; y: number } => e !== null)
    .sort((a, b) => a.y - b.y);

  const etiketter = endepunkter.map((e) => ({ ...e, tekstY: e.y }));
  for (let k = 1; k < etiketter.length; k++) {
    const forrige = etiketter[k - 1].tekstY;
    if (etiketter[k].tekstY - forrige < MIN_AVSTAND) {
      etiketter[k].tekstY = forrige + MIN_AVSTAND;
    }
  }
  // Skyv hele bunken opp igjen hvis den rant ut nederst.
  const overskudd = (etiketter.at(-1)?.tekstY ?? 0) - (PAD.topp + plotH);
  if (overskudd > 0) for (const e of etiketter) e.tekstY -= overskudd;

  const posisjon = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * b;
    const i = Math.round(((px - PAD.venstre) / plotB) * (n - 1));
    setAktiv(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <figure className="kort p-4 sm:p-5" ref={boks}>
      <figcaption className="mb-0.5 font-semibold">{tittel}</figcaption>
      {forklaring && <p className="text-xs text-muted mb-3">{forklaring}</p>}

      <div className="relative">
        <svg
          width="100%"
          height={høyde}
          viewBox={`0 0 ${b} ${høyde}`}
          role="img"
          aria-label={tittel}
          tabIndex={0}
          className="touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-gold rounded"
          onPointerMove={posisjon}
          onPointerDown={posisjon}
          onPointerLeave={() => setAktiv(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setAktiv((i) => Math.min(n - 1, (i ?? -1) + 1));
            else if (e.key === "ArrowLeft") setAktiv((i) => Math.max(0, (i ?? n) - 1));
            else if (e.key === "Escape") setAktiv(null);
            else return;
            e.preventDefault();
          }}
        >
          {merker.map((v) => (
            <g key={v}>
              <line
                x1={PAD.venstre}
                x2={b - PAD.høyre}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PAD.venstre - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-muted"
                style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
              >
                {v}
              </text>
            </g>
          ))}

          {visNull && rå.min < 0 && (
            <line
              x1={PAD.venstre}
              x2={b - PAD.høyre}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--line-sterk)"
              strokeWidth={1}
            />
          )}

          {merkelapper.map((m, i) =>
            i % hopp === 0 || i === n - 1 ? (
              <text
                key={i}
                x={x(i)}
                y={høyde - 10}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-muted"
                style={{ fontSize: 11 }}
              >
                {m}
              </text>
            ) : null,
          )}

          {aktiv !== null && (
            <line
              x1={x(aktiv)}
              x2={x(aktiv)}
              y1={PAD.topp}
              y2={PAD.topp + plotH}
              stroke="var(--line-sterk)"
              strokeWidth={1}
            />
          )}

          {serier.map((s) => {
            const punkter = s.verdier
              .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
              .filter((p): p is string => p !== null);
            if (punkter.length === 0) return null;
            const sisteIndeks = s.verdier.reduce<number>((a, v, i) => (v !== null ? i : a), -1);
            return (
              <g key={s.id}>
                <polyline
                  points={punkter.join(" ")}
                  fill="none"
                  stroke={s.farge}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {sisteIndeks >= 0 && (
                  <circle
                    cx={x(sisteIndeks)}
                    cy={y(s.verdier[sisteIndeks]!)}
                    r={4.5}
                    fill={s.farge}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                )}
                {aktiv !== null && s.verdier[aktiv] !== null && (
                  <circle
                    cx={x(aktiv)}
                    cy={y(s.verdier[aktiv]!)}
                    r={4.5}
                    fill={s.farge}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
          {etiketter.map((e) => (
            <g key={`etikett-${e.serie.id}`}>
              {Math.abs(e.tekstY - e.y) > 2 && (
                <line
                  x1={x(e.i) + 5}
                  x2={x(e.i) + 9}
                  y1={e.y}
                  y2={e.tekstY - 4}
                  stroke="var(--line-sterk)"
                  strokeWidth={1}
                />
              )}
              <text
                x={x(e.i) + 11}
                y={e.tekstY}
                dominantBaseline="middle"
                className="fill-ink"
                style={{ fontSize: 12 }}
              >
                {e.serie.navn}
              </text>
            </g>
          ))}
        </svg>

        {aktiv !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-xl border border-line bg-surface-2/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(72, (x(aktiv) / b) * 100)}%`,
              transform: (x(aktiv) / b) > 0.6 ? "translateX(-100%)" : undefined,
            }}
          >
            <p className="font-semibold mb-1">{merkelapper[aktiv]}</p>
            {serier.map((s) => (
              <p key={s.id} className="flex items-center gap-2 whitespace-nowrap">
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: s.farge }}
                />
                <span className="text-ink-2">{s.navn}</span>
                <span className="ml-auto tabular-nums font-medium">
                  {s.verdier[aktiv] ?? "–"}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tegnforklaringen er alltid der: identiteten skal aldri hvile på farge alene. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
        {serier.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-4 h-0.5 rounded-full"
              style={{ background: s.farge }}
            />
            <span className="text-ink-2">{s.navn}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
