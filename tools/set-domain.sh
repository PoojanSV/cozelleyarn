#!/usr/bin/env bash
# Usage: bash tools/set-domain.sh https://www.yourdomain.com   (run once, from the cozelle folder)
set -e
D="${1%/}"; [ -z "$D" ] && { echo "give your domain, e.g. https://www.cozelle.in"; exit 1; }
grep -rl "https://YOUR-DOMAIN.com" --include=*.html --include=*.js --include=*.txt --include=*.xml . | xargs sed -i "s#https://YOUR-DOMAIN.com#$D#g"
echo "Domain set to $D"
