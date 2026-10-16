/* ISLA — original procedural scenery. Three.js is distributed under its MIT license. */
'use strict';
window.Isla = (() => {
 const T=THREE, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t, smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
 let seed=8429; function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 function hash(x,z){let n=Math.imul(x,374761393)+Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295}
 function noise(x,z){let a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v)}
 function fbm(x,z){return noise(x,z)*.55+noise(x*2,z*2)*.27+noise(x*4,z*4)*.12+noise(x*8,z*8)*.06}
 const W={T,clamp,mix,smooth,rand,noise,fbm,roads:[],buildings:[],colliders:[],debris:[],particles:[],span:2400,depth:2400,N:321,NZ:321,minX:-1200,minZ:-1200};
 const roadCells=new Map(), cellSize=32;
 function luzHeight(x,z){let r=Math.hypot(x,z*1.07),coast=890+(fbm(x*.003,z*.003)-.5)*190;let inland=1-smooth(coast-150,coast,r);
  let beach=3.3+(coast-r)*.042;
  let mountain=145*Math.exp(-((x+70)**2/105000+(z+200)**2/115000))+78*Math.exp(-((x-350)**2/75000+(z+80)**2/135000))+62*Math.exp(-((x+440)**2/45000+(z-40)**2/120000));
  let terrain=10+mountain+(fbm(x*.008,z*.008)-.45)*(12+mountain*.32);
  let h=mix(beach,terrain,inland);if(r>coast)h=-2-(r-coast)*.10;
  return h;
 }
 W.luzHeight=luzHeight;const rawHeight=(x,z)=>Math.max(luzHeight(x,z),W.ruizHeight?.(x,z)??-Infinity);
 function addRoad(points,width,closed,name){let curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],0,p[1])),closed,'catmullrom',.28),count=Math.ceil(curve.getLength()/4),samples=curve.getSpacedPoints(count).map(p=>({x:p.x,z:p.z,y:rawHeight(p.x,p.z)+.08,width}));
  for(let pass=0;pass<9;pass++){let copy=samples.map(p=>p.y);for(let i=1;i<samples.length-1;i++)samples[i].y=(copy[i-1]+copy[i]*2+copy[i+1])/4;}
  let road={samples,width,closed,name};W.roads.push(road);
  samples.forEach((p,i)=>{p.road=road;p.index=i;let key=Math.floor(p.x/cellSize)+','+Math.floor(p.z/cellSize);if(!roadCells.has(key))roadCells.set(key,[]);roadCells.get(key).push(p)});return road;
 }
 function nearestRoad(x,z,range=1){let best=null,d2=Infinity,cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize);for(let a=-range;a<=range;a++)for(let b=-range;b<=range;b++){let list=roadCells.get((cx+a)+','+(cz+b));if(list)for(let p of list){let d=(p.x-x)**2+(p.z-z)**2;if(d<d2){d2=d;best=p}}}return {p:best,d:Math.sqrt(d2)}}
 W.nearestRoad=nearestRoad;W.addRoad=addRoad;
 W.initTerrain=()=>{W.roads.length=0;roadCells.clear();
  addRoad([[0,700],[230,655],[450,520],[650,250],[680,0],[610,-250],[450,-500],[180,-630],[-120,-680],[-420,-530],[-650,-300],[-720,-40],[-640,270],[-420,520],[-180,660]],9.5,true,'Coast road');
  addRoad([[280,630],[160,460],[200,310],[85,225],[-60,115],[100,-30],[50,-190],[-100,-270],[-220,-420],[-210,-655]],7.5,false,'Summit pass');
  addRoad([[-640,270],[-430,240],[-300,340],[-100,370],[90,470],[160,460]],7,false,'Jungle cut');
  W.extendRoads?.();W.heights=new Float32Array(W.N*W.NZ);let step=W.span/(W.N-1);W.step=step;
  for(let iz=0;iz<W.NZ;iz++)for(let ix=0;ix<W.N;ix++){let x=ix*step+W.minX,z=iz*step+W.minZ,h=rawHeight(x,z),near=nearestRoad(x,z);if(near.p&&!near.p.road.elevated){let t=1-smooth(near.p.width*.5+2,near.p.width*.5+17,near.d);h=mix(h,near.p.y-.06,t)}W.heights[iz*W.N+ix]=h;}
 };
 W.height=(x,z)=>{let fx=clamp((x-W.minX)/W.step,0,W.N-1.001),fz=clamp((z-W.minZ)/W.step,0,W.NZ-1.001),ix=Math.floor(fx),iz=Math.floor(fz),a=fx-ix,b=fz-iz,n=W.N,h=W.heights;return mix(mix(h[iz*n+ix],h[iz*n+ix+1],a),mix(h[(iz+1)*n+ix],h[(iz+1)*n+ix+1],a),b)};
 W.driveHeight=(x,z,belowDeck=false)=>{const deck=W.bridgeSurface?.(x,z);if(deck!=null&&!belowDeck)return deck;const approach=W.approachSurface?.(x,z);if(approach!=null)return approach;let n=nearestRoad(x,z);return W.height(x,z)+(n.p?.20*(1-smooth(n.p.width*.5,n.p.width*.5+1.5,n.d)):0)};
 W.slope=(x,z)=>({x:(W.height(x+1,z)-W.height(x-1,z))*.5,z:(W.height(x,z+1)-W.height(x,z-1))*.5});
 const mat=(color,roughness=.85,metalness=0)=>{let m=new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.55});m.color.convertSRGBToLinear();return m};W.mat=mat;
 const unitBox=new T.BoxGeometry(1,1,1);W.unitBox=unitBox;
 W.box=(parent,x,y,z,sx,sy,sz,material,shadow=true)=>{let m=new T.Mesh(unitBox,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m};
 function textureCanvas(size,paint,repeat=1){let c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);let t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t}
 W.textureCanvas=textureCanvas;
 W.makeRoadStrip=(scene,samples,width,material,offset=0,lift=.1)=>{let p=[],uv=[],indices=[],distance=0;for(let i=0;i<samples.length;i++){let q=samples[i],prev=samples[Math.max(i-1,0)],next=samples[Math.min(i+1,samples.length-1)],dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1,nx=dz/len,nz=-dx/len;if(i)distance+=Math.hypot(q.x-prev.x,q.z-prev.z);for(let side of [-1,1]){let x=q.x+nx*(offset+width*.5*side),z=q.z+nz*(offset+width*.5*side);let edge=q.width*.5+.8,grade=(q.road.elevated||q.road.graded)?q.y:Math.max(W.height(q.x,q.z),W.height(q.x+nx*edge,q.z+nz*edge),W.height(q.x-nx*edge,q.z-nz*edge));p.push(x,grade+lift+.08,z);uv.push(side===-1?0:1,distance/8)}if(i){let a=i*2;indices.push(a-2,a,a-1,a-1,a,a+1)}}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();let m=new T.Mesh(g,material);m.receiveShadow=true;scene.add(m);return m};
 W.makeWorld=(scene,renderer)=>{
  W.scene=scene;W.renderer=renderer;W.initTerrain();
  let geometry=new T.PlaneGeometry(W.span,W.depth,W.N-1,W.NZ-1);geometry.rotateX(-Math.PI/2);geometry.translate(W.minX+W.span/2,0,W.minZ+W.depth/2);let positions=geometry.attributes.position,col=new Float32Array(positions.count*3),color=new T.Color();
  for(let i=0;i<positions.count;i++){let x=positions.getX(i),z=positions.getZ(i),h=W.height(x,z);let rn=nearestRoad(x,z);positions.setY(i,h-(rn.p?.65*(1-smooth(rn.p.width*.5+.7,rn.p.width*.5+3,rn.d)):0));let n=fbm(x*.021,z*.021),s=W.slope(x,z),slope=Math.hypot(s.x,s.z);color.set(h<7?'#c4b482':h<14?'#93905f':'#637453');let green=new T.Color('#435c3a');color.lerp(green,smooth(10,50,h)*.55);color.multiplyScalar(.79+n*.35);if(slope>.75)color.lerp(new T.Color('#918b77'),smooth(.75,1.5,slope)*.8);color.convertSRGBToLinear();col.set([color.r,color.g,color.b],i*3)}
  geometry.setAttribute('color',new T.BufferAttribute(col,3));geometry.computeVertexNormals();
  let groundMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
  groundMat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGroundPosition;');s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vGroundPosition;
float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453),f.x),mix(fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1.,1.),vec2(127.1,311.7)))*43758.5453),f.x),f.y);}`);s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float grain=terrainNoise(vGroundPosition.xz*3.5)*.17+terrainNoise(vGroundPosition.xz*.45)*.22+terrainNoise(vGroundPosition.xz*.07)*.16;
diffuseColor.rgb*=.69+grain;
`)};
  let terrain=new T.Mesh(geometry,groundMat);terrain.receiveShadow=true;scene.add(terrain);
  const sky=new T.Mesh(new T.SphereGeometry(6000,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDirection:{value:new T.Vector3(-.52,.73,-.4)},warm:{value:0}},vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vWorld;uniform vec3 sunDirection;uniform float warm;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fb(vec2 p){return n(p)*.57+n(p*2.)*.28+n(p*4.)*.15;}
void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 horizon=mix(vec3(.69,.81,.82),vec3(.91,.72,.48),warm);vec3 top=mix(vec3(.14,.40,.59),vec3(.28,.43,.56),warm);vec3 col=mix(horizon,top,pow(h,.48));float sun=max(dot(d,normalize(sunDirection)),0.);col+=vec3(1.,.83,.57)*(pow(sun,90.)*.35+pow(sun,1800.)*3.);vec2 uv=d.xz/(max(d.y,.025))*1.6;float cloud=smoothstep(.52,.79,fb(uv+vec2(3.1,1.6)))*smoothstep(.02,.17,d.y)*(1.-smoothstep(.55,.95,d.y));col=mix(col,mix(vec3(.92,.94,.91),vec3(1.,.84,.65),warm),cloud*.72);gl_FragColor=vec4(col,1.);}` }));sky.frustumCulled=false;scene.add(sky);W.sky=sky;
  let hemi=new T.HemisphereLight(0xbcdfe9,0x777755,.8);scene.add(hemi);W.hemi=hemi;
  let sun=new T.DirectionalLight(0xffefd5,2.4);sun.position.set(-160,225,-120);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100,near:1,far:700});sun.shadow.bias=-.00018;sun.shadow.normalBias=.08;sun.shadow.radius=2;scene.add(sun);scene.add(sun.target);W.sun=sun;
  scene.fog=new T.FogExp2(0xa9cbd0,.00065);
  let envScene=new T.Scene();envScene.add(sky.clone());let pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.025,1,10000).texture;pmrem.dispose();
  let hdata=new Uint8Array(W.N*W.NZ*4);for(let i=0;i<W.heights.length;i++){let v=clamp((W.heights[i]+80)/320,0,1)*255;hdata[i*4]=v;hdata[i*4+1]=v;hdata[i*4+2]=v;hdata[i*4+3]=255}let htex=new T.DataTexture(hdata,W.N,W.NZ,T.RGBAFormat);htex.minFilter=htex.magFilter=T.LinearFilter;htex.needsUpdate=true;
  let waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},sunDirection:{value:W.sky.material.uniforms.sunDirection.value},heightMap:{value:htex},mapOrigin:{value:new T.Vector2(W.minX,W.minZ)},mapSize:{value:new T.Vector2(W.span,W.depth)},warm:{value:0}},vertexShader:'varying vec3 wp;void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}',fragmentShader:`varying vec3 wp;uniform float time;uniform vec3 sunDirection;uniform sampler2D heightMap;uniform vec2 mapOrigin;uniform vec2 mapSize;uniform float warm;
