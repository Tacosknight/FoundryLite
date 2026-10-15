# FoundryLite

Lightweight, self-hosted Virtual Tabletop (VTT) designed for local or tunneled role-playing game sessions. Built with Node.js, Express, Socket.io, and Tailwind CSS.

Table virtuelle de jeu de rôle (VTT) auto-hébergée et légère, conçue pour des sessions en réseau local ou via tunnel. Développée avec Node.js, Express, Socket.io et Tailwind CSS.

---

## English

### Overview
FoundryLite is a minimalist Virtual Tabletop focused on real-time state synchronization, low latency, and an old-school pen-and-paper aesthetic. It runs entirely on the host machine without external cloud dependencies, making it suitable for private play groups connecting over local networks or secure tunnels (such as Cloudflare Tunnel or Tailscale).

### Key Features
* **Real-time synchronization:** Persistent state management with Socket.io for instant health, energy, and token updates.
* **Character creation:** Medieval-fantasy interface featuring 10 races, 6 classes, Point Buy/3d6 attribute systems, class-specific starting equipment, and dynamic origin titles.
* **Secure dice engine:** Server-authoritative dice roller preventing client-side tampering, with natural 1 and 20 detection.
* **Local asset management:** On-the-fly client-side image compression (HTML5 Canvas to WebP) before transmission to protect tunnel bandwidth.
* **Modular architecture:** Clean single-page application (SPA) routing keeping WebSocket connections alive across views.

### Tech Stack
* **Runtime:** Node.js
* **Backend:** Express, Socket.io, Multer
* **Frontend:** Vanilla JavaScript, HTML5, Tailwind CSS
* **Persistence:** Local JSON flat-file storage with debounced disk writes

### Installation and Setup

1. Clone the repository:
```bash
git clone https://github.com/Tacosknight/FoundryLite.git
cd FoundryLite
```

2. Install dependencies:
```bash
npm install
```

3. Launch the server:
```bash
npm start
```

4. Open your browser and navigate to:
```text
http://localhost:3000
```

---

## Français

### Présentation
FoundryLite est une table virtuelle de jeu de rôle minimaliste axée sur la synchronisation en temps réel, une latence minimale et une esthétique inspirée des jeux de rôle classiques sur table. L'application tourne intégralement sur la machine hôte sans dépendance au cloud, idéale pour des parties privées via réseau local ou tunnels sécurisés (type Cloudflare Tunnel ou Tailscale).

### Fonctionnalités principales
* **Synchronisation temps réel :** Gestion centralisée de l'état via Socket.io pour la mise à jour immédiate des PV, de l'énergie et des fiches.
* **Création de personnage :** Interface médiévale-fantastique comprenant 10 races, 6 classes, attribution des caractéristiques par points (Point Buy) ou tirage 3d6, paquetages de départ et titres d'origine dynamiques.
* **Moteur de dés sécurisé :** Calcul des jets exécuté côté serveur pour empêcher la triche, avec détection des réussites et échecs critiques.
* **Gestion optimisée des images :** Compression automatique côté client (Canvas HTML5 vers WebP) avant l'envoi pour préserver la bande passante du tunnel.
* **Architecture modulaire :** Structure Single Page Application (SPA) maintenant la connexion WebSocket active entre les différentes vues.

### Stack technique
* **Environnement :** Node.js
* **Serveur :** Express, Socket.io, Multer
* **Interface :** JavaScript natif, HTML5, Tailwind CSS
* **Persistance :** Fichier JSON local avec écriture différée (debounce)

### Installation et démarrage

1. Cloner le dépôt :
```bash
git clone https://github.com/Tacosknight/FoundryLite.git
cd FoundryLite
```

2. Installer les dépendances :
```bash
npm install
```

3. Démarrer le serveur :
```bash
npm start
```

4. Ouvrir un navigateur à l'adresse :
```text
http://localhost:3000
```
