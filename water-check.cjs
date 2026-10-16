const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.THREE=require('../../public/three.min.js');global.window=global;
vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/world.js','utf8'));
vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/physics.js','utf8'));
const W=Isla,actual={height:W.height,driveHeight:W.driveHeight,slope:W.slope,nearestRoad:W.nearestRoad};
const idle={gas:false,brake:false,steer:0,handbrake:false},gas={...idle,gas:true};
let time=0,starts=0,sinks=0,recoveries=0;
W.height=W.driveHeight=x=>x<0?0:-12;
W.slope=()=>({x:0,z:0});W.nearestRoad=()=>({p:null,d:Infinity});W.buildCollisionIndex();
W.onWaterSkim=()=>starts++;W.onWaterSink=()=>sinks++;W.onRecover=()=>recoveries++;
function setup(kph,y=.12){time=0;starts=sinks=recoveries=0;W.resetVehicle(true);Object.assign(W.vehicle,{x:2,z:0,y,yaw:Math.PI/2,vx:kph/3.6,vz:0,lastSafe:{x:-20,z:0,yaw:Math.PI/2}});}
function step(seconds,input=idle){for(let i=0;i<Math.round(seconds*120);i++){time+=1/120;W.stepVehicle(1/120,input,time);}}
for(const kph of [80,139.99,140]){setup(kph);step(1/120);assert.equal(W.vehicle.waterMode,'sinking');assert.equal(starts,0);}
setup(140.01);step(1/120);assert.equal(W.vehicle.waterMode,'skimming');
console.log('PASS: skim requires strictly more than 140 km/h at water contact.');
setup(160);step(3.49,gas);assert.equal(W.vehicle.waterMode,'skimming');assert(W.vehicle.y>.07&&W.vehicle.y<.13);assert(W.vehicle.speed*3.6<140);assert(W.vehicle.x>120);assert.equal(starts,1);assert.equal(recoveries,0);
step(.02,gas);assert.equal(W.vehicle.waterMode,'sinking');assert.equal(sinks,1);step(.8,gas);assert(W.vehicle.y<-.8);step(.7,gas);assert.equal(recoveries,1);assert.equal(starts,1);assert.equal(W.vehicle.waterMode,'dry');assert(W.vehicle.x<0);assert.equal(W.vehicle.skimTime,0);
console.log('PASS: 3.5-second skim keeps moving as speed falls; then visible sinking and one recovery. Holding throttle cannot renew it.');
setup(180,10);step(.6);assert.equal(starts,0);assert.equal(W.vehicle.skimTime,0);assert.equal(W.vehicle.waterMode,'dry');for(let i=0;i<240&&W.vehicle.waterMode==='dry';i++)step(1/120);assert.equal(W.vehicle.waterMode,'skimming');assert(W.vehicle.skimTime<.02);assert(Math.abs(W.vehicle.y-.1)<.03);
console.log('PASS: airborne jumps do not consume skim time before touching water.');
setup(160);step(.5);W.vehicle.x=-2;W.vehicle.vx=-5;step(1/120);assert.equal(W.vehicle.waterMode,'dry');assert.equal(W.vehicle.skimTime,0);assert.equal(recoveries,0);W.vehicle.x=2;W.vehicle.y=.12;W.vehicle.vx=160/3.6;W.vehicle.vy=0;step(1/120);assert.equal(W.vehicle.waterMode,'skimming');assert.equal(starts,2);
W.resetVehicle();assert.equal(W.vehicle.waterMode,'dry');assert.equal(W.vehicle.skimTime,0);assert.equal(W.vehicle.waterTime,0);
console.log('PASS: reaching shore ends safely, a later entry can skim again, and manual recovery clears water state.');
// Integrate with the actual island coast, including the drop from beach to sea.
Object.assign(W,actual);W.initTerrain();let coastZ=700;while(W.height(0,coastZ)>=-.5&&coastZ<1200)coastZ++;
W.resetVehicle(true);Object.assign(W.vehicle,{x:0,z:coastZ-15,y:W.driveHeight(0,coastZ-15)+.12,yaw:0,vx:0,vz:180/3.6});
for(let i=0;i<600&&W.vehicle.waterMode==='dry';i++)step(1/120);
assert.equal(W.vehicle.waterMode,'skimming');assert(Math.abs(W.vehicle.y-.1)<.03);assert(W.height(W.vehicle.x,W.vehicle.z)<-.5);
console.log('PASS: a 180 km/h approach across the real beach transitions to water skimming.');

