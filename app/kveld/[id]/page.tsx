import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hentKveld } from "@/lib/kveld";
import { formatDato } from "@/lib/dates";
import { stillinger } from "@/lib/scoring";
import { kåringer, spillerStatistikk, type StatGiv } from "@/lib/stats";
import { spillerFarge } from "@/lib/palette";
import GivListe from "@/components/kveld/GivListe";
import Statistikk from "@/components/kveld/Statistikk";
import SlettRunde from "@/components/kveld/SlettRunde";

export const dynamic = "force-dynamic";

export default async function KveldHistorikk({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [kveld, alle, rad] = await Promise.all([
    hentKveld(id),
    prisma.player.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.match.findUnique({ where: { id }, include: { season: true } }),
  ]);
  if (!kveld) notFound();
  const sesong = rad?.season ?? null;

  const alleIder = alle.map((p) => p.id);
  const deltakere = kveld.spillere.map((s) => s.id);
  const navn = (pid: number) => kveld.spillere.find((s) => s.id === pid)?.name ?? "?";

  const vunnet: Record<number, number> = {};
  for (const r of kveld.runder) {
    if (r.winnerId) vunnet[r.winnerId] = (vunnet[r.winnerId] ?? 0) + 1;
  }

  const alleGiv: StatGiv[] = kveld.runder.flatMap((r) => r.giv);
  const totalt = stillinger(
    alleGiv.map((g) => ({ scores: g.scores })),
    deltakere,
  );
  // «Runder vunnet» står allerede som egen seksjon øverst på denne siden.
  const kår = kåringer(spillerStatistikk(alleGiv, deltakere, vunnet).values()).filter(
    (k) => k.nøkkel !== "runder",
  );

  const rangert = [...kveld.spillere].sort(
    (a, b) => (vunnet[b.id] ?? 0) - (vunnet[a.id] ?? 0) || (totalt[b.id] ?? 0) - (totalt[a.id] ?? 0),
  );
  const antallGiv = alleGiv.filter((g) => g.kind === "melding").length;
  const antallRunder = kveld.runder.filter((r) => r.giv.length > 0).length;

  return (
    <main className="min-h-dvh p-5 sm:p-8 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 mb-2">
        <Link href="/" className="text-ink-2 hover:text-ink" aria-label="Tilbake">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-2xl font-semibold">{formatDato(kveld.date)}</h1>
        {!kveld.isFinished && (
          <span className="text-xs px-2.5 py-1 rounded-full border border-gold/50 bg-gold/10 text-gold-2">
            pågår
          </span>
        )}
      </header>
      {sesong && (
        <Link
          href={`/sesong/${sesong.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold-2 mb-2"
        >
          <Trophy size={14} /> {sesong.name}
        </Link>
      )}
      <p className="text-ink-2 mb-8">
        {kveld.spillere.map((s) => s.name).join(", ")}
        {kveld.place && ` · ${kveld.place}`} ·{" "}
        {antallRunder} {antallRunder === 1 ? "runde" : "runder"} · {antallGiv} giv
      </p>

      <section className="mb-10">
        <h2 className="merkelapp mb-3">Runder vunnet</h2>
        <ul className="space-y-1.5">
          {rangert.map((s) => {
            const seire = vunnet[s.id] ?? 0;
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 kort px-4 py-3"
              >
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: spillerFarge(s.id, alleIder) }}
                />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {totalt[s.id] ?? 0} poeng i alt
                </span>
                <span className="tabular-nums font-semibold text-gold w-6 text-right">
                  {seire}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {kår.length > 0 && (
        <section className="mb-10">
          <h2 className="merkelapp mb-3">Kåringer fra kvelden</h2>
          <Statistikk kåringer={kår} spillere={kveld.spillere} alleIder={alleIder} />
        </section>
      )}

      {/* Også tomme runder vises, slik at de kan slettes herfra. */}
      {kveld.runder.map((r) => {
          const stilling = stillinger(
            r.giv.map((g) => ({ scores: g.scores })),
            deltakere,
          );
          return (
            <section key={r.id} className="mb-8">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="font-semibold">Runde {r.gameNo}</h2>
                {r.winnerId ? (
                  <span className="flex items-center gap-1.5 text-gold text-sm">
                    <Trophy size={14} /> {navn(r.winnerId)} vant
                  </span>
                ) : (
                  <span className="text-muted text-sm">· ikke avgjort</span>
                )}
                <SlettRunde
                  rundeId={r.id}
                  rundeNr={r.gameNo}
                  antallGiv={r.giv.length}
                  sisteRunde={kveld.runder.length === 1}
                  className="ml-auto"
                />
              </div>

              <p className="text-sm text-ink-2 mb-3 tabular-nums">
                {[...deltakere]
                  .sort((a, b) => (stilling[b] ?? 0) - (stilling[a] ?? 0))
                  .map((pid) => `${navn(pid)} ${stilling[pid] ?? 0}`)
                  .join(" · ")}
              </p>

              <GivListe
                giv={r.giv}
                spillere={kveld.spillere}
                alleIder={alleIder}
                nyesteFørst={false}
              />
            </section>
        );
      })}
    </main>
  );
}
