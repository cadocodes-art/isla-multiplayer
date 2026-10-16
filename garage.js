'use strict';
(()=>{
 const W=Isla;
 W.carModels=Object.freeze([
  {id:'classic',name:'Bahía Classic',price:0,color:'#9a3227',style:'classic',engine:1,grip:1,offroad:1,boostMax:53,thrust:8,boostKph:187,tag:'THE ORIGINAL',description:'The red sedan that started it all. Balanced, familiar, and always yours.'},
  {id:'rally',name:'Ruiz Rally',price:30000,color:'#d7bf81',style:'rally',engine:1.16,grip:1.06,offroad:1.35,boostMax:59,thrust:9,boostKph:208,tag:'ISLAND EXPLORER',description:'Rally lamps, a roof rack, and better grip for hills and off-road ramp runs.'},
  {id:'gt',name:'Coastline GT',price:80000,color:'#258fba',style:'gt',engine:1.4,grip:1.14,offroad:.98,boostMax:66,thrust:11,boostKph:233,tag:'COAST ROAD SPECIAL',description:'A low blue coupe with a white racing stripe, rear wing, and harder acceleration.'},
  {id:'solstice',name:'Solstice R',price:180000,color:'#f2b12c',style:'hyper',engine:1.8,grip:1.2,offroad:.9,boostMax:75,thrust:14,boostKph:264,tag:'MAXIMUM AURA',description:'Wide, low, and loud. Gold bodywork, black aero, and the fastest nitro in the garage.'}
 ]);
 W.createGarage=storage=>{
  // Requested fresh start: keep the previous save recoverable and save all new progress separately.
  const key='isla-drive-garage-v2',known=new Set(W.carModels.map(x=>x.id));let saved;
  try{saved=JSON.parse(storage?.getItem(key)||'null');}catch(e){}
  const number=v=>Number.isFinite(v)&&v>=0?Math.min(1e12,Math.floor(v)):0;
  const g={balance:number(saved?.balance),earned:number(saved?.earned),bestChain:number(saved?.bestChain),owned:[...new Set(['classic',...(Array.isArray(saved?.owned)?saved.owned.filter(id=>known.has(id)):[])])],selected:'classic',persistent:!!storage};
  if(g.owned.includes(saved?.selected))g.selected=saved.selected;g.earned=Math.max(g.earned,g.balance);
  g.save=()=>{try{if(!storage)throw Error();storage.setItem(key,JSON.stringify({balance:g.balance,earned:g.earned,bestChain:g.bestChain,owned:g.owned,selected:g.selected}));g.persistent=true;}catch(e){g.persistent=false;}};
  g.credit=(points,best=0)=>{if(!Number.isSafeInteger(points)||points<=0)return;g.balance+=points;g.earned+=points;g.bestChain=Math.max(g.bestChain,best);g.save();};
  g.choose=id=>{const m=W.carModels.find(x=>x.id===id);if(!m)return {ok:false,message:'Unknown car.'};if(!g.owned.includes(id)){if(g.balance<m.price)return {ok:false,message:'Earn more aura to unlock this car.'};g.balance-=m.price;g.owned.push(id);}g.selected=id;g.save();return {ok:true,model:m};};
  return g;
 };
 let storage;try{storage=window.localStorage;}catch(e){}W.garage=W.createGarage(storage);
 W.getCarSpec=()=>W.carModels.find(m=>m.id===W.garage.selected)||W.carModels[0];
 W.onAuraEarn=(points,best)=>W.garage.credit(points,best);
 W.carPreview=m=>{
  const sport=m.style==='gt',hyper=m.style==='hyper',rally=m.style==='rally';
  const body=hyper?'M22 75 L39 62 L104 58 L145 40 L198 40 L234 62 L290 69 L302 83 L294 92 L25 92Z':sport?'M24 72 L40 57 L100 53 L130 31 L194 31 L231 57 L283 65 L298 81 L291 92 L26 92Z':'M26 76 L34 58 L92 51 L117 23 L186 23 L230 54 L282 62 L297 80 L292 91 L27 91Z';
  const glass=hyper?'M117 58 L148 44 L194 44 L220 61Z':sport?'M111 54 L134 36 L190 36 L217 56Z':'M101 51 L123 29 L181 29 L216 53Z';
  return `<svg viewBox="0 0 320 110" role="img" aria-label="${m.name}"><ellipse cx="160" cy="99" rx="129" ry="6" fill="#000" opacity=".22"/><path d="${body}" fill="${m.color}"/><path d="${glass}" fill="#163a45"/><path d="M31 83 H294" stroke="#15292c" stroke-width="5"/>${rally?'<path d="M111 19 H194 M120 14 V22 M184 14 V22" stroke="#364347" stroke-width="5"/><rect x="286" y="55" width="9" height="12" rx="2" fill="#e9f6d9"/>':sport||hyper?'<path d="M22 54 H75 M38 54 V66 M63 54 V65" stroke="#142b30" stroke-width="5"/>':'<path d="M151 29 L153 53" stroke="'+m.color+'" stroke-width="6"/>'}${sport?'<path d="M44 67 H285" stroke="#ece9df" stroke-width="4"/>':hyper?'<path d="M101 72 L126 64 L133 82 H105Z M143 40 H198" fill="#163136" stroke="#163136" stroke-width="4"/>':''}<rect x="282" y="70" width="12" height="4" rx="2" fill="#ecf9e8"/><circle cx="77" cy="86" r="19" fill="#152024"/><circle cx="245" cy="86" r="19" fill="#152024"/><circle cx="77" cy="86" r="10" fill="#a4b4b8"/><circle cx="245" cy="86" r="10" fill="#a4b4b8"/><circle cx="77" cy="86" r="4" fill="#34474c"/><circle cx="245" cy="86" r="4" fill="#34474c"/></svg>`;
 };
 W.renderGarage=()=>{
  const g=W.garage;$('garageBalance').textContent=g.balance.toLocaleString('en-US');$('garageSave').textContent=g.persistent?'Aura and owned cars are saved in this browser.':'Aura and owned cars last for this session.';
  $('garageCars').innerHTML=W.carModels.map(m=>{const owned=g.owned.includes(m.id),active=g.selected===m.id,short=Math.max(0,m.price-g.balance);return `<article class="garage-car ${active?'selected':''}"><div class="garage-tag">${m.tag}<span>${active?'DRIVING':owned?'OWNED':m.price.toLocaleString('en-US')+' AURA'}</span></div>${W.carPreview(m)}<h3>${m.name}</h3><p>${m.description}</p><div class="car-stats"><span><b>${m.boostKph}</b> KM/H WITH NITRO</span><span>${m.style==='rally'?'OFF-ROAD GRIP':m.style==='hyper'?'HYPERCAR':m.style==='gt'?'SPORT COUPE':'STARTER CAR'}</span></div><button data-car="${m.id}" ${active||!owned&&short?'disabled':''}>${active?'CURRENT CAR':owned?'DRIVE':short?'NEED '+short.toLocaleString('en-US')+' MORE AURA':'BUY · '+m.price.toLocaleString('en-US')+' AURA'}</button></article>`;}).join('');
 };
 function $(id){return document.getElementById(id);}
 W.changeCar=id=>{
  const result=W.garage.choose(id);if(!result.ok)return result;
  const old=W.carMesh,geometries=new Set(),materials=new Set(),textures=new Set();
  if(old){W.scene.remove(old.root);old.root.traverse(o=>{if(o.geometry&&o.geometry!==W.unitBox)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  W.makeCar();W.resetVehicle();return result;
 };
})();
