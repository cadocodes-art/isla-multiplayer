'use strict';
(()=>{
 const W=Isla,T=THREE;
 let area=0;for(let z=-1000;z<1000;z+=10)for(let x=-1000;x<1000;x+=10)if(W.luzHeight(x+5,z+5)>0)area+=100;
 let shore=700;while(W.luzHeight(shore,0)>0&&shore<1100)shore++;
 // An elongated, asymmetric coast with headlands and shallow bays, scaled to the same land area.
 const coast=a=>Math.pow(Math.abs(Math.cos(a))**2.8+Math.abs(Math.sin(a))**2.8,-1/2.8)*(1+.11*Math.sin(3*a+.45)+.065*Math.sin(5*a-1.1)+.035*Math.sin(9*a+.6));
 let unitArea=0;for(let i=0;i<2048;i++)unitArea+=coast((i+.5)*Math.PI/1024)**2*Math.PI/2048;
 const aspect=2.05,rx=Math.sqrt(area*.4/(unitArea*aspect)),rz=rx*aspect,start=shore-8,end=start+400;
 W.ruiz={x:end+rx*coast(Math.PI)-8,z:0,rx,rz,targetArea:area*.4,mainArea:area};
 W.ruizCoastPoint=(a,inset=1)=>({x:W.ruiz.x+rx*coast(a)*Math.cos(a)*inset,z:rz*coast(a)*Math.sin(a)*inset});
 const outline=Array.from({length:256},(_,i)=>W.ruizCoastPoint(i*Math.PI/128));
 W.ruiz.bounds={minX:Math.min(...outline.map(p=>p.x)),maxX:Math.max(...outline.map(p=>p.x)),minZ:Math.min(...outline.map(p=>p.z)),maxZ:Math.max(...outline.map(p=>p.z))};
 W.bridge={start,end,length:400,width:11,deckY:8};
 Object.assign(W,{span:3600,depth:2400,N:481,NZ:321,minX:-1200,minZ:-1200});
 W.mapBounds={x:-1100,z:-1700,size:3400};
 W.ruizHeight=(x,z)=>{const u=(x-W.ruiz.x)/rx,v=z/rz,r=Math.hypot(u,v)/coast(Math.atan2(v,u));if(r>1)return -2-(r-1)*400;const beach=3.3+(1-r)*45,interior=13+48*Math.exp(-r*r*4)+(W.fbm(x*.007,z*.007)-.5)*10;return W.mix(beach,interior,W.smooth(0,.23,1-r));};
 W.bridgeSurface=(x,z)=>x>=start&&x<=end&&Math.abs(z)<=6.1?W.bridge.deckY:null;
 // Exact road grades keep the approach flush with the deck despite the coarse terrain grid.
 W.approachSurface=(x,z)=>{
  if(Math.abs(z)>6.1)return null;
  const r=x<start?W.luzApproach:x>end?W.ruizApproach:null;if(!r)return null;
  const p=r.samples;if(x<p[0].x||x>p.at(-1).x)return null;
  let i=0;while(i<p.length-2&&p[i+1].x<x)i++;
  return W.mix(p[i].y,p[i+1].y,(x-p[i].x)/(p[i+1].x-p[i].x))+.21;
 };
 W.placeName=(x,z,y)=>W.bridgeSurface(x,z)!=null?'SANTA RUIZ BRIDGE':x>end-20?'ISLA SANTA RUIZ':z>450?'BAHÍA COAST':x>500?'EAST SHORE':y>80?'SUMMIT PASS':x<-350?'PALM VALLEY':'SANTA LUZ';
 W.extendRoads=()=>{
  const points=[];for(let i=0;i<32;i++){const a=Math.PI+i*Math.PI/16,inset=.73+.035*Math.sin(4*a+.3)+.025*Math.sin(7*a-.7),p=W.ruizCoastPoint(a,inset);points.push([p.x,p.z]);}
  W.ruizRoad=W.addRoad(points,9.5,true,'Santa Ruiz coast road');
  W.luzApproach=W.addRoad([[680,0],[750,0],[start-40,0],[start,0]],11,false,'Ruiz bridge approach');
  W.ruizApproach=W.addRoad([[end,0],[end+40,0],[points[0][0],0]],11,false,'Ruiz arrival road');
  for(const r of [W.luzApproach,W.ruizApproach]){r.graded=true;for(const p of r.samples){const distance=r===W.luzApproach?start-p.x:p.x-end;p.y=W.mix(7.79,p.y,W.smooth(0,70,distance));}}
  W.bridgeRoad=W.addRoad([[start,0],[end,0]],11,false,'Santa Ruiz bridge');W.bridgeRoad.elevated=true;W.bridgeRoad.samples.forEach(p=>p.y=7.79);
 };
 function sign(scene,x,z,yaw,title,subtitle){const g=new T.Group();g.position.set(x,W.driveHeight(x,z),z);g.rotation.y=yaw;scene.add(g);const metal=W.mat('#b1bab7',.6,.5);for(const side of [-1,1])W.box(g,side*1.4,2.2,0,.12,4.4,.12,metal);const tex=W.textureCanvas(512,c=>{c.fillStyle='#1f5954';c.fillRect(0,0,512,512);c.strokeStyle='#e6f0e1';c.lineWidth=8;c.strokeRect(10,128,492,256);c.fillStyle='#f4f1dd';c.textAlign='center';c.font='bold 37px Arial';c.fillText(title,256,232);c.font='23px Arial';c.fillText(subtitle,256,299);});const m=new T.Mesh(new T.PlaneGeometry(5.4,5.4),new T.MeshStandardMaterial({map:tex,side:T.DoubleSide}));m.position.y=4.8;g.add(m);}
 W.makeBridge=scene=>{
  const group=new T.Group();group.name='400 m Santa Ruiz bridge';scene.add(group);
  const concrete=W.mat('#aaa99a'),steel=W.mat('#7b898a',.5,.55),dark=W.mat('#3d484a');
  W.box(group,(start+end)/2,7.3,0,400,1.2,13.2,concrete);
  // Solid abutments support the visible approach through the shoreline's coarse terrain cells.
  for(const [x0,x1] of [[start-18,start+.5],[end-.5,end+18]]){
   const pos=[],idx=[],count=20;
   for(let i=0;i<=count;i++){const x=W.mix(x0,x1,i/count),top=W.driveHeight(x,0)-.12;pos.push(x,top,-6.5,x,top,6.5,x,-4,-6.5,x,-4,6.5);if(i){const a=(i-1)*4,b=i*4;idx.push(a,a+1,b,a+1,b+1,b,a+2,a,b,a+2,b,b+2,a+1,a+3,b+1,a+3,b+3,b+1);}}
   const last=count*4;idx.push(0,2,1,1,2,3,last,last+1,last+2,last+1,last+3,last+2);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const abutment=new T.Mesh(geo,concrete);abutment.castShadow=abutment.receiveShadow=true;group.add(abutment);
  }
  for(const side of [-1,1]){W.box(group,(start+end)/2,6.35,side*4,400,.8,.5,steel);W.box(group,(start+end)/2,8.35,side*6.25,400,.7,.35,concrete);W.box(group,(start+end)/2,9.05,side*6.25,400,.12,.13,steel);W.colliders.push({kind:'barrier',x:(start+end)/2,z:side*6.25,y:8,yaw:Math.PI/2,w:.4,d:400,h:1.1});}
  for(let x=start+10;x<end;x+=20)for(const side of [-1,1])W.box(group,x,8.8,side*6.25,.13,.65,.13,steel);
  for(let x=start+40;x<end;x+=64)for(const side of [-1,1]){const floor=W.height(x,side*4),height=6.2-floor;W.box(group,x,floor+height/2,side*4,2.5,height,2.5,concrete);W.colliders.push({kind:'pier',x,z:side*4,y:floor,r:1.6,h:height});}
  for(let x=start+40;x<end;x+=40)W.box(group,x,8.012,0,.12,.02,11,dark,false);
  sign(scene,start-65,10,Math.PI/2,'ISLA SANTA RUIZ','400 m BRIDGE  →');sign(scene,end+55,-12,-Math.PI/2,'SANTA RUIZ','BIENVENIDOS');
 };
 W.makeRuizBuildings=(scene,build)=>{
  let count=0;const samples=W.ruizRoad.samples;
  for(let k=0;k<80&&count<22;k++){const i=Math.floor(((k+.4)/22%1)*(samples.length-1)),p=samples[i],q=samples[i+1],a=Math.atan2(q.x-p.x,q.z-p.z),side=k%2?1:-1,off=22+(k%3)*3,x=p.x+Math.cos(a)*side*off,z=p.z-Math.sin(a)*side*off;
   if(W.buildings.some(b=>Math.hypot(b.x-x,b.z-z)<27)||Math.abs(z)<24&&x<W.ruiz.x)continue;
   const before=W.buildings.length;build(x,z,a-side*Math.PI/2,10+(k%4),9+(k%3),k%3?2:1,'Santa Ruiz residence');
   if(W.buildings.length>before){W.buildings.at(-1).island='ruiz';count++;}
  }
  if(count!==22)throw Error('Santa Ruiz building placement incomplete');
 };
 W.makeRuizDetails=scene=>{
  let seed=48213;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),a=W.palmAssets,o=new T.Object3D(),palms=[];
  const bounds=W.ruiz.bounds;
  for(let i=0;i<4000&&palms.length<260;i++){const x=W.mix(bounds.minX,bounds.maxX,random()),z=W.mix(bounds.minZ,bounds.maxZ,random()),y=W.height(x,z),n=W.nearestRoad(x,z);if(y<3||n.d<15||W.buildings.some(b=>Math.hypot(b.x-x,b.z-z)<20))continue;palms.push({x,y,z,s:.8+random()*.5,a:random()*Math.PI*2});}
  const trunks=new T.InstancedMesh(a.tg,a.trunkMat,palms.length),leaves=new T.InstancedMesh(a.lg,a.leafMat,palms.length*10);
  palms.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.a,0);o.scale.setScalar(p.s);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);const lean=new T.Vector3(.75,7.45,0).applyAxisAngle(new T.Vector3(0,1,0),p.a);for(let k=0;k<10;k++){o.position.set(p.x+lean.x*p.s,p.y+lean.y*p.s,p.z+lean.z*p.s);o.rotation.set((k%2)*.14,p.a+k*Math.PI/5,.12+(k%3)*.12);o.scale.setScalar(p.s*.95);o.updateMatrix();leaves.setMatrixAt(i*10+k,o.matrix);}W.colliders.push({kind:'tree',x:p.x,z:p.z,y:p.y,r:.3});});trunks.castShadow=leaves.castShadow=true;trunks.receiveShadow=true;scene.add(trunks,leaves);
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),W.mat('#7e8270'),70);let ri=0;for(let i=0;i<1000&&ri<70;i++){const x=W.mix(bounds.minX,bounds.maxX,random()),z=W.mix(bounds.minZ,bounds.maxZ,random()),y=W.height(x,z),n=W.nearestRoad(x,z);if(y<2||n.d<22||W.buildings.some(b=>Math.hypot(b.x-x,b.z-z)<22))continue;const size=1+random()*2;o.position.set(x,y+size*.2,z);o.rotation.set(.2,random()*6,.2);o.scale.set(size,size*.7,size*.85);o.updateMatrix();rocks.setMatrixAt(ri++,o.matrix);W.colliders.push({kind:'rock',x,z,y,r:size*.8});}rocks.count=ri;rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
 };
})();
