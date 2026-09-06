# Amerikaner – poeng og statistikk for kortspillet amerikaner

Webapp som holder orden på spillerregistrering, poengscoring og statistikk for
kortspillet **amerikaner**. Bygget for å stå på en **stor skjerm** under
spillekvelden, med en talestyrt assistent («James») som fører protokollen mens
gutta spiller – alt han foreslår må bekreftes med ett trykk før det lagres.

Produksjon: **https://am.pokergutta.no** (Docker på `ragnar@lilletorget.org`,
bak Caddy i `~/reverse-proxy/Caddyfile`).
Søsterapper på samme server: `~/apps/pokergutta` (Next.js/Prisma-mønsteret),
`~/apps/idiot` (statistikk-mønsteret), `~/apps/legeassist` (Soniox + Bedrock).

## Status per 6. september 2026

**Fase 1 er ferdig og i drift, og er bygget om etter første spillekveld.** Appen
kan brukes på en spillekveld nå: start kveld, registrer giv manuelt, følg
stillingen mot 52, bekreft vunnet runde, rett opp det som ble feil. DNS, Caddy,
HTTPS, deploy-script og daglig backup står.

Etter prøvekvelden 5. september ble to ting rettet og én ting delt i to:

- **Runden ble ikke avsluttet.** Spørsmålet «hvem vant runden?» sto som et kort
  i en sidekolonne, og var ikke til å forstå som noe som *måtte* besvares for at
  runden skulle lagres. Det er nå en modal midt i bildet, med en knapp som sier
  hva den gjør: «Ragnar vant · lagre og start runde 2». Utsetter man den, blir
  det stående en gul stripe øverst til runden faktisk er avgjort.
