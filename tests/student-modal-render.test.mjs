import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('/* ---------- chi tiết bài ---------- */');
const end=html.indexOf('function refreshDetail()',start);
assert.ok(start!==-1 && end>start);
const source=html.slice(start,end);
function openGuestDetail(opts={}){
 const calls=[];
 const post={id:'sample',boardId:'board',studentName:'Học sinh A',by:'hs',studentAcc:null,text:'',images:[{k:'s',path:'private-image'}],
   attachments:opts.attachments||[],teacher:{approvedAt:123,note:'Giáo viên góp ý: chú ý cách trình bày.'}};
 const board={name:'Lớp 8A4',assignment:{studentView:{showFeedback:true},maxScore:10}};
 const media={dataset:{},innerHTML:''},sidebar={dataset:{},innerHTML:''};
 const modal={el:{},close:()=>{}};
 const $=(selector)=>selector==='#pd-media'?media:selector==='#pd-side'?sidebar:null;
 const $$=(selector)=>{calls.push(selector);return []};
 const context={S:{guest:{preview:true},meId:'preview'},SIGNED:new Map(),window:{TuongAiFilePreview:{dispose:()=>{}}},
   getPost:()=>post,getBoard:()=>board,isGV:()=>false,isTeacherAnnouncement:()=>false,SS:{get:()=>''},studentSimilarRefresh:()=>{},
   peerPost:()=>true,openModal:()=>modal,drawSide:()=>{calls.push('sidebar');sidebar.innerHTML='<section>Giáo viên góp ý: chú ý cách trình bày.</section>';},
   $,$$,splitLinks:()=>({text:'',links:[]}),postImageSrcs:()=>['https://example.test/image.jpg'],
   now:()=>123,esc:String,attachmentList:()=>'',previewPeerFile:()=>{},previewAttachmentFile:()=>{},
   studentPracticeRefresh:()=>{},openViewer:()=>{},runGrade:()=>{},
   console,ctlOf:new Map(),setTimeout,focus:'',timeAgo:()=>''};
 const fn=vm.runInNewContext(source+'\nopenDetail',context);
 assert.doesNotThrow(()=>fn('sample',false));
 return {media,sidebar,calls};
}
test('Eye viewer renders the comments pane even when only images and no file buttons exist',()=>{
 const {media,sidebar,calls}=openGuestDetail();
 assert.match(media.innerHTML,/post-image-wrap/);
 assert.match(sidebar.innerHTML,/Giáo viên góp ý/);
 assert.ok(calls.indexOf('sidebar')!==-1);
 assert.ok(calls.indexOf('sidebar')<calls.indexOf('[data-peer-file]'));
 assert.ok(calls.includes('[data-view-file]'));
});
test('The two file button selectors in the media view use querySelectorAll, never querySelector',()=>{
 assert.match(source,/\$\$\('\[data-peer-file\]', el\)\.forEach/);
 assert.match(source,/\$\$\('\[data-view-file\]', el\)\.forEach/);
 assert.doesNotMatch(source,/(^|[^\$])\$\('\[data-(?:peer|view)-file\]', el\)\.forEach/m);
});
test('Media viewer errors cannot stop comments from rendering',()=>{
 assert.match(source,/drawSide\(\);\s*try \{ drawMedia\(\); \}/);
 assert.match(source,/console\.warn\('Không thể khởi tạo một số nút xem tệp bài làm:'\, error\)/);
});
