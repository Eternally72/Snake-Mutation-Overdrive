#!/usr/bin/env bash
# Build the game and publish dist/ to the gh-pages branch (GitHub Pages).
# Usage: npm run deploy  (optionally: bash scripts/deploy.sh <remote-name>)
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="${1:-origin}"
URL="$(git remote get-url "$REMOTE")"

npm run build

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -r dist/. "$WORK"/
touch "$WORK/.nojekyll"

cd "$WORK"
git init -q -b gh-pages
git add -A
git -c user.name="deploy-script" -c user.email="deploy@localhost" commit -q -m "Deploy ${STAMP}"
git push -f "$URL" gh-pages:gh-pages
echo ""
echo "Pushed gh-pages. If this is the first deploy, enable Pages once:"
echo "  https://github.com/Eternally72/Snake-Mutation-Overdrive/settings/pages"
echo "  Source: Deploy from a branch -> gh-pages / (/root)"
