'use strict';
(()=>{
 const W=Isla,T=THREE;W.traffic=[];
 function route(points){const p=[];for(const q of points)if(!p.length||Math.hypot(q.x-p.at(-1).x,q.z-p.at(-1).z)>.05)p.push({x:q.x,z:q.z});if(Math.hypot(p[0].x-p.at(-1).x,p[0].z-p.at(-1).z)<.05)p.pop();const lengths=[0];for(let i=1;i<=p.length;i++)lengths.push(lengths.at(-1)+Math.hypot(p[i%p.length].x-p[i-1].x,p[i%p.length].z-p[i-1].z));return {p,lengths,length:lengths.at(-1)};}
 function sample(r,s){s=(s%r.length+r.length)%r.length;let lo=0,hi=r.p.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.lengths[mid]<=s)lo=mid;else hi=mid-1;}const p=r.p[lo],q=r.p[(lo+1)%r.p.length],f=(s-r.lengths[lo])/(r.lengths[lo+1]-r.lengths[lo]);return {x:W.mix(p.x,q.x,f),z:W.mix(p.z,q.z,f),yaw:Math.atan2(q.x-p.x,q.z-p.z)};}
 W.initTraffic=()=>{
  const luz=W.roads[0].samples.slice(0,-1),ruiz=W.ruizRoad.samples.slice(0,-1);let start=0;for(let i=1;i<luz.length;i++)if(Math.hypot(luz[i].x-680,luz[i].z)<Math.hypot(luz[start].x-680,luz[start].z))start=i;
  const rotated=[...luz.slice(start),...luz.slice(0,start),luz[start]],link=[...W.luzApproach.samples,...W.bridgeRoad.samples,...W.ruizApproach.samples];
  W.trafficRoutes=[route(luz),route(ruiz),route([...rotated,...link,...ruiz,ruiz[0],...link.slice().reverse()])];W.traffic=[];
  const colors=['#d7d7c9','#245e76','#6d3544','#b2986c','#47776d','#3b4349'];
  [8,6,4].forEach((count,ri)=>{const r=W.trafficRoutes[ri];for(let i=0;i<count;i++){let distance=(i+.5)*r.length/count;if(ri===2){let index=r.p.findIndex(p=>p.x>W.bridge.start+50&&p.x<W.bridge.end&&Math.abs(p.z)<1);distance=r.lengths[index]+i*85;}const t={id:W.traffic.length,route:r,distance,direction:i%2?1:-1,cruise:ri===2?15:11+(i%4)*2,speed:0,lane:2.35,offsetX:0,offsetZ:0,driftX:0,driftZ:0,stun:0,w:1.9,d:4.4,color:colors[(i+ri)%colors.length],x:0,y:0,z:0,yaw:0,vx:0,vz:0};t.speed=t.cruise;W.traffic.push(t);place(t);}});
 };
 function place(t){const p=sample(t.route,t.distance);t.yaw=p.yaw+(t.direction<0?Math.PI:0);t.x=p.x+Math.cos(t.yaw)*t.lane+t.offsetX;t.z=p.z-Math.sin(t.yaw)*t.lane+t.offsetZ;t.y=W.driveHeight(t.x,t.z)+.12;t.vx=Math.sin(t.yaw)*t.speed+t.driftX;t.vz=Math.cos(t.yaw)*t.speed+t.driftZ;}
 W.stepTraffic=dt=>{
  for(const t of W.traffic){let target=t.cruise;const sx=Math.sin(t.yaw),sz=Math.cos(t.yaw);
   for(const other of [...W.traffic,...(W.trafficObstacles||[W.vehicle])]){if(other===t||Math.abs(other.y-t.y)>2.4)continue;const dx=other.x-t.x,dz=other.z-t.z,ahead=dx*sx+dz*sz,cross=dx*sz-dz*sx;if(ahead>0&&ahead<55&&Math.abs(cross)<2.1)target=Math.min(target,Math.max(0,(ahead-7)*.55));}
   if(t.stun>0){t.stun=Math.max(0,t.stun-dt);target=0;}
   t.speed+=W.clamp(target-t.speed,-6*dt,1.8*dt);t.distance+=t.speed*t.direction*dt;t.offsetX=(t.offsetX+t.driftX*dt)*Math.exp(-dt*.65);t.offsetZ=(t.offsetZ+t.driftZ*dt)*Math.exp(-dt*.65);t.driftX*=Math.exp(-dt*2.4);t.driftZ*=Math.exp(-dt*2.4);t.offsetX=W.clamp(t.offsetX,-5,5);t.offsetZ=W.clamp(t.offsetZ,-5,5);
   const p=sample(t.route,t.distance);if(p.x>=W.bridge.start&&p.x<=W.bridge.end&&Math.abs(p.z)<1)t.offsetZ=W.clamp(t.offsetZ,-1,1);place(t);
  }
 };
 W.resolveTraffic=()=>{const c=W.vehicle,sx=Math.sin(c.yaw),sz=Math.cos(c.yaw);for(const t of W.traffic){if(Math.hypot(c.x-t.x,c.z-t.z)>8||Math.abs(c.y-t.y)>1.8)continue;for(const off of [-1.2,1.2]){const hit=W.circleOBB(c.x+sx*off,c.z+sz*off,.94,t);if(!hit)continue;const approach=-((c.vx-t.vx)*hit.nx+(c.vz-t.vz)*hit.nz);c.x+=hit.nx*hit.depth*.85;c.z+=hit.nz*hit.depth*.85;t.offsetX-=hit.nx*hit.depth*.15;t.offsetZ-=hit.nz*hit.depth*.15;if(approach>0){if(approach>2)W.net?.trafficHit(t,hit.nx,hit.nz,approach);c.vx+=hit.nx*approach*.9;c.vz+=hit.nz*approach*.9;c.yawRate+=(sx*hit.nz-sz*hit.nx)*off*approach*.012;t.driftX-=hit.nx*approach*.3;t.driftZ-=hit.nz*approach*.3;t.speed*=.45;t.stun=1.6;if(approach>2)W.onImpact?.(c.x,c.y+.7,c.z,approach,t);}}}};
 W.makeTraffic=scene=>{
  W.initTraffic();const count=W.traffic.length,box=new T.BoxGeometry(1,1,1),wheel=new T.CylinderGeometry(.34,.34,.24,12);wheel.rotateZ(Math.PI/2);
  const paint=W.mat('#ffffff',.4,.55),glass=W.mat('#253d45',.17,.6),rubber=W.mat('#182022'),rim=W.mat('#abb7ba',.35,.8),head=new T.MeshStandardMaterial({color:0xe8f2df,emissive:0xc5debc,emissiveIntensity:.4}),tail=new T.MeshStandardMaterial({color:0xa32320,emissive:0xff2211,emissiveIntensity:.2});
  const parts=[{p:[0,.66,0],s:[1.85,.54,4.25],m:paint},{p:[0,1.18,-.1],s:[1.54,.58,1.9],m:glass},{p:[0,1.49,-.1],s:[1.52,.06,1.85],m:paint},{p:[0,.48,2.12],s:[1.7,.16,.11],m:rubber},{p:[0,.48,-2.12],s:[1.7,.16,.11],m:rubber}];
  for(const side of [-1,1]){parts.push({p:[side*.64,.76,2.14],s:[.39,.11,.06],m:head},{p:[side*.64,.79,-2.14],s:[.42,.1,.06],m:tail});}
  for(const part of parts){part.mesh=new T.InstancedMesh(box,part.m,count);part.mesh.castShadow=part.mesh.receiveShadow=true;part.mesh.frustumCulled=false;if(part.m===paint)W.traffic.forEach((t,i)=>part.mesh.setColorAt(i,new T.Color(t.color).convertSRGBToLinear()));scene.add(part.mesh);}
  const tires=new T.InstancedMesh(wheel,rubber,count*4),rims=new T.InstancedMesh(wheel,rim,count*4);tires.castShadow=true;tires.frustumCulled=rims.frustumCulled=false;scene.add(tires,rims);
  const root=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4(),pitchQ=new T.Quaternion(),axisY=new T.Vector3(0,1,0),axisX=new T.Vector3(1,0,0);
  W.renderTraffic=()=>{W.traffic.forEach((t,i)=>{const sx=Math.sin(t.yaw),sz=Math.cos(t.yaw),pitch=Math.atan2(W.driveHeight(t.x+sx*1.4,t.z+sz*1.4)-W.driveHeight(t.x-sx*1.4,t.z-sz*1.4),2.8);root.position.set(t.x,t.y,t.z);root.quaternion.setFromAxisAngle(axisY,t.yaw).multiply(pitchQ.setFromAxisAngle(axisX,-pitch));root.updateMatrix();for(const part of parts){local.position.fromArray(part.p);local.rotation.set(0,0,0);local.scale.fromArray(part.s);local.updateMatrix();part.mesh.setMatrixAt(i,matrix.multiplyMatrices(root.matrix,local.matrix));}let j=0;for(const z of [-1.35,1.35])for(const side of [-1,1]){local.position.set(side*.93,.34,z);local.rotation.set(t.distance/.34,0,0);local.scale.set(1,1,1);local.updateMatrix();tires.setMatrixAt(i*4+j,matrix.multiplyMatrices(root.matrix,local.matrix));local.position.x=side*1.065;local.scale.set(.13,.68,.68);local.updateMatrix();rims.setMatrixAt(i*4+j,matrix.multiplyMatrices(root.matrix,local.matrix));j++;}});for(const p of parts)p.mesh.instanceMatrix.needsUpdate=true;tires.instanceMatrix.needsUpdate=rims.instanceMatrix.needsUpdate=true;};W.renderTraffic();
 };
})();
