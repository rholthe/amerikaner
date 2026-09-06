// Datoer lagres som naiv veggklokketid i UTC-feltet: en kveld kl. 19:00 norsk
// tid lagres som 19:00Z. Da gir DATE() i SQL, toISOString().slice(0,10) og
// visning alltid samme kalenderdag uavhengig av server- og klienttidssone.
// Samme konvensjon som pokergutta. Alle visnings-kall må ha timeZone: "UTC".

export function veggklokkeSomUtc(d: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ),
  );
}

export function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatKort(d: Date | string): string {
  return new Date(d).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatKlokke(d: Date | string): string {
  return new Date(d).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
