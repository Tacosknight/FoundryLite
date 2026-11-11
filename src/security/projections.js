'use strict';
const {distance,lineOfSight,visionRadius} = require('../rules/tactical');
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o && Object.hasOwn(o,k)).map(k=>[k,o[k]]));
const tokenKeys=['id','type','slot','name','x','y','size','color','image','imageUrl','hp','maxHp','conditions','hasTorch','torchRadius','visionRadius'];
const wallKeys=['id','x1','y1','x2','y2','wallType','blocksLight','blocksMovement','isOpen','isLocked'];
const trapKeys=['id','x','y','r','label','type','subType','revealed','triggered','disarmed'];
const zoneKeys=['id','x','y','w','h','r','shape','type','subType','color','label'];
function own(room,viewer) {
  const c=(room.characters||[]).find(c=>viewer?.identityId && c.ownerId===viewer.identityId);
  return (room.map?.tokens||[]).find(t=>t.type==='player' && c && t.slot===c.slot);
}
function visible(room,viewer,object) {
  const t=own(room,viewer), map=room.map||{};
  if(!t || !Number.isFinite(object?.x) || !Number.isFinite(object?.y)) return false;
  const c=(room.characters||[]).find(c=>c.slot===t.slot);
  return distance(t,object)<=visionRadius(t,c,map) && lineOfSight(t,object,map.walls||[]);
}
function projectMap(room,viewer) {
  const map=room?.map||{};
  if(viewer?.role==='mj'||viewer?.role==='gm') return structuredClone(map);
  const out=pick(map,['id','name','backgroundUrl','lightingMode','fogEnabled','gridSize','snapToGrid','activeSceneId']);
  const mine=own(room,viewer);
  out.tokens=(map.tokens||[]).filter(t=>t===mine || (!t.invisible && !t.hidden && !(t.conditions||[]).some(c=>c==='invisible' || c?.id==='invisible' || c?.type==='invisible') && visible(room,viewer,t))).map(t=>{
    const safe=pick(t,tokenKeys);
    if (Array.isArray(safe.conditions)) safe.conditions=safe.conditions.map(c=>typeof c === 'string' ? c : pick(c,['id','name','icon','color','desc','duration']));
    return safe;
  });
  out.walls=(map.walls||[]).map(w=>pick(w,wallKeys));
  out.traps=(map.traps||[]).filter(t=>t.revealed && visible(room,viewer,t)).map(t=>pick(t,trapKeys));
  out.zones=(map.zones||[]).filter(z=>!z.hidden && visible(room,viewer,z)).map(z=>pick(z,zoneKeys));
  out.props=(map.props||[]).filter(p=>!p.hidden && visible(room,viewer,p)).map(p=>{
    const prop=pick(p,['id','x','y','name','type','imageUrl','description','icon','size','stateLabel','interactionRadius','isDocRevealed']);
    if(p.isDocRevealed) prop.revealedDoc=p.revealedDoc;
    return prop;
  });
  const turnKeys=['slot','name','icon','color','roll','round','orderIndex','totalPlayers','startX','startY','timestamp'];
  out.currentTurn=map.currentTurn ? pick(map.currentTurn,turnKeys) : null;
  if(map.turnSystem) {
    out.turnSystem=pick(map.turnSystem,['round','currentIndex','active']);
    out.turnSystem.turnOrder=(map.turnSystem.turnOrder||[]).map(t=>pick(t,turnKeys));
  }
  out.lights=(map.lights||[]).filter(l=>!l.hidden).map(l=>pick(l,['id','x','y','radius','color','type','label','enabled']));
  out.revealedAreas=(map.revealedAreas||[]).map(a=>{
    const area=pick(a,['id','type','x','y','w','h','r']);
    if(Array.isArray(a.points)) area.points=a.points.map(p=>pick(p,['x','y']));
    return area;
  });
  out.drawings=(map.drawings||[]).filter(d=>!d.hidden).map(d=>{
    const drawing=pick(d,['id','author','color','width','createdAt']);
    drawing.points=(d.points||[]).map(p=>pick(p,['x','y']));
    return drawing;
  });
  out.teleporters=[];
  return out;
}
// Unknown payload fields are dropped; adapters must suppress an event when null is returned.
function projectPayload(payload,viewer,room) {
  if(viewer?.role==='mj'||viewer?.role==='gm') return structuredClone(payload);
  if(!payload || typeof payload!=='object' || Array.isArray(payload)) return null;
  const map=projectMap(room,viewer), out=pick(payload,['success','error','roomId','x','y','hasTorch','torchRadius','action']);
  if(payload.map) out.map=map;
  if(payload.tokenId) { if(!map.tokens.some(t=>t.id===payload.tokenId)) return null; out.tokenId=payload.tokenId; }
  if(payload.token) { const t=map.tokens.find(t=>t.id===payload.token.id); if(!t) return null; out.token=t; }
  if(payload.trapId) { if(!map.traps.some(t=>t.id===payload.trapId)) return null; out.trapId=payload.trapId; }
  if(payload.trap) { const t=map.traps.find(t=>t.id===payload.trap.id); if(!t) return null; out.trap=t; }
  return Object.keys(out).length ? out : null;
}
module.exports={projectMap,projectPayload};
