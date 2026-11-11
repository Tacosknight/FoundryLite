'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectMap,projectPayload}=require('../src/security/projections');
test('player projection excludes hidden and secret state',()=>{
  const room={characters:[{slot:1,ownerId:'a'}],map:{lightingMode:'day',tokens:[{id:'a',slot:1,type:'player',x:0,y:0,secretNotes:'secret'},{id:'b',type:'monster',x:2000,y:0}],traps:[{id:'t',x:1,y:1,revealed:false}],props:[{id:'p',x:1,y:1,secretNotes:'secret',sealed:'secret'}],scenes:[{name:'future'}]}};
  const view={role:'player',identityId:'a'};
  const p=projectMap(room,view);
  assert.equal(p.tokens.length,1); assert.equal(p.tokens[0].secretNotes,undefined);
  assert.equal(p.traps.length,0); assert.equal(p.props[0].secretNotes,undefined); assert.equal(p.scenes,undefined);
  assert.equal(projectPayload({tokenId:'b',x:2000,y:0},view,room),null);
});
test('projects public map fields and hides invisible tokens and sealed documents',()=>{
  const room={characters:[{slot:1,ownerId:'a'}],map:{lightingMode:'day',currentTurn:{slot:1,name:'A',secret:'no'},turnSystem:{active:true,round:1,turnOrder:[{slot:1,roll:15,secret:'no'}]},lights:[{id:'l',x:5,y:5,radius:100,secret:'no'}],revealedAreas:[{type:'rect',x:0,y:0,w:50,h:50,secret:'no'}],drawings:[{id:'d',points:[{x:1,y:2,secret:'no'}]}],tokens:[{id:'a',slot:1,type:'player',x:0,y:0},{id:'b',type:'monster',x:3,y:3,conditions:[{id:'invisible'}]}],props:[{id:'p',x:2,y:2,description:'public',icon:'x',size:20,stateLabel:'open',interactionRadius:40,revealedDoc:'secret',isDocRevealed:false},{id:'q',x:3,y:3,revealedDoc:'visible',isDocRevealed:true}]}};
  const p=projectMap(room,{role:'player',identityId:'a'});
  assert.equal(p.tokens.length,1); assert.equal(p.currentTurn.slot,1); assert.equal(p.currentTurn.secret,undefined);
  assert.equal(p.turnSystem.turnOrder[0].roll,15); assert.equal(p.lights[0].radius,100);
  assert.equal(p.revealedAreas.length,1); assert.equal(p.drawings[0].points[0].secret,undefined);
  assert.equal(p.props[0].description,'public'); assert.equal(p.props[0].revealedDoc,undefined); assert.equal(p.props[1].revealedDoc,'visible');
});
