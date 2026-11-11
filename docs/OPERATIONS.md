# Exploitation et sécurité

Ce document décrit les changements en cours. Les tests utilisent uniquement des campagnes synthétiques et des répertoires temporaires. Le parcours Chromium vérifie création MJ, invitation, forge du personnage, reconnexion, récupération d'identité, fin volontaire du tour avec `P`, restauration et export/import JSON depuis l'interface. Il ne remplace pas une recette complète ni une revue exhaustive de sécurité.

## Limites de cette version de développement

- Export JSON avec références aux médias, sans archive autonome des images ; la migration hors ligne des anciens médias `/uploads` est limitée aux formats et chemins décrits ci-dessous.
- Journal des actions sélectionnées réservé au MJ ; certaines narrations automatiques sont masquées aux joueurs par prudence.
- Une seule instance écrivain par répertoire. Les commandes Socket.IO sont sérialisées ; les uploads HTTP restent un chemin distinct. Une erreur disque après renommage peut laisser un résultat durable incertain : ne pas supposer un rollback transactionnel.
- Projections et contrôles couverts par des régressions ciblées, pas par un audit exhaustif de tous les événements. Ne pas déployer cette refonte en production sans recette et sauvegarde préalable.
- Brouillard : les pixels d’une image déjà téléchargée ne sont pas confidentiels ; une information déjà révélée ne peut pas être retirée de la mémoire des joueurs.

## Déploiement

- Utilisez Node.js 24 pour reproduire la CI, installez avec `npm ci`, puis démarrez avec `npm start`. Copiez `.env.example` vers `.env` et adaptez ses valeurs.
- `DATA_DIRECTORY` désigne le répertoire privé contenant les campagnes, identités, sauvegardes et médias. Il vaut `./data` par défaut avec `server.js`. Limitez les droits d'accès, maintenez des sauvegardes chiffrées hors machine et testez leur restauration. Ne publiez ni ce répertoire ni `.env`.
- `ALLOWED_ORIGINS` contient les origines exactes autorisées, séparées par des virgules (par exemple `https://vtt.example.org`, sans slash final). Pour un accès distant, utilisez HTTPS et `SECURE_COOKIES=true` derrière une terminaison TLS correctement configurée. Les cookies Secure ne fonctionnent pas sur une connexion HTTP ordinaire.
- Restreignez l'accès réseau aux personnes de confiance. La liste d'origines et les cookies ne remplacent pas une politique réseau, des mises à jour ou une revue de sécurité. Ne considérez pas les descriptions historiques du README comme des garanties de sécurité.

## Identité et invitations

L'application utilise une identité sans compte traditionnel : une session est créée automatiquement et associée à un cookie. Le code de récupération est sensible : conservez-le dans un gestionnaire de secrets, ne le partagez pas et ne le publiez pas. Une récupération renouvelle le code et les sessions ; l'effacement des données du navigateur sans code de récupération peut empêcher de retrouver l'identité. Les invitations de salle passent par l'événement Socket.IO `room:invite` ; une invitation est un secret à transmettre de manière privée, pas une preuve d'identité indépendante. Vérifiez le flux utilisateur avant tout déploiement.

## Sauvegarde, export et migration

- Arrêtez proprement le serveur et sauvegardez ensemble tout `DATA_DIRECTORY`, y compris les identités, les fichiers de campagne, leurs sauvegardes et les médias. Vérifiez les permissions et testez une restauration dans un répertoire isolé. Les sauvegardes locales ne protègent pas d'une perte de la machine.
- Les exports JSON contiennent à ce stade des références aux médias, pas nécessairement leurs fichiers. Ils ne constituent donc pas une archive autonome ; conservez séparément les médias et leurs associations.
- Les anciens médias sous `/uploads` sont bloqués. L'outil de migration ci-dessous ne modifie pas les originaux ; conservez une sauvegarde indépendante.
- Les données legacy ambiguës ou limitées à la présence peuvent être refusées. Faites une copie avant migration et traitez les erreurs explicitement, sans remplacer un fichier illisible par une campagne vide.

## Migration hors ligne des médias legacy

Arrêtez le serveur et tout autre processus utilisant les deux répertoires ; aucun verrou interprocessus n'est pris. Sauvegardez indépendamment le répertoire de données et les médias originaux, puis travaillez d'abord sur une copie isolée :

