# ⚔️ FOUNDRY LITE - Table Ronde Virtuelle Old-School

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.3-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Une application web auto-hébergée de **Table Virtuelle de Jeu de Rôle (Virtual Tabletop / VTT)** pensée pour l'immersion *Dark Fantasy & Old-School RPG* (esprit *Baldur's Gate*, *D&D*). 

Elle offre une synchronisation multijoueur en temps réel avec gestion stricte des rôles : **1 Maître du Jeu (MJ)** et jusqu'à **4 Joueurs**.

---

## 🌟 Fonctionnalités (Features)

### 🎨 Ambiance Visuelle & Immersion Médiévale-Fantastique
- **Design texturé fait main** : Fini le flat design moderne ou les dashboards SaaS aseptisés. L'interface utilise des textures de pierre taillée (`stone-950`), des parchemins anciens (`bg-[#f4e4bc]`), des bordures ciselées et des effets de sceau de cire.
- **Typographies immersives** : Google Fonts *Cinzel*, *MedievalSharp* pour les titres et *Crimson Text* pour la lecture.
- **Couleurs Distinctives Héroïques** : Chaque joueur choisit sa couleur de signature (Cramoisi, Saphir, Émeraude, Pourpre, Braise, etc.) qui habille sa carte d'aventurier, sa pastille de sceau, ses messages dans la taverne et son futur jeton de carte.
- **Sanctuaire Doré & Couronne MJ 👑** : La couleur Or/Jaune (`#facc15`) est protégée et exclusivement réservée au Maître du Jeu. Tous les messages et lancers du MJ portent automatiquement la couronne royale pour être identifiés en un coup d'œil.

