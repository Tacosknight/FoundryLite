# Foundry Lite - Table Ronde Virtuelle Old-School / Virtual Tabletop

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.3-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## Sommaire / Table of Contents
- [Français](#version-française)
  - [Présentation](#présentation)
  - [Fonctionnalités](#fonctionnalités)
  - [Architecture technique](#architecture-technique)
  - [Prérequis et installation](#prérequis-et-installation)
  - [Guide d'utilisation](#guide-dutilisation)
  - [Sécurité et anti-triche](#sécurité-et-anti-triche)
- [English](#english-version)
  - [Overview](#overview)
  - [Features](#features)
  - [Technical Architecture](#technical-architecture)
  - [Prerequisites and Setup](#prerequisites-and-setup)
  - [User Guide](#user-guide)
  - [Security and Anti-Tamper](#security-and-anti-tamper)

---

## Version Française

### Présentation
Foundry Lite est une application web auto-hébergée de table virtuelle de jeu de rôle (Virtual Tabletop / VTT) axée sur l'immersion dark fantasy et le jeu de rôle sur table traditionnel (dans l'esprit des cRPG classiques tels que *Baldur's Gate*, *Diablo II* et des modules immersifs de *Foundry VTT*).

L'application assure une synchronisation multijoueur en temps réel avec une séparation stricte des rôles : un Maître du Jeu (MJ) et jusqu'à quatre aventuriers.

### Fonctionnalités

#### Ambiance visuelle et direction artistique cRPG
* **Design forgé, tactile et organique :** Rejet complet des interfaces plates et des styles d'applications d'entreprise. L'interface évoque un grimoire ancien cerclé de fer forgé, d'ardoise et de pierre volcanique (`#0c0a09`, `#1c1917`, `#292524`), de vélin vieilli (`#f5ebe0`, `#e6ccb2`) et d'ornements métalliques en laiton et or terni (`#d4af37`, `#78350f`).
* **Typographies dédiées :** Intégration harmonieuse des polices Cinzel Decorative (titres majeurs), Cinzel (boutons, sous-titres et runes), Crimson Pro et EB Garamond (dialogues, registres de taverne et descriptions).
* **Fioles de sang et d'éther :** Jauges vitales modélisées comme des tubes de verre avec reflets spéculaires et remplissage liquide épais. Un effet de scintillement lumineux continu (shimmer arcanique) traverse les jauges d'énergie.
* **Identités visuelles par joueur :** Sélection d'une couleur distinctive habillant la plaque de héros, le sceau de cire, les messages de taverne et le pion sur la carte.
* **Sanctuaire doré du Maître du Jeu :** Réservation exclusive des teintes d'or flamboyant (`#facc15`, `#d4af37`) et du symbole de commandement au MJ pour une identification immédiate de ses arbitrages.

#### La Forge du Destin (Création de personnage)
* **Dix lignées et races jouables :** Humain, Elfe, Nain, Demi-Orc, Halfelin, Drakéide, Tieffelin, Gnome, Gobelin, Demi-Elfe (avec modificateurs de points de vie, d'énergie et passifs d'ascendance).
* **Six classes équilibrées :** Guerrier, Mage, Voleur, Clerc, Rôdeur, Paladin avec rôles tactiques spécifiques.
* **Attribution des caractéristiques (FOR, DEX, INT, CHA) :**
  * *Système par achat de points (Point Buy) :* 20 points à répartir (base 8, maximum 15).
  * *Tirage aléatoire sécurisé (3d6) :* Calcul et ventilation équilibrée certifiés par le serveur.
* **Titres d'origine dynamiques :** Association de 23 statuts sociaux et de 27 concepts abstraits générant des combinaisons narratives uniques (ex. *« Fossoyeur des cendres »*, *« Héraut de la flamme noire »*).
* **Dotation initiale automatique :** Attribution immédiate de deux équipements physiques et d'une aptitude ou sort caractéristique selon la classe choisie.
* **Verrouillage et renommage :**
  * Verrouillage définitif des caractéristiques, de la race et de la classe après validation de la fiche.
  * Onglet « Renommer Héros » accessible à tout moment pour faire évoluer le patronyme du personnage.
  * Réécriture rétroactive : la mise à jour du nom modifie instantanément tous les messages antérieurs du joueur dans le salon de taverne.

#### Suivi d'équipe et fiches d'aventuriers
* **Tableau de bord synchronisé :** Suivi permanent des quatre fiches sous forme de plaques d'armure incrustées de parchemin (points de vie actuels/maximum, énergie arcanique, attributs, passifs, inventaire).
* **Outils d'arbitrage du Maître du Jeu :**
  * Ajustement instantané des jauges par paliers rapides (`-5`, `-1`, `+1`, `+5`).
  * Fenêtre de modification complète pour ajuster manuellement les valeurs maximales, vocations et identités.
  * Affichage dynamique : état d'autel d'invocation vide tant qu'un joueur n'a pas rejoint la salle et forgé son avatar.

#### Inventaire et téléversement optimisé
* Grille d'objets structurée par aventurier avec gestion dynamique des quantités.
* **Création d'objets par le MJ :** Définition du nom, de la description, du volume et ajout d'illustrations.
* **Compression côté client :** Traitement automatique des images via Canvas HTML5 (redimensionnement à 400x400 pixels et conversion WebP qualité 0,8) avant transmission au serveur afin d'économiser la bande passante du tunnel.

#### La Taverne : Registre de discussion et moteur de dés
* **Chronique roleplay synchrone :** Messages horodatés gravés sur plaques de fer forgé sombre avec mise en valeur dorée pour le Maître du Jeu.
* **Boutons de dés runiques :** Dés taillés en runes de pierre facettées (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`), avec finition or sur le d20.
* **Interpréteur de commandes textuelles :** Prise en charge de la syntaxe standard (`/r` ou `/roll`, ex. `/roll 2d6+3`).
* **Ciblage flexible :** Attribution du jet à un aventurier précis ou à la table entière.
* **Animation cinématographique de suspense :** Défilement central accéléré des valeurs avec zoom d'impact lors de la révélation finale.
* **Effets visuels critiques d20 :**
  * *Réussite critique (20 naturel) :* Flash doré éclatant en superposition, secousse subtile de l'écran (3px) et particules radiales festives.
  * *Échec critique (1 naturel) :* Pulsation rouge sang sinistre sur le panneau et voile de fumée sombre.

#### Carte tactique (Battlemap) et gestion de combat
* **Moteur Canvas HTML5 fluide :** Déplacement continu et libre des pions sans contrainte de quadrillage ni blocage de grille.
* **Navigation sur la carte :** Déplacement panoramique à la souris et zoom progressif centré sur le curseur.
* **Fonds de carte interchangeables :** Le Maître du Jeu peut téléverser une illustration locale ou définir une URL externe pour modifier la carte en temps réel.
* **Gestion des pions (Joueurs & Monstres) :**
  * Génération automatique des pions joueurs lors de leur connexion.
  * Panneau d'invocation de monstres (nom, couleur, points de vie).
  * Déplacement par glisser-déposer avec restriction d'autorité (un joueur déplace son propre pion, le MJ déplace tous les pions).
  * Infobulle de santé détaillée au survol en texture de parchemin vieilli.
* **Brouillard de guerre dynamique :**
  * Masquage intégral pour les joueurs avec opacité configurable.
  * Vision semi-transparente pour le Maître du Jeu.
  * Outils de pinceau circulaire et de révélation rectangulaire.
  * Bouton de réinitialisation complète du brouillard.
* **Système d'initiative et tour de jeu :**
  * Contrôle centralisé pour le MJ avec bouton de passage au tour suivant.
  * Carillon fantastique procédural généré via la Web Audio API (sans aucun fichier audio externe).
  * Bannière d'alerte visuelle dorée sur l'écran du joueur actif.
  * Aura arcanique dorée pulsante sur le pion du joueur sur la carte ainsi que sur sa fiche d'aventurier.

---

### Architecture technique

```text
├── data/
│   └── rooms.json              # Persistance de l'état des salles, fiches et cartes
├── public/
│   ├── css/
│   │   └── rpg-theme.css       # Thème cRPG sombre (variables, bordures, fioles, keyframes)
│   ├── js/
│   │   └── app.js              # Client SPA, moteur Canvas, Socket.io, Web Audio et FX
│   ├── uploads/                # Répertoire de stockage des visuels d'inventaire
│   └── index.html              # Vue unique SPA (Tailwind CSS, fonts et composants forgés)
├── src/
│   ├── config/
│   │   └── multer.js           # Configuration d'upload Multer (WebP, PNG, JPEG)
│   ├── data/
│   │   └── rpgRules.js         # Règles, équilibrages et tables de statistiques
│   ├── routes/
│   │   └── uploadRoutes.js     # Route API REST POST /api/upload
│   ├── services/
│   │   └── roomService.js      # Gestion des salons en mémoire et reconnexions
│   ├── sockets/
│   │   ├── char.handler.js     # Événements fiches (création, renommage, jauges)
│   │   ├── chat.handler.js     # Événements salon et résolution des dés
│   │   ├── inv.handler.js      # Événements de gestion d'inventaire
│   │   ├── map.handler.js      # Événements de carte, pions, brouillard et tours
│   │   ├── roomHandler.js      # Authentification, présence et synchronisation
│   │   └── index.js            # Routeur principal Socket.io
│   └── state/
│       └── RoomManager.js      # Gestionnaire d'état avec sauvegarde différée
├── nodemon.json                # Exclusion des dossiers data/ et uploads/
├── package.json
└── server.js                   # Point d'entrée HTTP Express et Socket.io
```

---

### Prérequis et installation

#### Prérequis
* Node.js (version 18.x ou supérieure recommandée)
* Gestionnaire de paquets npm, yarn ou pnpm
* Navigateur récent prenant en charge les WebSockets, Canvas HTML5 et la Web Audio API

#### Installation
1. Cloner le dépôt :
```bash
git clone https://github.com/Tacosknight/FoundryLite.git
cd FoundryLite
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer l'environnement :
```bash
cp .env.example .env
```
*(Par défaut, le serveur démarre sur le port `3000`. Vous pouvez modifier la variable `PORT` dans `.env` si nécessaire).*

---

### Guide d'utilisation

#### Démarrage du serveur

Mode production :
```bash
npm start
```

Mode développement (rechargement automatique via Nodemon) :
```bash
npm run dev
```

Accès par défaut via : `http://localhost:3000`

#### Déroulement d'une session

1. **Création de la table (Maître du Jeu) :**
   * Ouvrir `http://localhost:3000`.
   * Indiquer le nom de la salle (ex. `table-ronde`) et son pseudonyme.
   * Sélectionner le rôle « Créer en tant que MJ » et valider.
   * La vue d'équipe s'affiche sous forme d'autel prêt à accueillir les aventuriers.

2. **Connexion des participants (jusqu'à 4 joueurs) :**
   * Les joueurs accèdent à l'adresse locale ou au lien de tunnelisé (`http://<ADRESSE_SERVEUR>:3000`).
   * Ils renseignent le nom de salle identique, leur pseudo et choisissent « Rejoindre en tant que Joueur ».
   * La redirection vers l'écran de création « Forger Héros » est automatique.

3. **Génération du héros :**
   * Choix du nom, de la race et de la classe.
   * Répartition obligatoire des 20 points d'attributs (manuelle ou via tirage certifié 3d6).
   * Sélection du titre d'origine (statut et concept).
   * Attribution de la couleur distinctive (teintes jaunes/or exclues).
   * Validation sur « Forger mon Destin » pour publier la fiche sur le tableau de bord de l'équipe.

4. **Conduite de la partie :**
   * Les joueurs échangent dans la Taverne sous leur identité et couleur de personnage.
   * Le MJ gère les ajustements de points de vie, distribue l'équipement avec images et arbitre les jets de dés.
   * Sur la Carte Tactique, le MJ déploie les fonds de carte, gère les monstres, révèle les zones masquées par le brouillard de guerre et rythme les combats grâce au gestionnaire de tours.

---

### Sécurité et anti-triche
* **Autorité serveur :** Toutes les statistiques vitales, les validations d'inventaire, le brouillard de guerre et les résolutions de dés sont exécutées sur le moteur Node.js.
* **Contrôle d'accès des événements :** Les actions réservées à l'arbitrage (`char:update_vitals`, `dice:roll`, `map:set_background`, `map:reveal_fog`, `turn:next`) exigent la validation stricte du rôle en mémoire côté serveur.
* **Filtrage des identités visuelles :** La couleur réservée au MJ (`#facc15`) est systématiquement bloquée si un joueur tente de la soumettre.
* **Sauvegarde à écriture différée (Debounce) :** Les opérations de mise à jour sur le fichier `data/rooms.json` sont temporisées pour préserver les performances d'entrée/sortie de la machine hôte.

---

## English Version

### Overview
Foundry Lite is a self-hosted Virtual Tabletop (VTT) web application focused on dark fantasy immersion and traditional tabletop roleplaying (inspired by classic cRPGs such as *Baldur's Gate*, *Diablo II*, and immersive modules of *Foundry VTT*).

The application provides real-time multiplayer synchronization with strict role separation: one Game Master (GM) and up to four adventurers.

### Features

#### Visual Ambiance and cRPG Art Direction
* **Tactile, Forged and Organic Aesthetic:** Complete removal of corporate flat dashboard elements. The UI reflects an ancient iron-clad grimoire crafted with slate and volcanic stone (`#0c0a09`, `#1c1917`, `#292524`), aged vellum (`#f5ebe0`, `#e6ccb2`), and metallic trims of brass and tarnished gold (`#d4af37`, `#78350f`).
* **Dedicated Typography:** Harmonious integration of Cinzel Decorative (major headers), Cinzel (subtitles, buttons, runes), and Crimson Pro / EB Garamond (dialogues, chronicle ledgers, descriptions).
* **Vials of Blood and Ether:** Health and energy gauges modeled as thick glass tubes with specular reflections and dense liquid shaders. A continuous arcane shimmer effect flows across active energy pools.
* **Hero Signatures:** Custom player colors styling hero armor plates, wax seals, tavern chat messages, and tactical canvas tokens.
* **Golden GM Sanctuary:** Exclusive reservation of radiant gold (`#facc15`, `#d4af37`) and the GM insignia for immediate adjudication clarity.

#### The Forge of Destiny (Character Creation)
* **Ten Playable Ancestries:** Human, Elf, Dwarf, Half-Orc, Halfling, Dragonborn, Tiefling, Gnome, Goblin, Half-Elf (each with health/energy modifiers and unique passive traits).
* **Six Balanced Classes:** Warrior, Mage, Rogue, Cleric, Ranger, Paladin with specific combat roles.
* **Attribute Allocation (STR, DEX, INT, CHA):**
  * *Point Buy System:* 20 points to distribute (base 8, maximum 15).
  * *Server-Certified 3d6 Roll:* Automatic, balanced distribution calculated on the backend.
* **Dynamic Origin Titles:** Pairing of 23 social ranks with 27 conceptual allegiances to generate unique titles (e.g., *"Gravedigger of the Ashes"*, *"Herald of the Black Flame"*).
* **Automated Starter Kit:** Automatic granting of two physical items and one class signature ability upon creation.
* **Locking and Rename:**
  * Permanent locking of stats, ancestry, and class upon character confirmation.
  * "Rename Hero" tab accessible at any time.
  * Retroactive update: changing a hero name updates all historical chat messages instantaneously.

#### Party Overview and Adventurer Cards
* **Real-time Dashboard:** Live tracking of all 4 hero cards formatted as parchment-inlaid armor plates (current/max HP, energy, attributes, passives, inventory).
* **Game Master Controls:**
  * Quick step buttons for instant resource changes (`-5`, `-1`, `+1`, `+5`).
  * Full editing modal to adjust character titles, classes, and vital ceilings.
  * Clean empty states: stone altar placeholder before players join and forge their heroes.

#### Inventory and Optimized Uploads
* Dynamic item grid per adventurer with quantity management.
* **GM Item Forging:** Modal to define name, description, quantity, and attach custom artwork.
* **Client-Side Compression:** Canvas-based image pipeline (downscaling to 400x400 pixels and converting to WebP quality 0.8) prior to server upload to minimize bandwidth usage.

#### The Tavern: Chronicle Chat and Dice Engine
* **Synchronous Roleplay Ledger:** Timestamped chronicle entries on dark iron panels with golden accents for the GM.
* **Chiseled Runic Dice:** Polyhedral stone runes (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`), with an ornate gilded d20.
* **Text Command Interpreter:** Full support for `/r` and `/roll` syntax (e.g., `/roll 2d6+3`).
* **Flexible Targeting:** Roll assigned to a designated player or the entire table.
* **Casino-style Suspense Animation:** Fast slot-rolling preview followed by impact zoom reveal.
* **d20 Critical Feedback:**
  * *Natural 20 (Critical Success):* Radiant golden overlay flash, subtle 3px screen shake, and radial particles.
  * *Natural 1 (Critical Failure):* Sinister ruby-blood pulsation and dark smoke vignette overlay.

#### Tactical Battlemap and Combat Tracker
* **Smooth Canvas Engine:** Continuous, freeform token movement with no grid locks or snapping constraints.
* **Intuitive Navigation:** Smooth mouse panning and cursor-centered zoom.
* **Dynamic Background Maps:** The GM can switch the battlefield on the fly via local image upload or external URL.
* **Token Management (Heroes & Monsters):**
  * Auto-generation of player tokens upon room entry.
  * Dedicated GM monster spawning panel (name, color, hit points).
  * Smooth drag-and-drop movement with ownership validation (players move only their own token, GM can move all).
  * Health tooltip revealed on hover with aged parchment styling.
* **Dynamic Fog of War:**
  * Full shroud covering the map for players.
  * Semi-transparent vision for the Game Master.
  * Circular brush and rectangular reveal carving tools.
  * One-click Fog of War reset.
* **Initiative and Turn Tracker:**
  * Centralized GM turn advancement controls.
  * Procedural fantasy bell chime powered by the Web Audio API (zero audio files needed).
  * Prominent golden banner alert for the active player.
  * Pulsing golden arcane aura displayed on both the canvas token and party card.

---

### Technical Architecture

```text
├── data/
│   └── rooms.json              # Persistent JSON store for rooms, characters and maps
├── public/
│   ├── css/
│   │   └── rpg-theme.css       # Dark cRPG stylesheet (variables, iron frames, vials, animations)
│   ├── js/
│   │   └── app.js              # SPA client, Canvas battlemap, Web Audio synthesizer, Socket.io
│   ├── uploads/                # Storage directory for compressed item images
│   └── index.html              # Single-page application entry point
├── src/
│   ├── config/
│   │   └── multer.js           # Multer upload filter and storage configuration
│   ├── data/
│   │   └── rpgRules.js         # Balancing rules, ancestries, classes, and item tables
│   ├── routes/
│   │   └── uploadRoutes.js     # REST API route POST /api/upload
│   ├── services/
│   │   └── roomService.js      # In-memory room manager and reconnection handler
│   ├── sockets/
│   │   ├── char.handler.js     # Character sheet events (creation, vitals, rename)
│   │   ├── chat.handler.js     # Chat messages and dice roll resolutions
│   │   ├── inv.handler.js      # Inventory and item transactions
│   │   ├── map.handler.js      # Map state, tokens, fog of war, and turn events
│   │   ├── roomHandler.js      # Authentication, presence and synchronization
│   │   └── index.js            # Socket.io root router
│   └── state/
│       └── RoomManager.js      # Room state manager with debounced disk persistence
├── nodemon.json                # Ignore data/ and uploads/ to prevent unwanted server reboots
├── package.json
└── server.js                   # Express HTTP server and Socket.io setup
```

---

### Prerequisites and Setup

#### Prerequisites
* Node.js (version 18.x or higher recommended)
* Package manager: npm, yarn, or pnpm
* Modern web browser supporting WebSockets, HTML5 Canvas, and Web Audio API

#### Setup
1. Clone the repository:
```bash
git clone https://github.com/Tacosknight/FoundryLite.git
cd FoundryLite
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```
*(The server defaults to port `3000`. Customize the `PORT` variable inside `.env` if desired).*

---

### User Guide

#### Launching the Server

Production mode:
```bash
npm start
```

Development mode (auto-reload via Nodemon):
```bash
npm run dev
```

Default access point: `http://localhost:3000`

#### Running a Game Session

1. **Host the Table (Game Master):**
   * Navigate to `http://localhost:3000`.
   * Specify a room name (e.g., `table-ronde`) and nickname.
   * Select "Créer en tant que MJ" and enter the session.
   * The party view opens with an empty stone altar awaiting adventurers.

2. **Connecting Players (Up to 4):**
   * Players access the local address or tunnel (`http://<SERVER_IP>:3000`).
   * They specify the identical room name, their handle, and choose "Rejoindre en tant que Joueur".
   * Automatic redirection to the character creation view occurs immediately.

3. **Forging an Adventurer:**
   * Select character name, ancestry, and class.
   * Distribute all 20 attribute points (manually or via 3d6 random roll).
   * Pick origin title and custom signature color (gold excluded).
   * Confirm to publish the sheet to the shared party dashboard.

4. **Gameplay:**
   * Players converse in the Tavern chat under their hero identity and signature color.
   * The GM monitors hit points, grants inventory loot with custom artwork, and executes dice rolls.
   * On the Tactical Battlemap, the GM can adjust maps, spawn monsters, reveal fog of war, and cycle turn initiative with audio-visual notifications.

---

### Security and Anti-Tamper
* **Server Authority:** All vital statistics, inventory transactions, fog states, and dice roll math are evaluated on the Node.js backend.
* **Role Enforcement:** Administrative socket actions (`char:update_vitals`, `dice:roll`, `map:set_background`, `map:reveal_fog`, `turn:next`) strictly verify GM status in server memory.
* **Visual Identity Protection:** Submissions attempting to claim the reserved GM golden color (`#facc15`) are rejected and assigned a standard hue.
* **Debounced Persistence:** Modifications to `data/rooms.json` are debounced to prevent disk I/O bottlenecks during active combat sequences.

---

### Licence / License
Ce projet est sous licence [ISC](https://opensource.org/licenses/ISC). Développé pour les passionnés de jeux de rôle sur table.
Distributed under the [ISC License](https://opensource.org/licenses/ISC). Crafted for dark fantasy tabletop enthusiasts.
