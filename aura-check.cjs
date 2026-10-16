const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;global.Isla={driveHeight:()=>0};
vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/aura.js','utf8'));
const W=Isla,dt=1/120;
let a,c;
function setup(){a=W.createAuraTracker();c={x:0,z:0,y:.12,vx:20,vz:0,grounded:true,ramp:null,waterMode:'dry'};a.update(c,dt);}
function run(seconds,overrides={}){Object.assign(c,overrides);for(let i=0;i<Math.round(seconds/dt);i++){c.x+=c.vx*dt;c.z+=c.vz*dt;a.update(c,dt);}}
function jump(seconds=1){run(seconds,{grounded:false,y:5});run(dt,{grounded:true,y:.12});}
setup();run(20);assert.equal(a.total,0);run(.2,{grounded:false,y:.4});run(1,{grounded:true,y:.12});assert.equal(a.total,0);
console.log('PASS: ordinary driving and tiny bumps earn no aura.');
setup();jump();const oneJump=a.total;assert(oneJump>250);assert.equal(a.chainCount,1);assert.equal(a.notice.message,'You almost have as much aura as this game.');run(.2);assert.equal(a.total,oneJump);jump();assert.equal(a.chainCount,2);assert.equal(a.total,oneJump*3);
console.log('PASS: a completed jump scores once; the next jump gets x2.');
setup();run(1.5,{grounded:false,y:8,vx:45});run(dt,{grounded:false,y:.1,waterMode:'skimming'});assert.equal(a.chainCount,1);const jumpPoints=a.total;run(2,{waterMode:'skimming'});run(dt,{waterMode:'dry',grounded:true,y:.12});assert.equal(a.chainCount,3);assert.equal(a.multiplier,3);assert(a.total>jumpPoints+1500);assert(a.notice.label.includes('WATER SKIM + COAST COMEBACK'));assert.equal(a.bestChain,a.total);const coastTotal=a.total;run(1);assert.equal(a.total,coastTotal);
console.log('PASS: jump → skim → coast earns three linked stunts with a x3 comeback bonus, without duplicate awards.');
setup();run(1,{waterMode:'skimming',grounded:false,y:.1,vx:45});run(dt,{waterMode:'sinking'});assert(a.total>0);assert.equal(a.chainCount,0);const sunkScore=a.total;run(2);assert.equal(a.total,sunkScore);
console.log('PASS: a real skim earns aura even when it ends in sinking; sinking stops the chain.');
setup();jump();run(4.9);run(3,{grounded:false,y:10});run(dt,{grounded:true,y:.12});assert.equal(a.chainCount,2);run(5.1);assert.equal(a.chainCount,0);const beforeFresh=a.total;jump();assert.equal(a.chainCount,1);assert.equal(a.total-beforeFresh,oneJump);
console.log('PASS: a long jump begun within the 5-second window stays linked; idle time ends the chain.');
setup();const messages=[];for(let i=0;i<7;i++){jump();messages.push(a.notice.message);}assert.equal(a.multiplier,5);assert.equal(new Set(messages.slice(0,5)).size,5);assert.equal(messages[0],messages[5]);assert.equal(W.auraMessages.length,5);
console.log('PASS: multipliers cap at x5 and exactly five celebration messages rotate.');
setup();jump();const earned=a.total;run(.7,{grounded:false,y:5});a.interrupt('RECOVERED');run(dt,{grounded:true,y:.12});assert.equal(a.total,earned);assert.equal(a.chainCount,0);run(.7,{grounded:false,y:5});c.x+=200;a.update(c,dt);run(dt,{grounded:true,y:.12});assert.equal(a.total,earned);
console.log('PASS: recovery and teleports cannot award a fake landing; earned aura is kept.');
// Integrate with the actual ramp physics and its landing behavior.
global.THREE=require('../../public/three.min.js');for(const file of ['world.js','ramps.js','physics.js','aura.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/'+file,'utf8'));
const R=Isla;R.initTerrain();R.planRamps();R.buildCollisionIndex();R.aura=R.createAuraTracker();R.resetVehicle(true);const ramp=R.ramps[0],p=R.rampPoint(ramp,0,-18);Object.assign(R.vehicle,{x:p.x,z:p.z,y:R.height(p.x,p.z)+.12,yaw:ramp.yaw});
for(let i=0;i<1000;i++){R.stepVehicle(dt,{gas:i<550,brake:false,steer:0,handbrake:false,boost:false},i*dt);R.aura.update(R.vehicle,dt);}
assert(R.aura.total>200);assert(R.vehicle.grounded);assert(R.aura.notice?.label==='JUMP'||R.aura.lastResult==='JUMP'||R.aura.lastResult==='CHAIN COMPLETE');
console.log('PASS: driving off a real island ramp and landing earns aura.');
let coastZ=700;while(R.height(0,coastZ)>=-.5&&coastZ<1200)coastZ++;
R.aura=R.createAuraTracker();R.resetVehicle(true);Object.assign(R.vehicle,{x:0,z:coastZ+80,y:7,yaw:Math.PI,vx:0,vz:-160/3.6,grounded:true});R.aura.update(R.vehicle,dt);
let sawSkim=false;for(let i=0;i<600;i++){R.stepVehicle(dt,{gas:false,brake:false,steer:0,handbrake:false,boost:false},i*dt);R.aura.update(R.vehicle,dt);if(R.vehicle.waterMode==='skimming')sawSkim=true;if(R.aura.chainCount===3)break;}
assert(sawSkim);assert.equal(R.aura.chainCount,3);assert(R.aura.notice.label.includes('COAST COMEBACK'));assert.equal(R.vehicle.waterMode,'dry');
console.log('PASS: the real coastline physics links flight, water contact, and safe shore return into a x3 chain.');

