"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import { api, hentJson } from "@/lib/api";
import { avgjørRunde, stillinger } from "@/lib/scoring";
import type { AktivKveldSvar, GivDto, KveldDto } from "@/lib/typer";
import type { GivBody } from "@/lib/givInput";

/**
 * All tilstand og alle skrivekall for en pågående kveld, delt av storskjermen
 * og mobilen. De to sidene skal se nøyaktig det samme – forskjellen er hvordan
 * det tegnes, aldri hva som er sant.
 */
export function useKveld() {
  const { data, mutate, isLoading } = useSWR<AktivKveldSvar>(
    "/api/kveld/aktiv",
    hentJson,
    { refreshInterval: 3000 },
  );

  const [feil, setFeil] = useState<string | null>(null);
  // «Spill videre» gjelder bare fram til neste giv – da spør vi igjen.
  const [avvistVed, setAvvistVed] = useState<number | null>(null);

  const kveld = data?.kveld ?? null;
  const spillere = useMemo(() => data?.spillere ?? [], [data]);

  const skriv = useCallback(
    async (fn: () => Promise<KveldDto>) => {
      setFeil(null);
      try {
        const ny = await fn();
        await mutate({ kveld: ny, spillere }, { revalidate: false });
        return ny;
      } catch (e) {
        setFeil(e instanceof Error ? e.message : "Noe gikk galt");
        throw e;
      }
    },
    [mutate, spillere],
  );

  const alleIder = useMemo(() => spillere.map((s) => s.id), [spillere]);
  const deltakere = useMemo(() => kveld?.spillere.map((s) => s.id) ?? [], [kveld]);

  const runde = useMemo(
    () => kveld?.runder.find((r) => !r.isFinished) ?? kveld?.runder.at(-1) ?? null,
    [kveld],
  );

  const status = useMemo(
    () =>
      runde
        ? avgjørRunde(runde.giv.map((g) => ({ scores: g.scores })), deltakere, runde.targetScore)
        : null,
    [runde, deltakere],
  );

  const runderVunnet = useMemo(() => {
    const ut: Record<number, number> = {};
    for (const r of kveld?.runder ?? []) {
      if (r.winnerId) ut[r.winnerId] = (ut[r.winnerId] ?? 0) + 1;
    }
    return ut;
  }, [kveld]);

  /** Runden har nådd 52 og er ikke avgjort. Sant til noen bekrefter eller utsetter. */
  const iMål = Boolean(
    runde && status?.kanAvsluttes && !runde.isFinished && status.forslagVinnerId != null,
  );
  const spørOmVinner = iMål && avvistVed !== (runde?.giv.length ?? -1);

  const navn = useCallback(
    (id: number) => kveld?.spillere.find((s) => s.id === id)?.name ?? "?",
    [kveld],
  );

  /** Stillingen uten en bestemt giv – brukes når en giv rettes, slik at
   *  konsekvensforhåndsvisningen ikke teller den gamle versjonen med. */
  const stillingUten = useCallback(
    (givId: number | null) => {
      if (!runde) return {};
      const giv = givId == null ? runde.giv : runde.giv.filter((g) => g.id !== givId);
      return stillinger(giv.map((g) => ({ scores: g.scores })), deltakere);
    },
    [runde, deltakere],
  );

  // ── Handlinger ──────────────────────────────────────────────────────────

  const startKveld = (playerIds: number[], place: string) =>
    skriv(() => api.post<KveldDto>("/api/kveld", { playerIds, place }));

  const lagreGiv = async (body: GivBody) => {
    if (!runde) return;
    await skriv(() => api.post<KveldDto>(`/api/runde/${runde.id}/giv`, body));
    setAvvistVed(null);
  };

  const rettGiv = async (giv: GivDto, body: GivBody) => {
    if (!runde) return;
    await skriv(() => api.put<KveldDto>(`/api/runde/${runde.id}/giv/${giv.dealNo}`, body));
    setAvvistVed(null);
  };

  const slettGiv = async (giv: GivDto) => {
    if (!runde) return;
    await skriv(() => api.delete<KveldDto>(`/api/runde/${runde.id}/giv/${giv.dealNo}`));
  };

  const juster = async (playerId: number, nySum: number, note: string) => {
    if (!runde) return;
    await skriv(() =>
      api.post<KveldDto>(`/api/runde/${runde.id}/juster`, { playerId, nySum, note }),
    );
    setAvvistVed(null);
  };

  const avsluttRunde = async (winnerId: number) => {
    if (!runde) return;
    await skriv(() => api.post<KveldDto>(`/api/runde/${runde.id}/avslutt`, { winnerId }));
    setAvvistVed(null);
  };

  const avsluttKveld = async () => {
    if (!kveld) return;
    await skriv(() => api.post<KveldDto>(`/api/kveld/${kveld.id}/avslutt`));
  };

  return {
    isLoading,
    /** Hent kvelden på nytt. Brukes etter sletting, der svaret ikke er en KveldDto. */
    oppdater: async () => {
      await mutate();
    },
    feil,
    setFeil,
    data,
    kveld,
    spillere,
    alleIder,
    deltakere,
    runde,
    status,
    runderVunnet,
    iMål,
    spørOmVinner,
    utsettAvslutning: () => setAvvistVed(runde?.giv.length ?? 0),
    gjenåpneAvslutning: () => setAvvistVed(null),
    navn,
    stillingUten,
    startKveld,
    lagreGiv,
    rettGiv,
    slettGiv,
    juster,
    avsluttRunde,
    avsluttKveld,
  };
}

export type KveldTilstand = ReturnType<typeof useKveld>;
