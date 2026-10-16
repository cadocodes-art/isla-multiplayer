'use strict';
(() => {
 const W=Isla,{clamp,mix}=W;
 W.waterSkim={minimumSpeed:140/3.6,duration:3.5,sinkDuration:1.4,level:.10};
 W.nitro={minDuration:5,maxDuration:7,maxSpeed:53,thrust:8,gravityScale:.48,rechargeDuration:8};
 W.vehicle={x:0,y:0,z:700,vx:0,vy:0,vz:0,yaw:Math.PI/2,yawRate:0,steer:0,pitch:0,roll:0,speed:0,grounded:true,ramp:null,airtime:0,distance:0,rpm:850,gear:0,throttle:0,brake:0,slip:0,contact:1,surface:'ASPHALT',lastSafe:{x:0,z:700,yaw:Math.PI/2},waterMode:'dry',skimTime:0,waterTime:0,nitroTime:0,nitroDuration:0,nitroHeld:false,nitroCharge:1};
 W.resetVehicle=(atStart=false)=>{W.aura?.interrupt('RECOVERED');let c=W.vehicle,p=atStart?{x:0,z:700,yaw:Math.PI/2+.14}:c.lastSafe;Object.assign(c,{x:p.x,z:p.z,y:W.driveHeight(p.x,p.z)+.12,vx:0,vy:0,vz:0,yaw:p.yaw,yawRate:0,steer:0,pitch:0,roll:0,speed:0,grounded:true,ramp:null,airtime:0,waterMode:'dry',skimTime:0,waterTime:0,nitroTime:0,nitroDuration:0,nitroHeld:false,nitroCharge:atStart?1:c.nitroCharge});};
 W.damageForImpact=speed=>speed<15?0:Math.min(44,(speed*speed-225)*.043);
 // Damage uses approach speed into the wall, so scraping and pushing cannot grind through a building.
 W.hitBuilding=(b,normalSpeed,time)=>{if(b.collapsed||time-b.lastHit<.7)return 0;b.lastHit=time;if(W.net?.active){W.net.hit(b,normalSpeed);return 0;}let damage=W.damageForImpact(normalSpeed);b.hp=Math.max(0,b.hp-damage);if(damage>0){if(W.onBuildingDamage)W.onBuildingDamage(b,damage,normalSpeed);if(b.hp<=0){b.collapsed=true;if(W.onCollapse)W.onCollapse(b)}}if(W.onBuildingContact)W.onBuildingContact(b,damage,normalSpeed);return damage;};
 // Contact of a circular chassis proxy with a rotated building footprint.
 W.circleOBB=(x,z,r,b)=>{let co=Math.cos(b.yaw),si=Math.sin(b.yaw),dx=x-b.x,dz=z-b.z,lx=dx*co-dz*si,lz=dx*si+dz*co,hx=b.w*.5+.12,hz=b.d*.5+.12,qx=clamp(lx,-hx,hx),qz=clamp(lz,-hz,hz),ex=lx-qx,ez=lz-qz,dist=Math.hypot(ex,ez);if(dist>=r)return null;let nx,nz,depth;if(dist>.0001){nx=ex/dist;nz=ez/dist;depth=r-dist;}else{let px=hx-Math.abs(lx),pz=hz-Math.abs(lz);if(px<pz){nx=lx>=0?1:-1;nz=0;depth=r+px}else{nx=0;nz=lz>=0?1:-1;depth=r+pz}}return {nx:nx*co+nz*si,nz:-nx*si+nz*co,depth};};
 // Broad phase: nearby objects only. Both axles collide, rather than just the car's centre.
 const bins=new Map(),cs=45;
 W.buildCollisionIndex=()=>{bins.clear();for(let b of W.colliders){let radius=b.r||Math.hypot(b.w,b.d)*.5+3;for(let x=Math.floor((b.x-radius)/cs);x<=Math.floor((b.x+radius)/cs);x++)for(let z=Math.floor((b.z-radius)/cs);z<=Math.floor((b.z+radius)/cs);z++){let key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(b)}}};
 function collide(c,time){let list=bins.get(Math.floor(c.x/cs)+','+Math.floor(c.z/cs));if(!list)return;let sx=Math.sin(c.yaw),sz=Math.cos(c.yaw);for(let b of list){if(b.collapsed)continue;if(c.y>(b.y+(b.h||6)+.7)||c.y+1.6<b.y)continue;for(let off of [1.22,-1.22]){let x=c.x+sx*off,z=c.z+sz*off,hit;if(b.kind==='ramp'&&(c.ramp===b||c.y>=W.rampHeight(b,x,z)-.4))continue;if(b.kind&&!b.w){let dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz),r=b.r+.96;if(d>=r)continue;hit={nx:dx/(d||1),nz:dz/(d||1),depth:r-d};}else hit=W.circleOBB(x,z,.96,b);if(!hit)continue;let approach=-(c.vx*hit.nx+c.vz*hit.nz);c.x+=hit.nx*hit.depth;c.z+=hit.nz*hit.depth;if(approach>0){c.vx+=hit.nx*approach*1.14;c.vz+=hit.nz*approach*1.14;c.yawRate+=(sx*hit.nz-sz*hit.nx)*off*approach*.018;c.vy+=Math.min(1.8,approach*.035);if(!b.kind)W.hitBuilding(b,approach,time);if(approach>2&&W.onImpact)W.onImpact(x,c.y+.7,z,approach,b);}}}}
 W.stepVehicle=(dt,input,time)=>{let c=W.vehicle,sx=Math.sin(c.yaw),sz=Math.cos(c.yaw),rx=sz,rz=-sx,forward=c.vx*sx+c.vz*sz,lateral=c.vx*rx+c.vz*rz,absSpeed=Math.abs(forward),near=W.nearestRoad(c.x,c.z),road=near.p&&near.d<near.p.width*.5+.2,h=W.driveHeight(c.x,c.z,c.y<(W.bridgeSurface?.(c.x,c.z)??-Infinity)-.6),sand=h<9&&!road,grip=road?1.05:sand?.61:.74;
  const surfaceHeight=(x,z)=>W.driveHeight(x,z,c.y<(W.bridgeSurface?.(x,z)??-Infinity)-.6),onBridge=W.bridgeSurface?.(c.x,c.z)!=null&&c.y>=W.bridge.deckY-.6;
  const spec=W.getCarSpec?.(),engine=spec?.engine??1;grip*=road?(spec?.grip??1):(spec?.offroad??1);
  let ramp=W.rampAt?.(c.x,c.z)||null;
  if(ramp&&c.ramp!==ramp){const g=W.rampGradient(ramp,c.x,c.z),gap=c.y-W.rampHeight(ramp,c.x,c.z)-.12;if(gap<-.4||gap>.45||c.vy>g.x*c.vx+g.z*c.vz+2)ramp=null;}
  c.ramp=ramp;if(ramp)grip=1.05*(spec?.grip??1);
  // A full tank and a fresh Shift press start a burst. Release stops it and refills the spent charge.
  if(!input.boost)c.nitroTime=0;
  if(input.boost&&!c.nitroHeld&&c.nitroTime<=0&&c.nitroCharge===1&&c.waterMode!=='sinking'&&forward>=-.6){c.nitroDuration=W.nitro.minDuration+Math.random()*(W.nitro.maxDuration-W.nitro.minDuration);c.nitroTime=c.nitroDuration;if(W.onNitroStart)W.onNitroStart(c.nitroDuration);}
  c.nitroHeld=!!input.boost;
  c.surface=ramp?'RAMP':road?'ASPHALT':sand?'BEACH':'OFF ROAD';c.speed=forward;c.slip=Math.abs(lateral);c.throttle=input.gas?1:0;c.brake=input.brake&&forward>.5?1:0;
  let maxSteer=.56/(1+absSpeed*.027),targetSteer=input.steer*maxSteer;c.steer=mix(c.steer,targetSteer,1-Math.exp(-dt*(input.steer?5.5:7)));let steer=c.steer;
  const overWater=W.height(c.x,c.z)<-.5&&!onBridge,skim=W.waterSkim;
  if(!overWater){c.waterMode='dry';c.skimTime=0;c.waterTime=0;}
  // A jump over the ocean does not use up the skim: start on actual water contact.
  else if(c.waterMode==='dry'&&c.y<=.25&&c.vy<=.5){
   c.waterMode=Math.hypot(c.vx,c.vz)>skim.minimumSpeed?'skimming':'sinking';c.skimTime=0;c.waterTime=0;c.airtime=0;
   if(c.waterMode==='skimming'){c.y=skim.level;c.vy=0;if(W.onWaterSkim)W.onWaterSkim();}
  }
  if(c.waterMode==='sinking')c.nitroTime=0;
  const boosting=c.nitroTime>0,thrust=boosting&&!input.brake&&!input.handbrake?(spec?.thrust??W.nitro.thrust)*clamp(((spec?.boostMax??W.nitro.maxSpeed)-Math.max(0,forward))/7,0,1):0;
  if(boosting)c.throttle=1;
  let hFront=surfaceHeight(c.x+sx*1.42,c.z+sz*1.42),hRear=surfaceHeight(c.x-sx*1.43,c.z-sz*1.43),hLeft=surfaceHeight(c.x-rx*.94,c.z-rz*.94),hRight=surfaceHeight(c.x+rx*.94,c.z+rz*.94),groundY=(hFront+hRear+hLeft+hRight)*.25+.12+(boosting?.08:0),groundDelta=groundY-c.y;
  if(ramp){groundY=W.rampHeight(ramp,c.x,c.z)+.12+(boosting?.08:0);groundDelta=groundY-c.y;}
  c.grounded=!!ramp||(groundDelta>-.24&&c.vy<3.8);
  let ax=0,az=0,acc=0;
  if(c.waterMode==='skimming'){
   // Momentum carries the car; throttle cannot extend or restart this one-shot timer.
   c.grounded=false;c.contact=0;c.surface='WATER SKIM';c.airtime=0;
   const drag=.10+(input.brake||input.handbrake?.35:0);
   ax=-c.vx*drag-rx*lateral*.22+sx*thrust*.65;az=-c.vz*drag-rz*lateral*.22+sz*thrust*.65;
   c.yawRate=mix(c.yawRate,clamp(forward/2.85*Math.tan(steer)*.10,-.28,.28),1-Math.exp(-dt*3));
   c.y=skim.level+Math.sin(time*18)*.018;c.vy=0;
   c.pitch=mix(c.pitch,.035,1-Math.exp(-dt*8));c.roll=mix(c.roll,-c.yawRate*.12,1-Math.exp(-dt*5));
   c.skimTime=Math.min(skim.duration,c.skimTime+dt);
  }else if(c.waterMode==='sinking'){
   c.grounded=false;c.contact=0;c.surface='SINKING';c.airtime=0;
   ax=-c.vx*1.8;az=-c.vz*1.8;c.vy=Math.max(-3.2,c.vy-3*dt);c.yawRate*=Math.exp(-dt*2);
   c.pitch=mix(c.pitch,-.16,1-Math.exp(-dt*2));c.roll=mix(c.roll,.045,1-Math.exp(-dt*2));c.waterTime+=dt;
  }else if(c.grounded){
   if(boosting&&input.brake){acc=forward>.6?-11.8:-4.2;}else if(input.gas||boosting){acc=forward<-.6?10:Math.min(7.6*engine,220*engine/(absSpeed+12));}else if(input.brake){acc=forward>.6?-11.8:-4.2;}else acc=-Math.sign(forward)*(.20+absSpeed*.016);
   acc+=thrust;
   if(forward>Math.max(66,spec?.boostMax??66)&&acc>0)acc=0;if(forward<-13&&acc<0)acc=0;
   acc-=forward*Math.abs(forward)*.0016+Math.sign(forward)*(road?.14:sand?.85:.43);
   if(input.handbrake)acc-=Math.sign(forward)*5.1;
   let available=grip*9.81;acc=clamp(acc,-available*1.18,available+(boosting?4:0));
   let lateralAccel=clamp(-lateral*(input.handbrake?1.5:7.5),-available*(input.handbrake?.46:1),available*(input.handbrake?.46:1));
   let slope=onBridge?{x:0,z:0}:ramp?W.rampGradient(ramp,c.x,c.z):W.approachSurface?.(c.x,c.z)!=null?{x:(surfaceHeight(c.x+1,c.z)-surfaceHeight(c.x-1,c.z))*.5,z:(surfaceHeight(c.x,c.z+1)-surfaceHeight(c.x,c.z-1))*.5}:W.slope(c.x,c.z);ax=sx*acc+rx*lateralAccel-9.81*slope.x;az=sz*acc+rz*lateralAccel-9.81*slope.z;
   let targetYaw=forward/2.85*Math.tan(steer)*(input.handbrake?1.23:1);let limit=available/Math.max(absSpeed,4);targetYaw=clamp(targetYaw,-limit*(input.handbrake?1.7:1),limit*(input.handbrake?1.7:1));
   c.yawRate=mix(c.yawRate,targetYaw,1-Math.exp(-dt*(input.handbrake?3.6:7.5)));
   if(absSpeed<.08&&!input.gas&&!input.brake&&Math.hypot(slope.x,slope.z)<.045){c.vx*=.92;c.vz*=.92;c.yawRate*=.9;}
   // A damped vertical spring follows the ground; a crest can release the chassis.
   if(ramp){c.y=groundY;c.vy=slope.x*c.vx+slope.z*c.vz;c.contact=1;}else{let spring=groundDelta*(boosting?110:170)-c.vy*(boosting?11:18);c.vy+=spring*dt;c.contact=clamp(1+spring/35,0,1.5);
   if(groundDelta>.38){c.y=groundY-.15;c.vy=Math.max(c.vy,0);}}
   let desiredPitch=(ramp?Math.atan(slope.x*sx+slope.z*sz):Math.atan2(hFront-hRear,2.85))+acc*.006,desiredRoll=Math.atan2(hRight-hLeft,1.88)-c.yawRate*forward*.007;
   c.pitch=mix(c.pitch,desiredPitch,1-Math.exp(-dt*8));c.roll=mix(c.roll,desiredRoll,1-Math.exp(-dt*7));
   if(c.airtime>.27&&W.onLanding)W.onLanding(c.airtime,c.vy);c.airtime=0;
  }else{c.vy-=9.81*(boosting?W.nitro.gravityScale:1)*dt;ax+=sx*thrust*.5;az+=sz*thrust*.5;c.yawRate*=Math.exp(-dt*(boosting?.45:.7));c.airtime+=dt;c.contact=0;c.pitch-=dt*(boosting?.015:.05);}
  c.vx+=ax*dt;c.vz+=az*dt;c.x+=c.vx*dt;c.z+=c.vz*dt;c.y+=c.vy*dt;c.yaw+=c.yawRate*dt;
  if(ramp){if(W.rampAt(c.x,c.z)===ramp){const g=W.rampGradient(ramp,c.x,c.z);c.y=W.rampHeight(ramp,c.x,c.z)+.12+(boosting?.08:0);c.vy=g.x*c.vx+g.z*c.vz;}else{c.ramp=null;c.grounded=false;c.contact=0;c.airtime=dt;}}
  // Reaching shore ends the skim safely; submerged ground must not lift a sinking car.
  if(W.height(c.x,c.z)>=-.5||(W.bridgeSurface?.(c.x,c.z)!=null&&c.y>=W.bridge.deckY-.6)){c.waterMode='dry';c.skimTime=0;c.waterTime=0;}
  let floor=surfaceHeight(c.x,c.z)+.10;if(c.waterMode==='dry'&&c.y<floor-.15){if(c.vy<-3&&W.onLanding)W.onLanding(.35,c.vy);c.y=floor-.06;c.vy=Math.max(0,-c.vy*.12);}
  collide(c,time);for(let d of W.debris){let p=d.mesh.position,dx=p.x-c.x,dz=p.z-c.z;if(Math.abs(dx)>5||Math.abs(dz)>5||Math.abs(c.y-p.y)>2)continue;let along=dx*sx+dz*sz,across=dx*rx+dz*rz;if(Math.abs(along)<2.4+d.mesh.scale.z*.3&&Math.abs(across)<1+d.mesh.scale.x*.3&&Math.hypot(c.vx,c.vz)>1.5){d.vx=c.vx*.65;d.vz=c.vz*.65;d.vy=1.1;d.rest=false;d.age=0;c.vx*=1-dt*.7;c.vz*=1-dt*.7;}}c.distance+=Math.hypot(c.vx,c.vz)*dt;
  if(road&&Math.abs(forward)>2&&Math.abs(lateral)<3){let next=near.p.road.samples[Math.min(near.p.index+1,near.p.road.samples.length-1)],prev=near.p.road.samples[Math.max(0,near.p.index-1)],angle=Math.atan2(next.x-prev.x,next.z-prev.z);if(Math.cos(angle-c.yaw)<0)angle+=Math.PI;c.lastSafe={x:near.p.x,z:near.p.z,yaw:angle};}
  if(c.waterMode==='skimming'&&c.skimTime>=skim.duration-1e-9){c.waterMode='sinking';c.vy=-.55;c.waterTime=0;c.nitroTime=0;if(W.onWaterSink)W.onWaterSink();}
  if(c.waterMode==='sinking'&&c.waterTime>=skim.sinkDuration){W.resetVehicle();if(W.onRecover)W.onRecover('Too deep. Back on dry land.');return;}
  let speed=Math.abs(forward);c.gear=forward<-.7?-1:speed<.3?0:speed<13?1:speed<23?2:speed<34?3:speed<46?4:5;let ratios=[0,3.4,2.1,1.5,1.15,.92];let rev=c.gear<=0?850+input.gas*700:Math.max(900,speed*ratios[c.gear]*105);c.rpm=mix(c.rpm,clamp(rev+input.gas*250,850,7200),1-Math.exp(-dt*10));
  if(boosting){c.nitroTime=Math.max(0,c.nitroTime-dt);c.nitroCharge=clamp(c.nitroCharge-dt/c.nitroDuration,0,1);if(c.nitroTime<1e-9)c.nitroTime=0;if(c.nitroCharge<1e-9)c.nitroCharge=0;}
  else{c.nitroCharge=Math.min(1,c.nitroCharge+dt/W.nitro.rechargeDuration);if(c.nitroCharge>1-1e-9)c.nitroCharge=1;}
 };
})();
