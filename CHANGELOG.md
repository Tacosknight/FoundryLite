# Changelog - Foundry Lite

Toutes les modifications notables apportées à la plateforme Foundry Lite sont consignées dans ce document.

---

## [v1.0.0] - 2026-10-17 - Release Officielle "Table Ronde Forgée"

Cette version 1.0.0 marque l'aboutissement de la plateforme complète de Table Ronde Virtuelle (VTT) dark fantasy, intégrant un moteur de combat tactique en temps réel, un système d'ambiance et de vision dynamique, une gestion de donjons multi-étages 100% locale, un tableau d'enquête collaboratif et une liberté d'improvisation totale sans contrainte de script.

---

### [■] Nouvelles Fonctionnalités Majeures (Core Release Features)

#### 1. Direction Artistique & Immersion Dark Fantasy cRPG
* **Esthétique de Grimoire Forgé :** Rejet absolu du design plat et corporatif au profit d'un univers visuel texturé évoquant l'ardoise, le fer forgé (`#0c0a09`, `#1c1917`, `#292524`), le vélin patiné (`#f5ebe0`, `#e6ccb2`) et les garnitures en laiton doré terni (`#d4af37`, `#78350f`).
* **Typographies d'ambiance médiévale :** Cinzel Decorative (grands titres), Cinzel (runes, sous-titres et boutons), Crimson Pro et EB Garamond (dialogues et chroniques).
* **Fioles vitales arcaniques :** Jauges de santé et d'énergie conçues comme des tubes de verre à reflets spéculaires avec remplissage liquide épais et scintillement continu.
* **Sceaux & Couleurs d'Équipe :** Chaque joueur choisit sa teinte distinctive appliquée à son blason, son sceau de cire, ses messages de taverne et son pion de combat.
* **Sanctuaire d'Or du MJ :** Réservation exclusive des teintes d'or flamboyant (`#facc15`, `#d4af37`) et du sceau de commandement pour les arbitrages du Maître du Jeu.

