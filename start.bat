@echo off
title Foundry Lite - Serveur
cd /d "%~dp0"

echo ==========================================
echo        Demarrage de Foundry Lite
echo ==========================================
echo.

:: 1. Verifier si Node.js est installe
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou non detecte dans le PATH.
    echo Installez-le depuis https://nodejs.org/ puis relancez ce script.
    echo.
    pause
    exit /b 1
)

:: 2. Creer le fichier .env si absent
if not exist .env (
    if exist .env.example (
        echo [INFO] Fichier .env absent : copie depuis .env.example...
        copy .env.example .env >nul
    )
)

:: 3. Installer les dependances si le dossier node_modules n'existe pas
if not exist node_modules (
    echo [INFO] Premier lancement detecte : installation des dependances npm...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERREUR] L'installation npm a echoue.
        pause
        exit /b 1
    )
)

:: 4. Ouvrir l'application dans le navigateur et lancer le serveur
echo [INFO] Lancement du serveur sur http://localhost:3000 ...
start http://localhost:3000
call npm run dev

pause