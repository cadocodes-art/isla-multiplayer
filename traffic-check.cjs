const fs=require('fs'),vm=require('vm'),assert=require('assert');global.window=global;global.THREE=require('../../public/three.min.js');for(const f of ['world.js','islands.js','ramps.js','physics.js','traffic.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/'+f,'utf8'));
const W=Isla;W.initTerrain();W.resetVehicle(true);W.initTraffic();assert.equal(W.traffic.length,18);assert(W.traffic.some(t=>t.x>W.bridge.end));assert(W.traffic.some(t=>W.bridgeSurface(t.x,t.z)!=null));assert(W.traffic.some(t=>t.x<700));const before=W.traffic.map(t=>({x:t.x,z:t.z}));let crossed=false;
for(let i=0;i<90*120;i++){W.stepTraffic(1/120);for(const t of W.traffic){assert(Number.isFinite(t.x)&&Number.isFinite(t.y));assert(W.driveHeight(t.x,t.z)>0);if(t.route===W.trafficRoutes[2]&&t.x>W.bridge.end+20)crossed=true;}}
assert(crossed);assert(W.traffic.some((t,i)=>Math.hypot(t.x-before[i].x,t.z-before[i].z)>50));
console.log('PASS: 18 traffic cars travel on both islands, cross the bridge, and stay on drivable surfaces.');
const t=W.traffic[0];Object.assign(W.vehicle,{x:t.x+Math.sin(t.yaw)*14,z:t.z+Math.cos(t.yaw)*14,y:t.y,grounded:true,vx:0,vz:0});const initial=t.speed;for(let i=0;i<120;i++)W.stepTraffic(1/120);assert(t.speed<initial);
console.log('PASS: traffic brakes for a stopped player ahead.');
Object.assign(W.vehicle,{x:t.x,z:t.z,y:t.y,yaw:t.yaw,vx:Math.sin(t.yaw)*35,vz:Math.cos(t.yaw)*35});const pos={x:W.vehicle.x,z:W.vehicle.z};W.resolveTraffic();assert(Math.hypot(W.vehicle.x-pos.x,W.vehicle.z-pos.z)>.1);assert(t.stun>0);
console.log('PASS: player/traffic contact separates the vehicles and makes the traffic car react.');