```sh
node scripts/migrate-legacy-media.js --data-directory /chemin/donnees --uploads-directory /chemin/public/uploads
```

Sans `--apply`, la simulation ne modifie aucun fichier. Examinez son résultat avant de relancer avec les mêmes arguments et `--apply`. La commande sauvegarde le `rooms.json` original et conserve les fichiers source. Elle ne prend en charge que les références exactes `/uploads/asset-<nombre>-<nombre>.<extension>` et les images PNG, JPEG et WebP statiques valides. Les chemins ambigus, liens symboliques de fichiers, médias absents, images animées et autres formats sont refusés ; les limites de taille, pixels et quota s'appliquent. Une erreur pendant l'application peut laisser des médias orphelins : l'opération n'est pas transactionnelle ; inspectez les fichiers et sauvegardes avant toute nouvelle tentative.

## Rattachement hors ligne d'une campagne legacy

Arrêtez le serveur et tout autre processus utilisant ce répertoire pendant toute l'opération. Aucun verrou interprocessus ne garantit cette exclusion. Sauvegardez auparavant tout le répertoire et vérifiez le nom exact de la campagne et l'identifiant de l'identité dans `identities.json` (fichier sensible, ne partagez pas son contenu). Dans une copie isolée, lancez d'abord :

```sh
npm run campaign:admin -- --data-directory /chemin/prive/vers/donnees --campaign 'Nom de campagne' --identity 'identifiant-existant'
```

La simulation est strictement en lecture seule. Après vérification, relancez avec les mêmes arguments et `--apply` pour enregistrer. La commande refuse toute campagne contenant déjà un champ `access`, même vide ou invalide ; elle ne transfère jamais une propriété existante. Elle ajoute le propriétaire comme MJ, sans rattacher automatiquement les personnages ou joueurs existants. Le fichier original `rooms.json` est copié dans `backups/` avant remplacement ; conservez également votre sauvegarde indépendante. Les documents invalides ou ambigus sont refusés. Cette opération ne migre pas les médias legacy.

## Intégration serveur

L'API programmatique impose un répertoire de données explicite. Elle ne lance pas elle-même l'écoute :

```js
const { createServer } = require('./src/createServer');
const instance = await createServer({
  dataDirectory: '/chemin/prive/vers/donnees',
  allowedOrigins: ['https://vtt.example.org'],
  secureCookies: true
});
instance.server.listen(3000);
// À l'arrêt, attendre instance.close() et traiter son éventuel rejet.
```

L'objet retourné expose `server`, `services` et `close` (ainsi que `app` et `io`). Utilisez un répertoire temporaire dédié pour chaque test, jamais les données de production. Les accès concurrents par plusieurs processus au même répertoire ne sont pas coordonnés par cette API.

## English

The storage, identity and media changes are in progress. Synthetic Chromium tests cover campaign creation, invitation, character creation, reconnect, voluntary turn completion with P, and restoration. These are targeted regressions, not a complete acceptance or security audit. JSON media bundling remains incomplete; an offline legacy media migration tool is available with the limitations described above. Use Node 24, `npm ci`, and `npm start`. Configure a private `DATA_DIRECTORY`, exact comma-separated `ALLOWED_ORIGINS`, and HTTPS with `SECURE_COOKIES=true`. Keep encrypted off-host backups of the entire data directory, including identities and assets, and test restores in isolation.

There are no traditional accounts: a session cookie is created automatically. Protect the recovery code and share `room:invite` invitations privately. Neither cookies nor origin checks alone make an internet-facing deployment safe.

JSON exports currently contain media references, not a self-contained bundle. Legacy `/uploads` access is blocked. Stop all processes, independently back up data and originals, and run the offline migration tool in dry-run mode before considering `--apply`; it supports only the paths and static image formats documented above and is not transactional. Legacy presence-only or ambiguous records may be rejected. The programmatic `createServer({ dataDirectory, allowedOrigins, secureCookies })` requires an explicit data directory and returns `server`, `services` and an async `close()`; call `server.listen()` yourself and await `close()` on shutdown. Do not point tests at production data or share a data directory between concurrent server processes.
