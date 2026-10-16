const fs=require('fs'),vm=require('vm'),assert=require('assert');global.window=global;global.THREE=require('../../public/three.min.js');
for(const f of ['world.js','physics.js','aura.js','garage.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../../public/'+f,'utf8'));
const W=Isla,memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};let g=W.createGarage(storage);
assert.deepEqual(W.carModels.map(m=>m.price),[0,30000,80000,180000]);
const previousSave=JSON.stringify({balance:50000,earned:350000,bestChain:12000,owned:['classic','rally','gt','solstice'],selected:'solstice'}),resetMemory=new Map([['isla-drive-garage-v1',previousSave]]),resetStorage={getItem:k=>resetMemory.get(k),setItem:(k,v)=>resetMemory.set(k,v)};
let fresh=W.createGarage(resetStorage);
assert.equal(fresh.balance,0);assert.equal(fresh.earned,0);assert.equal(fresh.bestChain,0);assert.equal(fresh.selected,'classic');assert.deepEqual(fresh.owned,['classic']);assert(!fresh.choose('solstice').ok);
fresh.credit(30500,1800);assert(fresh.choose('rally').ok);fresh=W.createGarage(resetStorage);
assert.equal(fresh.balance,500);assert.equal(fresh.earned,30500);assert.equal(fresh.bestChain,1800);assert.deepEqual(fresh.owned,['classic','rally']);assert.equal(fresh.selected,'rally');assert.equal(resetMemory.get('isla-drive-garage-v1'),previousSave);
console.log('PASS: the fresh start clears aura, best chain, and paid unlocks; new earnings and purchases survive reloads, and the old save stays recoverable.');
assert.deepEqual(g.owned,['classic']);assert(!g.choose('rally').ok);assert.equal(g.balance,0);g.credit(30500,2100);assert(g.choose('rally').ok);assert.equal(g.balance,500);assert.equal(g.earned,30500);g.choose('rally');assert.equal(g.balance,500);g.choose('classic');assert.equal(g.balance,500);g=W.createGarage(storage);assert(g.owned.includes('rally'));assert.equal(g.balance,500);assert.equal(g.bestChain,2100);assert(!g.choose('solstice').ok);assert.equal(g.selected,'classic');
console.log('PASS: purchases deduct the listed aura once, owned cars stay free to switch, insufficient funds are blocked, and balances/unlocks survive reloads.');
const broken=W.createGarage({getItem:()=>'{invalid',setItem:()=>{throw Error('blocked')}});broken.credit(1000);assert.equal(broken.balance,1000);assert(!broken.persistent);assert.deepEqual(broken.owned,['classic']);
console.log('PASS: unavailable or corrupted storage falls back safely to the starter car and session progress.');
W.height=W.driveHeight=()=>0;W.slope=()=>({x:0,z:0});const road={samples:[{x:0,z:-1000},{x:0,z:0},{x:0,z:1000}]};W.nearestRoad=(x,z)=>({d:0,p:{x,z,width:12,index:1,road}});W.buildCollisionIndex();
const idle={gas:false,brake:false,steer:0,handbrake:false,boost:false};let previous=0;
for(const model of W.carModels){W.garage.selected=model.id;W.resetVehicle(true);Object.assign(W.vehicle,{x:0,z:0,yaw:0,vx:0,vz:100/3.6});const old=Math.random;Math.random=()=>.999;for(let i=0;i<6.8*120;i++)W.stepVehicle(1/120,{...idle,gas:true,boost:true},i/120);Math.random=old;const kph=W.vehicle.vz*3.6;assert(kph>previous);assert(Math.abs(kph-model.boostKph)<5,model.name+' actual '+kph);previous=kph;console.log(model.name+': '+kph.toFixed(1)+' km/h nitro, price '+model.price);}
console.log('PASS: each paid upgrade is faster and its garage speed estimate matches the driving physics.');
W.garage=W.createGarage(storage);const before=W.garage.balance,tracker=W.createAuraTracker(),c={x:0,z:0,y:0,vx:0,vz:20,grounded:true,waterMode:'dry'};
tracker.update(c,.1);for(let i=0;i<10;i++){c.z+=2;c.y=3;c.grounded=false;tracker.update(c,.1);}c.z+=2;c.y=0;c.grounded=true;tracker.update(c,.1);
assert(tracker.total>0);assert.equal(W.garage.balance-before,tracker.total);assert.equal(W.createGarage(storage).balance,W.garage.balance);
console.log('PASS: landing a stunt credits exactly the awarded aura to the saved spendable balance.');