- **`/kveld/[id]` krasjet** («this page couldn't load»). `beskrivGiv()` lå i en
  `"use client"`-modul og ble importert av en server-komponent; da får serveren
  en klientreferanse i stedet for funksjonen, og rendringen kaster i det den
  kalles. Funksjonen ligger nå i `lib/givTekst.ts`. **Regel: ingen ren funksjon
  som en serverside trenger, skal bo i en komponentfil.**
- **Én skjerm ble til to**, se `/kveld` og `/registrer` under.

Fase 2 (sesonger, grafer og CSV) og fase 3 (James) er **ikke påbegynt**, men
kåringene i `lib/stats.ts` er skrevet, testet mot ekte data og i bruk fire
steder – de trenger bare et sesongfilter for å dekke fase 2.

Koden ligger på **`git@github.com:rholthe/amerikaner.git`**, gren `main`.
Serveren er en ren kopi av GitHub – man redigerer aldri filer der.

---

## 1. Spillet

Amerikaner er et stikkspill med melding. Høyeste byder velger trumf og roper
en makker (via et kort); melderen og makkeren må sammen ta minst så mange stikk
som meldingen.

**Antall spillere varierer: 3–6, oftest 4.** Antall stikk følger av hvor mange
som sitter ved bordet (4 spillere = 13 stikk med hele kortstokken, 5 spillere =
11 stikk med 3 jokere lagt til, osv.). Appen hardkoder derfor **aldri** 13
stikk noe sted – antall deltakere leses fra kvelden, og antall stikk er et
valgfritt felt på given.

### Tre nivåer: kveld → runde → giv

Dette er den viktigste strukturen i hele appen, og ordene brukes konsekvent slik
i kode, UI og prompt:

| Nivå | Betyr | Slutter når |
|---|---|---|
| **Kveld** | Én spilleøkt rundt bordet | Gutta går hjem |
| **Runde** | Ett helt spill, **til 52 poeng** | Noen når 52 |
| **Giv** | Én utdeling: melding, makker, stikk, poeng | Alle stikk er tatt |

En kveld inneholder et varierende antall runder, og en runde et varierende
antall giv. Poeng akkumuleres innenfor runden og nullstilles når en ny runde
begynner – **runden vinnes ved 52 poeng, av den med flest poeng.** Passerer to
spillere 52 i samme giv, vinner den høyeste.

**Tvungne giv.** Av og til spilles en runde der alle spillerne etter tur *må*
klare en melding som er bestemt på forhånd. Med 4 spillere er den **9**. Tallene
for de andre spillerantallene er skalert i samme forhold som stikkene:

| Spillere | Kort | Stikk | Tvungen melding |
|---|---|---|---|
| 3 | 52 + 2 jokere | 18 | 12 |
| 4 | 52 | 13 | **9** |
| 5 | 52 + 3 jokere | 11 | 8 |
| 6 | 52 + 2 jokere | 9 | 6 |

Stikktallene følger av «legg til færrest mulig jokere så kortstokken går opp i
spillerantallet», som reproduserer begge tallene appen allerede kjente (13 ved 4
og 11 ved 5). 9 av 13 er 69 % av stikkene, og samme andel gir resten. Dette er
en **husregel, ikke en spilleregel** – meldingen kan alltid endres i skjemaet,
og skal et annet tall gjelde fast, er det `TVUNGEN_MELDING` i `lib/scoring.ts`
som endres.

Poengene er de vanlige: en tvungen giv gir og koster nøyaktig som en frivillig.
Forskjellen lagres (`Deal.isForced`) fordi den skiller det man våget fra det man
måtte – snittmeldingen teller derfor bare frivillige meldinger.

**Sier alle pass, stokkes det på nytt.** Ingen får poeng. Slike giv trenger ikke
registreres, men kan det (`kind = "pass"`) – da får vi vite hvor ofte det skjer,
og givnummereringen stemmer med det som faktisk ble delt ut.

**Poeng per giv:**

| Situasjon | Poeng |
|---|---|
| Melder + makker klarer meldingen | begge får `+melding` |
| Melder + makker går bet | begge får `−melding` |
| Motspillere | `+1` per stikk de tar |
| «Amerikaner» (alle stikk alene) klart | `+52` |
| «Amerikaner» bet | `−52` |

**Amerikaner er 52 poeng uansett hvor mange som spiller** – altså nøyaktig
rundens målsum. En klart amerikaner vinner runden på flekken, fra hvilken som
helst stilling. Det er ikke en tilfeldighet i reglene, og appen skal vise det
som det det er: storskjermen markerer runden som vunnet i samme øyeblikk givet
bekreftes.

Eksempelet fra oppdraget – *«første fikk Sondre +9 poeng, Morten +9 poeng,
Haakon 3 poeng og Ragnar ingen poeng»* – er altså **første giv** i en runde:
Sondre meldte 9, ropte Morten som makker, laget tok minst 9 stikk, og Haakon tok
3 av de resterende.

Appen **lagrer poeng eksplisitt per spiller per giv** (se datamodellen).
Regelendringer skriver derfor aldri om historikken, og validering av poengsummer
er en advarsel, aldri en sperre – summen ser ulik ut ved 3 og ved 6 spillere.

---

## 2. Arkitektur

Samme stack som `pokergutta`, fordi delene vi trenger allerede finnes der og i
`legeassist` og kan kopieres nesten uendret:

- **Next.js 16** (App Router), TypeScript, **Node 22** (Prisma 7 krever det).
  Middleware i `proxy.ts` i rotmappen (Next 16-konvensjon, *ikke*
  `middleware.ts`).
- **Tailwind CSS 4**, mørkt tema med gull-aksent som pokergutta. Ingen
  komponentbibliotek – fargene er tokens i `app/globals.css`, resten er vanlige
  utility-klasser. Ikoner fra `lucide-react`.
- **Prisma 7 + SQLite** via `@prisma/adapter-libsql`. Databasen ligger i
  `data/amerikaner.db`, og `data/` er bind-montert – katalog og ikke enkeltfil,
  fordi SQLite legger `-wal` og `-shm` ved siden av basen. Kjør
  `npx prisma db push && npx prisma generate` sammen etter enhver
  skjemaendring.
- **SWR-polling (3 s)** for live-synk mellom storskjerm og mobiler.
- **Recharts 3** for grafer, **lucide-react** for ikoner.
- **Soniox** (`@soniox/speech-to-text-web`) for sanntidstranskripsjon.
- **Claude via AWS Bedrock** (`@anthropic-ai/bedrock-sdk`) for tolkning av tale
  til handlinger.
- **PWA** via `app/manifest.ts`, ingen service worker (live-synk – cache ville
  gitt gammel data).

Hvorfor ikke `idiot`-mønsteret (Svelte + PHP/SQLite)? Det er lettere og raskere,
men både Soniox' token-flyt og Bedrock-signering måtte da skrives på nytt i PHP.
Med Next.js gjenbrukes `legeassist/src/app/api/soniox-token/route.ts` og
`legeassist/src/app/api/claude/route.ts` nesten linje for linje.

---

## 3. Datamodell (Prisma)

```
Season       id, name, startDate, endDate, isActive
Player       id, name, nickname?, isActive, createdAt
Match        id, date, place?, seasonId?, isFinished, createdAt   // kveld
MatchPlayer  matchId, playerId, seatOrder                          // hvem møtte opp
Game         id, matchId, gameNo, targetScore(52), winnerId?, isFinished
Deal         id, gameId, dealNo, kind, bidderId?, partnerId?, bid?, trump?,
             tricksWon?, trickCount?, isAmerikaner, isForced, madeIt?, note?,
             source
DealScore    dealId, playerId, points, tricks?, role
Utterance    id, matchId?, gameId?, transcript, actionsJson, model,
             status(pending|confirmed|rejected|edited), createdAt
```

**Sannhetskilde er `DealScore.points`.** `Deal`-metadataene (melding, makker,
trumf, stikk) registreres alltid når de er kjent, og driver meldingsstatistikken
og makkersynergien – men de er nullbare. Får James bare med seg poengene, lagres
given likevel, og all poengbasert statistikk virker som normal.

`Deal.kind` er `"melding"` (vanlig giv), `"pass"` (alle passet, stokket om –
ingen `DealScore`-rader) eller `"justering"` (se under).

`Deal.madeIt` er utledet, ikke innskrevet: melder og makker klarte meldingen
hvis deres `DealScore.points` er positive. Feltet lagres fordi statistikken
spør etter det konstant, og fordi en giv kan være registrert med poeng uten
melding.

`Deal.source` er `"james"` eller `"manuell"`, så vi kan måle hvor godt
assistenten treffer.

**Stillingen lagres aldri – den summeres.** Løpende poeng i en runde er
`SUM(points)` over givene. Å lagre delsummer ville betydd to sannheter som kom i
utakt ved første korreksjon, og korreksjoner er nettopp det en taleassistent
produserer.

**Korreksjoner er egne rader, ikke overskriving.** Stemmer ikke stillingen –
fordi et giv ble hoppet over, eller fordi James hørte feil på et tall ingen
oppdaget – skriver man den riktige summen inn i UI-et, og appen lagrer
differansen som en `Deal` med `kind = "justering"` og en `note`. Alternativet,
å la brukeren overskrive et beregnet tall, ville ha brutt summeringen som eneste
sannhet. Slik står korrigeringen synlig i rundehistorikken, den kan angres, og
statistikken kan holde justeringer utenfor når den regner meldingsprosent.
Enkeltgiv kan naturligvis også rettes direkte når man vet hvilken det gjelder.

**`Game.winnerId` settes ved manuell bekreftelse, ikke automatisk.** Se
storskjermen under.

**Deltakelse per giv, ikke per kveld.** `MatchPlayer` sier hvem som møtte opp;
`DealScore` sier hvem som faktisk spilte den enkelte given. Slik håndteres både
at noen sitter over og at noen kommer eller går underveis, uten et eget
«sittingOut»-felt som uansett bare ville fungert for ett spillerantall.

**Spillere slettes aldri når de har spilt.** `DELETE /api/spillere/[id]` svarer
`409` hvis spilleren har rader i `DealScore` – da settes `isActive = false` i
stedet, og spilleren forsvinner fra nedtrekkslistene men blir stående i all
historikk og statistikk. Samme regel som i `idiot`. Spillere uten registrerte
giv kan slettes helt (typisk en feilstavet ny spiller James foreslo).

`Utterance` er logg over hva James hørte og foreslo. Nyttig for feilsøking og
for å forbedre promptet; kan tømmes fritt (se personvern).

---

## 4. Sider

| Rute | Side |
|---|---|
| `/` | Forside: inngang til begge skjermene, kåringer gjennom tidene, tidligere kvelder |
| `/registrer` | **Mobilvisning** – hovedveien inn med data (PIN-beskyttet) |
| `/kveld` | **Storskjermvisning** – tavle, giv og kåringer (PIN-beskyttet) |
| `/kveld/[id]` | Én spilt kveld: runder, giv og kveldens kåringer |
| `/sesong/[id]` | **Sesongside** – tabell, kåringer, alle kvelder og runder |
| `/sesonger` | Administrer sesonger (PIN-beskyttet) |
| `/oversikt` | Kveldshistorikk og CSV-eksport |
| `/oversikt?visning=graf` | Grafer: akkumulerte runder, formkurve, makkermatrise |
| `/sesong/[id]` | Sesongkåring – mester, pallen, kåringer |
| `/spillere/[id]` | Spillerprofil: karrieretall, rekorder, merker |
| `/spillere` | Administrer spillere (aktiv/inaktiv, nytt navn) |

**Sesonger fungerer som i pokergutta:** `Season` med start- og sluttdato,
`isActive` for inneværende, og en egen side per sesong. Sesongtabellen rangeres
på **antall vunne runder**, med totale poeng gjennom sesongen som
skillekriterium – runden er tross alt spillets naturlige seiersenhet, og en
kveld med mange korte runder skal ikke telle mindre enn en kveld med få lange.

**En sesong er et datointervall, og kveldene finner sesongen sin selv.**
`Match.seasonId` lagres, men regnes ut på nytt (`tildelKvelder()` i
`lib/sesong.ts`) hver gang en sesong opprettes eller får nye datoer: kvelder i
perioden knyttes til den, og kvelder som faller utenfor slippes fri igjen.
Alternativet – å knytte kvelden til «den aktive sesongen» én gang for alle –
ville betydd at en rettet sluttdato lot kvelder bli liggende i feil sesong, og
at kvelder spilt før sesongen ble opprettet aldri kom med. En kveld som blir
registrert mens en sesong dekker datoen, havner i den med det samme.

Sesonger skal ikke overlappe. Gjør de det, beholder den første sine kvelder –
`tildelKvelder()` tar bare kvelder som står uten sesong fra før.

### To skjermer, én sannhet

Etter prøvekvelden er registreringen og visningen skilt i to sider. Begge leser
den samme `/api/kveld/aktiv` hvert tredje sekund, deler all tilstand gjennom
`components/kveld/useKveld.ts`, og bruker de samme komponentene – forskjellen er
hvordan det tegnes, aldri hva som er sant. Man kan bytte mellom dem midt i en
kveld, og to personer kan sitte på hver sin uten at noe kommer i utakt.

#### Mobilen `/registrer` – hovedveien inn

Registrering er ikke en nødløsning for når James ikke hører; det er slik
poengene kommer inn. Derfor har mobilen sin egen side der skjemaet ligger åpent,
ikke bak et trykk.

- Fast topplinje: runde og givnummer, dato og sted, og en stillingsstripe som
  ruller vannrett – stillingen er synlig uansett hvilken fane man står i.
- Fire faner i bunnen, innenfor tommelens rekkevidde: **Ny giv** (skjemaet),
  **Stilling** (tavla, med retting), **Giv** (denne runden øverst, tidligere
  runder under) og **Tall** (kåringene).
- Alle trykkflater er minst 44 px høye (`.brikke` i `globals.css`).
- Retting av en giv skjer fra Giv-fanen: trykk på blyanten, så åpnes skjemaet i
  Ny giv-fanen ferdig utfylt, med en gul stripe som sier hvilken giv man retter.

#### Storskjermen `/kveld` – tavla

Layoutet er designet for en TV i stua, lest på 2–3 meters avstand. Skjemaet står
*ikke* framme; det åpnes i en modal med knappen «Registrer giv» (eller tasten
`n`), og er samme skjema som på mobilen. Det er her James senere skal legge
forslagskortene sine – uten at noe annet må skrives om.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ♠ AMERIKANER  6. sept · Hos Ragnar        Runde 1 [+ Registrer giv] ⋯│
│                                            giv 7                     │
├────────────────────────────────┬─────────────────────────────────────┤
│ STILLING I RUNDEN      MOT 52  │ GIV I RUNDE 1                       │
│ ● RAGNAR                    53 │  6  Ragnar meldte 10 ♠ med Morten   │
│   ████████████████████  i mål  │     Sondre +2 Morten +10 Ragnar +10 │
│ ● HAAKON                    40 │  5  Ragnar meldte 12 ♣ med Haakon   │
│   ███████████████░░░  12 igjen │     Sondre +1 Haakon +12 Ragnar +12 │
│ ● MORTEN                    14 │                                     │
│   █████░░░░░░░░░░░░  38 igjen  │ KÅRINGER            [I kveld][Alle] │
│ ● SONDRE                     8 │ ┌──────────┬──────────┬──────────┐  │
│   ███░░░░░░░░░░░░░░  44 igjen  │ │KLARTE    │GIKK BET  │MELDINGS% │  │
│                                │ │Ragnar  4 │Sondre  1 │Ragnar100%│  │
│ Trykk på et tall for å rette   │ └──────────┴──────────┴──────────┘  │
└────────────────────────────────┴─────────────────────────────────────┘
```

- Venstre: stillingen **i den pågående runden**, med søylene skalert mot 52 og
  ikke mot lederen – det er avstanden til 52 som avgjør spenningen, og en søyle
  som fyller seg mot en fast strek leses på tre meters avstand. Fargen følger
  spilleren, aldri rangeringen. Navn og tall skaleres med `clamp()` mot
  skjermbredden, så en 55-tommer bruker plassen.
- Under hvert navn: prikker for runder vunnet i kveld, og «12 igjen» / «i mål».
- Høyre: givene i runden, nyeste først, med retting og sletting. Beskrivelsen og
  poengene står på hver sin linje – på én linje er det beskrivelsen som ryker i
  det bordet blir fullt.
- Nederst til høyre: kåringene, som kan vises for kvelden eller gjennom tidene.

#### Felles for begge

- **Skjemaet viser konsekvensen før den inntreffer.** Under feltene står
  «Stillingen etter given» med alle summene, og passerer noen 52 sier den det
  rett ut: *«Ragnar passerer 52 – runden er i mål etter denne given.»* Det er
  der en feilregistrert melding blir oppdaget.
- **Poengene som lagres står alltid synlig**, og kan overstyres bak «Rett
  poeng». Det som lagres er sannheten.
- **Tvungen-knappen holder seg selv i gang.** Forvalget er *ikke* tvungen, men
  registrerer man en tvungen giv, står knappen på til alle rundt bordet har hatt
  sin – fire giv med fire spillere – og faller så tilbake til av. Skjemaet viser
  «Tvungen runde · giv 2 av 4 · alle skal melde 9». Tilstanden utledes av
  `tvungenStatus()` over givene som er lagret, ikke av en knapp som står på:
  slik overlever den både at siden lastes på nytt og at det er en annen telefon
  ved bordet som registrerer neste giv.
- **Runden vinnes ikke automatisk.** Passerer noen 52, kommer en modal midt i
  bildet: den høyeste er forhåndsvalgt, de andre står som alternativ, og knappen
  sier hva den gjør – «Ragnar vant · lagre og start runde 2». Først da settes
  `Game.winnerId`. Velger man «Ikke ferdig – spill videre», blir det stående en
  gul stripe øverst til runden faktisk er avgjort; den forsvinner ikke av seg
  selv. Grunnen er praktisk: den siste given er den som oftest er feilregistrert,
  og en runde som avslutter seg selv på feil grunnlag er langt mer irriterende å
  rydde opp i enn ett ekstra trykk.
- **Stillingen kan rettes direkte.** Trykk på et tall i tavla, skriv den riktige
  summen, og appen lagrer differansen som en justeringsgiv med notat. Man skal
  ikke måtte lete opp hvilken giv som ble feil for å få tavla til å stemme.
- **En runde kan slettes**, fra begge skjermene og fra `/kveld/[id]`. Det er
  det eneste i appen som fjerner registrerte poeng for godt, og derfor det
  eneste som ber om PIN-en på nytt selv om man allerede er logget inn:
  innloggingscookien varer et år, og en telefon som ligger på bordet skal ikke
  kunne slette kvelden ved et uhell. Er det den siste runden, slettes kvelden
  med – en kveld uten runder er ikke en tilstand noen skjerm skal måtte tegne,
  og den ville blitt liggende i historikken som en tom rad ingen kan fjerne.
  Resten av rundene renummereres, slik givene også gjør. Samme regel gjelder
  «Avslutt kvelden»: ble det aldri registrert en eneste giv, forsvinner kvelden
  i stedet for å legge seg i historikken som en tom rad.
- **Wake Lock** holder skjermen våken så lenge en kveld er aktiv.
- Menyen (`⋯`) har lenke til den andre skjermen, til spilleradministrasjon, og
  «Avslutt kvelden» bak en bekreftelse.

---

## 5. James – taleassistenten

### Flyt

1. Storskjermen holder én Soniox-WebSocket åpen mot romsmikrofonen
   (`stt-rt-v5`, `languageHints: ["no"]`, `enableEndpointDetection: true`).
2. Klienten samler final-tokens i en rullende buffer på ~60 sekunder.
3. En regex ser etter vekkeordet – `hei james` og de variantene Soniox
   faktisk produserer på norsk (`sjeims`, `jems`, `james`). Spillernavnene og
   «James» legges i `context.terms`, akkurat som legeassist gjør med medisinske
   termer – det er den enkeltendringen som hjelper mest på gjenkjenningen.
4. Ved treff: fang teksten fra vekkeordet til endpoint-deteksjon slår inn
   (maks 20 s), send til `POST /api/james`.
5. Serveren kaller Claude på Bedrock med **verktøybruk / strukturert utdata**,
   ikke fritekst. Kontekst som sendes med: alle kjente spillere, hvem som
   spiller i kveld, hvilken runde vi er på, og stillingen.
6. Svaret er en liste handlinger. Hver blir et forslagskort på skjermen.
7. Bekreftet kort → skrives til databasen i én transaksjon → alle enheter ser
   den nye stillingen ved neste poll.

### Handlingstyper

| Handling | Eksempelytring |
|---|---|
| `startMatch` | «Hei James, Sondre, Haakon, Ragnar og Morten spiller amerikaner i dag» (3–6 navn) |
| `newPlayer` | (utledes av `startMatch` når et navn ikke finnes fra før) |
| `startGame` | «Da tar vi en ny runde» |
| `registerDeal` | «Sondre meldte ni i spar og tok den med Morten, Haakon fikk tre» |
| `correctDeal` | «Rett giv fem, Haakon fikk fire ikke tre» |
| `correctStanding` | «Ragnar skal stå på 23» |
| `passedOut` | «Alle passet» |
| `endGame` | «Sondre tok den runden» |
| `endMatch` | «Da er vi ferdige for i kveld» |

Melding, makker og trumf hentes ut når de sies, men er valgfrie i skjemaet:
*«Sondre ni, Morten ni, Haakon tre»* gir en gyldig giv med tomme meldingsfelt.
Kravet om fullstendighet ville gjort assistenten ubrukelig i praksis – folk
snakker ikke i skjemaer.

`startGame` og `endGame` trenger sjelden å sies. Passerer noen 52, foreslår
James avslutning av runden av seg selv – men bekreftelsen er alltid et trykk.

Ukjente navn blir aldri opprettet automatisk – de kommer som et eget
`newPlayer`-kort som må bekreftes («Ny spiller: **Ståle**? Eller mente du
Sondre?»). Navnematching gjør fuzzy oppslag mot eksisterende spillere først.

### Maskinvare og mikrofon

Oppsettet er **én PC med mikrofon i enden av bordet**, som også driver skjermen.
Det gir tre konkrete krav i koden:

- **Eksplisitt mikrofonvalg.** En PC har gjerne flere lydinnganger, og Chrome
  velger sjelden den man trodde. Innstillingene har derfor en nedtrekksliste
  over `enumerateDevices()`, valget lagres i `localStorage`, og
  `audioConstraints: { deviceId: { exact: … } }` sendes til Soniox – samme
  mønster som `legeassist/src/hooks/use-mikrofon.ts`.
- **La nettleserens lydbehandling stå på.** På en mikrofon 1–3 meter unna
  hjelper automatisk forsterkning og støyreduksjon. (Legeassist slår dem
  *av*, men det gjelder lyd fra skjermdeling, ikke en rommikrofon – ikke kopier
  den innstillingen hit.)
- **Wake Lock.** `navigator.wakeLock.request("screen")` mens en kveld er aktiv,
  med ny forespørsel på `visibilitychange`. En skjerm som sovner midt i runden
  er den mest forutsigbare irritasjonen i hele oppsettet.

Et nivåmeter ved siden av av/på-bryteren viser at mikrofonen faktisk fanger lyd.
Uten det er «James svarer ikke» umulig å feilsøke fra andre siden av bordet.

### Validering før kortet vises

Serveren sjekker givet før kortet når skjermen: kjenner vi spillerne, gir
meldingen mening mot antall stikk, får melder og makker samme poengsum, og
hva blir stillingen etterpå. Avvik gir en **gul advarsel på kortet**, ikke en
avvisning – det er alltid mennesket som bestemmer, og en advarsel som blokkerer
er en advarsel som blir omgått.

To tilfeller får ekstra tydelig merking, fordi de avslutter runden og dermed er
dyre å oppdage for sent: en giv som tar noen over 52, og en meldt amerikaner.

### Kostnad

Dette var den uttalte bekymringen, så her er tallene:

| Post | Enhetspris | Per spillekveld (4 t) |
|---|---|---|
| Soniox sanntid, alltid på | $0,12/time | **≈ $0,48 (≈ 5 kr)** |
| Claude Haiku 4.5, ~60 kommandoer | $1/$5 per MTok | **≈ $0,14 (≈ 1,5 kr)** |
| **Sum** | | **≈ 7 kr per kveld** |

Med 40 spillekvelder i året blir det under 300 kr – assistenten er altså ikke
grunn til å droppe noe. Bytter man alltid-på-lytting mot «trykk for å snakke»
faller Soniox-posten til nesten null, siden strømmen bare står åpen mens noen
snakker. Begge modusene bygges; alltid-på er standard på storskjermen, og en
synlig av/på-bryter gjør at man kan slå den av.

To bremser er innebygd: strømmen stopper automatisk etter 10 minutter uten tale,
og Claude kalles **bare** når vekkeordet er hørt – ikke på løpende transkript.

### Modellvalg

- Standard: `eu.anthropic.claude-haiku-4-5` (må aktiveres i Bedrock-konsollen).
  Oppgaven er ren strukturert uttrekking fra én kort setning – Haiku holder.
- Fallback som allerede er aktivert på kontoen: `eu.anthropic.claude-sonnet-4-6`.
- Region `eu-central-1`, `eu.`-prefiks = cross-region inference innenfor EU.
- Gemini 2.5 Flash er et alternativ (nøkkelen finnes i pokergutta), men Bedrock
  velges for å holde seg til én leverandør og EU-endepunkter, som i legeassist.

### Personvern

En mikrofon som står på i stua opptar alt som sies. Derfor:

- Bare tekstsegmentet fra vekkeordet og utover lagres (`Utterance`). Den
  rullende bufferen ellers ligger kun i nettleserens minne og forsvinner.
- Lyd lagres aldri – hverken hos oss eller hos Soniox (EU-endepunkt).
- «Slett all taleloggen»-knapp i innstillinger.
- Lyttestatus vises alltid tydelig øverst på skjermen.

### Appen fungerer uten James

Manuell registrering er ikke en nødløsning, men hovedveien: et skjema der man
velger melder, makker, melding og stikk, og poengene regnes ut. James fyller ut
det samme skjemaet. Faller Soniox eller Bedrock bort, merkes det ikke på
poengføringen.

---

## 6. Innlogging

Felles PIN **1975**, samme som `idiot` – satt i `APP_PIN` i `.env`, som ikke er
committet. (`.env.example` har en plassholder, ikke den ekte verdien.) Endres
med `docker compose restart amerikaner` etterpå.

`proxy.ts` beskytter `/kveld`, `/registrer`, `/spillere` og skrivende
API-ruter. Cookien inneholder SHA-256-hashen av PIN-en
(`lib/pinHash.ts`-mønsteret fra pokergutta – edge-trygt via Web Crypto), aldri
PIN-en i klartekst. Lesende sider (`/oversikt`, spillerprofiler) er åpne.

---

## 7. API

Alt under `/api/kveld`, `/api/runde` og `/api/spillere` er PIN-beskyttet av
`proxy.ts`. `/api/pin` er åpen – ellers kunne man ikke logge inn.

| Fase | Metode | Sti | Beskrivelse |
|---|---|---|---|
| 1 | POST/DELETE | `/api/pin` | Logg inn / logg ut |
| 1 | GET | `/api/kveld/aktiv` | Aktiv kveld, spillere, runder, giv (SWR) |
| 1 | POST | `/api/kveld` | Start ny kveld |
| 1 | POST | `/api/kveld/[id]/runde` | Start ny runde (idempotent) |
| 1 | POST | `/api/kveld/[id]/avslutt` | Avslutt kvelden. Ble den tom, slettes den, og svaret er `null` |
| 1 | POST | `/api/runde/[id]/giv` | Lagre giv |
| 1 | PUT | `/api/runde/[id]/giv/[nr]` | Rett en giv |
| 1 | DELETE | `/api/runde/[id]/giv/[nr]` | Slett en giv, renummerer resten |
| 1 | POST | `/api/runde/[id]/juster` | `{playerId, nySum, note}` → justeringsgiv |
| 1 | POST | `/api/runde/[id]/avslutt` | `{winnerId}` – bekreft vunnet runde |
| 1 | DELETE | `/api/runde/[id]` | `{pin}` – slett runden. Var det den siste, slettes kvelden |
| 1 | GET/POST | `/api/spillere` | Liste og opprett spiller |
| 1 | PATCH | `/api/spillere/[id]` | Nytt navn eller aktiv/inaktiv |
| 1 | DELETE | `/api/spillere/[id]` | `409` hvis spilleren har spilt giv |
| 1 | GET | `/api/statistikk` | Karrieretall for alle spillere (åpen, lesende) |
| 2 | GET/POST | `/api/sesonger` | Liste og opprett sesong |
| 2 | PATCH/DELETE | `/api/sesonger/[id]` | Endre datoer/navn/aktiv, eller slett |
| 2 | GET | `/api/eksport/[seasonId]` | CSV, norsk Excel-format |
| 3 | GET | `/api/soniox-token` | Kortlivet Soniox-token + EU-ws-URL |
| 3 | POST | `/api/james` | `{transcript, matchId}` → liste med forslag |

De skrivende rutene returnerer hele kvelden på nytt, ikke bare det som ble
endret. Klienten slipper å flette inn en delrespons, og storskjermen er
oppdatert før neste poll rekker å komme.

Poenglogikken ligger samlet i `lib/scoring.ts` som rene, enhetstestede
funksjoner – aldri i rutene. Både James-ruten og den manuelle ruten kaller de
samme funksjonene. `avgjørRunde()` er den kritiske: den tar givene i en runde og
svarer om noen har nådd 52 og hvem som i så fall står høyest. Den **foreslår**
bare – `Game.winnerId` skrives utelukkende av `/api/runde/[id]/avslutt`. Kalles
også etter en retting, slik at et kort som «runden er kanskje ferdig» dukker opp
igjen hvis en korreksjon tar noen over streken.

Skriving skjer i én `prisma.$transaction`: giv, `DealScore`-rader og eventuell
oppdatering av `Game.winnerId` er enten alle lagret eller ingen.

---

## 8. Statistikk

Beregnes fra rådata, aldri lagret, og aldri i en API-rute – alt bor i
`lib/stats.ts` som rene funksjoner over en liste giv. Funksjonene bryr seg ikke
om lista kommer fra én kveld, én sesong eller hele historikken; det er derfor de
kan brukes fire steder allerede uten at noe er skrevet to ganger.

`spillerStatistikk(giv, deltakere, runderVunnet)` gir én `SpillerStat` per
spiller. `kåringer(stat)` gjør dem om til kort som kan tegnes. **En kåring uten
data faller bort av seg selv**, så tavla er aldri full av tomme kort tidlig på
kvelden – og en kveld med tre giv viser tre kort, ikke tolv tomme.

Kåringene som finnes nå:

| Kåring | Hva den svarer på |
|---|---|
| Klarte meldingen | Hvem kommer oftest i mål med sin egen melding |
| Gikk bet | Hvem bommer oftest |
| Meldingsprosent | Hvor ofte meldingen holder (fra tre meldinger og opp) |
| Snittmelding | Hvor høyt man pleier å melde – de dristige mot de forsiktige |
| Tjent på å bli ropt | Poeng hentet inn i givene man ble ropt som makker |
| Tapt på å bli ropt | Poeng mistet på å bli tatt med på et lag som gikk bet |
| Mest ettertraktet | Hvem blir oftest ropt som makker |
| Stikk i motspill | Stikk tatt når man ikke var med på laget |
| Største giv / verste smell | Beste og verste enkeltgiv |
| Amerikanere | Meldt, og hvor mange som ble klart |
| Meldte alene | Ganger man tok meldingen uten makker |
| Runder vunnet | Runder til 52 |

Vises på forsiden (gjennom tidene), på begge kveldsskjermene (kveld eller
gjennom tidene) og på `/kveld/[id]` (den kvelden). `makkerPar()` finnes også, og
er grunnlaget for makkermatrisen i fase 2.

**Fase 2 mangler fortsatt:** sesongfilter, sesongtabell, formkurve, grafer,
CSV-eksport, spillerprofiler og merker. Ingenting av det krever at kåringene
skrives om – de trenger bare en filtrert liste giv.

---

## 9. Miljøvariabler (`.env`, aldri committet)

| Variabel | Beskrivelse |
|---|---|
| `DATABASE_URL` | `file:./data/amerikaner.db` |
| `SONIOX_API_KEY` | Server-side; klienten får bare kortlivede tokens |
| `SONIOX_API_HOST` | `https://api.eu.soniox.com` |
| `SONIOX_WS_URL` | `wss://stt-rt.eu.soniox.com/transcribe-websocket` |
| `BEDROCK_API_KEY` / `BEDROCK_SECRET_KEY` | IAM-bruker med Bedrock-tilgang |
| `ANTHROPIC_MODEL` | `eu.anthropic.claude-haiku-4-5` |
| `AWS_REGION` | `eu-central-1` |
| `JAMES_WAKE_WORDS` | Kommaseparert, f.eks. `hei james,hei sjeims,hei jems` |
| `APP_PIN` | Felles PIN for skrivende sider og API-ruter |

---

## 10. Lokal utvikling

Verken den lokale maskinen eller serveren har node installert – alt kjøres i en
container, slik de andre appene på boksen gjør:

```bash
cd ~/apps/amerikaner
D="docker run --rm -u 1000:1000 -e HOME=/app -v $PWD:/app -w /app node:22-slim"

$D npm install
$D npx prisma generate      # etter enhver endring i schema.prisma
$D npx vitest run           # enhetstestene for lib/scoring.ts
$D npx tsc --noEmit         # typesjekk uten å bygge
$D npm run lint
```

`npm run dev` er lite nyttig her siden porten ikke er eksponert – bygg og kjør
containeren i stedet (`./deploy.sh`). Mikrofontilgang i fase 3 krever HTTPS
eller `localhost`, så James må testes mot det ekte domenet.

### Fallgruver som allerede har kostet tid

- **`prisma db push` har ingen `--skip-generate` i Prisma 7.** Flagget gjør at
  kommandoen skriver ut hjelpeteksten og går videre uten å røre databasen – uten
  feilkode. `deploy.sh` kaller den derfor uten flagg.
- **Prisma 7 vil ha Node 22.** På Node 20 advarer `@prisma/streams-local`.
  Både Dockerfile og utviklingskommandoene over bruker `node:22-slim`, og alle
  tre byggestegene installerer `openssl` – uten den nekter Prisma å generere.
- **ESLint-oppsettet fra `create-next-app` krasjer.** `FlatCompat` mot
  `eslint-config-next` 16 dør på en sirkulær referanse i react-konfigurasjonen.
  `eslint.config.mjs` importerer i stedet `eslint-config-next/core-web-vitals`
  og `/typescript` direkte – de er allerede flat-configs.
- **En funksjon fra en `"use client"`-modul kan ikke kalles på serveren.**
  `beskrivGiv()` lå i `GivListe.tsx` og ble importert av server-siden
  `/kveld/[id]`. Da får serveren en klientreferanse i stedet for funksjonen, og
  siden krasjer med «this page couldn't load» først i det den kalles – ikke ved
  bygging. Rene funksjoner hører hjemme i `lib/`.
- **Egne klasser i `globals.css` må ligge i `@layer components`.** Uten laget
  vinner de over alle Tailwind-utilities, fordi ulagede regler slår lagede
  uansett spesifisitet – og da har `className="brikke px-0"` ingen effekt.
- **Den genererte Prisma-klienten er ESM.** `require()` av
  `app/generated/prisma/client` feiler; bruk `import` eller gå via appens eget
  API når du skal titte i databasen fra et engangsskript.

---

## 11. Git og deploy

Kilden bor på GitHub, `git@github.com:rholthe/amerikaner.git`, gren `main`.
Flyten er: rediger lokalt → push → `./deploy.sh` på serveren.

```bash
# lokalt
git add -A && git commit -m "..." && git push

# på serveren
ssh lilletorget.org
cd ~/apps/amerikaner && ./deploy.sh   # fetch → ff-only → build → up -d → db push
```

`deploy.sh` **nekter å kjøre hvis noen har endret filer på serveren**, og henter
med `--ff-only`. Serveren er en kopi, ikke en arbeidsplass: en deploy skal aldri
kunne kaste bort noe som ikke finnes andre steder. Scriptet skriver ut den
forrige commiten, så en rullebakke er `git reset --hard <sha> && ./deploy.sh`.

Containeren heter `amerikaner`, kjører som uid 1000, henger på det eksterne
nettet `reverse-proxy_default` og lytter på 3000 internt. Ingen port publiseres
på hosten – Caddy er eneste vei inn.

`deploy.sh` tar en sikkerhetskopi av databasen før `prisma db push`, og beholder
de ti siste. Det er en angreknapp for et skjemabytte som gikk galt, ikke en
erstatning for den daglige backupen.

**Førstegangsoppsett av et arbeidstre** (serveren er allerede satt opp slik):

```bash
git init -b main
git remote add origin git@github.com:rholthe/amerikaner.git
git fetch origin && git reset --hard origin/main
git branch --set-upstream-to=origin/main main
```

`.env` og `data/` er gitignorert og overlever både `reset --hard` og deploy.

**Caddy** – ✅ lagt inn i `~/reverse-proxy/Caddyfile` (med `.bak-`kopi først, og
`caddy validate` før reload – den fila betjener alle sidene på boksen):

```
am.pokergutta.no {
	reverse_proxy http://amerikaner:3000 {
		header_up Host {http.request.host}
		header_up X-Forwarded-Proto https
	}
}
```

**DNS** – ✅ A-record `am.pokergutta.no → 159.195.146.240` er på plass, og
sertifikatet er hentet. `pokergutta.no` ligger hos ProISP (`ns1/ns2.proisp.no`)
og har **ingen wildcard**: et nytt underdomene må derfor alltid få sin egen
A-record *før* Caddy lastes på nytt, ellers får ikke Let's Encrypt validert det.

**Backup** – ✅ `backup-amerikaner.sh` er kopiert til `~/backups/` og lagt inn i
crontab, ved siden av de andre appenes:

```
20 3 * * * /home/ragnar/backups/backup-amerikaner.sh >> /home/ragnar/backups/backup.log 2>&1
```

Den tar en kopi av `data/amerikaner.db`, rsyncer den til `holthe.org` med
`~/.ssh/ekstern1_backup_key`, rydder lokale kopier eldre enn 7 dager, og sender
e-post ved feil. Prøvekjørt og verifisert.

---

## 12. Designbeslutninger

- **Spillerfarger følger spilleren, aldri rangeringen.** Paletten er den
  validerte CVD-optimaliserte kategoripaletten fra `idiot/frontend/src/lib/palette.js`;
  rekkefølgen er sikkerhetsmekanismen – ikke endre den.
- **Mørkt tema med gull-aksent**, som pokergutta. Appen står på en TV i et rom
  med dempet lys.
- **Alle tekstfarger er målt, ikke valgt på følelsen.** Hver farge i
  `globals.css` ligger på minst 4.5:1 mot alle fire flatene (`--bg`,
  `--surface`, `--surface-2`, `--surface-3`), som er WCAG AA for brødtekst. Den
  første paletten lå på 3.4–4.1 for `--muted` og `--bad` – nettopp de to som
  brukes til seksjonsetiketter og minuspoeng. Endrer du en verdi, mål på nytt.
- **Spillerfargene lysnes når de brukes som tekst.** Paletten er laget for
  flater; den mørkeste (grønn `#008300`) faller til 3.6:1 som tekst på et kort.
  `spillerFarge()` gir fargen til søyler og fyll, `spillerTekstFarge()` blander
  den mot hvitt til kontrasten holder. Rekkefølgen i `SERIE` røres aldri.
- **Det som ikke kan angres, spør om PIN.** Sletting av en runde er den eneste
  handlingen som fjerner poeng for godt, og den eneste som krever PIN-en på
  nytt. Alt annet – justeringer, rettinger, avslutning av runde og kveld – er
  reversibelt og klarer seg med ett trykk.
- **Kveld, runde og giv er tre nivåer – ikke to.** Fristelsen er å slå sammen
  runde og giv fordi de fleste kvelder har få runder. Men runden er der 52-målet
  bor og der seieren avgjøres, og givet er der meldingen bor. Slås de sammen,
  mister man enten meldingsstatistikken eller seiersstatistikken.
- **Poeng lagres eksplisitt per spiller per giv.** Regelendringer skal aldri
  kunne skrive om historikken.
- **Stillingen lagres aldri, den summeres.** To sannheter om samme tall kommer i
  utakt i det øyeblikket noen retter en giv – og korreksjoner er nettopp det en
  taleassistent produserer. Retting av stillingen skjer derfor som en
  justeringsgiv, ikke som overskriving av et beregnet tall.
- **Ingenting avslutter seg selv.** Verken runden eller kvelden går videre uten
  et trykk, selv når regnestykket er entydig. Den siste given er den som oftest
  er feilhørt, og en runde som avslutter seg selv på feil grunnlag koster mer å
  rydde opp i enn ett ekstra trykk koster å gjøre.
- **Et valg som må tas, tas i en modal.** Første versjon la spørsmålet «hvem
  vant runden?» i en sidekolonne ved siden av skjemaet, og resultatet var at
  runden ikke ble lagret i det hele tatt – det så ut som informasjon, ikke som
  et spørsmål. Blokkerende valg står nå midt i bildet, og knappen forteller hva
  den gjør («Ragnar vant · lagre og start runde 2»), ikke bare at den lagrer.
  Utsetter man valget, blir det liggende synlig igjen til det er tatt.
- **To skjermer, én tilstand.** Mobilen (`/registrer`) og storskjermen
  (`/kveld`) deler `useKveld.ts` og alle komponenter. Ingen av dem har logikk
  den andre ikke har – ellers ville de svart forskjellig på samme spørsmål to
  minutter etter at noen rettet en giv.
- **Registrering er hovedveien, ikke reserveløsningen.** Derfor ligger skjemaet
  åpent på mobilen. På storskjermen ligger det i en modal, fordi tavla er det
  man ser på – det er den samme modalen James senere skal fylle ut.
- **Rene funksjoner bor i `lib/`, aldri i en komponentfil.** En funksjon
  eksportert fra en `"use client"`-modul blir en klientreferanse på serveren og
  kaster i det den kalles. Det var akkurat dette som gjorde at `/kveld/[id]`
  ikke lastet.
- **James foreslår, mennesket bestemmer.** Ingen taleordre skriver til databasen
  uten et trykk. Dette er ikke bare sikkerhet – det gjør også at en dårlig
  transkripsjon blir en liten irritasjon i stedet for en ødelagt kveld.
- **Claude kalles kun etter vekkeord**, aldri på løpende transkript. Holder
  kostnaden nede og reduserer hva som sendes ut av huset.
- **Datoer lagres som naiv veggklokketid i UTC-feltet**, samme konvensjon som
  pokergutta (`lib/dates.ts`) – ellers spriker `DATE()` i SQL og visningen.

---

## 13. Utviklingsplan

**Fase 1 – Grunnmur (appen er brukbar uten AI) — FERDIG**
1. Next.js-prosjekt, Tailwind 4, mørkt tema, Prisma-skjema, PIN-innlogging.
2. Spilleradministrasjon med 409-regelen for sletting.
3. `lib/scoring.ts` med enhetstester – poeng per giv og `avgjørRunde()`.
4. Start kveld → velg 3–6 spillere → manuell givregistrering → runde til 52,
   med bekreftelse av vunnet runde og justeringsgiv for retting av stillingen.
5. Storskjermlayout for `/kveld` med 52-søylene, runde-prikkene og Wake Lock.
6. Docker, DNS, Caddy, deploy, backup.

**Fase 1b – etter prøvekvelden 5. september — FERDIG**
7. Egen mobilside `/registrer` med faner, og storskjermen ryddet til å vise
   tavle, giv og kåringer, med registrering i en modal.
8. Runden avsluttes gjennom en modal som ikke er til å overse, med en gul
   stripe som blir stående hvis valget utsettes.
9. `lib/stats.ts` med kåringer, i bruk på forsiden, begge kveldsskjermene og
   kveldshistorikken. `GET /api/statistikk` for karrieretallene.
10. Rettet at `/kveld/[id]` ikke lastet, og flyttet `beskrivGiv()` til
    `lib/givTekst.ts`.

Appen står på https://am.pokergutta.no og kan brukes på neste spillekveld.

**Fase 2 – Sesonger og grafer — påbegynt**
11. ✅ `Season`-administrasjon på `/sesonger`, med automatisk tilhørighet.
12. ✅ `/sesong/[id]`: sesongtabell på vunne runder, kåringer, alle kvelder og
    runder. Sesongene listes på forsiden, og kvelden lenker til sesongen sin.
13. CSV-eksport.
14. `/oversikt` med grafer: formkurve og akkumulerte vunne runder.
15. Spillerprofiler `/spillere/[id]`: makkermatrise (`makkerPar()` finnes),
    rekorder og merker.

Kåringene i `lib/stats.ts` dekker allerede tallene – det som mangler er
grafene og spillerprofilene.

**Fase 3 – James — ikke påbegynt**
15. `/api/soniox-token`, mikrofonvelger med nivåmeter, trykk-for-å-snakke.
16. `/api/james` med Bedrock og strukturert utdata; forslagskort med bekreftelse.
17. Alltid-på-lytting med vekkeord, auto-reconnect og inaktivitetsstopp.
18. Finpuss: navnematching, `context.terms`, korreksjonsordrer, taleloggvisning.

Forslagskortene skal åpne den samme giv-modalen som «Registrer giv» åpner på
storskjermen, ferdig utfylt – da er det bare bekreftelsen som er ny kode.

Fase 1 gir en app som er verdt å bruke på neste spillekveld. Fase 3 kan når som
helst utsettes eller droppes uten at noe annet må skrives om.

---

## 14. Åpne spørsmål

1. Blir det samme PC hver gang, eller må mikrofonvalget kunne følge flere
   maskiner? Fase 1 trenger ikke svaret – valget lagres per maskin i
   `localStorage`, som fungerer i begge tilfeller.

**Avklart:**
- 3–6 spillere, oftest 4. Antall stikk følger spillerantallet.
- Spillere registreres fortløpende, kan ikke slettes når de har spilt, men
  settes inaktive.
- Kveld → runde (til 52 poeng) → giv. Antall runder per kveld varierer.
- Melding og makker registreres, men er valgfrie felt.
- Amerikaner gir 52 poeng uansett spillerantall, og vinner dermed runden.
- Sesonger som i pokergutta, med kåringsside og Hall of Fame. Sesongtabellen
  rangeres på **vunne runder**, med totalpoeng som skillekriterium.
- Runden vinnes av den med flest poeng når 52 passeres, og **bekreftes manuelt**.
- Alle pass ⇒ stokk om, ingen poeng. Kan registreres som `kind = "pass"`.
- Stillingen regnes ut av appen, men kan rettes – som justeringsgiv.
- Maskinvare: én PC med mikrofon i enden av bordet, som også driver skjermen.
