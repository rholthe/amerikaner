import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDato } from "@/lib/dates";
import { hentSesong, kveldsvinner } from "@/lib/sesong";
import { kåringer, spillerStatistikk } from "@/lib/stats";
import { spillerFarge, spillerTekstFarge } from "@/lib/palette";
import Statistikk from "@/components/kveld/Statistikk";

export const dynamic = "force-dynamic";

const MEDALJER = ["🥇", "🥈", "🥉"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const sesong = await prisma.season.findUnique({ where: { id: Number((await params).id) } });
  return { title: sesong ? `${sesong.name} · Amerikaner` : "Amerikaner" };
}

export default async function SesongSide({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [sesong, alle] = await Promise.all([
    hentSesong(id),
    prisma.player.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
  ]);
  if (!sesong) notFound();

  const alleIder = alle.map((p) => p.id);
  // «Runder vunnet» er allerede det sesongtabellen rangerer på.
  const kår = kåringer(
    spillerStatistikk(sesong.giv, sesong.tabell.map((r) => r.playerId), sesong.runderVunnet).values(),
  ).filter((k) => k.nøkkel !== "runder");
  const spillere = sesong.tabell.map((r) => ({ id: r.playerId, name: r.name }));
  const navn = (pid: number) => spillere.find((s) => s.id === pid)?.name ?? "?";

  return (
    <main className="min-h-dvh p-5 sm:p-8 max-w-3xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-6">
        <ArrowLeft size={16} /> Forsiden
      </Link>

      <header className="text-center mb-10">
        <p className="merkelapp">♠ Sesong ♠</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-gold-2 mt-1.5">{sesong.name}</h1>
        {sesong.isActive && (
          <p className="text-sm text-gold mt-1.5">Sesongen pågår – stillingen er foreløpig</p>
        )}
        <p className="text-sm text-muted mt-2 tabular-nums">
          {formatDato(sesong.startDate)} – {formatDato(sesong.endDate)}
        </p>
        <p className="text-sm text-ink-2 mt-1 tabular-nums">
          {sesong.kvelder.length} {sesong.kvelder.length === 1 ? "kveld" : "kvelder"} ·{" "}
          {sesong.antallRunder} {sesong.antallRunder === 1 ? "runde" : "runder"} ·{" "}
          {sesong.antallGiv} giv · {sesong.tabell.length} spillere
        </p>
      </header>

      {sesong.kvelder.length === 0 ? (
        <p className="text-ink-2 text-center py-10">
          Ingen kvelder i denne sesongen enda. Kvelder havner her av seg selv når
          datoen deres faller innenfor sesongen.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="merkelapp">Sesongtabell</h2>
              <span className="merkelapp">vunne runder</span>
            </div>

            <ul className="space-y-2">
              {sesong.tabell.map((r, i) => {
                const pall = i < 3 && r.runderVunnet > 0;
                return (
                  <li
                    key={r.playerId}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
                      i === 0 && pall
                        ? "border-gold/50 bg-gold/10"
                        : "border-line bg-surface"
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center text-lg">
                      {pall ? (
                        MEDALJER[i]
                      ) : (
                        <span className="text-muted text-sm tabular-nums">{i + 1}</span>
                      )}
                    </span>

                    <span
                      aria-hidden
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: spillerFarge(r.playerId, alleIder) }}
                    />

                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold truncate ${i === 0 && pall ? "text-lg" : ""}`}
                        style={
                          i === 0 && pall
                            ? { color: spillerTekstFarge(r.playerId, alleIder) }
                            : undefined
                        }
                      >
                        {r.name}
                        {i === 0 && pall && (
                          <span className="ml-2 text-xs font-medium text-gold">Sesongmester</span>
                        )}
                      </p>
                      <p className="text-xs text-muted tabular-nums mt-0.5">
                        {r.poeng} poeng · {r.kveldsseire}{" "}
                        {r.kveldsseire === 1 ? "kveldsseier" : "kveldsseire"} · {r.kvelder}{" "}
                        {r.kvelder === 1 ? "kveld" : "kvelder"}
                        {r.meldinger > 0 && ` · ${r.meldingerKlart}/${r.meldinger} meldinger`}
                      </p>
                    </div>

                    <span className="text-2xl font-bold tabular-nums shrink-0">
                      {r.runderVunnet}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {kår.length > 0 && (
            <section className="mb-10">
              <h2 className="merkelapp mb-3">Kåringer</h2>
              <Statistikk kåringer={kår} spillere={spillere} alleIder={alleIder} />
            </section>
          )}

          <section>
            <h2 className="merkelapp mb-3">Alle kvelder</h2>
            <ul className="space-y-2">
              {sesong.kvelder.map((k) => {
                const vinner = kveldsvinner(k);
                const spilte = k.runder.filter((r) => r.giv.length > 0);
                return (
                  <li key={k.id}>
                    <Link
                      href={`/kveld/${k.id}`}
                      className="block kort px-4 py-3.5 hover:bg-surface-2 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-ink-2 text-sm tabular-nums shrink-0 whitespace-nowrap">
                          {formatDato(k.date)}
                        </span>
                        {vinner !== null ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Trophy size={14} className="text-gold shrink-0" />
                            <span
                              className="font-medium truncate"
                              style={{ color: spillerTekstFarge(vinner, alleIder) }}
                            >
                              {navn(vinner)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted text-sm">ingen avgjorte runder</span>
                        )}
                        <span className="ml-auto text-xs text-muted tabular-nums shrink-0">
                          {spilte.length} {spilte.length === 1 ? "runde" : "runder"}
                        </span>
                        <ChevronRight size={16} className="text-muted shrink-0" />
                      </div>

                      {spilte.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                          {spilte.map((r) => (
                            <span key={r.id}>
                              Runde {r.gameNo}:{" "}
                              {r.winnerId ? (
                                <span style={{ color: spillerTekstFarge(r.winnerId, alleIder) }}>
                                  {navn(r.winnerId)}
                                </span>
                              ) : (
                                "ikke avgjort"
                              )}{" "}
                              <span className="text-muted">({r.giv.length} giv)</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {k.place && <p className="mt-1 text-xs text-muted">{k.place}</p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
