'use strict';

// Movement retries return the exact cached response object from map.handler. Weak
// references follow that cache's lifetime and do not invent a second eviction policy.
const recordedMoves = new WeakSet();
const text = value => typeof value === 'string' ? value.slice(0, 200) : null;
const number = value => Number.isFinite(value) ? value : null;
const vitals = character => character ? {
  hp: number(character.hp), maxHp: number(character.maxHp),
  energy: number(character.energy), maxEnergy: number(character.maxEnergy)
} : null;
const position = token => token ? { x: number(token.x), y: number(token.y) } : null;
const doorState = door => door ? { isOpen: Boolean(door.isOpen), isLocked: Boolean(door.isLocked) } : null;
const conditions = token => Array.isArray(token?.conditions) ? token.conditions.slice(0, 64).map(c => ({
  id: text(c?.id), name: text(c?.name), duration: number(c?.duration)
})) : [];

// Called after authorization but immediately before invoking the handler. Copy
// only the fields needed; room entities are mutated in place by the handler.
function captureBefore(event, data = {}, room) {
  if (!room) return null;
  const map = room.map;
  if (event === 'char:update_vitals' || event === 'char:update_full') {
    const character = room.characters?.[parseInt(data.slot, 10)];
    return { characterId: text(character?.id), slot: number(character?.slot), vitals: vitals(character) };
  }
  if (event === 'map:move_token' || event.startsWith('token:')) {
    const token = map?.tokens?.find(item => item.id === data.tokenId);
    return { sceneId: text(room.activeSceneId), tokenId: text(token?.id), position: position(token), conditions: conditions(token) };
  }
  if (event === 'map:toggle_door' || event === 'map:lock_door' || event === 'prop:trigger_door') {
    const doorId = event === 'prop:trigger_door' ? map?.props?.find(p => p.id === data.propId)?.linkedDoorId : data.doorId;
    const door = map?.walls?.find(item => item.id === doorId);
    return { sceneId: text(room.activeSceneId), doorId: text(door?.id), door: doorState(door) };
  }
  return null;
}

async function recordCommand({ event, data = {}, result, before, socket, services }) {
  const roomId = socket?.data?.roomId;
  if (!roomId || result?.success !== true || data.preview || result.preview) return;
  let details;
  switch (event) {
    case 'dice:roll': {
      const roll = result.result;
      if (!roll) return;
      details = { formula: text(roll.formula), rolls: Array.isArray(roll.rolls) ? roll.rolls.slice(0, 50).map(number) : [],
        modifier: number(roll.modifier), total: number(roll.total), outcome: text(roll.outcome) };
      break;
    }
    case 'char:update_vitals':
    case 'char:update_full':
      if (!before?.vitals || !result.character) return;
      details = { characterId: before.characterId, slot: before.slot, before: before.vitals, after: vitals(result.character) };
      break;
    case 'map:move_token':
      if (!before?.position || !result.token || recordedMoves.has(result)) return;
      recordedMoves.add(result);
      details = { sceneId: before.sceneId, tokenId: before.tokenId, before: before.position, after: position(result.token) };
      break;
    case 'map:toggle_door':
    case 'map:lock_door':
    case 'prop:trigger_door':
      if (!before?.door || !result.door) return;
      details = { sceneId: before.sceneId, doorId: before.doorId, before: before.door, after: doorState(result.door) };
      break;
    case 'token:set_condition':
    case 'token:remove_condition':
    case 'token:clear_conditions':
      if (!before?.tokenId || !result.token) return;
      details = { sceneId: before.sceneId, tokenId: before.tokenId, before: before.conditions, after: conditions(result.token) };
      break;
    default: return;
  }
  const actor = text(socket.data.user?.username) || text(socket.data.identityId) || 'Utilisateur';
  return services.tools.appendHistory(roomId, { actor, audience: 'gm', action: event, details });
}

module.exports = { captureBefore, recordCommand };
