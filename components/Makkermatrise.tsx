import { spillerFarge, spillerTekstFarge } from "@/lib/palette";

export interface MatriseRad {
  /** Nøkkel «melderId:makkerId» → hvor mange ganger, og hvor mange som holdt. */
  nøkkel: string;
  ganger: number;
  klart: number;
}

interface Props {
  spillere: { id: number; name: string }[];
  alleIder: number[];
  par: MatriseRad[];
  /** Uthev én spillers rad og kolonne – brukt på spillerprofilen. */
  fremhevId?: number;
}

/**
 * Hvem roper hvem, og hvordan går det. Matrise og ikke liste, fordi retningen
 * betyr noe: å rope noen er et valg, å bli ropt er det ikke. Og de tomme
 * rutene er halve poenget – hvem man *ikke* roper er like avslørende.
 */
export default function Makkermatrise({ spillere, alleIder, par, fremhevId }: Props) {
  const kart = new Map(par.map((p) => [p.nøkkel, p]));
  const harData = par.some((p) => p.ganger > 0);

  if (spillere.length < 2 || !harData) {
    return (
      <p className="text-muted text-sm py-2">
        Matrisen tegner seg så snart det er registrert giv med både melder og makker.
      </p>
    );
  }

  const kort = (navn: string) => (navn.length > 4 ? navn.slice(0, 3) : navn);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-bg z-10 text-left pr-2">
              <span className="merkelapp">melder ↓ / makker →</span>
            </th>
            {spillere.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="px-2 py-1 font-semibold text-center min-w-14"
                style={{ color: spillerTekstFarge(s.id, alleIder) }}
                title={s.name}
              >
                {kort(s.name)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {spillere.map((melder) => (
            <tr key={melder.id}>
              <th
                scope="row"
                className="sticky left-0 bg-bg z-10 text-left pr-3 font-semibold whitespace-nowrap"
                style={{ color: spillerTekstFarge(melder.id, alleIder) }}
              >
                {melder.name}
              </th>

              {spillere.map((makker) => {
                if (melder.id === makker.id) {
                  return (
                    <td key={makker.id} className="text-center text-muted/40 rounded-lg bg-surface/40">
                      ·
                    </td>
                  );
                }

                const rad = kart.get(`${melder.id}:${makker.id}`);
                const gjelder =
                  fremhevId === undefined ||
                  melder.id === fremhevId ||
                  makker.id === fremhevId;

                if (!rad || rad.ganger === 0) {
                  return (
                    <td
                      key={makker.id}
                      className={`text-center rounded-lg bg-surface ${gjelder ? "text-muted" : "text-muted/30"}`}
                    >
                      –
                    </td>
                  );
                }

                // Fargen er andelen som holdt, ikke hvem som meldte: sterkere
                // grønt jo oftere paret kom i mål.
                const andel = rad.klart / rad.ganger;
                return (
                  <td
                    key={makker.id}
                    className={`text-center rounded-lg px-2 py-1.5 tabular-nums whitespace-nowrap ${
                      gjelder ? "" : "opacity-30"
                    }`}
                    style={{
                      background: `color-mix(in srgb, var(--good) ${Math.round(andel * 34)}%, var(--surface-2))`,
                      borderLeft: `3px solid ${spillerFarge(melder.id, alleIder)}`,
                    }}
                    title={`${melder.name} ropte ${makker.name} ${rad.ganger} ${
                      rad.ganger === 1 ? "gang" : "ganger"
                    }, ${rad.klart} klart`}
                  >
                    <span className="font-semibold">{rad.klart}</span>
                    <span className="text-muted">/{rad.ganger}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-muted mt-2">
        Tallet er <b>klart av ganger ropt</b>. Raden er den som meldte, kolonnen
        den som ble ropt – og de tomme rutene sier like mye som de fylte.
      </p>
    </div>
  );
}