### 📜 La Forge du Destin (Création de Personnage)
- **10 Races fantastiques** : Humain, Elfe, Nain, Demi-Orc, Halfelin, Drakéide, Tieffelin, Gnome, Gobelin, Demi-Elfe (modificateurs de PV, Énergie et passif d'ascendance).
- **6 Classes équilibrées** : Guerrier, Mage, Voleur, Clerc, Rôdeur, Paladin avec rôles tactiques définis.
- **Système d'Attributs (FOR, DEX, INT, CHA)** :
  - **Option Point Buy** : 20 points à répartir avec boutons `[+]` / `[-]` (Base 8, Max 15).
  - **Option Tirage Aléatoire (3d6)** : Le serveur dépense équitablement l'intégralité des 20 points de façon sécurisée.
- **Système de Titre d'Origine** : Combinaison dynamique d'un statut social (23 options) et d'une allégeance/concept (27 options) forgeant des titres uniques (ex: *« Fossoyeur des cendres »*, *« Héraut de la flamme noire »*).
- **Dotation de Classe Automatique** : Injection à la validation de 2 objets physiques et d'une capacité/sort emblématique.
- **Verrouillage Post-Création & Renommage** :
  - Une fois son personnage forgé, le joueur n'a plus accès à la refonte de sa fiche.
  - L'onglet devient **« Renommer Héros »** : il peut modifier son patronyme à tout moment.
  - **Remplacement rétroactif dans le chat** : dès qu'un joueur se renomme, tous ses anciens messages dans la taverne sont instantanément mis à jour avec son nouveau nom et sa couleur.

### 🛡️ Vue Équipe & Fiches d'Aventuriers
- **Tableau de bord temps réel** : Suivi des 4 fiches de héros (PV actuels/max, Énergie actuelle/max, attributs, passif unique, inventaire).
- **Contrôles réservés au Maître du Jeu** :
  - Ajustement direct des jauges avec boutons d'incrément/décrément rapides (`-5`, `-1`, `+1`, `+5`).
  - Modale d'édition complète (✏️) pour ajuster les noms, classes et plafonds vitaux des aventuriers.
  - Apparition dynamique : aucun faux aventurier fantôme ; les cartes n'apparaissent que lorsque de vrais héros rejoignent et forgent leur personnage.

### 🎒 Inventaire & Upload d'Images WebP
- Grille d'objets stylisée par personnage avec quantité modifiable.
- **Création d'objets par le MJ** : Modale permettant de définir le nom, la description, la quantité et d'associer une illustration.
- **Optimisation de la bande passante (Client Canvas -> WebP)** : Les images téléversées sont compressées et redimensionnées automatiquement côté client (max 400x400px en WebP qualité 0.8) avant l'upload `multer` vers `public/uploads/`.

### 🍺 La Taverne : Discussion RP & Moteur de Dés
- **Chat multijoueur synchrone** : Salon textuel roleplay avec horodatage et coloration d'expéditeur.
- **Lancer de dés physique & virtuel (Réservé au MJ)** :
  - Barre rapide de dés classiques : `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`.
  - Commande `/r` ou `/roll` (ex: `/roll 2d6+3`, `/r 1d20+5`).
  - **Ciblage individuel ou général** : Le MJ peut attribuer un jet à un joueur précis ou à toute la table.
  - **Animation Casino / Machine à sous** : Effet de suspense central avec révélation cinématographique et zoom d'impact.
  - **Critiques d20** : 
    - `20 Naturel` : Lueur triomphale émeraude/or et explosion de confettis 🎉.
    - `1 Naturel` : Lueur cramoisie ténébreuse et secousse sismique de l'écran 💀.

### 🗺️ Carte Tactique (En cours de développement)
- Espace réservé pour la battlemap quadrillée, le déplacement des pions et le brouillard de guerre.

---

## 🛠️ Architecture Technique

```
├── data/
│   └── rooms.json              # Persistance JSON des salles, personnages et inventaires
├── public/
│   ├── css/                    # Feuilles de styles
│   ├── js/
│   │   └── app.js              # SPA Frontend, Canvas WebP, Socket.io client, Audio/FX
│   ├── uploads/                # Illustrations des objets uploadés
│   └── index.html              # Vue unique SPA (Tailwind + Google Fonts)
├── src/
│   ├── config/
│   │   └── multer.js           # Configuration upload Multer (filtre WebP, PNG, JPEG)
│   ├── data/
│   │   └── rpgRules.js         # Règles, équilibrages races/classes et calculs des stats
│   ├── routes/
│   │   └── uploadRoutes.js     # Route API REST POST /api/upload
│   ├── services/
│   │   └── roomService.js      # Gestion des salons en mémoire et reconnexions
│   ├── sockets/
│   │   ├── char.handler.js     # Événements char:create, char:rename, char:update_vitals, etc.
│   │   ├── chat.handler.js     # Événements chat:message et dice:roll
│   │   ├── inv.handler.js      # Événements inv:add_item, inv:remove_item, etc.
│   │   ├── roomHandler.js      # Événements room:join, déconnexion et synchronisation
│   │   └── index.js            # Point d'entrée Socket.io
│   └── state/
│       └── RoomManager.js      # Gestionnaire d'état de salle avec auto-sauvegarde debouncée
├── nodemon.json                # Ignore data/** et public/** pour éviter les reboots
├── package.json
└── server.js                   # Serveur HTTP Express + Socket.io
```

---

## 📦 Prérequis

- [Node.js](https://nodejs.org/) (Version **18.x** ou supérieure recommandée)
- [npm](https://www.npmjs.com/) (inclus avec Node.js) ou `yarn` / `pnpm`
- Un navigateur moderne (Chrome, Firefox, Safari, Edge) supportant WebSockets et Canvas HTML5.

---

## 🚀 Manuel d'Installation

### 1. Cloner le Répertoire
```bash
git clone https://github.com/votre-compte/vtt-rpg.git
cd vtt-rpg
```

### 2. Installer les Dépendances
```bash
npm install
```

### 3. Configurer l'Environnement
Copiez le fichier `.env.example` en `.env` :
```bash
cp .env.example .env
```
*(Par défaut, le serveur démarre sur le port `3000`. Vous pouvez modifier la variable `PORT` dans `.env` si nécessaire).*

---

## 🎮 Manuel d'Utilisation

### 1. Démarrer le Serveur

#### En Mode Production :
```bash
npm start
```

#### En Mode Développement (avec redémarrage automatique via Nodemon) :
```bash
npm run dev
```

Une fois démarré, vous verrez dans la console :
```
[VTT Server] Serveur démarré avec succès sur le port 3000
[VTT Server] Accès local : http://localhost:3000
```

---

### 2. Comment le Jeu Fonctionne (Guide Pas à Pas)

#### Étape A : Créer la Table (Le Maître du Jeu)
1. Ouvrez votre navigateur sur `http://localhost:3000`.
2. Laissez ou saisissez un nom de salle (ex: `table-ronde`).
3. Renseignez votre pseudo (ex: `Le Grand Mage`).
4. Dans le sélecteur de rôle, sélectionnez **« 👑 Créer en tant que MJ »**.
5. Cliquez sur **« Entrer sur la table de jeu »**.
6. Vous arrivez sur la vue **Équipe** : au départ, aucun joueur n'est présent (la table attend ses aventuriers).

#### Étape B : Rejoindre la Table (Les Joueurs - Jusqu'à 4)
1. Chaque joueur ouvre un nouvel onglet ou se connecte depuis un autre ordinateur du réseau local (`http://<IP_DU_SERVEUR>:3000`).
2. Il saisit le **même nom de salle** (ex: `table-ronde`), son pseudo (ex: `Gaston`) et sélectionne **« 🛡️ Rejoindre en tant que Joueur »**.
3. Comme il n'a pas encore de héros, il est immédiatement redirigé vers **« 📜 Forger Héros »**.

#### Étape C : Forger son Personnage
1. **Nom du Héros** : Saisissez le nom de votre avatar.
2. **Lignée & Race** : Choisissez parmi les 10 races pour ajuster vos PV/Énergie de base et votre passif d'ascendance.
3. **Vocation & Classe** : Choisissez parmi les 6 classes pour définir votre paquetage d'équipement et votre rôle tactique.
4. **Attributs Primordiaux** : Répartissez impérativement l'ensemble des **20 points** (soit manuellement en *Point Buy*, soit en 1 clic avec le bouton *Tirage Aléatoire*).
5. **Historique & Titre** : Associez un statut et un concept pour vous forger un titre de légende (ex: *« Chevalier renégat des abysses »*).
6. **Couleur Héroïque** : Choisissez votre couleur distinctive (le doré étant interdit car réservé au MJ).
7. Le parchemin de droite prévisualise vos statistiques en direct.
8. Cliquez sur le sceau de cire **« ⚔️ Forger mon Destin »**.
9. Vous basculez sur la vue **Équipe** : votre carte d'aventurier apparaît instantanément sur tous les écrans connectés !

#### Étape D : Renommer son Héros
- Si un joueur souhaite changer de nom plus tard, il clique sur l'onglet **« 🏷️ Renommer Héros »** dans la barre de navigation.
- Les choix d'attributs, de race et de classe sont définitivement verrouillés pour préserver l'équilibre de la partie.
- Il modifie simplement son nom et valide : **tous ses anciens messages dans la taverne sont immédiatement réécrits sous son nouveau nom !**

#### Étape E : Gérer les Fiches et l'Inventaire (Actions MJ)
- **Points de Vie & Énergie** : Seul le MJ peut cliquer sur les boutons `[-5]`, `[-1]`, `[+1]`, `[+5]` de chaque fiche pour faire évoluer l'état de santé du groupe.
- **Édition Rapide (✏️)** : Le MJ peut ouvrir la modale pour ajuster les plafonds maximaux.
- **Forger un Nouvel Objet** : Le MJ clique sur `+ Nouvel Objet` sur la fiche d'un joueur, entre le libellé, la quantité et glisse une image (PNG/JPG/WebP). L'image est automatiquement compressée et ajoutée à l'inventaire en temps réel.
- **Gestion du Sac** : Le MJ peut incrémenter/décrémenter la quantité d'objets (flèches, potions) avec les boutons `+` / `-`, ou jeter un objet via la croix `[x]`.

#### Étape F : Jouer dans la Taverne & Lancer les Dés
- **Discussion RP** : Les joueurs et le MJ discutent dans le salon. Les pseudonymes apparaissent colorés selon le sceau de chaque héros (et en jaune or avec couronne 👑 pour le MJ).
- **Lancers de dés** :
  - Le MJ sélectionne la cible du jet (*Toute la table* ou *un héros précis*).
  - Il clique sur l'un des boutons de dés rapides (`d4` à `d100`) ou tape `/roll 1d20+4` dans le chat.
  - L'animation suspense de machine à sous se déclenche au milieu de l'écran des joueurs avec le dénouement critique ou l'échec associé !

---

## 🔒 Sécurité & Anti-Triche
- **Calculs côté serveur** : Les statistiques de PV, d'Énergie et la résolution des jets de dés sont intégralement calculées et validées sur le backend Node.js.
- **Vérification stricte des rôles** : Les requêtes socket (`char:update_vitals`, `dice:roll`, `inv:add_item`) vérifient la légitimité du rôle `mj` en mémoire serveur.
- **Protection des couleurs** : Tout joueur essayant d'injecter la couleur jaune dorée du MJ voit sa requête filtrée et basculée sur une couleur standard.
- **Débouncing de persistance** : Les modifications de fiches et d'inventaires sont sauvegardées dans `data/rooms.json` avec un mécanisme de temporisation (debounce) pour prévenir les surcharges d'écriture disque.

---

## 📜 Licence

Ce projet est sous licence [ISC](https://opensource.org/licenses/ISC). Développé pour les passionnés de jeux de rôle sur table.
