import { NextRequest, NextResponse } from "next/server";
import { hashPin, PIN_COOKIE } from "@/lib/pinHash";

// Next.js 16 legger middleware i proxy.ts i rotmappen, ikke middleware.ts.
export async function proxy(request: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) {
    console.error("FEIL: APP_PIN er ikke satt. Sett APP_PIN i .env.");
    return new NextResponse("Serverkonfigurasjonsfeil: APP_PIN mangler", { status: 500 });
  }

  const { pathname } = request.nextUrl;

  const cookie = request.cookies.get(PIN_COOKIE);
  if (cookie?.value === (await hashPin(pin))) {
    return NextResponse.next();
  }

  // API-kall får 401 i stedet for en redirect til PIN-siden – en klient som
  // poller skal ikke få HTML tilbake der den venter JSON.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/pin";
  url.searchParams.set("neste", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/kveld/:path*",
    "/registrer/:path*",
    "/spillere",
    "/sesonger/:path*",
    "/api/kveld/:path*",
    "/api/runde/:path*",
    "/api/spillere/:path*",
    "/api/sesonger/:path*",
  ],
};
