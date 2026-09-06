"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, LogOut, Monitor, Smartphone, Users } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/api";
import { formatDato } from "@/lib/dates";
import type { KveldDto } from "@/lib/typer";

interface Props {
  kveld: KveldDto | null;
  /** Hvilken skjerm menyen står på – den andre tilbys som lenke. */
  denne: "storskjerm" | "mobil";
  onAvsluttKveld: () => Promise<void>;
  onLukk: () => void;
}

const RAD =
  "flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl bg-surface-2 border border-line hover:border-line-sterk transition";

export default function KveldMeny({ kveld, denne, onAvsluttKveld, onLukk }: Props) {
  const [bekrefter, setBekrefter] = useState(false);
  const [jobber, setJobber] = useState(false);

  return (
    <Modal
      tittel="Kvelden"
      undertittel={
        kveld
          ? `${formatDato(kveld.date)}${kveld.place ? ` · ${kveld.place}` : ""} · ${kveld.spillere
              .map((s) => s.name)
              .join(", ")}`
          : "Ingen kveld i gang"
      }
      bredde="smal"
      onLukk={onLukk}
    >
      <div className="space-y-2">
        {denne === "mobil" ? (
          <Link href="/kveld" className={RAD}>
            <Monitor size={18} className="text-gold" />
            <span>
              Storskjerm
              <span className="block text-xs text-muted">Tavla til TV-en</span>
            </span>
          </Link>
        ) : (
          <Link href="/registrer" className={RAD}>
            <Smartphone size={18} className="text-gold" />
            <span>
              Mobilvisning
              <span className="block text-xs text-muted">Registrering ved bordet</span>
            </span>
          </Link>
        )}

        <Link href="/spillere" className={RAD}>
          <Users size={18} className="text-ink-2" />
          <span>
            Spillere
            <span className="block text-xs text-muted">Legg til, gi nytt navn, sett inaktiv</span>
          </span>
        </Link>

        <Link href="/" className={RAD}>
          <Home size={18} className="text-ink-2" />
          <span>Forsiden</span>
        </Link>

        <button
          onClick={async () => {
            await api.delete("/api/pin");
            // Hard navigasjon: den slettede cookien må være borte i den
            // forespørselen middleware ser på.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/";
          }}
          className={RAD}
        >
          <LogOut size={18} className="text-ink-2" />
          <span>Logg ut</span>
        </button>
      </div>

      {kveld && (
        <div className="mt-6 pt-5 border-t border-line">
          {bekrefter ? (
            <>
              <p className="text-sm text-ink-2 mb-3">
                Kvelden lukkes og legges i historikken. Påbegynte runder uten giv
                forsvinner; alt som er registrert blir stående.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setJobber(true);
                    try {
                      await onAvsluttKveld();
                      onLukk();
                    } finally {
                      setJobber(false);
                    }
                  }}
                  disabled={jobber}
                  className="knapp-gull flex-1"
                  style={{ background: "var(--bad)", color: "#000" }}
                >
                  {jobber ? "Avslutter…" : "Ja, avslutt kvelden"}
                </button>
                <button onClick={() => setBekrefter(false)} className="knapp-stille">
                  Avbryt
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setBekrefter(true)}
              className="knapp-stille w-full text-bad border-bad/40"
            >
              Avslutt kvelden
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
