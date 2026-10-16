const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.THREE=require('../../public/three.min.js');global.window=global;
vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/world.js','utf8'));
vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/physics.js','utf8'));
const W=Isla,idle={gas:false,brake:false,steer:0,handbrake:false,boost:false};
const road={samples:[{x:0,z:-10000},{x:0,z:0},{x:0,z:10000}]};
W.height=W.driveHeight=()=>0;W.slope=()=>({x:0,z:0});
W.nearestRoad=(x,z)=>({d:0,p:{x,z,width:12,index:1,road}});W.buildCollisionIndex();
let time=0,starts=0;W.onNitroStart=()=>starts++;
function setup(kph=100,y=.12){time=0;starts=0;W.resetVehicle(true);Object.assign(W.vehicle,{x:0,z:0,y,yaw:0,vx:0,vz:kph/3.6});}
function step(seconds,input=idle){for(let i=0;i<Math.round(seconds*120);i++){time+=1/120;W.stepVehicle(1/120,input,time);}}
const originalRandom=Math.random;
try{
 for(const random of [0,.5,.999999]){Math.random=()=>random;setup();step(1/120,{...idle,boost:true});assert.equal(W.vehicle.nitroDuration,5+2*random);assert(W.vehicle.nitroTime<7&&W.vehicle.nitroTime>4.99);}
 console.log('PASS: fresh random durations span 5–7 seconds.');
 Math.random=()=>.5;setup();step(6,{...idle,boost:true});assert.equal(starts,1);assert.equal(W.vehicle.nitroTime,0);assert.equal(W.vehicle.nitroCharge,0);
 step(4,{...idle,boost:true});assert(Math.abs(W.vehicle.nitroCharge-.5)<1e-8);assert.equal(starts,1);
 step(5,{...idle,boost:true});assert.equal(W.vehicle.nitroCharge,1);assert.equal(starts,1);step(1/120);step(1/120,{...idle,boost:true});assert.equal(starts,2);
 console.log('PASS: an empty tank refills steadily in 8 seconds; holding Shift never auto-restarts.');
 setup();step(3,{...idle,boost:true});assert(Math.abs(W.vehicle.nitroCharge-.5)<1e-8);step(1/120);assert.equal(W.vehicle.nitroTime,0);assert.equal(W.vehicle.throttle,0);assert(W.vehicle.nitroCharge>.5&&W.vehicle.nitroCharge<.502);
 for(let i=0;i<20;i++){step(.05,{...idle,boost:true});step(.05);}assert.equal(starts,1);assert.equal(W.vehicle.nitroTime,0);assert(W.vehicle.nitroCharge>.74&&W.vehicle.nitroCharge<.76);
 step(1.975);assert(W.vehicle.nitroCharge<1);step(1/120,{...idle,boost:true});assert.equal(starts,1);step(.05);assert.equal(W.vehicle.nitroCharge,1);step(1/120,{...idle,boost:true});assert.equal(starts,2);assert(W.vehicle.nitroTime>5.9);
 console.log('PASS: early release preserves the bar level; repeated presses cannot bypass refill or restart before full.');
 for(const duration of [5,6,7]){Math.random=()=>(duration-5)/2;setup();step(duration-.02,{...idle,boost:true});const speed=W.vehicle.vz*3.6;assert(speed>=180&&speed<200,`${duration}s boost reached ${speed} km/h`);const before=W.vehicle.vz;step(.05,{...idle,gas:true});assert(Math.abs(W.vehicle.vz-before)<.3);console.log(`PASS: ${duration}s burst from 100 km/h reaches ${speed.toFixed(1)} km/h and expires smoothly.`);}
 Math.random=()=>.5;setup(100,20);step(1);const normalY=W.vehicle.y,normalVy=W.vehicle.vy;
 setup(100,20);step(1,{...idle,boost:true});assert(W.vehicle.y>normalY+2);assert(W.vehicle.vy>normalVy+4);
 step(7,{...idle,boost:true});assert.equal(W.vehicle.nitroTime,0);assert(W.vehicle.grounded);assert(Math.abs(W.vehicle.y-.12)<.1);
 console.log('PASS: boost reduces airborne gravity, then returns to a settled normal landing.');
 setup(100);step(.5,{...idle,boost:true,brake:true});assert(W.vehicle.vz<100/3.6);assert(W.vehicle.nitroTime>0);
 setup(-20);step(.5,{...idle,boost:true});assert.equal(starts,0);assert.equal(W.vehicle.nitroTime,0);
 setup();step(3,{...idle,boost:true});const chargeBeforeReset=W.vehicle.nitroCharge;W.resetVehicle();assert.equal(W.vehicle.nitroTime,0);assert.equal(W.vehicle.nitroDuration,0);assert.equal(W.vehicle.nitroCharge,chargeBeforeReset);step(1/120,{...idle,boost:true});assert.equal(starts,1);
 console.log('PASS: brakes override thrust, reverse cannot fire nitro, and recovery cannot bypass recharge.');
 W.height=W.driveHeight=x=>x<0?0:-12;W.nearestRoad=()=>({d:Infinity,p:null});setup(160);W.vehicle.x=2;W.vehicle.lastSafe={x:-20,z:0,yaw:0};
 step(3.49,{...idle,boost:true});assert.equal(W.vehicle.waterMode,'skimming');assert(W.vehicle.nitroTime>0);step(.02,{...idle,boost:true});assert.equal(W.vehicle.waterMode,'sinking');assert.equal(W.vehicle.nitroTime,0);
 console.log('PASS: nitro cannot extend the 3.5-second water skim and ends on sinking.');
 const source=fs.readFileSync(__dirname+'/../../public/game.js','utf8'),keys=new Set();
 const input=vm.runInNewContext('('+source.match(/function input\(\)\{[^\n]+/)[0]+')',{keys});
 for(const key of ['ShiftLeft','ShiftRight']){keys.clear();keys.add(key);assert(input().boost);}
 keys.clear();keys.add('ArrowLeft');assert.equal(input().steer,1);assert(!input().boost);
 console.log('PASS: both Shift keys activate boost and left steering remains corrected.');
}finally{Math.random=originalRandom;}

