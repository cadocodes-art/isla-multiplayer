const fs=require('fs'),vm=require('vm'),assert=require('assert');global.THREE=require('../../public/three.min.js');global.window=global;
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
for(const name of ['world.js','islands.js','ramps.js','physics.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/'+name,'utf8'));
const W=Isla;W.initTerrain();const scene=new THREE.Scene();W.makeBridge(scene);W.makeBuildings(scene);W.makeRamps(scene);W.makeVegetation(scene);W.makeRuizDetails(scene);W.buildCollisionIndex();
let luz=0,ruiz=0;for(let x=-1100;x<2400;x+=10)for(let z=-1100;z<1100;z+=10)if(W.height(x,z)>0){if(x>W.bridge.end-20)ruiz+=100;else luz+=100;}
assert(ruiz/luz>.37&&ruiz/luz<.43);assert.equal(W.buildings.filter(b=>b.island==='ruiz').length,22);assert.equal(W.bridge.end-W.bridge.start,400);assert.equal(W.ramps.length,15);
console.log('PASS: Santa Ruiz area is '+(ruiz/luz*100).toFixed(1)+'% of Santa Luz, with 22 buildings, a 400 m bridge, and 15 original ramps.');
const bounds=W.ruiz.bounds;assert((bounds.maxZ-bounds.minZ)/(bounds.maxX-bounds.minX)>1.7);
const radii=[];for(let i=0;i<128;i++){const p=W.ruizCoastPoint(i*Math.PI/64);radii.push(Math.hypot((p.x-W.ruiz.x)/W.ruiz.rx,p.z/W.ruiz.rz));}
assert(Math.max(...radii)-Math.min(...radii)>.2);
for(const p of W.ruizRoad.samples){assert(W.height(p.x,p.z)>5,'Coast road must stay inland');assert(W.ruizHeight(p.x,p.z)>5,'Coast road cannot create a causeway through a bay');}
console.log('PASS: Santa Ruiz has an elongated, irregular outline and its winding coast road stays inland.');
const roadScene=new THREE.Scene(),asphalt=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
for(const road of [W.luzApproach,W.bridgeRoad,W.ruizApproach])W.makeRoadStrip(roadScene,road.samples,road.width,asphalt,0,.13);roadScene.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
for(const join of [W.bridge.start,W.bridge.end])for(let x=join-15;x<=join+15;x+=.25)for(const z of [-4.5,-2.35,0,2.35,4.5]){ray.set(new THREE.Vector3(x,100,z),down);const hits=ray.intersectObjects(roadScene.children);assert(hits.length,'Visible road gap at '+x+','+z);assert(Math.abs(hits[0].point.y-W.driveHeight(x,z))<.025,'Visible road must match the driving surface at '+x+','+z);}
console.log('PASS: actual rendered road triangles meet the bridge at deck height across both lanes, with no visible gap.');
assert(W.ruiz.rz>W.ruiz.rx*1.4);for(let x=W.bridge.start+30;x<W.bridge.end-30;x+=10){assert(W.height(x,0)<0);assert.equal(W.driveHeight(x,0),8);}
console.log('PASS: the bridge is raised over open water, not a terrain causeway.');
const idle={gas:false,brake:false,steer:0,handbrake:false,boost:false};
for(const dir of [1,-1]){W.resetVehicle(true);const x=dir===1?W.bridge.start-50:W.bridge.end+50;Object.assign(W.vehicle,{x,z:0,y:W.driveHeight(x,0)+.12,yaw:dir*Math.PI/2,vx:dir*25,vz:0});for(let i=0;i<3600;i++){W.stepVehicle(1/120,{...idle,gas:true},i/120);assert.equal(W.vehicle.waterMode,'dry');assert(Number.isFinite(W.vehicle.y));if(dir===1&&W.vehicle.x>W.bridge.end+35||dir===-1&&W.vehicle.x<W.bridge.start-35)break;}assert(dir===1?W.vehicle.x>W.bridge.end+35:W.vehicle.x<W.bridge.start-35);}
console.log('PASS: uninterrupted driving across the bridge in both directions without sinking or dropping through the deck.');
for(const dir of [1,-1])for(const lane of [-2.35,0,2.35])for(const initial of [0,5,25]){W.resetVehicle(true);const x=dir===1?W.bridge.start-28:W.bridge.end+28;Object.assign(W.vehicle,{x,z:lane,y:W.driveHeight(x,lane)+.12,yaw:dir*Math.PI/2,vx:dir*initial,vz:0});let crossed=false;for(let i=0;i<6000;i++){W.stepVehicle(1/120,{...idle,gas:true},i/120);assert.equal(W.vehicle.waterMode,'dry','Bridge join: direction '+dir+' lane '+lane+' initial '+initial);if(dir===1&&W.vehicle.x>W.bridge.end+35||dir===-1&&W.vehicle.x<W.bridge.start-35){crossed=true;break;}}assert(crossed);}
console.log('PASS: slow and fast bridge entries from rest and in both lanes remain dry in both directions.');

W.resetVehicle(true);Object.assign(W.vehicle,{x:(W.bridge.start+W.bridge.end)/2,z:0,y:.1,vx:0,vz:0});W.stepVehicle(1/120,idle,1);assert.equal(W.vehicle.waterMode,'sinking');assert(W.vehicle.y<1);
console.log('PASS: cars below the bridge stay in the water instead of teleporting onto the deck.');

