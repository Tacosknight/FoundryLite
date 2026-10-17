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
  - [Fonctionnalités Principales](#fonctionnalités-principales)
    - [1. Direction Artistique & Ambiance Dark Fantasy cRPG](#1-direction-artistique--ambiance-dark-fantasy-crpg)
    - [2. Création de Héros & Suivi d'Équipe](#2-création-de-héros--suivi-déquipe)
    - [3. La Taverne & Moteur de Dés Runic](#3-la-taverne--moteur-de-dés-runiques)
    - [4. Carte Tactique & Moteur Canvas Avancé](#4-carte-tactique--moteur-canvas-avancé)
    - [5. Lumière Dynamique & Brouillard de Guerre](#5-lumière-dynamique--brouillard-de-guerre)
    - [6. Murs, Gouffres & Portes Interactives](#6-murs-gouffres--portes-interactives)
    - [7. Terrains Difficiles & Zones de Danger](#7-terrains-difficiles--zones-de-danger)
    - [8. Pièges & Secrets Détectables](#8-pièges--secrets-détectables)
    - [9. Conditions & Altérations d'État](#9-conditions--altérations-détat)
    - [10. Gestionnaire de Scènes & Téléporteurs (Donjons Multi-Niveaux)](#10-gestionnaire-de-scènes--téléporteurs-donjons-multi-niveaux)
    - [11. Volet Ancré des Raccourcis Clavier Tactiques](#11-volet-ancré-des-raccourcis-clavier-tactiques)
    - [12. Le Carnet d'Enquête & Mur de Liens Collaboratif](#12-le-carnet-denquête--mur-de-liens-collaboratif)
    - [13. Dessin Libre & Craie Tactique Éphémère (Pings)](#13-dessin-libre--craie-tactique-éphémère-pings)
    - [14. Fiches de PNJ & Objets Personnalisables Bac à Sable](#14-fiches-de-pnj--objets-personnalisables-bac-à-sable)
  - [Architecture Technique](#architecture-technique)
  - [Prérequis et Installation](#prérequis-et-installation)
  - [Guide d'Utilisation](#guide-dutilisation)
  - [Sécurité et Anti-Triche](#sécurité-et-anti-triche)
- [English](#english-version)
  - [Overview](#overview)
  - [Core Features](#core-features)
  - [Technical Architecture](#technical-architecture-1)
  - [Prerequisites and Setup](#prerequisites-and-setup)
  - [User Guide](#user-guide-1)
  - [Security and Anti-Tamper](#security-and-anti-tamper)

---

## Version Française

### Présentation
Foundry Lite est une application web auto-hébergée de table virtuelle de jeu de rôle (Virtual Tabletop / VTT) axée sur l'immersion dark fantasy, l'exploration de donjons et le jeu sur table traditionnel (dans l'esprit des cRPG classiques tels que *Baldur's Gate*, *Diablo II* et des modules immersifs de *Foundry VTT*).

L'application assure une synchronisation multijoueur en temps réel via WebSockets avec une séparation stricte des rôles : un Maître du Jeu (MJ) et jusqu'à quatre aventuriers.

---

### Fonctionnalités Principales

#### 1. Direction Artistique & Ambiance Dark Fantasy cRPG
* **Design forgé, tactile et organique :** Interface évoquant un grimoire ancien cerclé de fer forgé, d'ardoise et de pierre volcanique (`#0c0a09`, `#1c1917`, `#292524`), de vélin vieilli (`#f5ebe0`, `#e6ccb2`) et d'ornements métalliques en laiton et or terni (`#d4af37`, `#78350f`).
* **Typographies dédiées :** Cinzel Decorative (titres majeurs), Cinzel (boutons, sous-titres et runes), Crimson Pro et EB Garamond (dialogues, registres de taverne et descriptions).
* **Fioles de sang et d'éther :** Jauges vitales modélisées comme des tubes de verre avec reflets spéculaires et remplissage liquide épais avec scintillement arcanique continu.
* **Identités visuelles par joueur :** Choix d'une couleur distinctive personnalisant la plaque de héros, le sceau de cire, les messages de taverne et le pion tactique.
* **Sanctuaire doré du MJ :** Réservation exclusive des teintes d'or flamboyant (`#facc15`, `#d4af37`) et du sceau de commandement au MJ.

#### 2. Création de Héros & Suivi d'Équipe
* **Dix lignées et races jouables :** Humain, Elfe, Nain, Demi-Orc, Halfelin, Drakéide, Tieffelin, Gnome, Gobelin, Demi-Elfe (modificateurs de points de vie, d'énergie, vision dans le noir et passifs d'ascendance).
* **Six classes équilibrées :** Guerrier, Mage, Voleur, Clerc, Rôdeur, Paladin.
* **Attribution des caractéristiques (FOR, DEX, INT, CHA) :** Point Buy (20 points) ou tirage aléatoire 3d6 certifié par le serveur.
* **Titres d'origine dynamiques :** 23 statuts sociaux combinés à 27 concepts abstraits (ex. *« Fossoyeur des cendres »*, *« Héraut de la flamme noire »*).
* **Tableau de bord d'équipe en direct :** Suivi en temps réel des jauges, inventaires et altérations avec commandes rapides pour le MJ (`-5`, `-1`, `+1`, `+5`).
* **Gestion d'inventaire avec compression :** Téléversement d'illustrations d'objets avec conversion Canvas WebP locale.

#### 3. La Taverne & Moteur de Dés Runiques
* **Chronique roleplay synchrone :** Messages horodatés gravés sur fer forgé avec badge d'auteur et couleur d'équipe.
* **Dés polyédriques runiques :** d4, d6, d8, d10, d12, d20 (doré), d100.
* **Interpréteur de commandes textuelles :** Support complet `/r` et `/roll` (ex. `/roll 2d6+3`).
* **Effets cinématographiques d20 :** Flash doré, secousse d'écran et particules pour les réussites critiques (20 naturel) ; pulsation rouge sang et fumée sombre pour les échecs critiques (1 naturel).

#### 4. Carte Tactique & Moteur Canvas Avancé
* **Déplacement fluide sans grille bloquante :** Glisser-déposer naturel des pions avec échelle métrique continue (1 case = 1.5 m = 50 px).
* **Contrôle d'autorité et tours de combat :** Les joueurs déplacent uniquement leur héros et pendant leur tour actif ; le MJ conserve le contrôle absolu sur tous les pions.
* **Moteur Ghost Pathing & Course (Dash) :**
  * Ligne de visée directe avec encoches métriques tous les 1.5 m.
  * Zone de mouvement standard (cercle bleu) et zone de Course / Dash (cercle jaune).
  * Si un aventurier dépasse sa vitesse standard vers le cercle jaune, son tour d'action est automatiquement consommé.
  * Détection continue des collisions physiques contre les murs et gouffres.
* **Navigation caméra :** Panoramique à la souris (clic molette ou clic droit) et zoom fluide centré sur le curseur.

#### 5. Lumière Dynamique & Brouillard de Guerre
* **Plein Jour vs Nuit Obscure :** Bascule en un clic de l'ambiance lumineuse du donjon.
* **Ombres portées et calcul de visibilité :** L'obscurité masque la carte aux joueurs avec opacité réglable ; les sources lumineuses percent le brouillard selon le rayon réel.
* **Torches héroïques portatives :** Rayon lumineux de 12 m activable par chaque héros (`T` ou bouton d'interface).
* **Foyers lumineux & Braseros fixes (MJ) :** Dépôt libre de braseros de 12 m sur la carte (`L`) avec suppression au clic droit.
* **Exploration persistante du brouillard :** Les zones explorées restent visibles en mémoire pour les aventuriers.
* **Pinceaux de brouillard pour le MJ :** Révélation au rectangle (`F`), masquage au cercle (`H`), ou réinitialisation globale (`Shift + F`).

#### 6. Murs, Gouffres & Portes Interactives
* **Murs de pierre (`W`) :** Segments opaques bloquant à la fois le regard et le passage physique.
* **Gouffres & Failles (`G`) :** Précipices infranchissables pour les pions, mais transparents à la ligne de vue et à la lumière.
* **Portes interactives (`D`) :**
  * Passages ouvrables et fermables au clic par le MJ ou par les joueurs à portée (< 2m / 120 px, touche `E`).
  * Verrouillage à double tour par le MJ (clic droit) empêchant l'ouverture sans crochetage ou clé.
* **Aimantation intelligente (Snapping) :** Jonction automatique des sommets des murs pour clore facilement des salles.
* **Outil de démolition (`X`) :** Destruction rapide de n'importe quel segment.

#### 7. Terrains Difficiles & Zones de Danger
* **Terrains ralentissants :** Marais (`1`), Eau profonde (`2`), Gravats (`3`), Toiles d'araignée (`4`) divisant la vitesse par deux (50%).
* **Zones de danger actif :**
  * Flammes (`5`) : 4 dégâts continus + statut Brûlé.
  * Poison (`6`) : 3 dégâts continus + statut Empoisonné.
  * Acide (`7`) : 5 dégâts corrosifs immédiats.
* **Dissipation de zone (`8`) :** Retrait d'un clic d'une surface d'effet.

#### 8. Pièges & Secrets Détectables
* **Mécanismes dissimulés :** Fosse secrète (`Shift + 1`, DD 12), Mâchoires d'acier (`Shift + 2`, DD 13), Fléchettes empoisonnées (`Shift + 3`, DD 14), Passage secret (`Shift + 4`, DD 13).
* **Perception Passive automatique :** Si la perception passive d'un aventurier atteint le Degré de Difficulté (DD) du piège alors qu'il se trouve dans son champ de vision, le mécanisme est automatiquement révélé.
* **Déclenchement physique :** Si un pion franchit la case d'un piège dissimulé, son mouvement est immédiatement interrompu et l'alerte retentit.
* **Panneau d'administration des pièges (`K`) :** Inspection, révélation manuelle, désamorçage ou réarmement par le MJ.

#### 9. Conditions & Altérations d'État
* **Règles 5e intégrées :**
  * *Aveuglé (Blinded) :* Champ de vision réduit à 0 case, écran plongé dans les ténèbres.
  * *Entravé (Restrained) :* Vitesse de déplacement bloquée à 0 m.
  * *Endormi (Asleep) :* Vitesse bloquée à 0 m, impossible d'agir.
  * *À terre (Prone) :* Vitesse divisée par deux (ramper).
  * *Brûlé (Burning) :* Dégâts réguliers de feu.
  * *Empoisonné (Poisoned) :* Affaiblissement toxique continu.
  * *Invisible :* Pion masqué pour les autres joueurs, rendu en semi-transparence (`alpha 0.45`) pour le MJ et le propriétaire.
* **Panneau d'administration (`A`) :** Application, retrait et décompte automatique de durée en rounds.

#### 10. Gestionnaire de Scènes & Téléporteurs (Donjons Multi-Niveaux)
* **Stockage 100% local depuis le PC :** Remplacement des URLs externes par un gestionnaire de fichiers qui charge directement les cartes depuis l'ordinateur du MJ.
* **Préchargement complet (Preload) :** Possibilité de précharger toutes les scènes et étages du donjon en arrière-plan pour éliminer tout temps de chargement lors des transitions.
* **Téléporteurs & Escaliers interactifs (`Shift + T`) :**
  * Pose de bornes de transition au sol (escaliers descendants, portails arcaniques, trappes).
  * Déclenchement automatique lorsque le pion d'un joueur franchit le seuil du téléporteur : transition immédiate de toute la table vers la scène cible aux coordonnées définies.
  * Démantèlement d'escalier via l'outil dédié (`Shift + X`).

#### 11. Volet Ancré des Raccourcis Clavier Tactiques
* **Panneau ancré rétractable :** Volet fixé à droite de l'écran, actif exclusivement sur la page Carte Tactique.
* **Onglets dédiés Joueur et MJ :** Vue synoptique de toutes les touches d'action rapides (déplacement, caméra, zoom, torche, portes, tours, craie, pings, murs, pièges, monstres...).
* **Feedback visuel discret (HUD Toast) :** Confirmation en temps réel de chaque raccourci activé sans perturber la partie.
* **Protection de saisie :** Les raccourcis sont ignorés intelligemment si l'utilisateur saisit du texte dans un champ ou si une modale est ouverte.

#### 12. Le Carnet d'Enquête & Mur de Liens Collaboratif
* **Mur de détective partagé :** Espace d'investigation où aventuriers et MJ épinglent des indices, témoignages, rumeurs, portraits de suspects et parchemins.
* **Ficelles d'investigation rouges :** Outil interactif permettant de relier deux indices entre eux pour tracer des déductions et hypothèses collectives.
* **Épinglage libre :** Création de fiches d'indices avec nom, type, texte, couleur et illustration locale depuis le PC.
* **Zéro automatisme contraignant :** Outil purement narratif favorisant la réflexion et l'immersion d'enquête.

#### 13. Dessin Libre & Craie Tactique Éphémère (Pings)
* **Craie tactile à main levée (`Q`) :** Permet aux joueurs et au MJ d'esquisser des manœuvres, fissures, barricades improvisées ou zones d'embuscade.
* **Palette flottante complète :** 7 couleurs thématiques (craie blanche, or, sang, céruléen, émeraude, violet améthyste, pierre ardoise) et 3 calibres de pointe (Fine, Moyenne, Large).
* **Mode Éphémère vs Permanent :**
  * *Éphémère (~5 secondes) :* Le trait disparaît tout seul avec fondu arcanique progressif.
  * *Permanent :* Le croquis reste ancré sur la carte jusqu'à son effacement.
* **Gomme à craie (`Shift + Q`) :** Suppression au clic des traits permanents.
* **Signaux d'attention lumineux (Pings, `Alt + Clic` ou `I`) :** Halo lumineux animé avec ondes sonores et badge de l'émetteur pour désigner un élément en une seconde.

#### 14. Fiches de PNJ & Objets Personnalisables "Bac à Sable"
* **Dépôt d'éléments interactifs (`Shift + O`) :** Coffres vermoulus, autels de sang, leviers en bronze, cadavres à fouiller, grimoires anciens, statues avec icônes runiques (`[■]`, `[T]`, `[+]`, `[B]`, `[X]`, `[S]`, `[♨]`, `[O]`, `[#]`, `[?]`).
* **Illustrations locales depuis le PC :** Import direct d'images de décor via téléversement sécurisé.
* **Règle tactile de portée (< 2m / 120 px) :** Les joueurs doivent s'approcher à portée pour ouvrir la fiche narrative de l'objet.
* **Documents secrets & Notes privées :**
  * Parchemin scellé révélable ou masqué aux joueurs en un clic (`[✦ Révéler Parchemin]`).
  * Notes secrètes réservées au MJ (pièges, trésors, conséquences).
* **Actionnement de portes liées :** Possibilité de lier un levier à une porte du donjon et de l'actionner directement depuis la fiche (`[⊓ Actionner Porte]`).
* **Épinglage sur le Mur d'Enquête :** Export instantané de l'objet et de ses indices vers le Carnet d'Enquête (`[# Épingler Enquête]`).
* **Improvisation sans script :** Espace libre pour formuler des actions (*"Je verse de l'eau bénite sur l'autel"*) transmises directement dans le chat de taverne.

---

### Architecture Technique

```text
├── data/
│   └── rooms.json              # Persistance des salles, scènes, fiches, objets et enquêtes
├── public/
│   ├── css/
│   │   └── rpg-theme.css       # Thème cRPG sombre (variables, fioles, panneaux forgés)
│   ├── js/
│   │   └── app.js              # Moteur Canvas, Ghost Pathing, Web Audio, Socket.io, raccourcis
│   ├── uploads/                # Stockage des illustrations d'inventaire, scènes et objets
│   └── index.html              # Vue unique SPA (Tailwind CSS, modales et menus tactiques)
├── src/
│   ├── config/
│   │   └── multer.js           # Configuration Multer (WebP, PNG, JPEG, SVG)
│   ├── data/
│   │   └── rpgRules.js         # Règles, équilibrages et tables de statistiques
│   ├── routes/
│   │   └── uploadRoutes.js     # Route API REST POST /api/upload
│   ├── services/
│   │   └── roomService.js      # Gestion des salons en mémoire et reconnexions
│   ├── sockets/
│   │   ├── char.handler.js     # Fiches de personnages et conditions
│   │   ├── chat.handler.js     # Salon de discussion et résolution des dés
│   │   ├── inv.handler.js      # Gestion des inventaires
│   │   ├── map.handler.js      # Pions, lumière, brouillard, scènes, props, dessins, enquêtes
│   │   ├── roomHandler.js      # Authentification et synchronisation d'état
│   │   └── index.js            # Routeur principal Socket.io
│   └── state/
│       └── RoomManager.js      # Gestionnaire d'état temps réel avec écriture différée
├── nodemon.json                # Exclusion de data/ et uploads/
├── package.json
└── server.js                   # Point d'entrée HTTP Express et Socket.io
```

---

### Prérequis et Installation

#### Prérequis
* Node.js (version 18.x ou supérieure)
* Gestionnaire de paquets npm, yarn ou pnpm
* Navigateur moderne prenant en charge les WebSockets, Canvas 2D et la Web Audio API

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
*(Le port par défaut est `3000`. Modifiez `PORT` dans `.env` si nécessaire).*

---

### Guide d'Utilisation

#### Démarrage du serveur
* Mode production :
```bash
npm start
```
* Mode développement (rechargement automatique) :
```bash
npm run dev
```
Accès par défaut : `http://localhost:3000`

#### Guide rapide des Raccourcis Clavier sur la Carte Tactique
| Raccourci | Rôle | Action |
| :--- | :--- | :--- |
| `V` | Tous | Mode Sélection & Déplacement de pion |
| `O` | Tous | Mode Vue Caméra libre (Pan) |
| `C` ou `Espace` | Tous | Centrer la caméra sur son héros (ou vue globale) |
| `+` / `-` / `0` | Tous | Zoom avant / Zoom arrière / Réinitialiser à 100% |
| `T` | Joueur | Allumer / Éteindre sa torche portative (12 m) |
| `E` | Joueur | Actionner la porte la plus proche (< 2 m) |
| `P` | Joueur | Confirmer et terminer son tour de jeu |
| `M` | Tous | Réglette tactique de mesure de distance |
| `Q` | Tous | Craie tactique (dessin libre éphémère ou permanent) |
| `Shift + Q` | Tous | Gomme à craie permanente |
| `Alt + Clic` ou `I` | Tous | Émettre un signal d'attention lumineux (Ping) |
| `W` | MJ | Tracer un segment de mur de pierre |
| `D` | MJ | Poser une porte interactive |
| `G` | MJ | Tracer un gouffre infranchissable (vue libre) |
| `X` | MJ | Démolir un mur, gouffre ou porte |
| `L` / `Shift + L` | MJ | Poser / Retirer un foyer lumineux (brasero 12 m) |
| `N` | MJ | Basculer Plein Jour / Nuit Obscure |
| `F` / `H` / `Shift + F` | MJ | Révéler / Masquer / Réinitialiser le brouillard |
| `1` à `8` | MJ | Poser des zones de terrain / danger et dissiper |
| `Shift + 1` à `5` | MJ | Poser des pièges secrets et passage dérobé |
| `K` | MJ | Ouvrir le panneau de contrôle des pièges |
| `A` | MJ | Ouvrir le panneau des altérations d'état |
| `S` | MJ | Ouvrir le gestionnaire de scènes et étages |
| `Shift + T` / `Shift + X` | MJ | Poser / Démanteler un téléporteur de scène |
| `B` / `Shift + B` | MJ | Invoquer un monstre / Invoquer un pion joueur |
| `Shift + O` / `Shift + D` | MJ | Poser / Supprimer un objet personnalisé |
| `Shift + P` | MJ | Ouvrir le catalogue d'objets interactifs |
| `Tab` / `Shift + R` | MJ | Passer au tour suivant / Nouveau round de combat |

---

### Sécurité et Anti-Triche
* **Autorité serveur stricte :** Statistiques vitales, déplacements, brouillard de guerre, résolution des dés et inventaires validés côté backend.
* **Contrôle des rôles :** Toutes les commandes d'arbitrage vérifient le rôle `mj` en mémoire.
* **Sauvegarde à écriture différée :** Temporisation des écritures sur `data/rooms.json` pour garantir une fluidité totale même en combat intense.

---

## English Version

### Overview
Foundry Lite is a self-hosted Virtual Tabletop (VTT) web application designed for dark fantasy immersion, dungeon exploration, and traditional tabletop roleplaying (in the spirit of classic cRPGs like *Baldur's Gate*, *Diablo II*, and immersive modules of *Foundry VTT*).

The application delivers real-time multiplayer synchronization via WebSockets with strict role separation: one Game Master (GM) and up to four adventurers.

---

### Core Features

* **Authentic cRPG Aesthetic:** Atmospheric UI reflecting an iron-clad grimoire with dark slate, aged vellum, forged metal trims, and glass liquid vials.
* **Hero Forge & Party Ledger:** 10 ancestries, 6 classes, Point Buy / 3d6 certified stat generation, origin titles, custom color signatures, and real-time vital tracking.
* **Tavern Chat & Polyhedral Dice:** Real-time roleplay ledger, polyhedral runic dice (d4 to d100), cinematic critical animations, and text syntax support (`/roll 2d6+3`).
* **Tactical Battlemap Canvas:** Freeform token motion (1 grid = 1.5 m = 50 px), direct trajectory ghost pathing, dash limits, and cursor-centered zoom.
* **Dynamic Lighting & Fog of War:** Day/Night cycle, hero torches (12 m), static braziers, raycasted obstacle shadows, and persistent fog exploration.
* **Walls, Chasms & Doors:** Stone walls (blocking line of sight and movement), chasms (blocking movement, open sight), and interactable doors with key locking.
* **Difficult Terrains & Hazards:** Mud, deep water, webs (-50% speed), fire, poison, and corrosive acid surfaces with one-click clearing.
* **Traps & Secrets:** Pit traps, bear snares, poison darts, secret passages, passive perception checks, and trigger warnings.
* **Conditions Tracker:** Blinded (blackout vision), Restrained, Asleep, Prone, Burning, Poisoned, and Invisible (client-side transparency) with round tracking.
* **Multi-Level Scenes & Teleporters:** 100% local map loading from PC, instant scene preloading, and interactable teleporters/stairs connecting dungeon floors.
* **Anchored Keyboard Shortcuts Panel:** Collapsible right-hand panel with dedicated Player and GM tabs, on-screen trigger feedback, and full battlemap keybindings.
* **Investigation Board (Detective Wall):** Shared conspiracy pinboard with clue cards, evidence linking red strings, and PC image uploads.
* **Chalk Drawing & Animated Pings:** Freehand drawing with 7 colors, 3 stroke widths, ephemeral (5s fade) or permanent mode, eraser tool, and animated pings (`Alt + Click` or `I`).
* **Sandbox Freeform Props & NPCs:** Deposit chests, altars, levers, corpses, or books with PC images; 2m range check; revealable secret documents; linked door toggles; and direct chat improvisation.

---

### Technical Architecture

```text
├── data/
│   └── rooms.json              # State persistence (rooms, scenes, heroes, props, clues)
├── public/
│   ├── css/
│   │   └── rpg-theme.css       # Dark cRPG stylesheet (variables, iron frames, shaders)
│   ├── js/
│   │   └── app.js              # Canvas engine, ghost pathing, Web Audio, Socket.io, shortcuts
│   ├── uploads/                # Local asset storage (inventories, maps, props, clues)
│   └── index.html              # SPA single page with Tailwind CSS and modals
├── src/
│   ├── config/
│   │   └── multer.js           # Multer storage and file type configuration
│   ├── data/
│   │   └── rpgRules.js         # Balancing tables and class definitions
│   ├── routes/
│   │   └── uploadRoutes.js     # Upload API endpoint POST /api/upload
│   ├── services/
│   │   └── roomService.js      # In-memory rooms and socket session management
│   ├── sockets/
│   │   ├── char.handler.js     # Character vitals and condition events
│   │   ├── chat.handler.js     # Chronicle messages and dice rolls
│   │   ├── inv.handler.js      # Inventory transactions
│   │   ├── map.handler.js      # Map, fog, lights, scenes, props, drawings, clues
│   │   ├── roomHandler.js      # Authentication and state synchronization
│   │   └── index.js            # Main socket router
│   └── state/
│       └── RoomManager.js      # Real-time state manager with debounced disk persistence
├── nodemon.json
├── package.json
└── server.js                   # Express and Socket.io entry point
```

---

### Prerequisites and Setup

1. **Prerequisites:**
   * Node.js (v18.x or higher)
   * npm, yarn, or pnpm
   * Modern browser with Canvas 2D, WebSockets, and Web Audio API support

2. **Setup:**
```bash
git clone https://github.com/Tacosknight/FoundryLite.git
cd FoundryLite
npm install
cp .env.example .env
```

3. **Running:**
* Production: `npm start`
* Development: `npm run dev`
* Default URL: `http://localhost:3000`

---

### Security and Anti-Tamper
* **Server Authority:** All vitals, inventory items, dice math, and fog exploration are verified on Node.js.
* **Role Verification:** GM-exclusive actions check session memory on every socket event.
* **Debounced Persistence:** Disk writes to `data/rooms.json` are debounced to prevent I/O stutters.

---

### Licence / License
Ce projet est sous licence [ISC](https://opensource.org/licenses/ISC). Développé pour les passionnés de jeux de rôle sur table.
Distributed under the [ISC License](https://opensource.org/licenses/ISC). Crafted for dark fantasy tabletop enthusiasts.
