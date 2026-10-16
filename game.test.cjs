const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
for(const name of ['physics','nitro','water','ramp','aura','island','garage','traffic']){
 test('original game: '+name,()=>{
  const result=spawnSync(process.execPath,[path.join(__dirname,'regression',name+'-check.cjs')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}
