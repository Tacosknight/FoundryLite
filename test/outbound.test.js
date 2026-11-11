'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { project, createOutbound } = require('../src/security/outbound');

function fixture() {
  const room = {
    id: 'r', activeSceneId: 'active',
    characters: [{ id: 'mine', slot: 1, name: 'Hero', ownerId: 'identity', socketId: 'sock', inventory: [] }],
    map: { id: 'active', name: 'Public', tokens: [{ id: 'hero', type: 'player', slot: 1, x: 0, y: 0 }, { id: 'hidden-token', name: 'TOKEN_SENTINEL', x: 1, y: 1, hidden: true }],
      walls: [], traps: [{ id: 'hidden-trap', name: 'TRAP_SENTINEL', x: 1, y: 1, revealed: false }], zones: [],
      props: [{ id: 'hidden-prop', name: 'PROP_SENTINEL', x: 1, y: 1, hidden: true }, { id: 'public-prop', name: 'Chest', x: 1, y: 1, secretNotes: 'NOTE_SENTINEL', revealedDoc: 'DOC_SENTINEL', isDocRevealed: false }] },
    scenes: [{ id: 'secret-scene', name: 'SCENE_SENTINEL' }],
    investigation: { clues: [{ id: 'a', title: 'Visible' }, { id: 'b', title: 'Visible too' }, { id: 'hidden', hidden: true, title: 'CLUE_SENTINEL' }, { id: 'sealed', title: 'Sealed', isSealed: true, content: 'SEALED_SENTINEL' }], links: [{ id: 'ok', fromId: 'a', toId: 'b' }, { id: 'no', fromId: 'a', toId: 'hidden' }] }
  };
  const manager = { rooms: new Map([['r', room]]) };
  const player = { id: 's', data: { roomId: 'r', identityId: 'identity', user: { role: 'player' } } };
  const gm = { data: { roomId: 'r', identityId: 'gm', user: { role: 'mj' } } };
  return { room, manager, player, gm };
}

test('authoritative player replacement removes hidden entities and preserves visible links', () => {
  const { room, manager, player } = fixture();
  const result = project({ map: room.map, scenes: room.scenes, characters: room.characters, investigation: room.investigation, ownCharacterId: 'wrong', ownSlot: 999 }, player, manager);
  const text = JSON.stringify(result);
  for (const secret of ['TOKEN_SENTINEL', 'TRAP_SENTINEL', 'PROP_SENTINEL', 'SCENE_SENTINEL', 'CLUE_SENTINEL', 'SEALED_SENTINEL', 'NOTE_SENTINEL', 'DOC_SENTINEL', 'identity', 'sock']) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(result.investigation.links.map(l => l.id), ['ok']);
  assert.equal(result.characters[0].name, 'Hero');
  assert.equal(result.ownCharacterId, 'mine');
  assert.equal(result.ownSlot, 1);
  assert.equal(result.map.tokens[0].id, 'hero');
});

test('MJ retains game secrets but not credentials or ownership', () => {
  const { room, manager, gm } = fixture();
  const result = project({ map: room.map, characters: room.characters, access: { password: 'CREDENTIAL' }, nested: { secretNotes: 'NOTE', sessions: ['SESSION'] } }, gm, manager);
  assert.equal(result.map.props[1].secretNotes, 'NOTE_SENTINEL');
  assert.equal(result.map.props[1].revealedDoc, 'DOC_SENTINEL');
  assert.equal(result.nested.secretNotes, 'NOTE');
  assert.ok(!JSON.stringify(result).includes('CREDENTIAL'));
  assert.ok(!JSON.stringify(result).includes('SESSION'));
  assert.ok(!JSON.stringify(result).includes('identity'));
});

test('event envelopes suppress hidden links, entities and unlabelled generated narration', () => {
  const { room, manager, player } = fixture();
  for (const [event, payload] of [
    ['scene:created', { scene: room.scenes[0] }],
    ['scene:teleporter_added', { teleporter: { name: 'SCENE_SENTINEL' } }],
    ['investigation:clue_added', { clue: room.investigation.clues[2] }],
    ['investigation:clue_moved', { clueId: 'hidden', x: 1, y: 2 }],
    ['investigation:link_added', { link: room.investigation.links[1] }],
    ['map:trap_triggered', { trapId: 'hidden-trap' }],
    ['prop:moved', { propId: 'hidden-prop' }],
    ['chat:broadcast', { sender: 'Carnet d’Enquête', text: 'CLUE_SENTINEL' }]
  ]) assert.equal(project(payload, player, manager, event), null, event);
  assert.equal(project({ link: room.investigation.links[0] }, player, manager, 'investigation:link_added').link.id, 'ok');
  assert.equal(project({ id: 'msg-1', sender: 'Hero', text: 'Hello' }, player, manager, 'chat:broadcast').text, 'Hello');
});

test('outbound sends viewer-specific projected payload', () => {
  const { room, manager, player } = fixture();
  const emitted = [];
  player.rooms = new Set(['r']);
  player.emit = (event, value) => emitted.push([event, value]);
  const outbound = createOutbound({ sockets: { sockets: new Map([['s', player]]) } }, manager, { membership: () => ({ role: 'player' }) });
  outbound.to('r').emit('map:sync', { map: room.map });
  assert.equal(emitted.length, 1);
  assert.ok(!JSON.stringify(emitted).includes('PROP_SENTINEL'));
});