void main(){float h=texture2D(heightMap,(wp.xz-mapOrigin)/mapSize).r*320.-80.;float dep=max(-h,0.);vec2 p=wp.xz;float a=sin(p.x*.16+p.y*.09+time*1.7),b=cos(p.x*.075-p.y*.18+time*1.2),c=sin(p.x*.6+p.y*.35-time*2.);vec3 normal=normalize(vec3((a+b)*.055+c*.012,1.,(b-a)*.06));vec3 viewDir=normalize(cameraPosition-wp);float fres=pow(1.-max(dot(viewDir,normal),0.),4.);vec3 base=mix(vec3(.08,.51,.49),vec3(.025,.20,.28),smoothstep(0.,36.,dep));vec3 col=mix(base,vec3(.58,.74,.77),fres*.65);float spec=pow(max(dot(reflect(-normalize(sunDirection),normal),viewDir),0.),180.);col+=mix(vec3(1.,.96,.79),vec3(1.,.61,.27),warm)*spec*1.8;float shore=(1.-smoothstep(0.,3.8,dep))*smoothstep(-.4,.4,-h);float foam=smoothstep(.3,.8,sin(dep*2.-time*1.25+sin(p.x*.3)*.5));col=mix(col,vec3(.84,.91,.85),shore*foam*.65);float haze=1.-exp(-length(cameraPosition-wp)*.00027);col=mix(col,vec3(.64,.77,.80),haze);gl_FragColor=vec4(col,1.);}`});let water=new T.Mesh(new T.PlaneGeometry(13000,13000),waterMat);water.rotation.x=-Math.PI/2;water.position.y=.0;scene.add(water);W.water=water;
  W.roadMaterial=mat('#535858',.99);W.roadMaterial.map=textureCanvas(256,(ctx,s)=>{ctx.fillStyle='#858582';ctx.fillRect(0,0,s,s);let im=ctx.getImageData(0,0,s,s);for(let i=0;i<im.data.length;i+=4){let c=100+rand()*65;im.data[i]=c;im.data[i+1]=c;im.data[i+2]=c;im.data[i+3]=255}ctx.putImageData(im,0,0)},1);
  const white=mat('#d8d5bc'),lineWhite=mat('#d7d3b5'),shoulder=mat('#a89d7c');
  const strip=(...args)=>W.makeRoadStrip(scene,...args);
  W.roads.forEach(road=>{strip(road.samples,.7,shoulder,road.width*.5+.35,.08);strip(road.samples,.7,shoulder,-road.width*.5-.35,.08);strip(road.samples,road.width,W.roadMaterial,0,.13);strip(road.samples,.13,lineWhite,road.width*.5-.4,.155);strip(road.samples,.13,lineWhite,-road.width*.5+.4,.155);for(let i=1;i<road.samples.length-2;i+=6)strip(road.samples.slice(i,i+3),.13,white,0,.16)});
  W.makeBridge?.(scene);W.makeBuildings(scene);W.makeRamps(scene);W.makeVegetation(scene);W.makeRuizDetails?.(scene);W.makeRoadDetails(scene);
 };
 W.makeBuildings=scene=>{
  const glass=mat('#36585e',.19,.6),trim=mat('#e8e3d4',.8),dark=mat('#3b4546'),wood=mat('#654e3d'),metal=mat('#53636a',.48,.55),roof=mat('#9d6150');
  let stucco=textureCanvas(128,(c,s)=>{c.fillStyle='#dedbd2';c.fillRect(0,0,s,s);for(let i=0;i<4000;i++){c.fillStyle=rand()>.5?'#c3c0b745':'#ffffff45';c.fillRect(rand()*s,rand()*s,1,1)}},3);
  let crackTex=textureCanvas(512,(c,s)=>{c.clearRect(0,0,s,s);c.strokeStyle='#1e2522cc';function branch(x,y,a,len,depth){c.beginPath();c.moveTo(x,y);for(let i=0;i<7;i++){x+=Math.cos(a)*len/7+(rand()-.5)*14;y+=Math.sin(a)*len/7+(rand()-.5)*14;c.lineTo(x,y);if(depth&&i===4)branch(x,y,a+(rand()>.5?1:-1),len*.5,depth-1)}c.lineWidth=depth+1;c.stroke()}for(let i=0;i<6;i++)branch(s*.5,s*.5,i*1.04+rand()*.2,100+rand()*160,2)});
  const crackMat=new T.MeshBasicMaterial({map:crackTex,transparent:true,opacity:.82,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  let palette=['#d2c5a8','#d7dbcd','#a9b9ad','#d1b295','#e2d8bd','#a2b9bd'];let id=0;
  function building(x,z,yaw,w,d,floors,type){let y=W.height(x,z),h=floors*3.4;let slope=W.slope(x,z);if(Math.hypot(slope.x,slope.z)>.34||y<4)return;
   let group=new T.Group();group.position.set(x,y,z);group.rotation.y=yaw;scene.add(group);let wall=mat(palette[id%palette.length]);wall.map=stucco;let b={id:id++,name:type||'Coastal residence',x,z,y,yaw,w,d,h,hp:100,maxHp:100,group,wall,collapsed:false,lastHit:-10,cracks:[],windows:[],pieces:[]};W.buildings.push(b);W.colliders.push(b);
   W.box(group,0,-.25,0,w+1,1,d+1,trim);
   const body=W.box(group,0,h*.5,0,w,h,d,wall);b.body=body;
   W.box(group,0,h+.12,0,w+.8,.3,d+.8,trim);
   W.box(group,0,h+.42,-d*.47,w+.6,.45,.22,trim);W.box(group,-w*.48,h+.42,0,.22,.45,d,trim);W.box(group,w*.48,h+.42,0,.22,.45,d,trim);
   if(floors===1&&id%3===0){let r=new T.Mesh(new T.CylinderGeometry(0,1,1,4,1),roof);r.rotation.y=Math.PI/4;r.scale.set(w*.79,2,d*.79);r.position.y=h+1;group.add(r);r.castShadow=true;b.roof=r;}
   else{W.box(group,w*.2,h+.55,-d*.15,2,.7,1.3,metal);for(let k=-2;k<=2;k++)W.box(group,w*.2+k*.32,h+.92,-d*.15,.05,.03,1.15,dark,false)}
   // Recessed glass, frames and exterior shutters on all four facades.
   for(let side=0;side<4;side++){let face=new T.Group();face.rotation.y=side*Math.PI/2;group.add(face);let fw=side%2?d:w,depth=side%2?w:d,count=Math.max(2,Math.floor(fw/3));for(let f=0;f<floors;f++)for(let j=0;j<count;j++){let wx=(j-(count-1)*.5)*(fw/(count+.3)),wy=2+f*3.4;W.box(face,wx,wy,depth*.5+.04,1.6,1.9,.11,trim,false);let windowMesh=W.box(face,wx,wy,depth*.5+.11,1.35,1.65,.05,glass,false);b.windows.push(windowMesh);W.box(face,wx,wy,depth*.5+.16,.055,1.65,.04,trim,false);W.box(face,wx,wy+.85,depth*.5+.18,1.75,.12,.28,trim,false);if(id%2===0){W.box(face,wx-1.0,wy,depth*.5+.1,.35,1.8,.1,wood,false);W.box(face,wx+1.0,wy,depth*.5+.1,.35,1.8,.1,wood,false)}}let crack=new T.Mesh(new T.PlaneGeometry(fw,h),crackMat);crack.position.set(0,h*.5,depth*.5+.18);crack.visible=false;face.add(crack);b.cracks.push(crack)}
   W.box(group,0,1.25,d*.5+.19,1.35,2.5,.17,wood);W.box(group,.43,1.23,d*.5+.31,.08,.22,.08,metal,false);
   W.box(group,0,3.05,d*.5+1.1,w*.65,.16,2.2,id%3===0?mat('#477e7a'):trim);
   for(let a of [-1,1])W.box(group,a*w*.29,1.5,d*.5+1.9,.16,3,.16,trim);
   if(floors>1){W.box(group,0,3.35,d*.5+.8,w*.85,.23,1.8,trim);for(let k=0;k<9;k++)W.box(group,(k-4)*w*.09,3.95,d*.5+1.65,.05,1,.05,metal,false);W.box(group,0,4.45,d*.5+1.65,w*.8,.06,.06,metal,false)}
   let garden=mat('#66784f');W.box(group,-w*.5-1,.3,d*.35,1.4,.6,2.8,trim);W.box(group,-w*.5-1,.67,d*.35,1.25,.22,2.6,garden);
  }
  W.addBuilding=building;let main=W.roads[0],samples=main.samples;
  // Coastal settlements with individual properties and room to leave the road.
  for(let i=10;i<samples.length-10;i+=16){let p=samples[i];if(p.z<330&&!(p.x>520&&p.z>-180&&p.z<230))continue;let next=samples[i+1],dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len;
   for(let side of [-1,1]){if(rand()<.17)continue;let w=8+rand()*7,d=7+rand()*5,off=main.width*.5+10+d*.5;let x=p.x+nx*off*side,z=p.z+nz*off*side;let yaw=Math.atan2(-nx*side,-nz*side);building(x,z,yaw,w,d,rand()>.45?2:1,p.z>450?'Bahía coastal residence':'East shore villa');}
  }
  let pass=W.roads[1].samples;for(let i=60;i<pass.length-35;i+=55){let p=pass[i],next=pass[i+1],a=Math.atan2(next.x-p.x,next.z-p.z);building(p.x+Math.cos(a)*23,p.z-Math.sin(a)*23,a-Math.PI/2,11,8,1,'Mountain retreat');}W.makeRuizBuildings?.(scene,building);
 };
 W.makeVegetation=scene=>{
  // Curved tapered trunks and long segmented palm fronds, drawn in two batches.
  let trunkPos=[],trunkIdx=[],trunkUV=[];for(let j=0;j<=9;j++){let h=j/9;for(let k=0;k<=7;k++){let a=k/7*Math.PI*2,r=.18*(1-h*.5);trunkPos.push(Math.cos(a)*r+h*h*.75,h*7.5,Math.sin(a)*r);trunkUV.push(k/7,h*9);if(j<9&&k<7){let q=j*8+k;trunkIdx.push(q,q+8,q+1,q+1,q+8,q+9)}}}let tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(trunkPos,3));tg.setAttribute('uv',new T.Float32BufferAttribute(trunkUV,2));tg.setIndex(trunkIdx);tg.computeVertexNormals();let trunkMat=mat('#9c9277');trunkMat.map=textureCanvas(64,(c,s)=>{c.fillStyle='#bbb29c';c.fillRect(0,0,s,s);for(let i=0;i<s;i+=8){c.fillStyle='#786d5944';c.fillRect(0,i,s,2)}});
  let lp=[],li=[],lc=[];for(let j=0;j<=10;j++){let t=j/10,xx=t*4.1,yy=Math.sin(t*Math.PI*.9)*1.3-t*t*2.3,width=Math.sin(t*Math.PI)*.46;for(let k of [-1,0,1]){lp.push(xx,yy-(k!==0?.10:0),k*width);let c=new T.Color(k===0?'#617a37':'#3e602d');c.multiplyScalar(.8+t*.3);lc.push(c.r,c.g,c.b)}if(j<10){let q=j*3;li.push(q,q+3,q+1,q+1,q+3,q+4,q+1,q+4,q+2,q+2,q+4,q+5)}}let lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lp,3));lg.setAttribute('color',new T.Float32BufferAttribute(lc,3));lg.setIndex(li);lg.computeVertexNormals();let leafMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,side:T.DoubleSide});
  W.palmAssets={tg,trunkMat,lg,leafMat};let palms=[];for(let n=0;n<2300&&palms.length<760;n++){let x=(rand()-.5)*1950,z=(rand()-.5)*1850,y=W.height(x,z),near=nearestRoad(x,z);
   if(W.inRampClearing(x,z)||y<3||y>95||near.d<(near.p?near.p.width*.5+4:9))continue;if(W.buildings.some(b=>(b.x-x)**2+(b.z-z)**2<225))continue;palms.push({x,y,z,s:.75+rand()*.55,a:rand()*6.28});}
  let trunks=new T.InstancedMesh(tg,trunkMat,palms.length),leaves=new T.InstancedMesh(lg,leafMat,palms.length*10),o=new T.Object3D();palms.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.a,0);o.scale.setScalar(p.s);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);let lean=new T.Vector3(.75,7.45,0).applyAxisAngle(new T.Vector3(0,1,0),p.a);for(let k=0;k<10;k++){o.position.set(p.x+lean.x*p.s,p.y+lean.y*p.s,p.z+lean.z*p.s);o.rotation.set((k%2)*.14,p.a+k*Math.PI*.2, .12+(k%3)*.12);o.scale.setScalar(p.s*(.8+rand()*.3));o.updateMatrix();leaves.setMatrixAt(i*10+k,o.matrix)}W.colliders.push({kind:'tree',x:p.x,z:p.z,y:p.y,r:.3});});trunks.castShadow=leaves.castShadow=true;trunks.receiveShadow=true;scene.add(trunks,leaves);W.palms=palms;
  const rockMat=mat('#7e8270');let rockGeo=new T.IcosahedronGeometry(1,1);let rocks=new T.InstancedMesh(rockGeo,rockMat,260),ri=0;
  for(let n=0;n<1500&&ri<260;n++){let x=(rand()-.5)*1870,z=(rand()-.5)*1770,y=W.height(x,z),near=nearestRoad(x,z);if(W.inRampClearing(x,z)||y<.1||near.d<22||W.buildings.some(b=>(b.x-x)**2+(b.z-z)**2<300))continue;let s=1+rand()*3.8;o.position.set(x,y+s*.17,z);o.rotation.set(rand()*.5,rand()*6.28,rand()*.5);o.scale.set(s,s*.65,s*.8);o.updateMatrix();rocks.setMatrixAt(ri++,o.matrix);W.colliders.push({kind:'rock',x,z,y,r:s*.8});}rocks.count=ri;rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
  let foliageMat=mat('#3f5637'),foliage=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),foliageMat,900),fi=0;
  for(let n=0;n<2400&&fi<900;n++){let x=(rand()-.5)*1500,z=(rand()-.5)*1400,y=W.height(x,z),near=nearestRoad(x,z);if(W.inRampClearing(x,z)||y<25||near.d<17||W.buildings.some(b=>(b.x-x)**2+(b.z-z)**2<240))continue;let s=3+rand()*5;o.position.set(x,y+s*.6,z);o.rotation.set(rand(),rand()*6.28,rand());o.scale.set(s,s*.9,s*.8);o.updateMatrix();foliage.setMatrixAt(fi++,o.matrix);}foliage.count=fi;foliage.castShadow=true;foliage.receiveShadow=true;scene.add(foliage);W.foliage=foliage;
  // Small ground plants, gathered into one instanced draw call.
  let grassGeo=new T.ConeGeometry(.5,1.4,4),grass=new T.InstancedMesh(grassGeo,mat('#70784b'),1800),gi=0;for(let n=0;n<5000&&gi<1800;n++){let x=(rand()-.5)*1650,z=(rand()-.5)*1600,y=W.height(x,z),near=nearestRoad(x,z);if(W.inRampClearing(x,z)||y<10||near.d<10)continue;o.position.set(x,y+.3,z);o.rotation.set(0,rand()*6.28,0);o.scale.setScalar(.7+rand());o.updateMatrix();grass.setMatrixAt(gi++,o.matrix)}grass.count=gi;scene.add(grass);W.grass=grass;
 };
 W.makeRoadDetails=scene=>{
  let pole=mat('#bcc0b8',.5,.5),black=mat('#3d4544'),yellow=mat('#e8d9a1'),white=mat('#d6d5c6');
  let road=W.roads[0].samples;
  for(let i=5;i<road.length-5;i+=26){let p=road[i],q=road[i+1],a=Math.atan2(q.x-p.x,q.z-p.z),nx=Math.cos(a),nz=-Math.sin(a);for(let side of [-1,1]){let x=p.x+nx*6.8*side,z=p.z+nz*6.8*side,y=W.height(x,z);let post=new T.Group();post.position.set(x,y,z);post.rotation.y=a;W.box(post,0,.65,0,.14,1.3,.14,white);W.box(post,0,1.02,.075,.15,.24,.025,black,false);W.box(post,0,1.04,.095,.06,.08,.015,yellow,false);scene.add(post)}
   if(p.z>500){let x=p.x+nx*9,z=p.z+nz*9,y=W.height(x,z);let lamp=new T.Group();lamp.position.set(x,y,z);lamp.rotation.y=a;W.box(lamp,0,3.8,0,.12,7.6,.12,pole);W.box(lamp,-.9,7.5,0,1.9,.12,.12,pole);W.box(lamp,-1.8,7.38,0,.7,.12,.35,black);scene.add(lamp)}
  }
  function sign(index,text){let p=road[index],q=road[index+1],a=Math.atan2(q.x-p.x,q.z-p.z),x=p.x+Math.cos(a)*10,z=p.z-Math.sin(a)*10,y=W.height(x,z);let group=new T.Group();group.position.set(x,y,z);group.rotation.y=a;W.box(group,0,1.4,0,.12,2.8,.12,pole);let tex=textureCanvas(256,(c,s)=>{c.fillStyle='#2b635a';c.fillRect(0,0,s,s);c.strokeStyle='#e9eedc';c.lineWidth=7;c.strokeRect(8,54,240,148);c.fillStyle='#f7f6ed';c.font='bold 22px Arial';c.textAlign='center';c.fillText(text,128,113);c.font='18px Arial';c.fillText('SANTA LUZ  ↗',128,150)});let m=new T.Mesh(new T.PlaneGeometry(3,3),new T.MeshStandardMaterial({map:tex,side:T.DoubleSide}));m.position.y=3;group.add(m);scene.add(group)}sign(35,'BAHÍA COAST');sign(Math.floor(road.length*.35),'SUMMIT PASS');
 };
 W.makeCar=(model=W.getCarSpec?.()||{style:'classic',color:'#9a3227'},remote=false)=>{
  let root=new T.Group(),body=new T.Group();root.add(body);let paint=new T.MeshPhysicalMaterial({color:model.color,metalness:.65,roughness:.25,clearcoat:1,clearcoatRoughness:.13,envMapIntensity:1.3}),black=mat('#151b1c',.7),rubber=mat('#151817',.95),silver=mat('#b9c1c3',.25,.92),glass=new T.MeshPhysicalMaterial({color:0x263e43,metalness:.3,roughness:.07,clearcoat:1,envMapIntensity:1.9}),lights=new T.MeshStandardMaterial({color:0xeef9ff,emissive:0xc4eaff,emissiveIntensity:1.3}),tail=new T.MeshStandardMaterial({color:0x7d1513,emissive:0xff2313,emissiveIntensity:.35});
  paint.color.convertSRGBToLinear();glass.color.convertSRGBToLinear();tail.color.convertSRGBToLinear();
  // Sculpted body silhouette, narrower over the cabin and at both bumpers.
  function shell(rings,material){let pos=[],ind=[];rings.forEach(r=>{let [z,width,bottom,top]=r;pos.push(-width,bottom,z,width,bottom,z,width,top-.10,z,width*.88,top,z,-width*.88,top,z,-width,top-.10,z)});for(let i=0;i<rings.length-1;i++)for(let j=0;j<6;j++){let a=i*6+j,b=i*6+(j+1)%6;ind.push(a,b,a+6,b,b+6,a+6)}ind.push(0,2,1,0,4,2,0,5,4);let n=(rings.length-1)*6;ind.push(n,n+1,n+2,n,n+2,n+4,n,n+4,n+5);let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(ind);geo.computeVertexNormals();let mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);return mesh}
  if(model.style==='classic'||model.style==='rally'){
  shell([[-2.25,.87,.40,.91],[-1.6,.97,.38,1.04],[.3,.94,.40,1.03],[1.6,.94,.39,.87],[2.24,.82,.43,.75]],paint);
  shell([[-1.37,.80,1,1.04],[-.70,.70,1.02,1.59],[.50,.68,1.01,1.57],[1.15,.80,.95,1.0]],glass);
  W.box(body,-.76,1.29,-1.01,.055,.67,.06,paint).rotation.x=.83;W.box(body,.76,1.29,-1.01,.055,.67,.06,paint).rotation.x=.83;
  for(let side of [-1,1]){W.box(body,side*.715,1.31,.82,.07,.70,.07,paint).rotation.x=-.86;W.box(body,side*.705,1.31,-.25,.075,.6,.07,black);W.box(body,side*.96,.57,0,.09,.17,2.9,black);W.box(body,side*.946,.96,-.32,.025,.035,.24,silver);W.box(body,side*1.01,1.12,.66,.27,.14,.28,paint);W.box(body,side*1.016,1.12,.51,.22,.10,.02,glass,false);}
  W.box(body,0,1.59,-.08,1.4,.055,1.22,paint);W.box(body,0,.57,2.22,1.63,.25,.12,black);W.box(body,0,.58,-2.23,1.7,.24,.13,black);W.box(body,0,.74,2.25,.9,.16,.02,black);for(let i=-3;i<=3;i++)W.box(body,i*.12,.74,2.267,.04,.12,.02,silver,false);
  for(let side of [-1,1]){W.box(body,side*.64,.78,2.28,.34,.11,.05,lights);W.box(body,side*.64,.84,-2.278,.40,.12,.035,tail);W.box(body,side*.56,.44,-2.30,.14,.09,.12,silver)}
  let plateTex=textureCanvas(256,(c,s)=>{c.fillStyle='#e4e2d4';c.fillRect(0,0,s,s);c.fillStyle='#293d3f';c.font='bold 52px Arial';c.textAlign='center';c.fillText('ISLA 01',128,145)});W.box(body,0,.68,-2.311,.46,.15,.01,new T.MeshStandardMaterial({map:plateTex}),false);
  if(model.style==='rally'){for(const x of [-.57,.57]){W.box(body,x,1.73,-.12,.06,.12,1.7,black);W.box(body,x,1.66,-.7,.06,.15,.06,black);W.box(body,x,1.66,.55,.06,.15,.06,black);}for(const z of [-.9,-.3,.3,.7])W.box(body,0,1.76,z,1.25,.05,.05,silver);for(const x of [-.48,-.16,.16,.48])W.box(body,x,1.03,2.25,.23,.22,.14,lights);W.box(body,0,.55,2.35,1.75,.09,.1,silver);}
  }else{
   const hyper=model.style==='hyper',roofY=hyper?1.23:1.37;
   shell([[-2.27,.97,.39,.9],[-1.6,1.02,.38,1.02],[.1,.98,.38,.88],[1.65,.98,.38,.72],[2.27,.77,.4,.61]],paint);
   shell([[-1.18,.79,.88,.96],[-.6,.65,.91,roofY],[.25,.64,.88,roofY],[1.1,.8,.8,.85]],glass);
   W.box(body,0,roofY,-.13,1.27,.045,.83,hyper?black:paint);
   for(const side of [-1,1]){W.box(body,side*.74,1.04,.7,.05,.52,.055,paint).rotation.x=-.95;W.box(body,side*.73,1.05,-.88,.05,.47,.06,paint).rotation.x=.8;W.box(body,side*.99,.46,0,.12,.12,3.25,black);W.box(body,side*1.01,1.0,.56,.22,.1,.23,paint);W.box(body,side*.71,.68,2.23,.36,.065,.04,lights);W.box(body,side*.65,.78,-2.28,.55,.075,.04,tail);W.box(body,side*.56,.44,-2.3,.16,.09,.12,silver);W.box(body,side*.66,1.12,-1.9,.09,.45,.12,black);}
   W.box(body,0,hyper?1.4:1.31,-1.95,hyper?2.15:1.8,.08,.5,black);W.box(body,0,.42,2.22,1.9,.08,.3,black);W.box(body,0,.48,-2.26,1.9,.15,.18,black);
   for(const side of [-1,1]){W.box(body,side*.16,.805,1.25,.19,.018,.8,hyper?black:W.mat('#eee9d9'));W.box(body,side*.16,.97,-1.6,.19,.018,.5,hyper?black:W.mat('#eee9d9'));}
   if(hyper)for(const side of [-1,1])W.box(body,side*.97,.7,-.85,.05,.24,.6,black);
  }
  // Wheel barrels, five-spoke alloys and individual steerable suspension points.
  const wheelGeo=new T.CylinderGeometry(.36,.36,.25,24);wheelGeo.rotateZ(Math.PI/2);let wheels=[];
  for(let z of [1.42,-1.43])for(let side of [-1,1]){let pivot=new T.Group();pivot.position.set(side*.94,.39,z);root.add(pivot);let spin=new T.Group();pivot.add(spin);let tire=new T.Mesh(wheelGeo,rubber);tire.castShadow=true;spin.add(tire);let rim=new T.Mesh(new T.CylinderGeometry(.245,.245,.265,20),black);rim.rotation.z=Math.PI/2;spin.add(rim);for(let k=0;k<5;k++){let spoke=W.box(spin,side*.139,0,0,.028,.46,.05,silver);spoke.rotation.x=k*Math.PI*2/5;}let hub=new T.Mesh(new T.CylinderGeometry(.072,.072,.29,12),silver);hub.rotation.z=Math.PI/2;spin.add(hub);wheels.push({pivot,spin,side,z});}
  // Subtle under-car contact shadow.
  let shadowTex=textureCanvas(128,(c,s)=>{let grad=c.createRadialGradient(64,64,5,64,64,64);grad.addColorStop(0,'#000000a0');grad.addColorStop(1,'#00000000');c.fillStyle=grad;c.fillRect(0,0,s,s)});let contact=new T.Mesh(new T.PlaneGeometry(3.6,5.8),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.02;root.add(contact);
  // Two animated flame volumes point out of the real exhaust tips, along local -Z.
  const nitroGroup=new T.Group(),jets=[],flameGeometry=new T.CylinderGeometry(0,.19,1,14,12,true);
  flameGeometry.translate(0,.5,0);flameGeometry.rotateX(-Math.PI/2);body.add(nitroGroup);nitroGroup.visible=false;
  const glowTexture=textureCanvas(64,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'#e7faffff');g.addColorStop(.25,'#9dcfffbb');g.addColorStop(.55,'#ff9a3444');g.addColorStop(1,'#ff5e0000');ctx.fillStyle=g;ctx.fillRect(0,0,s,s)});
  for(const side of [-1,1]){
   const jet=new T.Group();jet.position.set(side*.56,.44,-2.37);nitroGroup.add(jet);
   const flameMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{time:{value:0},strength:{value:0},phase:{value:side*2.7}},vertexShader:`varying vec2 flameUv;uniform float time;uniform float phase;
