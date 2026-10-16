# 📜 CHANGELOG - Foundry Lite

Toutes les modifications notables apportées au projet pour cette version sont consignées ci-dessous.

---

## 🚀 Nouvelles Fonctionnalités (New Features)

### 💾 Système de Sauvegarde de Session & Cycle de Vie des Salles
- **Bouton « 💾 Sauvegarder » pour le MJ** : Ajout d'un bouton dédié dans la barre de navigation supérieure, accessible uniquement au Maître du Jeu connecté.
- **Persistance à la demande** : Les fiches, PV, points d'énergie, objets d'inventaire et historiques sont désormais enregistrés de façon pérenne dans `data/rooms.json` uniquement si le MJ clique sur « Sauvegarder ».
- **Reprise de session fluide** : Lorsqu'une partie a été sauvegardée, les joueurs peuvent se reconnecter ultérieurement avec leur pseudo d'origine et retrouver instantanément leur avatar, leurs points de vie et l'intégralité de leur besace.
- **Nettoyage automatique à l'abandon** : Si le MJ quitte ou ferme son navigateur sans sauvegarder, la salle est intégralement purgée de la mémoire serveur et du disque pour éviter les parties fantômes.
- **Déconnexion synchrone des aventuriers** : Dès que le MJ quitte la session, tous les joueurs de la table sont automatiquement déconnectés et redirigés vers l'accueil avec un message contextuel.

### 🎨 Sécurité et Exclusivité des Couleurs Héroïques
- **Palette dynamique en temps réel** : La grille des couleurs de la Forge de Personnage s'actualise instantanément dès qu'un autre joueur sélectionne sa couleur.
- **Verrouillage visuel des couleurs prises** : Les couleurs déjà attribuées sont automatiquement grisées, désactivées (`disabled`), marquées d'une croix rouge ✕ et du libellé *« Prise »*.
- **Réassignation préventive** : Si la couleur en cours de prévisualisation est validée par un autre joueur avant vous, le sélecteur bascule automatiquement sur la première couleur libre.
- **Validation serveur stricte (Anti-triche)** : Le backend rejette toute tentative d'injection d'une couleur déjà prise ou de la couleur dorée réservée au MJ.

### 🏷️ Identité Visuelle & Nommage Officiel
- **Rebranding « Foundry Lite »** : Harmonisation globale du nom du projet à travers l'interface utilisateur, le titre de document, les métadonnées, le `package.json` et la documentation `README.md`.

---

## 🐛 Corrections de Bugs (Bug Fixes)

- **Fix du joueur fantôme à la création de salle** : Nettoyage des anciennes données de tests persistées dans `data/rooms.json` qui provoquaient l'affichage immédiat d'un héros non désiré dès l'arrivée du MJ.
- **Résolution du plantage `ENOENT` sur `data/rooms.json`** : Ajout de la création récursive du répertoire `data/` via `fs.mkdir(..., { recursive: true })` avant toute écriture pour prévenir les crashs lors d'un `git clone` frais.
- **Protection des dossiers vides sous Git** : Ajout des marqueurs `.gitkeep` pour `data/` et `public/uploads/` afin d'assurer la présence physique de ces répertoires sur GitHub sans versionner les données privées des tables.
- **Gestion des déconnexions intempestives en partie sauvegardée** : Correction de `removePlayerCharacter` pour détacher le `socketId` sans supprimer le personnage du joueur si la salle est marquée comme sauvegardée.
- **Correction des conflits Git distants** : Synchronisation propre avec `origin/main` et rebasage sans perte de commits.
