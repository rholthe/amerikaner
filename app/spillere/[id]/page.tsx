import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDato } from "@/lib/dates";
import { hentSpillerProfil } from "@/lib/spiller";
import { spillerFarge, spillerTekstFarge } from "@/lib/palette";
import Makkermatrise from "@/components/Makkermatrise";
import { merkerFor } from "@/lib/merker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await prisma.player.findUnique({ where: { id: Number((await params).id) } });
  return { title: p ? `${p.name} · Amerikaner` : "Amerikaner" };
}

function Tall({
  merkelapp,
  verdi,
  hint,
  farge,
}: {
  merkelapp: string;
  verdi: string | number;
  hint?: string;
  farge?: string;
}) {
  return (
    <div className="kort px-4 py-3">
      <p className="merkelapp">{merkelapp}</p>
      <p className="text-2xl font-bold tabular-nums mt-1" style={farge ? { color: farge } : undefined}>
        {verdi}
      </p>
      {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

function komma(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

export default async function SpillerProfil({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [profil, alle] = await Promise.all([
    hentSpillerProfil(id),
    prisma.player.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
  ]);
  if (!profil) notFound();

  const alleIder = alle.map((p) => p.id);
  const farge = spillerTekstFarge(id, alleIder);
  const s = profil.stat;
  const matrise = [...profil.medspillere].sort((a, b) => a.id - b.id);
  const merker = merkerFor({
    stat: s,
    kvelder: profil.kvelder,
    kveldsseire: profil.kveldsseire,
    seiersrekke: profil.seiersrekke,
  });
  const oppnådd = merker.filter((m) => m.oppnådd);

  return (
    <main className="min-h-dvh p-5 sm:p-8 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-6"
      >
        <ArrowLeft size={16} /> Forsiden
      </Link>

      <header className="flex items-center gap-4 mb-8">
        <span
          aria-hidden
          className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center text-2xl font-bold text-black"
          style={{ background: spillerFarge(id, alleIder) }}
        >
          {profil.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold truncate" style={{ color: farge }}>
            {profil.name}
          </h1>
          <p className="text-sm text-ink-2">
            {profil.nickname && <span>«{profil.nickname}» · </span>}
            {profil.kvelder} {profil.kvelder === 1 ? "kveld" : "kvelder"} · {s.giv} giv
            {!profil.isActive && <span className="text-muted"> · inaktiv</span>}
          </p>
        </div>
      </header>

      {profil.kvelder === 0 ? (
        <p className="text-ink-2">Ingen registrerte giv enda.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-10">
            <Tall merkelapp="Runder vunnet" verdi={s.runderVunnet} farge={farge} />
            <Tall
              merkelapp="Kveldsseire"
              verdi={profil.kveldsseire}
              hint={`av ${profil.kvelder}`}
            />
            <Tall merkelapp="Poeng i alt" verdi={s.poeng} />
            <Tall
              merkelapp="Snitt per giv"
              verdi={s.giv > 0 ? komma(s.poeng / s.giv) : "–"}
            />
          </section>

          <section className="mb-10">
            <h2 className="merkelapp mb-3">Som melder</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Tall
                merkelapp="Meldinger"
                verdi={s.meldinger}
                hint={`${s.meldingerKlart} klart · ${s.meldingerBet} bet`}
              />
              <Tall
                merkelapp="Meldingsprosent"
                verdi={
                  s.meldinger > 0
                    ? `${Math.round((s.meldingerKlart / s.meldinger) * 100)} %`
                    : "–"
                }
              />
              <Tall
                merkelapp="Snittmelding"
                verdi={s.meldingerMedTall > 0 ? komma(s.meldingSum / s.meldingerMedTall) : "–"}
                hint={s.meldingerMedTall > 0 ? "frivillige meldinger" : undefined}
              />
              <Tall
                merkelapp="Tvungne giv"
                verdi={s.tvungne}
                hint={s.tvungne > 0 ? `${s.tvungneKlart} klart` : undefined}
              />
            </div>
          </section>

          <section className="mb-10">
            <h2 className="merkelapp mb-3">Som makker og motspiller</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Tall
                merkelapp="Ropt som makker"
                verdi={s.makkerGanger}
                hint={s.makkerGanger > 0 ? `${s.makkerKlart} klart` : undefined}
              />
              <Tall
                merkelapp="Tjent på å bli ropt"
                verdi={s.makkerTjent > 0 ? `+${s.makkerTjent}` : "0"}
                farge={s.makkerTjent > 0 ? "var(--good)" : undefined}
              />
              <Tall
                merkelapp="Tapt på å bli ropt"
                verdi={s.makkerTapt > 0 ? `−${s.makkerTapt}` : "0"}
                farge={s.makkerTapt > 0 ? "var(--bad)" : undefined}
              />
              <Tall merkelapp="Stikk i motspill" verdi={s.stikk} />
            </div>
          </section>

          <section className="mb-10">
            <h2 className="merkelapp mb-3">Rekorder</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Tall
                merkelapp="Største giv"
                verdi={s.besteGiv > 0 ? `+${s.besteGiv}` : "–"}
                farge={s.besteGiv > 0 ? "var(--good)" : undefined}
              />
              <Tall
                merkelapp="Verste smell"
                verdi={s.versteGiv < 0 ? `−${-s.versteGiv}` : "–"}
                farge={s.versteGiv < 0 ? "var(--bad)" : undefined}
              />
              <Tall
                merkelapp="Amerikanere"
                verdi={s.amerikanereMeldt}
                hint={s.amerikanereMeldt > 0 ? `${s.amerikanereKlart} klart` : undefined}
              />
              <Tall merkelapp="Meldte alene" verdi={s.meldtAlene} />
            </div>
          </section>

          {profil.sesonger.length > 0 && (
            <section className="mb-10">
              <h2 className="merkelapp mb-3">Per sesong</h2>
              <ul className="space-y-2">
                {profil.sesonger.map((se) => (
                  <li key={se.id}>
                    <Link
                      href={`/sesong/${se.id}`}
                      className="flex items-center gap-3 kort px-4 py-3 hover:bg-surface-2 transition"
                    >
                      <span className="font-medium">{se.name}</span>
                      {se.isActive && <span className="text-xs text-gold">pågår</span>}
                      <span className="ml-auto text-xs text-muted tabular-nums">
                        {se.kvelder} {se.kvelder === 1 ? "kveld" : "kvelder"} · {se.poeng} poeng
                      </span>
                      <span className="tabular-nums font-semibold text-gold w-6 text-right">
                        {se.runderVunnet}
                      </span>
                      <ChevronRight size={16} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="merkelapp">Merker</h2>
              <span className="merkelapp tabular-nums">
                {oppnådd.length} av {merker.length}
              </span>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {merker.map((m) => (
                <li
                  key={m.nøkkel}
                  className={`kort px-3.5 py-3 ${m.oppnådd ? "" : "opacity-45"}`}
                  style={m.oppnådd ? { borderColor: "var(--gold)" } : undefined}
                >
                  <div className="flex items-baseline gap-2">
                    <span aria-hidden className="text-xl leading-none">
                      {m.emoji}
                    </span>
                    <span className="font-semibold text-sm truncate">{m.navn}</span>
                  </div>
                  <p className="text-xs text-muted mt-1">{m.krav}</p>
                  {!m.oppnådd && m.framgang && m.framgang.mål > 1 && (
                    <p className="text-xs text-muted tabular-nums mt-1">
                      {m.framgang.nå} av {m.framgang.mål}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="merkelapp mb-3">Makkermatrise</h2>
            <Makkermatrise
              spillere={matrise}
              alleIder={alleIder}
              par={profil.par}
              fremhevId={id}
            />
          </section>

          <section>
            <h2 className="merkelapp mb-3">Kvelder</h2>
            <ul className="space-y-2">
              {profil.siste.map((k) => (
                <li key={k.id}>
                  <Link
                    href={`/kveld/${k.id}`}
                    className="flex items-center gap-3 kort px-4 py-3 hover:bg-surface-2 transition"
                  >
                    <span className="text-ink-2 text-sm tabular-nums shrink-0 whitespace-nowrap">
                      {formatDato(k.date)}
                    </span>
                    {k.plassering === 1 && k.runderVunnet > 0 && (
                      <Trophy size={14} className="text-gold shrink-0" />
                    )}
                    <span className="text-sm text-muted tabular-nums">
                      {k.plassering}. av {k.antallSpillere}
                    </span>
                    <span className="ml-auto text-xs text-muted tabular-nums shrink-0">
                      {k.runderVunnet} {k.runderVunnet === 1 ? "runde" : "runder"} · {k.poeng} poeng
                    </span>
                    <ChevronRight size={16} className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
