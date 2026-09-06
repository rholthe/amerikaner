"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function PinSkjema({ neste }: { neste: string }) {
  const [pin, setPin] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [jobber, setJobber] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setJobber(true);
    setFeil(null);
    try {
      await api.post("/api/pin", { pin });
      // Hard navigasjon, ikke router.push – den nye cookien må være med i
      // forespørselen middleware ser på.
      window.location.href = neste;
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Innlogging feilet");
      setPin("");
      setJobber(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <div className="text-6xl mb-2 text-gold">♠</div>
        <h1 className="text-2xl font-semibold mb-8">Amerikaner</h1>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="w-full text-center text-2xl tracking-[0.4em] bg-surface-2 border border-line rounded-xl px-4 py-4 outline-none focus:border-gold"
        />

        {feil && <p className="mt-4 text-bad text-sm">{feil}</p>}

        <button
          type="submit"
          disabled={jobber || pin === ""}
          className="mt-6 w-full bg-gold text-black font-semibold rounded-xl py-4 disabled:opacity-40"
        >
          {jobber ? "Sjekker…" : "Logg inn"}
        </button>
      </form>
    </main>
  );
}
