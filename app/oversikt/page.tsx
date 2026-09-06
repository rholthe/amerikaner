import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { formatKort } from "@/lib/dates";
import { hentOversikt } from "@/lib/oversikt";
import { hentSesonger } from "@/lib/sesong";
import { spillerFarge } from "@/lib/palette";
import Linjediagram, { type Serie } from "@/components/Linjediagram";

export const dynamic = "force-dynamic";
export const metadata = { title: "Oversikt · Amerikaner" };

/** Flere enn dette blir et fargekaos; tabellen under har alle uansett. */
const MAKS_LINJER = 6;

export default async function OversiktSide({
  searchParams,
}: {
  searchParams: Promise<{ sesong?: string }>;
}) {
  const valgt = (await searchParams).sesong ?? "";
  const sesonger = await hentSesonger();

  const sesongId =
    valgt === "alle" ? null : Number(valgt) || sesonger.find((s) => s.isActive)?.id || null;
  const aktivSesong = sesonger.find((s) => s.id === sesongId) ?? null;

  const oversikt = await hentOversikt(sesongId);

  const alleIder = oversikt.spillere.map((s) => s.id);
  const merkelapper = oversikt.kvelder.map((k) => formatKort(k.date));

  // Bare de som faktisk har spilt nok til å bære en linje – resten står i tabellen.
  const rangert = [...oversikt.spillere].sort(
    (a, b) =>
      (oversikt.totaltRunder[b.id] ?? 0) - (oversikt.totaltRunder[a.id] ?? 0) ||
      (oversikt.totaltPoeng[b.id] ?? 0) - (oversikt.totaltPoeng[a.id] ?? 0),
  );
  const iKurven = rangert.slice(0, MAKS_LINJER);

  const akkumulert: Serie[] = iKurven.map((s) => {
    let sum = 0;
    return {
      id: s.id,
      navn: s.name,
      farge: spillerFarge(s.id, alleIder),
      verdier: oversikt.kvelder.map((k) => {
        sum += k.runderVunnet[s.id] ?? 0;
        return sum;
      }),
    };
  });

  const form: Serie[] = iKurven.map((s) => ({
    id: s.id,
    navn: s.name,
    farge: spillerFarge(s.id, alleIder),
    verdier: oversikt.kvelder.map((k) =>
      k.deltakere.includes(s.id) ? (k.poeng[s.id] ?? 0) : null,
    ),
  }));

  const lenke = (id: string) => `/oversikt?sesong=${id}`;
  const gjeldende = sesongId === null ? "alle" : String(sesongId);

  return (
    <main className="min-h-dvh p-5 sm:p-8 max-w-4xl mx-auto">
      <header className="flex items-center gap-3 mb-2">
        <Link href="/" className="text-ink-2 hover:text-ink" aria-label="Tilbake">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-2xl font-semibold">Oversikt</h1>
      </header>
      <p className="text-sm text-ink-2 mb-6">
        Kveld for kveld gjennom sesongen – hvem som drar fra, og hvem som har formen.
      </p>

      {/* Én filterrad over alt den gjelder for, ikke ett filter per diagram. */}
      <div className="flex flex-wrap gap-2 mb-8">
        {sesonger.map((s) => (
          <Link
            key={s.id}
            href={lenke(String(s.id))}
            className="brikke text-sm"
            data-aktiv={gjeldende === String(s.id)}
            style={gjeldende === String(s.id) ? { background: "var(--gold)" } : undefined}
          >
            {s.name}
          </Link>
        ))}
        <Link
          href={lenke("alle")}
          className="brikke text-sm"
          data-aktiv={gjeldende === "alle"}
          style={gjeldende === "alle" ? { background: "var(--gold)" } : undefined}
        >
          Gjennom tidene
        </Link>
      </div>

      {oversikt.kvelder.length === 0 ? (
        <p className="text-ink-2">
          Ingen kvelder {aktivSesong ? `i ${aktivSesong.name}` : "registrert"} enda.
        </p>
      ) : (
        <>
          <div className="grid gap-4 mb-4">
            <Linjediagram
              tittel="Vunne runder gjennom sesongen"
              forklaring="Akkumulert. Den øverste linja leder."
              merkelapper={merkelapper}
              serier={akkumulert}
            />
            <Linjediagram
              tittel="Formkurve"
              forklaring="Poeng per kveld. Brudd i linja betyr at man ikke var med."
              merkelapper={merkelapper}
              serier={form}
              visNull
            />
          </div>

          {rangert.length > MAKS_LINJER && (
            <p className="text-xs text-muted mb-8">
              Kurvene viser de {MAKS_LINJER} med flest vunne runder. Alle står i
              tabellen under.
            </p>
          )}

          <section>
            <h2 className="merkelapp mb-3">Kveld for kveld</h2>
            <p className="text-xs text-muted mb-3">
              Poeng den kvelden, med antall vunne runder i parentes.
            </p>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm border-separate border-spacing-y-1.5">
                <thead>
                  <tr>
                    <th scope="col" className="text-left merkelapp pr-3 whitespace-nowrap">
                      Kveld
                    </th>
                    {oversikt.spillere.map((s) => (
                      <th
                        key={s.id}
                        scope="col"
                        className="px-2 text-right merkelapp whitespace-nowrap"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="w-2 h-2 rounded-full"
                            style={{ background: spillerFarge(s.id, alleIder) }}
                          />
                          {s.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...oversikt.kvelder].reverse().map((k) => (
                    <tr key={k.id}>
                      <th scope="row" className="text-left font-normal pr-3">
                        <Link
                          href={`/kveld/${k.id}`}
                          className="text-ink-2 hover:text-gold whitespace-nowrap tabular-nums"
                        >
                          {formatKort(k.date)}
                        </Link>
                      </th>
                      {oversikt.spillere.map((s) => {
                        const med = k.deltakere.includes(s.id);
                        const seire = k.runderVunnet[s.id] ?? 0;
                        return (
                          <td
                            key={s.id}
                            className={`px-2 py-2 text-right tabular-nums rounded-lg ${
                              med ? "bg-surface" : "text-muted/40"
                            }`}
                          >
                            {med ? (
                              <>
                                <span className={(k.poeng[s.id] ?? 0) < 0 ? "text-bad" : ""}>
                                  {k.poeng[s.id] ?? 0}
                                </span>
                                {seire > 0 && (
                                  <span className="text-gold ml-1" title={`${seire} runder`}>
                                    ({seire})
                                  </span>
                                )}
                              </>
                            ) : (
                              "–"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="text-left pr-3 pt-2">
                      <span className="flex items-center gap-1.5 text-gold text-xs font-semibold">
                        <Trophy size={13} /> I alt
                      </span>
                    </th>
                    {oversikt.spillere.map((s) => (
                      <td key={s.id} className="px-2 pt-2 text-right tabular-nums font-semibold">
                        {oversikt.totaltPoeng[s.id] ?? 0}
                        <span className="text-gold ml-1">({oversikt.totaltRunder[s.id] ?? 0})</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
