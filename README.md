# Epson Quiz Live

Quiz multijoueur en temps réel (web + mobile) pour vos événements : 5 questions,
60 secondes de chrono, 80+ joueurs simultanés dans une même room, console
organisateur temps réel.

**Aucune base de données.** Tout l'état (rooms, joueurs, réponses, scores,
classement) vit en mémoire dans le processus Node.js. Redémarrer le serveur
réinitialise donc la room en cours.

---

## Sommaire

- [Stack](#stack)
- [Installation](#installation)
- [Lancement en développement](#lancement-en-développement)
- [Variables d'environnement](#variables-denvironnement)
- [Règles du jeu](#règles-du-jeu)
- [Sécurité des rôles](#sécurité-des-rôles)
- [Chronométrage autoritaire](#chronométrage-autoritaire)
- [Build web et déploiement](#build-web-et-déploiement)
- [Application mobile (Capacitor)](#application-mobile-capacitor)
- [PWA](#pwa)
- [Test de charge](#test-de-charge)
- [Structure du projet](#structure-du-projet)
- [Personnaliser le quiz](#personnaliser-le-quiz)
- [Logo Epson](#logo-epson)
- [Limites connues](#limites-connues)

---

## Stack

| Couche     | Technologie                                                        |
| ---------- | ------------------------------------------------------------------ |
| Client     | React 18 + TypeScript + Vite, responsive mobile first              |
| Temps réel | Socket.IO 4 (WebSocket avec repli long-polling)                    |
| Serveur    | Node.js + TypeScript (`tsx`), Express + Socket.IO                  |
| Design     | Interface néon sombre, fond briques, halos cyan/magenta            |
| Icônes     | lucide-react                                                       |
| Mobile     | PWA (vite-plugin-pwa) + Capacitor 7 (Android / iOS)                |
| Stockage   | **Mémoire uniquement** (`Map`), zéro fichier de persistance        |

Monorepo : `/client`, `/server`, `/shared` (contrat TypeScript partagé).

---

## Installation

Prérequis : **Node.js ≥ 20** et npm ≥ 10.

```bash
npm install
cp .env.example .env          # Windows : copy .env.example .env
```

Éditez `.env` et définissez impérativement `ADMIN_PASSWORD`.
Le serveur refuse de démarrer sans ce mot de passe.

---

## Lancement en développement

```bash
npm run dev
```

- Client Vite : <http://localhost:5173>
- Serveur Socket.IO : <http://localhost:3001>
- Console admin : <http://localhost:5173/admin>

Le client Vite proxifie `/socket.io` vers le serveur Node (WebSocket inclus),
aucune configuration CORS supplémentaire n'est nécessaire en local.

Autres commandes utiles :

```bash
npm run typecheck     # TypeScript strict, client + serveur
npm run build         # build de production du client (dist/)
npm start             # serveur de production (sert aussi client/dist)
npm run load-test     # test de charge Socket.IO
npm run icons         # régénère les icônes PWA/Capacitor depuis le logo
```

---

## Variables d'environnement

Fichier `.env` à la racine (voir `.env.example`).

| Variable         | Obligatoire | Défaut                                       | Description                                                                  |
| ---------------- | ----------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `ADMIN_PASSWORD` | **oui**     | —                                            | Mot de passe de la console `/admin`, vérifié côté serveur.                    |
| `PORT`           | non         | `3001`                                       | Port HTTP + Socket.IO.                                                       |
| `CORS_ORIGIN`    | non         | `http://localhost:5173,http://localhost:4173` | Origines autorisées, séparées par des virgules.                              |
| `VITE_SERVER_URL` (client) | non | même origine                                | URL absolue du serveur. **Obligatoire pour Capacitor et pour un client hébergé séparément.** |

Le serveur charge `.env` depuis la racine du monorepo puis depuis `/server`.

---

## Règles du jeu

### Cycle de vie de la room

`WAITING` → `COUNTDOWN` → `RUNNING` → `FINISHED`

- **Démarrer le quiz** : passe en décompte 5 → 0, puis chaque joueur présent
  reçoit son chrono de 60 s.
- **Fermer / ouvrir l'accès** : l'admin peut bloquer les nouvelles entrées puis
  les rouvrir tant que la room n'est pas `FINISHED`. Un joueur bloqué voit
  « Accès fermé par l'organisateur ».
- **Afficher le classement** : actif uniquement quand la room est `FINISHED`.
  Ouvre une **popup** dans la console : décompte 5 → 0, puis podium des 3
  premiers avec, pour chaque place, le cadeau défini par l'organisateur.
- **Nouvelle room** : actif **uniquement** si la room précédente est `FINISHED`.
  Sinon le bouton est désactivé et un message explique pourquoi. L'action
  réinitialise joueurs, scores et classement (vérifié aussi côté serveur).
  Les **cadeaux du podium sont conservés** d'une room à l'autre.
- Une room devient `FINISHED` quand tous ses joueurs ont terminé ou ont été
  clôturés automatiquement à l'expiration de leur chrono.

### Parcours joueur

1. Nom, prénom, société (tous obligatoires), dans une interface néon conforme
   aux maquettes (titre INSCRIPTION, champs cyan, bouton lumineux).
2. Salle d'attente avec compteur de joueurs en direct.
3. Décompte 5 → 0 (synchronisé, basé sur l'heure serveur).
4. 5 questions affichées **une par une**, avec **un seul minuteur global de 60 s**.
   Dès qu'une réponse est sélectionnée, la question suivante s'affiche
   automatiquement : **le retour en arrière est impossible**.
5. Après la dernière réponse, un écran de fin propose **Terminer** (envoi
   définitif) ; les réponses sont aussi envoyées automatiquement à
   l'expiration du chrono.
6. Résultat : carte néon avec score (`4/5`), temps précis au millième
   (`25,221s`) et « Votre résultat a bien été enregistré », puis
   « Merci d'avoir participé, les résultats seront annoncés par l'organisateur ».
7. Reconnexion : l'identifiant joueur est conservé dans `localStorage`, la
   session est restaurée (y compris les réponses déjà envoyées).

Un joueur qui rejoint **après le démarrage** dispose de son propre décompte
5 → 0 puis de son propre chrono de 60 s, sans perturber les autres.

### Classement et cadeaux (admin uniquement)

Trié par **nombre de bonnes réponses décroissant**, puis par **temps de réponse
croissant**. La popup « Afficher le classement » lance un décompte 5 → 0, puis
révèle le podium des 3 premiers : médaille, nom, score, temps et **cadeau de la
place**. Les joueurs ne reçoivent jamais le classement, la liste des joueurs,
les cadeaux ni les statistiques.

La console admin contient un panneau **Cadeaux du podium** : un champ par place
(1re, 2e, 3e), enregistré côté serveur. Les cadeaux peuvent être saisis avant le
démarrage ou après la room, restent verrouillés pendant le quiz, et sont
conservés pour toutes les nouvelles rooms (mémoire du serveur).

### Questions

Définies dans [`server/src/questions.ts`](server/src/questions.ts) : 5 questions,
3 propositions, un seul index correct. Les réponses correctes **ne quittent
jamais le serveur** : le client reçoit uniquement `{ id, prompt, options }`.

---

## Sécurité des rôles

- Connexion admin : `admin:login` avec mot de passe, comparé côté serveur en
  temps constant (SHA-256 + `timingSafeEqual`), avec blocage temporaire après
  5 échecs.
- Le serveur délivre ensuite un **token aléatoire** (32 octets) conservé en
  mémoire. Chaque action admin (`start`, `close-access`, `open-access`,
  `new-room`) et l'enregistrement des cadeaux (`admin:set-prizes`) revalident
  ce token.
- Les sockets authentifiés rejoignent la room Socket.IO `admin`. Les snapshots
  (`admin:snapshot`) sont émis **uniquement** vers cette room ; un joueur ne
  reçoit que sa propre session et les compteurs publics.
- La liste des joueurs, les statistiques et le classement sont inclus
  exclusivement dans `admin:snapshot`.
- Diffusion des snapshots admin **limitée à 1 fois par seconde** (throttle
  leading + trailing edge).
- Validation serveur systématique : champs du formulaire, longueurs, caractères
  de contrôle, index de réponse 0–2, identifiant de question, joueur déjà
  clôturé, quiz non démarré, temps écoulé.

---

## Chronométrage autoritaire

- Le chrono démarre côté serveur avec `process.hrtime.bigint()` au moment exact
  où le quiz du joueur commence (fin du décompte global ou personnel).
- La durée est calculée à la réception de `player:finish` : `end - start` en
  nanosecondes, arrondie à la milliseconde. Le client ne fournit aucun temps.
- À l'expiration, le serveur clôture automatiquement avec exactement 60 000 ms.
- Le décompte et le minuteur du client reposent sur des **horodatages absolus
  serveur** (`countdownEndsAt`, `quizEndsAt`) et sur un décalage d'horloge
  recalculé à chaque événement, jamais sur une durée locale.
- Réseau lent ou onglet en veille : la reconnexion restaure l'échéance réelle.

---

## Build web et déploiement

```bash
npm run build     # génère client/dist + service worker PWA
npm start         # serveur Node sur le port 3001, sert aussi client/dist
```

Le serveur :

- sert les assets statiques et le fallback SPA (y compris `/admin`) ;
- expose `GET /health` (utile pour les sondes de disponibilité) ;
- applique la liste CORS de `CORS_ORIGIN`.

Exemple de déploiement (VPS, Docker, Render, Fly.io…) :

1. `npm ci`
2. définir `ADMIN_PASSWORD` (secret de la plateforme) et `PORT`
3. `npm run build`
4. `npm start`

**Important :** l'état étant en mémoire, faites tourner **une seule instance**
du serveur. Si vous utilisez un hébergeur qui réplique le processus ou fait de
l'auto-scaling, activez le *sticky session* ou désactivez le scaling : plusieurs
instances auraient chacune leur propre room.

Pour un client hébergé séparément (CDN), définissez `VITE_SERVER_URL` à la
construction et ajoutez l'origine du client à `CORS_ORIGIN`.

---

## Application mobile (Capacitor)

Le même code React est empaqueté pour Android et iOS.

```bash
cd client
npm run build          # build web dans client/dist
npx cap add android    # une seule fois
npx cap add ios        # une seule fois (macOS + Xcode)
npx cap sync
npx cap open android   # ou : npx cap open ios
```

Ou via les scripts fournis :

```bash
npm run cap:sync      # build + cap sync
npm run cap:android   # build + sync + ouverture Android Studio
npm run cap:ios       # build + sync + ouverture Xcode
```

**URL du serveur obligatoire** : une application native n'a pas d'origine
commune avec le serveur. Créez `client/.env.production` :

```
VITE_SERVER_URL=https://quiz.example.com
```

puis rebuild. Pensez à autoriser cette origine côté serveur si nécessaire.
L'identifiant de l'app (`com.epson.quizlive`) et le nom sont définis dans
[`client/capacitor.config.ts`](client/capacitor.config.ts).

Icônes et splash : `client/assets/icon-only.png` et `client/assets/splash.png`
sont générés depuis le logo officiel. Pour les décliner dans les projets natifs :

```bash
npx @capacitor/assets generate
```

(La plateforme native doit exister au préalable.)

---

## PWA

`vite-plugin-pwa` génère automatiquement le manifeste et le service worker au
build. L'application est installable sur mobile et desktop, avec les icônes
`client/public/icons/*` et le favicon PNG. Le thème et le fond du manifeste
reprennent le noir/violet du design néon. Pour régénérer les icônes depuis le
logo : `npm run icons`.

---

## Test de charge

Le script [`scripts/load-test.mjs`](scripts/load-test.mjs) simule des joueurs
Socket.IO réels : connexion admin, création des joueurs, démarrage du quiz,
réponses, clôture, puis vérification du snapshot admin.

Serveur démarré et `ADMIN_PASSWORD` connu :

```bash
ADMIN_PASSWORD=epsonepson2026 npm run load-test
# personnaliser :
PLAYERS=100 SERVER_URL=http://localhost:3001 ADMIN_PASSWORD=... npm run load-test
```

Résultat mesuré localement avec 100 joueurs :

```
Joueurs simulés        : 100
Sessions créées        : 100
Résultats reçus        : 100
Échecs                 : 0
Durée totale           : 8.0 s
Temps de réponse min   : 1021 ms
Temps de réponse moy.  : 1396 ms
Temps de réponse max   : 1784 ms
État final de la room  : FINISHED
Snapshot admin         : 100 joueurs, 100 terminés
```

---

## Structure du projet

```
.
├── client/
│   ├── public/                 # favicon + icônes PWA
│   ├── src/
│   │   ├── assets/epson-logo-black.png / epson-logo-white.png
│   │   ├── components/         # EpsonLogo, ConnectionBanner
│   │   ├── lib/                # socket typé, hooks joueur/admin, horloge
│   │   ├── screens/            # parcours joueur + console admin + popup podium
│   │   ├── App.tsx             # routage léger (/ et /admin)
│   │   └── index.css           # design system néon sombre
│   ├── capacitor.config.ts
│   └── vite.config.ts
├── server/
│   └── src/
│       ├── game.ts             # moteur de room, chrono hrtime, vues admin
│       ├── index.ts            # Express + Socket.IO, auth admin, throttle
│       └── questions.ts        # questions + corrections (privées)
├── shared/src/index.ts         # types et événements partagés
├── scripts/load-test.mjs       # test de charge 80–100 joueurs
├── scripts/generate-icons.mjs  # icônes depuis le logo
└── .env.example
```

### Événements Socket.IO

| Sens            | Événement         | Destinataire              |
| --------------- | ----------------- | ------------------------- |
| client → serveur | `player:join`     | —                         |
| client → serveur | `player:resume`   | —                         |
| client → serveur | `player:answer`   | —                         |
| client → serveur | `player:finish`   | —                         |
| client → serveur | `admin:login`     | —                         |
| client → serveur | `admin:resume`    | —                         |
| client → serveur | `admin:action`    | —                         |
| client → serveur | `admin:set-prizes`| —                         |
| serveur → client | `player:session`  | le joueur concerné        |
| serveur → client | `room:public`     | tous (compteurs publics)  |
| serveur → client | `admin:snapshot`  | socket admin authentifié  |

---

## Personnaliser le quiz

Éditez `server/src/questions.ts` : ajoutez ou retirez des questions (3 options,
un index correct). Le client s'adapte au nombre de questions reçu et
l'affichage du score utilise ce total. Les corrections restent côté serveur.

---

## Logo Epson

Les deux versions officielles fournies sont utilisées telles quelles :
`client/assets/logoepsonnoir.png` (noir) et `client/assets/logoepsonblanc.png`
(blanc). Des copies recadrées de leurs marges transparentes sont générées dans
`client/src/assets/epson-logo-black.png` et `epson-logo-white.png` ; la
géométrie et les couleurs ne sont jamais modifiées.

Le composant réutilisable `<EpsonLogo height={...} variant="white" />` utilise
par défaut la version **blanche**, adaptée au design néon sombre (prop
`variant="black"` disponible). Il n'est jamais redessiné, déformé, filtré ni
reconverti en texte.

Emplacements : formulaire joueur, salle d'attente, décompte, résultat joueur,
quiz, connexion admin, en-tête admin, popup du podium, icônes PWA et Capacitor,
favicon.

Les icônes PWA/native et le splash sont régénérés depuis le logo noir fourni
par `npm run icons`.

---

## Limites connues

- État volatil : perte de la room au redémarrage du serveur (choix assumé,
  aucune base de données).
- Une seule room active à la fois, une seule instance serveur.
- La reconnexion joueur s'appuie sur un identifiant stocké dans le navigateur :
  vider le stockage local crée un nouveau participant.
- Le classement n'est pas archivé : il disparaît avec la room.
- Les cadeaux du podium sont conservés d'une room à l'autre mais restent en
  mémoire : un redémarrage du serveur les réinitialise.
