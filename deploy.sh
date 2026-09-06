#!/usr/bin/env bash
# Deploy av am.pokergutta.no. Kjøres på serveren:
#
#   cd ~/apps/amerikaner && ./deploy.sh [gren]
#
# Serveren er en kopi av GitHub, ikke et sted man redigerer. Scriptet henter
# derfor koden med --ff-only og nekter å kjøre hvis noen har endret filer her –
# en deploy skal aldri kunne kaste bort noe som ikke finnes andre steder.
#
# data/ inneholder SQLite-databasen og bind-monteres inn. Den røres aldri av
# dette scriptet ut over sikkerhetskopien nedenfor.
set -euo pipefail
cd "$(dirname "$0")"

GREN="${1:-main}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "FEIL: $(pwd) er ikke et git-arbeidstre." >&2
  echo "Sett det opp én gang med:" >&2
  echo "  git init -b main" >&2
  echo "  git remote add origin git@github.com:rholthe/amerikaner.git" >&2
  echo "  git fetch origin && git reset --hard origin/main" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "FEIL: .env mangler. Kopier .env.example og fyll inn APP_PIN." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "FEIL: det ligger endringer i arbeidstreet som ikke er committet:" >&2
  git status --short >&2
  echo "" >&2
  echo "Rett dem opp lokalt og push, eller forkast dem her med" >&2
  echo "  git checkout -- ." >&2
  exit 1
fi

echo "=== Henter $GREN fra GitHub ==="
git fetch --prune origin
FOER=$(git rev-parse HEAD)
git checkout --quiet "$GREN"
git merge --ff-only "origin/$GREN"
ETTER=$(git rev-parse HEAD)

if [ "$FOER" = "$ETTER" ]; then
  echo "Ingen nye commits ($(git rev-parse --short HEAD)) – bygger likevel."
else
  echo "Nye commits:"
  git --no-pager log --oneline "$FOER..$ETTER" | sed 's/^/  /'
  echo "Rull tilbake med: git reset --hard $FOER && ./deploy.sh"
fi

mkdir -p data

if [ -f data/amerikaner.db ]; then
  echo "=== Sikkerhetskopi før migrering ==="
  cp data/amerikaner.db "data/amerikaner.db.bak-$(date +%F_%H-%M-%S)"
  # Behold de ti nyeste. Den daglige backupen er den ordentlige; disse er bare
  # en angreknapp for et skjemabytte som gikk galt.
  ls -1t data/amerikaner.db.bak-* 2>/dev/null | tail -n +11 | xargs -r rm --
fi

echo "=== Bygger image ==="
docker compose build

echo "=== Bytter til ny container ==="
docker compose up -d

echo "=== Synkroniserer skjema mot databasen ==="
# Ingen --skip-generate: flagget finnes ikke i Prisma 7, og kommandoen ville da
# skrevet ut hjelpeteksten og gått videre uten å røre databasen.
docker compose exec -T amerikaner npx prisma db push

echo "=== Venter på at appen svarer ==="
for _ in $(seq 1 30); do
    if docker compose exec -T amerikaner node -e \
        "fetch('http://localhost:3000/pin').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        echo "Appen er oppe på $(git rev-parse --short HEAD)."
        exit 0
    fi
    sleep 2
done

echo "FEIL: appen svarte ikke innen 60 sekunder." >&2
docker compose logs --tail 50 amerikaner >&2
echo "Rull tilbake med: git reset --hard $FOER && ./deploy.sh" >&2
exit 1
