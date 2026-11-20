/**
 * Test de charge : simule N joueurs (100 par défaut) qui rejoignent la room,
 * répondent aux 5 questions et terminent, puis vérifie que la room passe
 * bien à l'état FINISHED côté serveur.
 *
 * Prérequis : serveur démarré, ADMIN_PASSWORD disponible dans l'environnement.
 *
 *   ADMIN_PASSWORD=change-moi npm run load-test
 *   PLAYERS=100 SERVER_URL=http://localhost:3001 ADMIN_PASSWORD=... npm run load-test
 */
import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:3001';
const PLAYERS = Number(process.env.PLAYERS ?? 100);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const QUESTION_COUNT = 5;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000);

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD est requis pour lancer le test de charge.');
  process.exit(1);
}
if (!Number.isInteger(PLAYERS) || PLAYERS < 1) {
  console.error('PLAYERS doit être un entier positif.');
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectClient(extra = {}) {
  return new Promise((resolve, reject) => {
    const client = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 15_000,
      ...extra,
    });
    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Timeout de connexion au serveur'));
    }, 15_000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function emitAck(client, event, payload) {
  return new Promise((resolve) => {
    client.emit(event, payload, resolve);
  });
}

function createPlayer(index) {
  return {
    firstName: `Joueur${String(index + 1).padStart(3, '0')}`,
    lastName: 'Load',
    company: `Société ${String((index % 7) + 1).padStart(2, '0')}`,
  };
}

const startedAt = Date.now();
const results = [];
let failures = 0;

const admin = await connectClient();

// Le serveur envoie un snapshot dès la connexion admin : utile pour vérifier
// que la room est bien en attente avant de lancer un test de charge.
const initialSnapshotPromise = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 3000);
  admin.once('admin:snapshot', (snapshot) => {
    clearTimeout(timer);
    resolve(snapshot);
  });
});

const login = await emitAck(admin, 'admin:login', { password: ADMIN_PASSWORD });
const initialSnapshot = await initialSnapshotPromise;
if (!login.ok) {
  console.error('Connexion admin refusée :', login.message);
  process.exit(1);
}

let lastSnapshot = null;
admin.on('admin:snapshot', (snapshot) => {
  lastSnapshot = snapshot;
});

if (initialSnapshot && initialSnapshot.roomState !== 'WAITING') {
  console.error(
    `La room est en état ${initialSnapshot.roomState}. Créez une nouvelle room depuis /admin avant de lancer le test.`,
  );
  process.exit(1);
}

// L'accès doit être ouvert AVANT la connexion des joueurs.
const opened = await emitAck(admin, 'admin:action', {
  token: login.data.token,
  action: 'open-access',
});
if (!opened.ok) {
  console.error("Impossible d'ouvrir l'accès :", opened.message);
  process.exit(1);
}

console.log(`→ Connexion de ${PLAYERS} joueurs sur ${SERVER_URL}…`);

const players = new Array(PLAYERS);
const joinResults = await Promise.all(
  Array.from({ length: PLAYERS }, async (_, index) => {
    const client = await connectClient();
    players[index] = client;
    const identity = createPlayer(index);
    const res = await emitAck(client, 'player:join', identity);
    if (!res.ok) {
      failures += 1;
      console.error(`  ✗ ${identity.firstName}: ${res.message}`);
      return null;
    }
    return { client, playerId: res.data.player.id, identity };
  }),
);

const joined = joinResults.filter(Boolean);
console.log(`✓ ${joined.length}/${PLAYERS} joueurs ont rejoint la room`);

const start = await emitAck(admin, 'admin:action', {
  token: login.data.token,
  action: 'start',
});
if (!start.ok) {
  console.error('Démarrage refusé :', start.message);
  process.exit(1);
}
console.log('✓ Quiz démarré (décompte 5 s)');

// Chaque joueur répond dès qu'il reçoit sa session « quiz », puis termine.
const finished = await Promise.all(
  joined.map(
    ({ client, playerId, identity }) =>
      new Promise((resolve) => {
        let answered = 0;
        let done = false;

        const answerNext = () => {
          if (answered >= QUESTION_COUNT) {
            setTimeout(async () => {
              if (done) return;
              done = true;
              const res = await emitAck(client, 'player:finish', { playerId });
              if (res.ok) {
                results.push({ identity, ...res.data });
                resolve(true);
              } else {
                failures += 1;
                console.error(`  ✗ finish ${identity.firstName}: ${res.message}`);
                resolve(false);
              }
            }, 150);
            return;
          }
          const questionId = `q${answered + 1}`;
          const optionIndex = Math.floor(Math.random() * 3);
          client.emit('player:answer', { playerId, questionId, optionIndex }, () => {});
          answered += 1;
          setTimeout(answerNext, 80 + Math.floor(Math.random() * 120));
        };

        const onSession = (session) => {
          if (session.phase === 'quiz') {
            client.off('player:session', onSession);
            setTimeout(answerNext, 200 + Math.random() * 600);
          }
          if (session.phase === 'result' && !done) {
            done = true;
            resolve(true);
          }
        };
        client.on('player:session', onSession);
      }),
  ),
);

// Attend que le serveur passe la room à FINISHED (dernier joueur clôturé).
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  const snapshot = lastSnapshot;
  if (snapshot?.roomState === 'FINISHED') break;
  await wait(400);
}

const snapshot = lastSnapshot;
const elapsed = Date.now() - startedAt;
const durations = results.map((r) => r.durationMs);
const average = durations.length
  ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
  : 0;

console.log('\n──────────── RÉSULTAT DU TEST DE CHARGE ────────────');
console.log(`Joueurs simulés        : ${PLAYERS}`);
console.log(`Sessions créées        : ${joined.length}`);
console.log(`Résultats reçus        : ${results.length}`);
console.log(`Échecs                 : ${failures}`);
console.log(`Durée totale           : ${(elapsed / 1000).toFixed(1)} s`);
if (durations.length > 0) {
  console.log(`Temps de réponse min   : ${Math.min(...durations)} ms`);
  console.log(`Temps de réponse moy.  : ${average} ms`);
  console.log(`Temps de réponse max   : ${Math.max(...durations)} ms`);
}
console.log(`État final de la room  : ${snapshot?.roomState ?? 'inconnu'}`);
console.log(
  `Snapshot admin         : ${snapshot ? `${snapshot.stats.total} joueurs, ${snapshot.stats.finished} terminés` : 'aucun'}`,
);
if (snapshot?.leaderboard?.length) {
  console.log('\nTop 5 :');
  for (const entry of snapshot.leaderboard.slice(0, 5)) {
    const seconds = (entry.durationMs / 1000).toFixed(3);
    console.log(
      `  ${String(entry.rank).padStart(2, ' ')}. ${entry.firstName} ${entry.lastName} (${entry.company}) — ${entry.score}/${entry.total} en ${seconds} s`,
    );
  }
}

const ok = snapshot?.roomState === 'FINISHED' && results.length === joined.length && failures === 0;
console.log(`\n${ok ? '✓ TEST RÉUSSI' : '✗ TEST EN ÉCHEC'}`);
console.log('────────────────────────────────────────────────────');

for (const client of players) client?.close();
admin.close();
setTimeout(() => process.exit(ok ? 0 : 1), 200);
