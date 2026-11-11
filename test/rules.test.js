'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RoomManager } = require('../src/state/RoomManager');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-rules-'));
  const manager = new RoomManager(path.join(dir, 'rooms.json'), 60000);
  // Les règles sont testées en mémoire ; aucune écriture asynchrone ne survit au test.
  manager.persist = async () => {};
  const room = manager.createDefaultRoom('test');
  manager.rooms.set('test', room);
  t.after(() => {
    clearTimeout(manager.debounceTimer);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { manager, room };
}

test('les dégâts préservent zéro et synchronisent les PV du personnage', (t) => {
  const { manager, room } = fixture(t);
  const token = { id: 'p', type: 'player', slot: 0, hp: 0 };
  room.characters.push({ slot: 0, hp: 0 });
  room.map.tokens.push(token);
  room.map.traps.push({ id: 'trap', damage: 3 });
  room.map.zones.push({ id: 'zone', effect: { damage: 3 } });
  manager.triggerTrap('test', 'trap', 'p');
  assert.equal(token.hp, 0);
  manager.applyHazardZone('test', 'zone', 'p');
  assert.equal(token.hp, 0);
  assert.equal(room.characters[0].hp, 0);
  token.hp = '7';
  manager.triggerTrap('test', 'trap', 'p');
  assert.equal(token.hp, 4);
  manager.applyHazardZone('test', 'zone', 'p');
  assert.equal(token.hp, 1);
  assert.equal(room.characters[0].hp, 1);
  token.hp = 'invalide';
  manager.applyHazardZone('test', 'zone', 'p');
  assert.equal(token.hp, 7);
});

test('la création de pion accepte zéro et rejette les nombres non finis', (t) => {
  const { manager } = fixture(t);
  const zero = manager.addToken('test', { hp: 0, maxHp: '0' });
  assert.equal(zero.hp, 0);
  assert.equal(zero.maxHp, 0);
  const invalid = manager.addToken('test', { hp: 'oops', maxHp: Infinity });
  assert.equal(invalid.hp, 10);
  assert.equal(invalid.maxHp, 10);
});

test('export objet crée un indice sans divulguer un document caché', (t) => {
  const { manager, room } = fixture(t);
  const prop = { id: 'p', name: 'Coffre', description: 'Une boîte', revealedDoc: 'Secret', isDocRevealed: false, imageUrl: '/coffre.png' };
  room.map.props.push(prop);
  const hidden = manager.exportPropToInvestigation('test', 'p', 'Alice');
  assert.equal(hidden.content, 'Une boîte');
  assert.equal(hidden.type, 'note');
  assert.equal(hidden.author, 'Alice');
  assert.equal(hidden.image, '/coffre.png');
  prop.isDocRevealed = true;
  const revealed = manager.exportPropToInvestigation('test', 'p');
  assert.equal(revealed.content, 'Une boîte\n\n---\n\nSecret');
  assert.equal(revealed.type, 'document');
  assert.deepEqual(room.investigation.clues, [hidden, revealed]);
  assert.equal(manager.exportPropToInvestigation('test', 'absent'), null);
});

test('conditions joueurs par tour et monstres par manche sans double décrément', (t) => {
  const { manager, room } = fixture(t);
  room.characters = [{ slot: 0, name: 'A', created: true }, { slot: 1, name: 'B', created: true }];
  const a = { id: 'a', type: 'player', slot: 0, name: 'A', conditions: [{ id: 'a', duration: 2 }] };
  const b = { id: 'b', type: 'player', slot: 1, name: 'B', conditions: [{ id: 'b', duration: 2 }] };
  const monster = { id: 'm', type: 'monster', conditions: [{ id: 'm', duration: 2 }] };
  room.map.tokens.push(a, b, monster);
  room.map.currentTurn = { slot: 0, name: 'A' };
  room.map.turnSystem = { round: 1, currentIndex: 0, turnOrder: [{ slot: 0, name: 'A' }, { slot: 1, name: 'B' }] };
  manager.nextTurn('test');
  assert.equal(a.conditions[0].duration, 1);
  assert.equal(b.conditions[0].duration, 2);
  assert.equal(monster.conditions[0].duration, 2);
  const result = manager.nextTurn('test');
  assert.equal(b.conditions[0].duration, 1);
  assert.equal(monster.conditions[0].duration, 1);
  assert.equal(result.updatedTokens.filter((token) => token.id === 'b').length, 1);
});

test('début de manche direct et ordre absent décrémentent une seule fois', (t) => {
  for (const direct of [true, false]) {
    const { manager, room } = fixture(t);
    room.characters = [{ slot: 0, name: 'A', created: true }];
    const token = { id: 'a', type: 'player', slot: 0, name: 'A', conditions: [{ id: 'c', duration: 2 }] };
    room.map.tokens.push(token);
    room.map.currentTurn = { slot: 0, name: 'A' };
    const result = direct ? manager.startNewRound('test') : manager.nextTurn('test');
    assert.equal(token.conditions[0].duration, 1);
    assert.equal(result.updatedTokens.filter((item) => item.id === 'a').length, 1);
  }
});

test('la première manche ne décrémente pas les conditions des monstres', (t) => {
  const { manager, room } = fixture(t);
  room.characters = [{ slot: 0, name: 'A', created: true }];
  const monster = { id: 'm', type: 'monster', conditions: [{ id: 'c', duration: 2 }] };
  room.map.tokens.push(monster);
  manager.startNewRound('test');
  assert.equal(monster.conditions[0].duration, 2);
});

test('une porte exige un pion joueur proche, sauf pour le MJ', (t) => {
  const { manager, room } = fixture(t);
  const door = { id: 'd', wallType: 'door', x1: 0, y1: 0, x2: 10, y2: 0, isOpen: false, isLocked: false, blocksMovement: true, blocksLight: true };
  room.map.walls.push(door);
  assert.throws(() => manager.toggleDoor('test', 'd', 'player', 0), /Pion joueur introuvable/);
  assert.equal(door.isOpen, false);
  const token = { type: 'player', slot: 0, x: 200, y: 0 };
  room.map.tokens.push(token);
  assert.throws(() => manager.toggleDoor('test', 'd', 'player', 0), /trop éloigné/);
  token.x = 10;
  door.isLocked = true;
  assert.equal(manager.toggleDoor('test', 'd', 'player', 0).locked, true);
  door.isLocked = false;
  assert.equal(manager.toggleDoor('test', 'd', 'player', 0).success, true);
  room.map.tokens = [];
  assert.equal(manager.toggleDoor('test', 'd', 'mj').success, true);
});
