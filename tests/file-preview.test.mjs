import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const viewer=fs.readFileSync(new URL('../file-preview.js',import.meta.url),'utf8');

test('Classroom file preview loads before the application and provides an eye action',()=>{
  assert.match(html,/<script src="\.\/file-preview\.js"><\/script>/);
  assert.ok(html.indexOf('src="./file-preview.js"')<html.indexOf('function previewAttachmentFile('));
  assert.match(html,/data-view-file="\$\{i\}"/);
  assert.match(html,/data-file-preview="\$\{i\}"/);
  assert.match(html,/function previewAttachmentFile\(p,index,button\)/);
  assert.match(html,/TuongAiFilePreview\?\.dispose\(m\.el\)/);
  assert.match(html,/TuongAiFilePreview\?\.dispose\(el\)/);
  assert.match(html,/data-view-file.*aria-expanded/);
  for(const ext of ["jpg:'image/jpeg'","png:'image/png'","webp:'image/webp'","gif:'image/gif'"]){
    assert.ok(html.includes(ext),ext);
  }
});
test('Inline browser scripts and the file preview renderer have valid syntax',()=>{
  assert.doesNotThrow(()=>new vm.Script(viewer));
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(m[1].trim()) assert.doesNotThrow(()=>new vm.Script(m[1]));
  }
});
function makeViewer() {
  const revoked=[];
  const win={};
  const context={
    window:win,WeakMap,Map,AbortController,URL:{
      createObjectURL:()=> 'blob:preview-image',revokeObjectURL:(url)=>revoked.push(url)
    },Blob,TextDecoder,
    fetch:async()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([137,80,78,71]).buffer}),
    document:{head:{appendChild:()=>{}},createElement:()=>({})}
  };
  vm.runInNewContext(viewer,context);
  return {api:win.TuongAiFilePreview,revoked};
}
test('The eye viewer shows legacy-format guidance without uploading documents elsewhere',async()=>{
  const {api}=makeViewer();
  const el={isConnected:true,hidden:true,innerHTML:'',querySelectorAll:()=>[]};
  await api.render(el,{name:'Bai-tap.doc'},'https://storage.example/private');
  assert.equal(el.hidden,false);
  assert.match(el.innerHTML,/DOCX/);
  assert.doesNotMatch(el.innerHTML,/<iframe/);
  api.close(el);
});
test('Image preview is displayed inside the page and releases temporary URLs on close',async()=>{
  const {api,revoked}=makeViewer();
  const el={isConnected:true,hidden:true,innerHTML:'',querySelectorAll:()=>[]};
  await api.render(el,{name:'Anh-huong-dan.png'},'https://storage.example/private');
  assert.match(el.innerHTML,/fp-image-wrap/);
  assert.match(el.innerHTML,/blob:preview-image/);
  api.close(el);
  assert.deepEqual(revoked,['blob:preview-image']);
});
test('Viewer escapes any user file name before inserting it into HTML',async()=>{
  const {api}=makeViewer();
  const el={isConnected:true,hidden:true,innerHTML:'',querySelectorAll:()=>[]};
  await api.render(el,{name:'<svg onload=alert(1)>.doc'},'https://storage.example/private');
  assert.doesNotMatch(el.innerHTML,/<svg onload/);
});
