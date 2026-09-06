import Link from "next/link";
import { CalendarRange, ChartLine, ChevronRight, Monitor, Smartphone, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDato } from "@/lib/dates";
import { stillinger } from "@/lib/scoring";
import { kåringer } from "@/lib/stats";
import { hentTotalStatistikk } from "@/lib/statsDb";
import { hentSesonger } from "@/lib/sesong";
import { spillerFarge } from "@/lib/palette";
import Statistikk from "@/components/kveld/Statistikk";

export const dynamic = "force-dynamic";

export default async function Forside() {
  const [aktiv, siste, total] = await Promise.all([
    prisma.match.findFirst({
      where: { isFinished: false },
      orderBy: { id: "desc" },
      include: { players: { include: { player: true } } },
    }),
    prisma.match.findMany({
      where: { isFinished: true },
      orderBy: { date: "desc" },
      take: 8,
      include: {
        players: { include: { player: true } },
        games: { include: { deals: { include: { scores: true } } } },
      },
    }),
    hentTotalStatistikk(),
  ]);

  const sesonger = await hentSesonger();
  const aktivSesong = sesonger.find((s) => s.isActive) ?? null;

  const alleIder = total.spillere.map((s) => s.id);
  const kår = kåringer(total.stat);

  return (
    <main className="min-h-dvh p-5 sm:p-10 max-w-3xl mx-auto">
      <header className="mb-9">
        <div className="text-5xl text-gold leading-none">♠</div>
        <h1 className="text-4xl font-bold mt-2 tracking-tight">Amerikaner</h1>
        <p className="text-ink-2 mt-1">Poeng og statistikk for gutta.</p>
      </header>

      {aktiv && (
        <p className="mb-4 text-sm text-gold-2 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3">
          Det pågår en kveld med {aktiv.players.map((p) => p.player.name).join(", ")}.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <Link
          href="/registrer"
          className="bg-gold text-black rounded-2xl p-5 font-semibold text-lg hover:brightness-110 transition"
        >
          <Smartphone size={22} className="mb-2" />
          {aktiv ? "Registrer giv" : "Start ny kveld"}
          <span className="block text-sm font-normal opacity-70 mt-0.5">
            Mobilen ved bordet
          </span>
        </Link>

        <Link
          href="/kveld"
          className="kort p-5 font-semibold text-lg hover:bg-surface-2 transition"
        >
          <Monitor size={22} className="mb-2 text-gold" />
          Storskjerm
          <span className="block text-sm font-normal text-ink-2 mt-0.5">
            Tavla til TV-en i stua
          </span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-12">
        <Link
          href="/oversikt"
          className="kort flex items-center gap-3 px-5 py-4 hover:bg-surface-2 transition"
        >
          <ChartLine size={18} className="text-ink-2" />
          <span className="font-medium">Oversikt</span>
        </Link>
        <Link
          href="/spillere"
          className="kort flex items-center gap-3 px-5 py-4 hover:bg-surface-2 transition"
        >
          <Users size={18} className="text-ink-2" />
          <span className="font-medium">Spillere</span>
          <span className="text-sm text-ink-2 ml-auto">{total.spillere.length}</span>
        </Link>
        <Link
          href="/sesonger"
          className="kort flex items-center gap-3 px-5 py-4 hover:bg-surface-2 transition"
        >
          <CalendarRange size={18} className="text-ink-2" />
          <span className="font-medium">Sesonger</span>
          <span className="text-sm text-ink-2 ml-auto">{sesonger.length}</span>
        </Link>
      </div>

      {sesonger.length > 0 && (
        <section className="mb-12">
          <h2 className="merkelapp mb-3">
            {aktivSesong ? "Sesongen som pågår" : "Sesonger"}
          </h2>
          <ul className="space-y-2">
            {sesonger.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sesong/${s.id}`}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${
                    s.isActive
                      ? "border-gold/50 bg-gold/10 hover:bg-gold/15"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <Trophy size={17} className={s.isActive ? "text-gold" : "text-muted"} />
                  <span className="font-semibold">{s.name}</span>
                  {s.isActive && (
                    <span className="text-xs text-gold">pågår</span>
                  )}
                  <span className="ml-auto text-xs text-muted tabular-nums">
                    {s.kvelder} {s.kvelder === 1 ? "kveld" : "kvelder"} · {s.runder}{" "}
                    {s.runder === 1 ? "runde" : "runder"}
                  </span>
                  <ChevronRight size={16} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {kår.length > 0 && (
        <section className="mb-12">
          <h2 className="merkelapp mb-3">Gjennom tidene</h2>
          <Statistikk
            kåringer={kår}
            spillere={total.spillere}
            alleIder={alleIder}
            antall={6}
          />
        </section>
      )}

      <section>
        <h2 className="merkelapp mb-3">Tidligere kvelder</h2>

        {siste.length === 0 ? (
          <p className="text-ink-2">Ingen kvelder registrert enda.</p>
        ) : (
          <ul className="space-y-2">
            {siste.map((m) => {
              const deltakere = m.players.map((p) => p.playerId);
              const vunnet = new Map<number, number>();
              for (const g of m.games) {
                if (g.winnerId) vunnet.set(g.winnerId, (vunnet.get(g.winnerId) ?? 0) + 1);
              }
              const poeng = stillinger(
                m.games.flatMap((g) =>
                  g.deals.map((d) => ({
                    scores: d.scores.map((s) => ({ playerId: s.playerId, points: s.points })),
                  })),
                ),
                deltakere,
              );
              const beste = [...vunnet.entries()].sort(
                (a, b) => b[1] - a[1] || (poeng[b[0]] ?? 0) - (poeng[a[0]] ?? 0),
              )[0];
              const vinnerId = beste?.[0] ?? null;
              const vinner = vinnerId
                ? m.players.find((p) => p.playerId === vinnerId)?.player.name
                : null;

              return (
                <li key={m.id}>
                  <Link
                    href={`/kveld/${m.id}`}
                    className="flex items-center gap-3 kort px-4 py-3 hover:bg-surface-2 transition"
                  >
                    <span className="text-ink-2 tabular-nums text-sm shrink-0 whitespace-nowrap">
                      {formatDato(m.date)}
                    </span>
                    {vinner && vinnerId != null ? (
                      <>
                        <span
                          aria-hidden
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: spillerFarge(vinnerId, alleIder) }}
                        />
                        <span className="font-medium truncate">{vinner}</span>
                        <span className="text-ink-2 text-sm ml-auto tabular-nums shrink-0">
                          {beste[1]} {beste[1] === 1 ? "runde" : "runder"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted text-sm">ingen fullførte runder</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
