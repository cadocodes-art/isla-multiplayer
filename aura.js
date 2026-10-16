'use strict';
(()=>{
 const W=Isla;
 W.auraMessages=Object.freeze([
  'You almost have as much aura as this game.',
  'Gravity just lost an argument.',
  'Physics would like a word.',
  'That should not have worked.',
  'The island is still processing that one.'
 ]);
 W.createAuraTracker=()=>({
  total:0,bestChain:0,chainPoints:0,chainCount:0,multiplier:1,remaining:0,window:5,
  flight:null,skim:null,previous:null,notice:null,messageIndex:0,lastResult:'FIND YOUR NEXT STUNT',
  interrupt(reason='CHAIN ENDED'){
   if(this.chainCount)this.lastResult=reason;
   this.flight=this.skim=this.previous=null;
   this.chainCount=this.chainPoints=this.remaining=0;this.multiplier=1;
  },
  update(c,dt){
   if(this.notice){this.notice.remaining=Math.max(0,this.notice.remaining-dt);if(!this.notice.remaining)this.notice=null;}
   const previous=this.previous,events=[],speed=Math.hypot(c.vx,c.vz);
   const distance=previous?Math.hypot(c.x-previous.x,c.z-previous.z):0;
   const air=c.waterMode==='dry'&&!c.grounded&&!c.ramp;
   // Ignore a reset/teleport, even if a tool or future game feature moves the car directly.
   if(previous&&distance>Math.max(4,speed*dt*3+1)){this.interrupt('RECOVERED');this.previous=this.snapshot(c);return;}
   const award=(label,base,detail)=>{
    this.chainCount++;this.multiplier=Math.min(5,this.chainCount);
    const points=Math.round(base*this.multiplier);
    this.total+=points;this.chainPoints+=points;this.bestChain=Math.max(this.bestChain,this.chainPoints);W.onAuraEarn?.(points,this.bestChain);
    this.remaining=this.window;this.lastResult=label;
    events.push({label,points,detail});
   };
   let jumpToWater=false;
   if(air){
    if(!this.flight&&previous&&previous.waterMode==='dry'&&previous.grounded){this.flight={seconds:0,distance:0,height:0};}
    if(this.flight){this.flight.seconds+=dt;this.flight.distance+=distance;this.flight.height=Math.max(this.flight.height,c.y-Math.max(0,W.driveHeight(c.x,c.z)));}
   }else if(this.flight){
    const f=this.flight,landed=c.grounded&&c.waterMode==='dry'||c.waterMode==='skimming';
    if(landed&&f.seconds>=.45&&f.distance>=6&&f.height>=.7){
     award('JUMP',100+f.seconds*120+f.distance*4+f.height*10,f.seconds.toFixed(1)+'s airtime · '+Math.round(f.distance)+' m');
     jumpToWater=c.waterMode==='skimming';
    }
    this.flight=null;
   }
   if(c.waterMode==='skimming'){
    if(!this.skim)this.skim={seconds:0,distance:0,fromJump:jumpToWater};
    this.skim.seconds+=dt;this.skim.distance+=distance;
   }else if(this.skim){
    const s=this.skim;
    if(s.seconds>=.5&&s.distance>=10){
     award('WATER SKIM',150+s.seconds*100+s.distance*5,s.seconds.toFixed(1)+'s on water · '+Math.round(s.distance)+' m');
     if(c.waterMode==='dry'&&s.fromJump)award('COAST COMEBACK',500,'Air → sea → land');
    }
    this.skim=null;
   }
   if(events.length){
    this.notice={points:events.reduce((n,e)=>n+e.points,0),label:events.map(e=>e.label).join(' + '),
     detail:events.map(e=>e.detail).join(' · '),multiplier:this.multiplier,
     message:W.auraMessages[this.messageIndex++%W.auraMessages.length],remaining:4.5};
   }
   if(c.waterMode==='sinking'){this.interrupt('CHAIN ENDED · SANK');}
   // A stunt begun within the chain window keeps the chain alive through its flight or skim.
   else if(this.chainCount&&!this.flight&&!this.skim&&!events.length){
    this.remaining=Math.max(0,this.remaining-dt);
    if(!this.remaining){this.lastResult='CHAIN COMPLETE';this.chainCount=this.chainPoints=0;this.multiplier=1;}
   }
   this.previous=this.snapshot(c);
  },
  snapshot:c=>({x:c.x,z:c.z,grounded:c.grounded||!!c.ramp,waterMode:c.waterMode})
 });
})();