#### 2. La Forge du Destin (Création de Héros & Suivi d'Équipe)
* **Dix lignées et races jouables :** Humain, Elfe, Nain, Demi-Orc, Halfelin, Drakéide, Tieffelin, Gnome, Gobelin, Demi-Elfe (modificateurs de points de vie, d'énergie, vision nocturne et traits passifs).
* **Six classes équilibrées :** Guerrier, Mage, Voleur, Clerc, Rôdeur, Paladin.
* **Système d'attribution des caractéristiques (FOR, DEX, INT, CHA) :**
  * *Point Buy (20 points) :* Répartition libre et équilibrée (base 8, maximum 15).
  * *Tirage 3d6 certifié :* Algorithme équilibré exécuté et garanti par le serveur.
* **Titres d'origine dynamiques :** 23 statuts sociaux combinés à 27 concepts abstraits (ex. *« Fossoyeur des cendres »*, *« Héraut de la flamme noire »*).
* **Tableau de bord d'équipe synchronisé :** Fiches d'aventuriers complètes avec jauges vitales, ajustements instantanés par paliers (`-5`, `-1`, `+1`, `+5`) et équipement.
* **Inventaire avec compression locale :** Création d'objets par le MJ avec téléversement et compression automatique WebP côté client (400x400 px, qualité 0.8).

#### 3. La Taverne : Registre de Discussion & Moteur de Dés Runiques
* **Chronique roleplay temps réel :** Messages gravés sur plaques de fer forgé avec horodatage, couleurs d'équipe et distinction du MJ.
* **Dés polyédriques runiques :** d4, d6, d8, d10, d12, d20 (doré), d100.
* **Interpréteur textuel de commandes :** Prise en charge des formules de dés `/r` et `/roll` (ex. `/roll 2d6+3`).
* **Effets cinématographiques d20 :**
  * *Réussite critique (20 naturel) :* Flash doré éclatant, secousse d'écran et particules festives.
  * *Échec critique (1 naturel) :* Pulsation rouge sang sinistre et fumée sombre.

#### 4. Carte Tactique (Battlemap) & Moteur de Déplacement Direct
* **Moteur Canvas 2D fluide :** Déplacement continu et libre sans blocage de quadrillage (1 case = 1.5 m = 50 px).
* **Trajectoire directe & graduations métriques :** Ligne droite continue avec encoches de distance tous les 1.5 m et silhouette de pion fantôme (Ghost Token) à l'arrivée.
* **Suppression des checkpoints encombrants :** Retrait complet des jalons intermédiaires numérotés pour un glisser-déposer naturel, immédiat et lisible.
* **Gestion des tours de jeu & Course (Dash) :**
  * Zone de mouvement standard (cercle bleu) et zone de course / Dash (cercle jaune).
  * Si un joueur déplace son pion au-delà de sa vitesse standard, son tour est automatiquement validé et consommé.
  * Sonnerie arcanique procédurale (Web Audio API) et bannière d'alerte lors du tour actif.
* **Navigation fluide :** Déplacement panoramique à la souris et zoom progressif centré sur le curseur.

#### 5. Éclairage Dynamique, Ombres Portées & Cycle Jour / Nuit
* **Bascule Plein Jour vs Nuit Obscure (`N`) :** Gestion globale de l'ambiance lumineuse du donjon.
* **Vision nocturne (Darkvision) selon la race :** Elfes et Nains perçoivent l'obscurité à 12 m (400 px) ; Humains aveugles sans source lumineuse (25 px).
* **Torches héroïques portatives (`T`) :** Torche personnelle allumable par chaque héros perçant le brouillard à 12 m pour l'ensemble du groupe.
* **Foyers lumineux & Braseros fixes (`L`) :** Vasques de flammes posées par le MJ illuminant 12 m en continu avec halo animé.
* **Brouillard de guerre persistant :** Les zones explorées restent gravées dans la mémoire des aventuriers ; outils MJ de révélation (`F`), masquage (`H`) et réinitialisation (`Shift + F`).

#### 6. Architecture Tactique : Murs de Pierre, Gouffres & Portes
* **Murs de pierre (`W`) :** Segments opaques infranchissables bloquant totalement la vue, la lumière et le mouvement physique.
* **Gouffres & Failles (`G`) :** Précipices bloquant le passage physique des pions mais transparents à la ligne de vue et à la lumière.
* **Portes interactives (`D`) :**
  * Vantaux à double battant ouvrables et fermables au clic par le MJ ou par les joueurs à portée (< 2 m / 120 px, touche `E`).
  * Verrouillage à clé par le MJ (clic droit) avec alerte de porte verrouillée.
* **Aimantation intelligente (Snapping) :** Jonction automatique des sommets de murs pour bâtir des salles rapidement.
* **Démolition rapide (`X`) :** Destruction au clic de n'importe quel segment.

#### 7. Terrains Difficiles & Zones de Danger Actif
* **Surfaces ralentissantes :** Marais boueux (`1`), Eau profonde (`2`), Gravats (`3`), Toiles d'araignée (`4`) divisant automatiquement la vitesse par deux (-50%).
* **Zones de danger continu :**
  * Nappe de flammes (`5`) : 4 dégâts de feu + altération Brûlé.
  * Nappe de poison (`6`) : 3 dégâts de poison + altération Empoisonné.
  * Flaque d'acide (`7`) : 5 dégâts corrosifs immédiats.
* **Dissipation de zone (`8`) :** Retrait d'une surface d'effet au clic.

#### 8. Pièges & Découvertes Dissimulées (Secrets)
* **Mécanismes secrets :** Fosse dissimulée (`Shift + 1`, DD 12), Mâchoires d'acier (`Shift + 2`, DD 13), Fléchettes empoisonnées (`Shift + 3`, DD 14), Passage secret (`Shift + 4`, DD 13).
* **Perception Passive automatique :** Révélation automatique dès que la perception passive d'un héros dans son champ de vision atteint le Degré de Difficulté (DD).
* **Interruption de déplacement :** Si un aventurier marche sur un piège non décelé, sa course est immédiatement stoppée sur la case exacte et l'alarme retentit.
* **Panneau d'administration (`K`) :** Inspection, révélation manuelle, désamorçage et réarmement par le MJ.

#### 9. Conditions & Altérations d'État (Règles 5e)
* **Système d'altérations complet (`A`) :**
  * *Aveuglé (Blinded) :* Obscurité totale (0 case de vision).
  * *Entravé (Restrained) :* Vitesse bloquée à 0 m.
  * *Endormi (Asleep) :* Vitesse bloquée à 0 m, incapacité totale.
  * *À terre (Prone) :* Vitesse divisée par deux (ramper).
  * *Brûlé (Burning) :* Dégâts de feu réguliers.
  * *Empoisonné (Poisoned) :* Affaiblissement toxique.
  * *Invisible :* Pion totalement masqué pour les autres joueurs, semi-transparent (`alpha 0.45`) pour le MJ et son propriétaire.
* **Décompte des rounds :** Décrémentation automatique de la durée à chaque tour de combat.

#### 10. Gestionnaire de Scènes & Donjons Multi-Niveaux
* **Fichiers 100% locaux depuis le PC du MJ :** Élimination définitive des URLs externes ; sélection directe des cartes sur le disque dur hôte.
* **Préchargement complet (Preload) :** Mise en cache mémoire de toutes les scènes et étages en amont pour des transitions instantanées à zéro temps de chargement.
* **Téléporteurs & Escaliers interactifs (`Shift + T`) :**
  * Bornes de transition reliant les niveaux entre eux (escaliers, trappes, portails).
  * Déclenchement automatique dès qu'un héros franchit la dalle du téléporteur : transition synchronisée de toute la table vers l'étage cible aux coordonnées exactes.
  * Démantèlement d'escalier via l'outil dédié (`Shift + X`).

#### 11. Volet Ancré des Raccourcis Clavier Tactiques
* **Panneau ancré rétractable :** Volet ancré à droite, exclusif à la page Carte Tactique, garantissant une utilisation sans conflit.
* **Onglets dédiés Joueur et MJ :** Répertoire clair de toutes les touches rapides.
* **Toast Feedback visuel :** Notification discrète et immédiate confirmant chaque action déclenchée.
* **Protection de saisie intelligente :** Désactivation des raccourcis si l'utilisateur saisit du texte dans un champ ou si une modale est ouverte.

#### 12. Le Carnet d'Enquête & Mur de Liens Collaboratif (Tableau de Détective)
* **Mur d'enquête partagé :** Panneau collaboratif où joueurs et MJ épinglent des indices, témoignages, rumeurs, portraits de suspects et parchemins.
* **Ficelles d'investigation rouges :** Outil interactif permettant de relier visuellement deux indices pour formuler des hypothèses d'enquête.
* **Épinglage libre :** Fiches personnalisables avec nom, type, texte, couleur et image locale depuis le PC.
* **Zéro automatisme contraignant :** Outil purement narratif au service de la réflexion collective.

#### 13. Outils de Dessin Libre & Craie Tactique Éphémère (Pings)
* **Craie tactile à main levée (`Q`) :** Dessin libre sur la carte pour esquisser des manœuvres, barricades de fortune ou zones d'embuscade.
* **Palette flottante complète :** 7 couleurs thématiques et 3 calibres de trait (Fine, Moyenne, Large).
* **Mode Éphémère vs Permanent :**
  * *Éphémère (~5 secondes) :* Le trait disparaît de lui-même avec fondu progressif.
  * *Permanent :* Le croquis reste sauvegardé sur la carte jusqu'à son effacement.
* **Gomme à craie (`Shift + Q`) :** Suppression au clic des traits permanents.
* **Signaux d'attention lumineux (Pings, `Alt + Clic` ou `I`) :** Halo arcanique pulsant avec ondes sonores et badge de l'émetteur pour désigner un point en une seconde.

#### 14. Fiches de PNJ & Objets Personnalisables "Bac à Sable" (Freeform Props)
* **Dépôt d'éléments interactifs (`Shift + O`) :** Coffres vermoulus, autels, leviers, cadavres, grimoires, statues avec icônes runiques (`[■]`, `[T]`, `[+]`, `[B]`, `[X]`, `[S]`, `[♨]`, `[O]`, `[#]`, `[?]`).
* **Images locales depuis le PC :** Téléversement d'illustrations d'objets avec aperçu instantané.
* **Règle tactile de portée (< 2 m / 120 px) :** Les joueurs doivent s'approcher à portée pour ouvrir la fiche narrative.
* **Documents secrets & Notes privées :**
  * Parchemin scellé révélable ou masqué d'un clic aux aventuriers (`[✦ Révéler Parchemin]`).
  * Notes secrètes réservées au MJ (pièges, trésors, conséquences).
* **Actionnement de portes liées :** Liaison directe entre un levier et une porte du donjon, actionnable depuis la fiche (`[⊓ Actionner Porte]`).
* **Export direct vers le Mur d'Enquête :** Épinglage automatique de l'objet et de ses indices sur le Carnet d'Enquête (`[# Épingler Enquête]`).
* **Improvisation narrative sans script :** Champ d'action libre (*"Je verse de l'eau bénite sur l'autel"*) diffusant l'intention directement dans le chat de taverne.

---

### [❖] Architecture Technique & Robustesse

* **Backend Haute Performance :** Node.js, Express 5 et Socket.io 4 avec séparation modulaire des contrôleurs (`char.handler.js`, `chat.handler.js`, `inv.handler.js`, `map.handler.js`).
* **Gestionnaire d'État Centralisé (`RoomManager.js`) :** Persistance temps réel dans `data/rooms.json` avec écriture différée (debounce 200 ms) pour absorber les rafales de mouvements en combat sans ralentissement disque.
* **Pipeline de Téléversement Sécurisé (`multer.js`) :** Support des formats WebP, PNG, JPEG, SVG pour les fonds de carte, inventaires, props et indices d'enquête.
* **Rendu Canvas Découplé :** Moteur Canvas 2D utilisant des buffers hors-écran (offscreen canvas) pour le calcul du brouillard de guerre et de l'éclairage sans impacter le taux de rafraîchissement principal (60 FPS).
* **Régulation Réseau (Throttling) :** Déplacements de pions et d'objets échantillonnés à 30-35 ms pour une réactivité parfaite sans congestionner la bande passante.

---

### [✓] Tableau Exhaustif des Raccourcis Clavier Tactiques

| Raccourci | Rôle | Action |
| :--- | :--- | :--- |
| `V` | Tous | Mode Sélection & Déplacement de pion |
| `O` | Tous | Mode Caméra libre (Pan) |
| `C` ou `Espace` | Tous | Centrer la caméra sur son héros (ou vue globale) |
| `+` / `-` / `0` | Tous | Zoom avant / Zoom arrière / Réinitialiser à 100% |
| `T` | Joueur | Allumer / Éteindre sa torche portative (12 m) |
| `E` | Joueur | Actionner la porte la plus proche (< 2 m) |
| `P` | Joueur | Confirmer et terminer son tour de jeu |
| `M` | Tous | Réglette tactique de mesure de distance |
| `Q` | Tous | Craie tactique (dessin libre éphémère ou permanent) |
| `Shift + Q` | Tous | Gomme à craie permanente |
| `Alt + Clic` ou `I` | Tous | Émettre un signal d'attention lumineux (Ping) |
| `W` | MJ | Tracer un segment de mur de pierre (bloque vue & pas) |
| `D` | MJ | Poser une porte interactive (ouvrable & verrouillable) |
| `G` | MJ | Tracer un gouffre infranchissable (vue & lumière libres) |
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
| `Shift + O` / `Shift + D` | MJ | Poser / Supprimer un objet interactif personnalisé |
| `Shift + P` | MJ | Ouvrir le catalogue d'objets interactifs |
| `Tab` / `Shift + R` | MJ | Passer au tour suivant / Nouveau round de combat |
