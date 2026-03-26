#!/usr/bin/env bash
# release.sh — Build y publica una nueva versión de Venilu
# Uso: ./release.sh 1.2.0

set -e

# ── Cargar variables del .env local ──────────────────────────────────────────
if [ -f "$(dirname "$0")/.env" ]; then
  export $(grep -v '^#' "$(dirname "$0")/.env" | xargs)
  echo "✅  Variables cargadas desde .env"
else
  echo "❌  No se encontró .env — crea uno con GH_TOKEN=tu_token"
  exit 1
fi

# ── Validar token ─────────────────────────────────────────────────────────────
if [ -z "$GH_TOKEN" ] || [ "$GH_TOKEN" = "ghp_aqui_tu_token_nuevo" ]; then
  echo "❌  GH_TOKEN no está configurado en .env"
  exit 1
fi

# ── Versión ───────────────────────────────────────────────────────────────────
VERSION=${1:-""}
if [ -z "$VERSION" ]; then
  echo "❌  Especifica la versión: ./release.sh 1.2.0"
  exit 1
fi

echo "🚀  Publicando Venilu v$VERSION..."

# Actualizar version en package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('📦  package.json actualizado a v$VERSION');
"

# ── Build + Publish ───────────────────────────────────────────────────────────
echo "🔨  Compilando y publicando..."
bun run build -- --publish always

echo ""
echo "🎉  ¡Venilu v$VERSION publicado en GitHub Releases!"
echo "    https://github.com/leon4rdodev/Venilu-releases/releases"
