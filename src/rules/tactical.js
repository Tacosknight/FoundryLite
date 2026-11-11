'use strict';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function distanceToSegment(p, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, length = dx*dx+dy*dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
  return distance(p, {x:a.x+t*dx,y:a.y+t*dy});
}
function intersects(a,b,c,d) {
  const cross = (p,q,r) => (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const on = (p,q,r) => Math.min(p.x,q.x)<=r.x && r.x<=Math.max(p.x,q.x) && Math.min(p.y,q.y)<=r.y && r.y<=Math.max(p.y,q.y);
  const x=cross(a,b,c), y=cross(a,b,d), z=cross(c,d,a), w=cross(c,d,b);
  return (x*y<0 && z*w<0) || (!x && on(a,b,c)) || (!y && on(a,b,d)) || (!z && on(c,d,a)) || (!w && on(c,d,b));
}
const ends = w => [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}];
function lineOfSight(a,b,walls=[]) { return !walls.some(w => w.blocksLight !== false && intersects(a,b,...ends(w))); }
function pointInZone(p,z) {
  if (z.shape === 'circle' || z.r != null) return distance(p,z) <= (Number(z.r)||0);
  const x2=z.x+(Number(z.w)||0), y2=z.y+(Number(z.h)||0);
  return p.x>=Math.min(z.x,x2) && p.x<=Math.max(z.x,x2) && p.y>=Math.min(z.y,y2) && p.y<=Math.max(z.y,y2);
}
function segmentInZone(a,b,z) {
  if (z.shape === 'circle' || z.r != null) return distanceToSegment(z,a,b) <= (Number(z.r)||0);
  if (pointInZone(a,z)||pointInZone(b,z)) return true;
  const c={x:z.x,y:z.y}, d={x:z.x+z.w,y:z.y}, e={x:z.x+z.w,y:z.y+z.h}, f={x:z.x,y:z.y+z.h};
  return [[c,d],[d,e],[e,f],[f,c]].some(([p,q])=>intersects(a,b,p,q));
}
function hasCondition(token,id) { return (token.conditions||[]).some(c => c === id || c.id === id || c.type === id); }
function passivePerception(character,token) {
  if(hasCondition(token,'blinded')) return 0;
  const attributes=character?.attributes||{};
  let n=10+Math.floor((Math.max(Number(attributes.intelligence)||10,Number(attributes.dexterite)||10)-10)/2);
  const cls=(character?.class||character?.vocation||'').toLowerCase();
  const race=(character?.race||'').toLowerCase();
  if(/rôdeur|rodeur/.test(cls)) n+=3; else if(/voleur|clerc/.test(cls)) n+=2;
  if(race.includes('elfe')) n+=2; else if(race.includes('gnome')) n++;
  if(hasCondition(token,'confused')) n-=5;
  if(hasCondition(token,'blessed')) n+=2;
  return Math.max(0,n);
}
function speed(token, character, slowed=false) {
  let n=300, race=(character?.race||'').toLowerCase(), cls=(character?.class||character?.vocation||'').toLowerCase();
  if(token.type==='player' && /nain|halfelin|gnome/.test(race)) n=250;
  else if(token.type==='player' && /voleur|rôdeur|rodeur/.test(cls)) n=350;
  else if(token.type==='monster' && (token.size||40)>60) n=400;
  if(hasCondition(token,'restrained')||hasCondition(token,'asleep')) n=0;
  else if(hasCondition(token,'prone')) n=Math.floor(n/2);
  return slowed ? Math.floor(n/2) : n;
}
function visionRadius(token, character, map) {
  if(hasCondition(token,'blinded')) return 0;
  if(token.visionRadius>0) return token.visionRadius;
  if(map.lightingMode!=='night') return 1000;
  let n=token.hasTorch ? token.torchRadius||400 : 0;
  if(token.type==='monster' || /elfe|nain|orc|tieffelin|gnome|gobelin/.test((character?.race||'').toLowerCase())) n=Math.max(n,400);
  else if(token.type==='player' && character && !token.hasTorch) n=25;
  return n;
}
function validateMove({map,token,character,x,y,spent=0,previouslySlowed=false}) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(token.x)||!Number.isFinite(token.y)) throw new Error('Coordonnées invalides.');
  const a={x:token.x,y:token.y}, b={x,y}, radius=(Number(token.size)||40)/2;
  for(const w of map.walls||[]) if(w.blocksMovement!==false && !w.isOpen) {
    const [c,d]=ends(w);
    if(intersects(a,b,c,d) || distanceToSegment(b,c,d)<radius || distanceToSegment(c,a,b)<radius || distanceToSegment(d,a,b)<radius) throw new Error('Mur infranchissable.');
  }
  const slowed=previouslySlowed || (map.zones||[]).some(z=>z.type==='difficult' && segmentInZone(a,b,z));
  const length=distance(a,b), limit=speed(token,character,slowed);
  if(spent+length>limit+1e-6) throw new Error('Vitesse de déplacement dépassée.');
  const traps=(map.traps||[]).filter(t=>!t.triggered&&!t.disarmed && distanceToSegment(t,a,b)<=(t.r||25)+radius*0.4).map(t=>{
    const dx=b.x-a.x, dy=b.y-a.y, r=(t.r||25)+radius*0.4;
    const projection=length ? ((t.x-a.x)*dx+(t.y-a.y)*dy)/length : 0;
    const perpendicular=length ? Math.abs((t.x-a.x)*dy-(t.y-a.y)*dx)/length : 0;
    return {trap:t, at:Math.max(0, projection-Math.sqrt(Math.max(0,r*r-perpendicular*perpendicular)))};
  }).sort((t,u)=>t.at-u.at);
  const stop=traps.length ? Math.min(length,traps[0].at) : length;
  return {x:length ? a.x+(b.x-a.x)*stop/length : x,y:length ? a.y+(b.y-a.y)*stop/length : y,length:stop,limit,slowed,trap:traps[0]?.trap||null};
}
function explorationPolygon(token, character, map) {
  const radius = visionRadius(token, character, map);
  if (radius <= 30) return null;
  const walls = (map.walls || []).filter(w => w.blocksLight !== false && !w.isOpen);
  const angles = Array.from({ length: 64 }, (_, i) => i * Math.PI / 32);
  for (const wall of walls) for (const end of ends(wall)) {
    const angle = Math.atan2(end.y - token.y, end.x - token.x);
    angles.push(angle - 0.00001, angle, angle + 0.00001);
  }
  const points = angles.sort((a, b) => a - b).map(angle => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let length = radius;
    for (const wall of walls) {
      const wx = wall.x2 - wall.x1, wy = wall.y2 - wall.y1;
      const denominator = dx * wy - dy * wx;
      if (Math.abs(denominator) < 1e-10) continue;
      const ax = wall.x1 - token.x, ay = wall.y1 - token.y;
      const along = (ax * wy - ay * wx) / denominator;
      const segment = (ax * dy - ay * dx) / denominator;
      if (along >= 0 && segment >= 0 && segment <= 1) length = Math.min(length, along);
    }
    return { x: token.x + dx * length, y: token.y + dy * length };
  });
  return { type: 'polygon', points };
}
module.exports={distance,distanceToSegment,intersects,lineOfSight,pointInZone,segmentInZone,speed,visionRadius,passivePerception,validateMove,explorationPolygon};
