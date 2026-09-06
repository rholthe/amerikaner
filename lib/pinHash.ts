// Edge-trygg (Web Crypto) – brukes både av proxy.ts (middleware) og PIN-APIet.
// Cookien inneholder SHA-256-hashen av PIN-en, aldri PIN-en i klartekst.
export const PIN_COOKIE = "amerikaner_auth";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`amerikaner:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
