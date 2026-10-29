#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# 1. Vérification de Node.js
if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé."
    exit 1
fi

# 2. Création du fichier .env si absent
if [ ! -f .env ] && [ -f .env.example ]; then
    echo "[INFO] Création du fichier .env depuis .env.example..."
    cp .env.example .env
fi

# 3. Installation des dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installation des dépendances npm..."
    npm install
fi

# 4. Lancement
echo "[INFO] Lancement sur http://localhost:3000..."
which xdg-open > /dev/null && xdg-open http://localhost:3000 &
npm run dev