'use strict';
(() => {
 const W=Isla,T=THREE,$=id=>document.getElementById(id);
 const safeRead=(storage,key)=>{try{return storage.getItem(key)}catch{return null}};
 const safeWrite=(storage,key,value)=>{try{if(value===null)storage.removeItem(key);else storage.setItem(key,value)}catch{}};
 let local,session;try{local=localStorage;session=sessionStorage}catch{}
 const net=W.net={active:false,connected:false,code:'',id:'',host:'',players:[],remotes:new Map(),latency:0};
 let socket=null,identity=null,intent=null,connecting=false,leaving=false,retry=null,connectTimeout=null,attempt=0,lastSend=0,lastPing=0,lastAura=0,pendingAura=0,scoreSeq=0,trafficTargets=null,ui=null,open=false;
 const send=data=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));};
 function status(message,error=false){$('roomStatus').textContent=message;$('roomStatus').classList.toggle('error',error);}
 function saveIdentity(){safeWrite(session,'isla-room-v1',identity?JSON.stringify(identity):null);}
 function pose(){const c=W.vehicle,parked=ui.paused()||document.hidden;return {x:c.x,y:c.y,z:c.z,yaw:c.yaw,vx:parked?0:c.vx,vy:parked?0:c.vy,vz:parked?0:c.vz,pitch:c.pitch,roll:c.roll,steer:c.steer,speed:parked?0:c.speed,car:W.garage.selected,nitro:!parked&&c.nitroTime>0,grounded:c.grounded,water:c.waterMode,brake:!!c.brake,parked};}
 function applySpawn(state){W.resetVehicle(true);Object.assign(W.vehicle,{x:state.x,y:state.y,z:state.z,yaw:state.yaw,lastSafe:{x:state.x,z:state.z,yaw:state.yaw}});}
 function drawRoster(){
  $('roomLobby').classList.toggle('hidden',!net.active);$('roomEntry').classList.toggle('hidden',net.active);
  $('roomCreate').disabled=$('roomJoin').disabled=connecting;
  $('roomCode').textContent=net.code||'------';$('roomCount').textContent=net.players.filter(p=>p.connected).length+' / 4 DRIVERS';
  $('roomBtn').textContent=net.active?(net.connected?'● '+net.code:'↻ RECONNECTING'):'FRIENDS';
  $('roomBtn').classList.toggle('in-room',net.active);
  $('roomHostHint').textContent=net.host===net.id?'You are the host. Rebuild islands in the pause menu.':'The host can rebuild the islands for everyone.';
  const list=$('roomPlayers');list.replaceChildren();
  const sorted=[...net.players].sort((a,b)=>b.score-a.score);
  for(let i=0;i<4;i++){const p=sorted[i],row=document.createElement('div');row.className='room-player'+(!p?' empty':'');
   const rank=document.createElement('span');rank.className='room-rank';rank.textContent=String(i+1).padStart(2,'0');
   const name=document.createElement('span');name.className='room-driver';name.textContent=p?p.name+(p.id===net.id?' (you)':''):'Waiting for a friend';
   if(p){const sub=document.createElement('small');sub.textContent=!p.connected?'RECONNECTING · SPOT RESERVED':p.host?'ROOM HOST':'ON THE ISLANDS';name.append(sub);}
   const score=document.createElement('strong');score.textContent=p?p.score.toLocaleString('en-US'):'—';row.append(rank,name,score);list.append(row);
  }
 }
 function openRoom(){open=true;$('garage').classList.add('hidden');if(ui.started())ui.pause(true);$('pause').classList.add('hidden');$('rooms').classList.remove('hidden');drawRoster();
  if(location.protocol==='file:')status('Private rooms need the hosted edition. This downloaded game still works solo.');
  else if(!net.active&&!connecting)status('Create a room, then share its code or invite link.');
  $('rooms').scrollTop=0;document.querySelector('.room-panel').scrollTop=0;(net.active?$('roomClose'):$('driverName')).focus({preventScroll:true});
 }
 function closeRoom(){open=false;$('rooms').classList.add('hidden');if(ui.started())ui.pause(false);else $('startBtn').focus();}
 net.closePanel=()=>{if(!open)return false;closeRoom();return true;};
 net.panelOpen=()=>open;
 function disposeRemote(remote){W.scene.remove(remote.mesh.root);const geometries=new Set(),materials=new Set(),textures=new Set();remote.mesh.root.traverse(o=>{if(o.geometry&&o.geometry!==W.unitBox&&!o.isSprite)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 function clearRemotes(){for(const r of net.remotes.values())disposeRemote(r);net.remotes.clear();}
 function nameTag(name){const texture=W.textureCanvas(512,(c,s)=>{c.fillStyle='#10272be8';c.fillRect(0,160,s,110);c.strokeStyle='#b8edcb';c.lineWidth=4;c.strokeRect(2,162,s-4,106);c.fillStyle='#effff2';c.font='600 34px Arial';c.textAlign='center';c.fillText(name,256,228,480);});const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.set(0,3.2,0);sprite.scale.set(5,5,1);return sprite;}
 function remoteFor(p){let remote=net.remotes.get(p.id);if(remote&&remote.car!==p.state.car){disposeRemote(remote);net.remotes.delete(p.id);remote=null;}
  if(!remote){const model=W.carModels.find(m=>m.id===p.state.car)||W.carModels[0],mesh=W.makeCar(model,true);mesh.root.add(nameTag(p.name));remote={mesh,car:p.state.car,current:{...p.state},target:{...p.state},at:performance.now(),connected:p.connected};net.remotes.set(p.id,remote);}
  remote.target={...p.state};remote.at=performance.now();remote.connected=p.connected;return remote;
 }
 function disconnectToSolo(message){clearTimeout(retry);clearTimeout(connectTimeout);leaving=true;const old=socket;socket=null;old?.close();identity=null;saveIdentity();intent=null;connecting=false;net.active=net.connected=false;net.code='';net.id='';net.players=[];pendingAura=0;trafficTargets=null;clearRemotes();ui.restore();W.initTraffic();W.resetVehicle(true);drawRoster();status(message);}
 net.leave=()=>{send({type:'leave'});disconnectToSolo('You left the room. Your aura and cars are still saved.');closeRoom();ui.toast('Back to solo driving.');};
 function connect(){
  clearTimeout(retry);clearTimeout(connectTimeout);
  if(location.protocol==='file:'){status('Open the hosted edition to create or join a room.',true);return;}
  if(!['http:','https:'].includes(location.protocol))return;
  leaving=false;connecting=true;drawRoster();
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');socket=ws;
  status(identity?'Reconnecting to '+identity.code+'…':'Connecting… The server may take a minute to wake up.');
  connectTimeout=setTimeout(()=>{if(socket===ws&&!net.connected){status('The server is taking a while. Retrying…');ws.close();}},70000);
  ws.onopen=()=>{if(socket!==ws)return;send(identity?{type:'resume',v:1,name:identity.name,code:identity.code,token:identity.token}:intent);};
  ws.onmessage=e=>{if(socket!==ws)return;let data;try{data=JSON.parse(e.data)}catch{return;}
   if(data.type==='welcome'){
    const expected=W.buildings.map(b=>[b.id,Math.round(b.x*100),Math.round(b.z*100)]);
    if(JSON.stringify(expected)!==JSON.stringify(data.buildings)){disconnectToSolo('This game version differs from the server. Refresh before joining.');openRoom();status('This game version differs from the server. Refresh before joining.',true);return;}
    clearTimeout(connectTimeout);attempt=0;connecting=false;net.active=net.connected=true;net.code=data.code;net.id=data.id;net.host=data.host;net.players=data.players;scoreSeq=data.scoreSeq;pendingAura=0;
    identity={code:data.code,token:data.token,name:intent?.name||identity?.name||$('driverName').value};saveIdentity();
    ui.restore();ui.buildings(data.hp);applySpawn(data.state);drawRoster();ui.start();closeRoom();status('Connected. Send the code to your friends.');ui.toast(data.resumed?'Back in room '+data.code:'ROOM '+data.code+' · invite up to 3 friends',5);
   }else if(data.type==='error'){
    const message=data.message;
    if(data.expired){disconnectToSolo(message);openRoom();status(message,true);}
    else{connecting=false;drawRoster();status(message,true);if(!net.active){leaving=true;clearTimeout(connectTimeout);ws.close();}}
   }else if(data.type==='roster'){
    net.players=data.players;net.host=data.host;drawRoster();
    const ids=new Set(data.players.map(p=>p.id));for(const [id,r] of net.remotes)if(!ids.has(id)){disposeRemote(r);net.remotes.delete(id);}
   }else if(data.type==='frame'&&net.active){
    for(const p of data.players)if(p.id!==net.id)remoteFor(p);
    trafficTargets=data.traffic;
   }else if(data.type==='building'&&net.active){ui.building(data.id,data.hp,data.speed);}
   else if(data.type==='reset'&&net.active){ui.restore();const me=data.players.find(p=>p.id===net.id);if(me)applySpawn(me.state);trafficTargets=null;ui.toast('The host rebuilt both islands.');}
   else if(data.type==='pong'){net.latency=Math.max(0,Date.now()-data.at);$('roomLatency').textContent=net.latency+' ms';}
  };
  ws.onerror=()=>{};
  ws.onclose=()=>{if(socket!==ws||leaving)return;clearTimeout(connectTimeout);net.connected=false;connecting=false;
   if(net.active){ui.pause(true);status('Connection lost. Your spot is reserved for 90 seconds. Reconnecting…',true);drawRoster();retry=setTimeout(connect,Math.min(8000,1000*2**Math.min(attempt++,3)));}
   else{drawRoster();status('Could not connect. Check your internet and try again; the server may still be waking up.',true);}
  };
 }
 function requestRoom(type){const name=$('driverName').value.trim();if(!name){status('Give yourself a driver name first.',true);$('driverName').focus();return;}const code=$('joinCode').value.trim().toUpperCase();if(type==='join'&&!/^[A-Z2-9]{6}$/.test(code)){status('Enter the six-character room code.',true);$('joinCode').focus();return;}
  safeWrite(local,'isla-driver-name',name);identity=null;intent={type,v:1,name,code};connect();
 }
 net.hit=(b,speed)=>{if(!net.connected)return;send({type:'state',state:pose()});send({type:'hit',id:b.id,speed});};
 let lastTrafficHit=0;
 net.trafficHit=(t,nx,nz,speed)=>{if(net.connected&&performance.now()-lastTrafficHit>220){lastTrafficHit=performance.now();send({type:'trafficHit',id:t.id,nx,nz,speed});}};
 net.rebuild=()=>{if(!net.connected)return ui.toast('Reconnect before rebuilding.');if(net.host!==net.id)return ui.toast('Only the room host can rebuild the islands.');send({type:'reset'});};
 net.tick=(dt,time)=>{
  if(!net.active)return;
  const now=performance.now(),alpha=1-Math.exp(-dt*13);
  if(net.connected&&now-lastSend>=50){lastSend=now;send({type:'state',state:pose()});}
  if(net.connected&&now-lastPing>=5000){lastPing=now;send({type:'ping',at:Date.now()});}
  if(net.connected&&pendingAura>0&&now-lastAura>=200){lastAura=now;const points=Math.min(25000,pendingAura);pendingAura-=points;send({type:'aura',seq:++scoreSeq,points});}
  for(const r of net.remotes.values()){
   const c=r.current,s=r.target,car=r.mesh,lag=Math.min(.1,(now-r.at)/1000);
   const snap=Math.hypot(s.x-c.x,s.y-c.y,s.z-c.z)>40;
   for(const k of ['x','y','z'])c[k]=snap?s[k]:W.mix(c[k],s[k]+(s.parked?0:(s[k==='x'?'vx':k==='y'?'vy':'vz']||0)*lag),alpha);
   c.yaw+=Math.atan2(Math.sin(s.yaw-c.yaw),Math.cos(s.yaw-c.yaw))*(snap?1:alpha);
   car.root.position.set(c.x,c.y,c.z);car.root.rotation.y=c.yaw;car.body.rotation.set(-s.pitch,0,s.roll);car.contact.visible=s.grounded;
   car.nitro.group.visible=!!s.nitro&&r.connected&&s.water!=='sinking';car.nitro.light.intensity=car.nitro.group.visible?1.8:0;
   for(const jet of car.nitro.jets){jet.jet.scale.z=1.8+Math.sin(time*43)*.2;jet.material.uniforms.time.value=time;jet.material.uniforms.strength.value=1;jet.glow.material.opacity=.8;}
   for(const wheel of car.wheels){wheel.pivot.rotation.y=wheel.z>0?s.steer:0;wheel.spin.rotation.x+=s.speed*dt/.36;}
   car.tail.emissiveIntensity=s.brake?3:.35;
   if(s.water==='skimming'&&r.connected&&now-(r.sprayAt||0)>80){r.sprayAt=now;ui.spray({...s,...c});}
  }
  if(trafficTargets)W.traffic.forEach((t,i)=>{const a=trafficTargets[i];if(!a)return;const snap=Math.hypot(t.x-a[0],t.z-a[2])>30;for(const [j,k]of ['x','y','z'].entries())t[k]=snap?a[j]:W.mix(t[k],a[j],alpha);t.yaw+=Math.atan2(Math.sin(a[3]-t.yaw),Math.cos(a[3]-t.yaw))*alpha;[t.vx,t.vz,t.speed,t.distance]=a.slice(4);});
 };
 W.initMultiplayer=hooks=>{
  ui=hooks;
  const previousEarn=W.onAuraEarn;W.onAuraEarn=(points,best)=>{previousEarn?.(points,best);if(net.connected)pendingAura+=points;};
  $('driverName').value=safeRead(local,'isla-driver-name')||'';
  $('roomBtn').onclick=$('friendsBtn').onclick=openRoom;$('roomClose').onclick=closeRoom;
  $('roomCreate').onclick=()=>requestRoom('create');$('roomJoin').onclick=()=>requestRoom('join');$('roomLeave').onclick=net.leave;
  $('joinCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
  $('roomCopy').onclick=async()=>{const url=new URL(location.href);url.pathname='/';url.search='';url.hash='';url.searchParams.set('room',net.code);try{await navigator.clipboard.writeText(url.href);status('Invite link copied. Send it to your friends.');}catch{status('Share this room code: '+net.code);}};
  $('rooms').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===$('joinCode'))requestRoom('join');});
  const invite=new URLSearchParams(location.search).get('room');if(invite){$('joinCode').value=invite.toUpperCase().slice(0,6);openRoom();}
  try{const saved=JSON.parse(safeRead(session,'isla-room-v1'));if(saved?.code&&saved?.token&&saved?.name&&location.protocol!=='file:'){identity=saved;connect();}}catch{}
  // Keep parked drivers connected even if their browser throttles animation frames.
  setInterval(()=>{if(net.connected&&performance.now()-lastSend>500){lastSend=performance.now();send({type:'state',state:pose()});}},500);
  window.addEventListener('pagehide',()=>{leaving=true;socket?.close();});
  drawRoster();
 };
})();