void main(){flameUv=uv;vec3 p=position;p.x+=sin(uv.y*19.-time*31.+phase)*.035*uv.y;p.y+=cos(uv.y*16.-time*25.+phase)*.028*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 flameUv;uniform float time;uniform float strength;uniform float phase;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){float v=flameUv.y;float turbulence=noise(vec2(flameUv.x*8.+phase,v*11.-time*12.));vec3 col=mix(vec3(.15,.65,2.1),vec3(2.8,1.8,.55),smoothstep(.03,.25,v));col=mix(col,vec3(2.3,.36,.025),smoothstep(.25,.85,v));float alpha=(1.-smoothstep(.67,1.,v))*(.40+.55*turbulence)*strength;gl_FragColor=vec4(col,alpha);}`});
   const flame=new T.Mesh(flameGeometry,flameMaterial);flame.frustumCulled=false;jet.add(flame);
   const core=new T.Mesh(flameGeometry,flameMaterial);core.scale.set(.48,.48,.65);jet.add(core);
   const glow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.position.z=-.12;glow.scale.set(.55,.55,1);jet.add(glow);
   jets.push({jet,material:flameMaterial,glow});
  }
  const nitroLight=new T.PointLight(0xff7627,0,5,2);nitroLight.position.set(0,.55,-3.05);body.add(nitroLight);
  W.scene.add(root);const car={root,body,wheels,tail,paint,contact,nitro:{group:nitroGroup,jets,light:nitroLight}};if(!remote)W.carMesh=car;return car;
 };
 return W;
})();
