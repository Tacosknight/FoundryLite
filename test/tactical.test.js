'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../src/rules/tactical');
test('movement enforces cumulative speed and wall collision', () => {
  const token={x:0,y:0,type:'player',size:40};
  assert.throws(()=>t.validateMove({map:{walls:[]},token,x:200,y:0,spent:101}),/Vitesse/);
  assert.throws(()=>t.validateMove({map:{walls:[{x1:50,y1:-50,x2:50,y2:50}]},token,x:100,y:0}),/Mur/);
  assert.equal(t.validateMove({map:{walls:[]},token,x:100,y:0,spent:100}).length,100);
});
test('trap interrupts movement and passive perception follows character rules', () => {
  const map={traps:[{id:'trap',x:100,y:0,r:25}],walls:[]};
  const token={x:0,y:0,type:'player',size:40};
  const result=t.validateMove({map,token,x:200,y:0});
  assert.equal(result.trap.id,'trap'); assert.equal(result.x,67); assert.equal(result.length,67);
  assert.equal(t.passivePerception({race:'Elfe',class:'Rôdeur',attributes:{intelligence:14,dexterite:10}},token),17);
  assert.equal(t.passivePerception({}, {...token,conditions:[{id:'blinded'}]}),0);
  assert.throws(()=>t.validateMove({map:{},token,x:10,y:0,spent:145,previouslySlowed:true}),/Vitesse/);
});

test('exploration is computed from authoritative vision and stops at walls', () => {
  const token = { x: 0, y: 0, type: 'player' };
  const map = { lightingMode: 'day', walls: [{ x1: 100, y1: -2000, x2: 100, y2: 2000 }] };
  const polygon = t.explorationPolygon(token, {}, map);
  assert.equal(polygon.type, 'polygon');
  assert.ok(polygon.points.length >= 64);
  assert.ok(polygon.points.every(point => point.x <= 100.00001));
  assert.equal(t.explorationPolygon({ ...token, conditions: [{ id: 'blinded' }] }, {}, map), null);
  assert.equal(t.explorationPolygon(token, { race: 'Humain' }, { lightingMode: 'night' }), null);
});

test('vision and difficult terrain', () => {
  assert.equal(t.visionRadius({type:'player'}, {race:'Nain'}, {lightingMode:'night'}),400);
  assert.equal(t.speed({type:'player'}, {race:'Nain'},true),125);
  assert.equal(t.segmentInZone({x:0,y:0},{x:100,y:0},{x:50,y:-10,w:10,h:20}),true);
});
