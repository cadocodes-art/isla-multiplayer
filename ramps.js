'use strict';
(()=>{
 const W=Isla,T=THREE;
 W.ramps=[];
 W.rampLocal=(r,x,z)=>{const dx=x-r.x,dz=z-r.z;return {across:dx*r.co-dz*r.si,along:dx*r.si+dz*r.co+r.d/2};};
 W.rampPoint=(r,across,along)=>({x:r.x+r.co*across+r.si*(along-r.d/2),z:r.z-r.si*across+r.co*(along-r.d/2)});
 W.rampAt=(x,z)=>W.ramps.find(r=>{const p=W.rampLocal(r,x,z);return Math.abs(p.across)<=r.w/2&&p.along>=0&&p.along<=r.d;})||null;
 W.rampHeight=(r,x,z)=>{const t=W.clamp(W.rampLocal(r,x,z).along/r.d,0,1);return W.height(x,z)+.04+r.rise*t*t;};
 W.rampGradient=(r,x,z)=>{const g=W.slope(x,z),t=W.clamp(W.rampLocal(r,x,z).along/r.d,0,1),grade=2*r.rise*t/r.d;return {x:g.x+r.si*grade,z:g.z+r.co*grade};};
 // Reserve the deck, a 40 m run-up, and 65 m landing corridor for every ramp.
 W.inRampClearing=(x,z)=>W.ramps.some(r=>{const p=W.rampLocal(r,x,z);return Math.abs(p.across)<r.w/2+7&&p.along>-40&&p.along<r.d+65;});
 W.planRamps=()=>{
  if(W.ramps.length)return W.ramps;
  const sites=[[-45,753,1.7],[320,720,1.5],[590,430,2.5],[750,90,3.1],[695,-255,3.5],[480,-600,4.2],[180,-745,4.7],[-160,-755,4.7],[-505,-580,5.4],[-770,-230,.2],[-750,180,.5],[-440,400,1.3],[-285,40,2.4],[330,100,3.4],[50,-390,4.8]];
  function valid(r){
   if(W.ramps.some(p=>Math.hypot(p.x-r.x,p.z-r.z)<150))return false;
   for(let s=0;s<=r.d;s+=r.d/8)for(let u of [-r.w/2,0,r.w/2]){const p=W.rampPoint(r,u,s),h=W.height(p.x,p.z),g=W.slope(p.x,p.z),n=W.nearestRoad(p.x,p.z,2);if(h<3||Math.hypot(g.x,g.z)>.24||n.p&&n.d<n.p.width/2+5)return false;}
   for(let s=-40;s<=r.d+65;s+=7)for(let u of [-r.w/2-4,0,r.w/2+4]){const p=W.rampPoint(r,u,s),g=W.slope(p.x,p.z);if(W.height(p.x,p.z)<2||Math.hypot(g.x,g.z)>.45)return false;if(W.buildings.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(b.w,b.d)/2+7))return false;}
   return true;
  }
  for(let i=0;i<sites.length;i++){
   const [ax,az,yaw]=sites[i];let chosen;
   search:for(let radius=0;radius<=240;radius+=20)for(let k=0;k<(radius?16:1);k++)for(let turn of [0,.45,-.45,.9,-.9,Math.PI]){
    const angle=k*Math.PI/8,r={id:i+1,kind:'ramp',x:ax+Math.sin(angle)*radius,z:az+Math.cos(angle)*radius,yaw:yaw+turn,w:8.5+(i%3)*.5,d:22+(i%3)*2,rise:4.8+(i%4)*.55};r.co=Math.cos(r.yaw);r.si=Math.sin(r.yaw);r.y=W.height(r.x,r.z)-1;r.h=r.rise+8;
    if(valid(r)){chosen=r;break search;}
   }
   if(!chosen)throw Error('Could not place off-road ramp '+(i+1));
   W.ramps.push(chosen);
  }
  return W.ramps;
 };
 W.makeRamps=scene=>{
  W.planRamps();
  const deck=W.mat('#475257',.78,.35),side=W.mat('#343c3c',.88,.2),orange=W.mat('#ef9c39',.7,.15),white=W.mat('#eee9d2'),pole=W.mat('#8b9692',.5,.65);
  function mesh(parent,positions,indices,material){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,material);m.receiveShadow=m.castShadow=true;parent.add(m);return m;}
  for(const r of W.ramps){
   const group=new T.Group();group.name='Off-road ramp '+r.id;scene.add(group);r.group=group;
   function v(u,s,lift=0){const p=W.rampPoint(r,u,s);return [p.x,W.rampHeight(r,p.x,p.z)+lift,p.z];}
   function ribbon(u0,u1,s0,s1,material,lift=.025){mesh(group,[...v(u0,s0,lift),...v(u1,s0,lift),...v(u0,s1,lift),...v(u1,s1,lift)],[0,2,1,1,2,3],material);}
   for(let j=0;j<26;j++){const s0=r.d*j/26,s1=r.d*(j+1)/26;ribbon(-r.w/2,r.w/2,s0,s1,deck,0);
    for(const sign of [-1,1]){const u=sign*r.w/2,a=v(u,s0),b=v(u,s1),a0=[a[0],W.height(a[0],a[2])-.12,a[2]],b0=[b[0],W.height(b[0],b[2])-.12,b[2]];mesh(group,[...a,...b,...a0,...b0],sign===1?[0,1,2,1,3,2]:[0,2,1,1,2,3],side);ribbon(sign>0?r.w/2-.35:-r.w/2,sign>0?r.w/2:-r.w/2+.35,s0,s1,j%4<2?orange:side);}
   }
   const a=v(-r.w/2,r.d),b=v(r.w/2,r.d);mesh(group,[...a,...b,a[0],W.height(a[0],a[2])-.12,a[2],b[0],W.height(b[0],b[2])-.12,b[2]],[0,1,2,1,3,2],side);
   // Broad white chevrons point toward the launch edge.
   for(let s of [5,10,15,20])if(s<r.d-2)for(const sign of [-1,1])mesh(group,[...v(0,s+1.8,.05),...v(sign*2,s,.05),...v(sign*2,s-.35,.05),...v(0,s+1.45,.05)],sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],white);
   for(const sign of [-1,1]){const p=W.rampPoint(r,sign*(r.w/2+1),1),y=W.height(p.x,p.z);W.box(group,p.x,y+2.3,p.z,.09,4.6,.09,pole);const flag=new T.Mesh(new T.PlaneGeometry(.8,1.8),new T.MeshStandardMaterial({color:0xf1a23f,roughness:.8,side:T.DoubleSide}));flag.position.set(p.x,y+3.65,p.z);flag.rotation.y=r.yaw;group.add(flag);}
   W.colliders.push(r);
  }
 };
})();
