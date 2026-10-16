const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.THREE=require('../../public/three.min.js');global.window=global;
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
for(const name of ['world.js','ramps.js','physics.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/'+name,'utf8'));
const W=Isla,scene=new THREE.Scene();W.initTerrain();W.makeBuildings(scene);W.makeRamps(scene);W.makeVegetation(scene);W.buildCollisionIndex();
assert.equal(W.ramps.length,15);assert.equal(scene.children.filter(x=>x.name.startsWith('Off-road ramp ')).length,15);
const quadrants=new Set();for(const r of W.ramps){quadrants.add((r.x>0?1:0)+','+(r.z>0?1:0));for(let s=0;s<=r.d;s+=r.d/12)for(let u=-r.w/2;u<=r.w/2;u+=r.w/8){const p=W.rampPoint(r,u,s);for(const road of W.roads)assert(road.samples.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>road.width/2+4.9),'Ramp overlaps road');assert(W.height(p.x,p.z)>2.9);}assert(W.ramps.filter(p=>p!==r).every(p=>Math.hypot(p.x-r.x,p.z-r.z)>=150));}
assert.equal(quadrants.size,4);assert(W.colliders.filter(b=>b.kind==='tree'||b.kind==='rock').every(b=>!W.inRampClearing(b.x,b.z)));
console.log('PASS: exactly 15 ramps, spread across all four quadrants, entirely off-road with no trees or rocks in their run-ups/landing corridors.');
const idle={gas:false,brake:false,steer:0,handbrake:false,boost:false};let time=0;
function step(input=idle){time+=1/120;W.stepVehicle(1/120,input,time);}
function place(r,s,speed=100,across=0,yaw=r.yaw){W.resetVehicle(true);const p=W.rampPoint(r,across,s);Object.assign(W.vehicle,{x:p.x,z:p.z,y:W.driveHeight(p.x,p.z)+.12,yaw,vx:Math.sin(yaw)*speed/3.6,vz:Math.cos(yaw)*speed/3.6});}
for(const r of W.ramps){place(r,-8);let climbed=false,launched=false,peakVy=0;for(let j=0;j<600;j++){step({...idle,gas:true});const c=W.vehicle;if(c.ramp===r){climbed=true;assert(Math.abs(c.y-W.rampHeight(r,c.x,c.z)-.12)<.001);peakVy=Math.max(peakVy,c.vy);}if(climbed&&!c.ramp){assert(!c.grounded);assert(c.vy>4,'Ramp failed to launch upward');launched=true;break;}}assert(climbed&&launched,'Could not drive up ramp '+r.id);console.log(`PASS: ramp ${r.id} at (${r.x.toFixed(0)}, ${r.z.toFixed(0)}) launches at ${peakVy.toFixed(1)} m/s upward.`);}
const r=W.ramps[0];place(r,r.d+8,45,0,r.yaw+Math.PI);let maxProgress=-Infinity;for(let j=0;j<150;j++){step();maxProgress=Math.max(maxProgress,r.d-W.rampLocal(r,W.vehicle.x,W.vehicle.z).along);}assert(maxProgress<1);assert(!W.vehicle.ramp);assert(W.vehicle.y<W.rampHeight(r,W.vehicle.x,W.vehicle.z)-1);
console.log('PASS: the tall back face blocks ground-level entry without teleporting onto the deck.');
place(r,r.d/2,80);W.vehicle.y=W.rampHeight(r,W.vehicle.x,W.vehicle.z)+10;step();assert(!W.vehicle.ramp);assert(!W.vehicle.grounded);
console.log('PASS: flying above a ramp does not snap the car onto it.');

