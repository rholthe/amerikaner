"use client";

import { useEffect } from "react";

/**
 * Holder skjermen våken mens en kveld er aktiv, og ber om låsen på nytt når
 * fanen blir synlig igjen (nettleseren slipper den ved bytte av fane).
 * En skjerm som sovner midt i runden er den mest forutsigbare irritasjonen
 * i hele oppsettet.
 */
export function useWakeLock(aktiv: boolean) {
  useEffect(() => {
    if (!aktiv) return;

    let lås: { release: () => Promise<void> } | null = null;

    async function be() {
      try {
        const wl = (navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        if (wl) lås = await wl.request("screen");
      } catch {
        // Nektet, ikke støttet, eller siden er skjult. Ingen grunn til å mase.
      }
    }

    be();
    const påSynlig = () => {
      if (document.visibilityState === "visible") be();
    };
    document.addEventListener("visibilitychange", påSynlig);

    return () => {
      document.removeEventListener("visibilitychange", påSynlig);
      lås?.release().catch(() => {});
    };
  }, [aktiv]);
}
