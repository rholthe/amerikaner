"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  tittel: string;
  undertittel?: React.ReactNode;
  /** Bredden på storskjerm. På mobil er modalen alltid et ark fra bunnen. */
  bredde?: "smal" | "vanlig" | "bred";
  /** Av for valg som må tas – da lukker verken bakgrunnsklikk eller Escape. */
  kanLukkes?: boolean;
  onLukk: () => void;
  children: React.ReactNode;
}

/** Antall åpne modaler. Uten telleren ville den siste som lukkes kunne sette
 *  tilbake en «hidden» som en annen modal fortsatt trenger – eller motsatt. */
let åpne = 0;

const BREDDE = {
  smal: "sm:max-w-md",
  vanlig: "sm:max-w-2xl",
  bred: "sm:max-w-4xl",
} as const;

/**
 * Felles modal for begge skjermene. På mobil glir den opp fra bunnen som et
 * ark, på storskjerm står den midt i bildet – samme innhold, samme kode.
 */
export default function Modal({
  tittel,
  undertittel,
  bredde = "vanlig",
  kanLukkes = true,
  onLukk,
  children,
}: Props) {
  useEffect(() => {
    if (!kanLukkes) return;
    const ned = (e: KeyboardEvent) => {
      if (e.key === "Escape") onLukk();
    };
    window.addEventListener("keydown", ned);
    return () => window.removeEventListener("keydown", ned);
  }, [kanLukkes, onLukk]);

  useEffect(() => {
    åpne += 1;
    document.body.style.overflow = "hidden";
    return () => {
      åpne -= 1;
      if (åpne === 0) document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 sm:p-6"
      onClick={kanLukkes ? onLukk : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={tittel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glid-opp sm:stigning w-full ${BREDDE[bredde]} max-h-[92dvh] flex flex-col
          bg-surface border border-line rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/60`}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">{tittel}</h2>
            {undertittel && <p className="text-sm text-ink-2 mt-0.5">{undertittel}</p>}
          </div>
          {kanLukkes && (
            <button
              onClick={onLukk}
              aria-label="Lukk"
              className="shrink-0 -mr-1 -mt-1 w-11 h-11 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-surface-2"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <div className="overflow-y-auto px-5 py-5 trygg-bunn">{children}</div>
      </div>
    </div>
  );
}
