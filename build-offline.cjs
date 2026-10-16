'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'public'),out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>\n'+fs.readFileSync(path.join(dir,'style.css'),'utf8')+'\n</style>');
for(const name of ['three.min.js','world.js','islands.js','ramps.js','physics.js','aura.js','garage.js','traffic.js','multiplayer.js','game.js']){
 const js=fs.readFileSync(path.join(dir,name),'utf8');
 html=html.replace('<script src="'+name+'"></script>',()=>'<script>\n'+js.replace(/<\/script/gi,'<\\/script')+'\n</script>');
}
const license=fs.readFileSync(path.join(dir,'THREE-LICENSE.txt'),'utf8');
html=html.replace('<!doctype html>','<!doctype html>\n<!-- Three.js license:\n'+license.replace(/--/g,'—')+'\n-->');
fs.writeFileSync(path.join(out,'ISLA-Drive.html'),html);
console.log('Saved dist/ISLA-Drive.html');
