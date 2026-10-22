import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function section(start,end){
 const from=html.indexOf(start),to=html.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,'Missing source section '+start);
 return html.slice(from,to);
}
const realFeedback=section('function publishedStudentFeedback(p)','const postColor =');
const realSimilar=section('function studentSimilarPreviewHtml(p)','/* ---------- chi tiết bài ---------- */');
const drawSource=section('function drawSide() {','let secT = 0;');
const encode=v=>String(v??'').replace(/[&<>"]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[k]));
function renderStudent(p,{peer=false,boardSettings={}}={}) {
 const side={innerHTML:''};
 const board={assignment:{maxScore:10,studentView:boardSettings}};
 const detail={id:p.id,key:'',m:{el:{}}};
 const S={guest:{id:'this-student'},meId:'this-student',grading:new Set()};
 const ctx={S,detail,document:{activeElement:null},console,getPost:()=>p,getBoard:()=>board,isGV:()=>false,isAdmin:()=>false,
   isTeacherAnnouncement:()=>false,peerPost:()=>peer,detailKey:()=> 'test-key',
   $:(sel)=>sel==='#pd-side'?side:null,$$:()=>[],
   ic:()=>'',esc:encode,vnTime:()=> '22/10/2026',fmt:v=>String(v),timeAgo:()=> 'vừa xong',
   drawMedia:()=>{},studentPracticeHtml:()=>'',studentPracticeSubmit:()=>{},
   finalScore:()=>peer?null:Number(p.teacher.score||0),studentCanEdit:()=>false,
   aiOn:()=>false,aiComment:()=>'',CAP:{},tmeta:()=>p.teacher};
 const run=vm.runInNewContext(realFeedback+'\n'+realSimilar+'\n'+drawSource+'\ndrawSide',ctx);
 assert.doesNotThrow(()=>run());
 return side.innerHTML;
}
test('Own approved legacy AI result always displays teacher comments in the right column',()=>{
 const p={id:'one',boardId:'cls',by:'hs',studentAcc:'this-student',studentName:'Học sinh A',
   teacher:{approvedAt:123,score:8.5,note:'Em cần trình bày rõ các bước giải.',comments:[]},
   ai:{diem:6},similarQuestions:[]};
 const result=renderStudent(p);
 assert.match(result,/Điểm và nhận xét của em/);
 assert.match(result,/8.5/);
 assert.match(result,/Nhận xét sau khi chấm/);
 assert.match(result,/Em cần trình bày rõ các bước giải/);
 assert.match(html,/\$\$\('\[data-st-pr-answer\]', el\)\.forEach/);
 assert.match(html,/\$\$\('\[data-st-pr-send\]', el\)\.forEach/);
 assert.match(result,/Bài tập tương tự/);
 assert.ok(result.length>200);
});
test('A preview opening an approved classmates submission displays publicly approved remarks',()=>{
 const p={id:'peer',boardId:'cls',by:'hs',studentAcc:null,studentName:'Học sinh B',
   teacher:{approvedAt:123,note:'Cần sửa lại phép tính cuối.',comments:[]},similarQuestions:[]};
 const result=renderStudent(p,{peer:true});
 assert.match(result,/Nhận xét bài làm/);
 assert.match(result,/Cần sửa lại phép tính cuối/);
 assert.match(result,/Điểm và nhận xét AI riêng của bạn không hiển thị/);
 assert.ok(result.length>200);
});
test('Teacher-photographed student work keeps published comments visible to class visitors',()=>{
 const p={id:'teacher-photo',boardId:'cls',by:'gv',studentAcc:null,studentName:'Học sinh C',
   teacher:{postType:'student_work',approvedAt:123,note:'Chữ viết rõ, cần đặt phép tính thẳng hàng.',comments:[]},
   similarQuestions:[]};
 const result=renderStudent(p,{peer:true});
 assert.match(result,/Nhận xét sau khi chấm/);
 assert.match(result,/Chữ viết rõ/);
 assert.match(result,/Điểm và nhận xét AI riêng của bạn không hiển thị/);
});
test('An old approved submission without AI result or written remarks still displays a clear message',()=>{
 const p={id:'old',boardId:'cls',by:'hs',studentAcc:'this-student',studentName:'Học sinh A',
  teacher:{approvedAt:123,score:0},ai:null,similarQuestions:[]};
 const result=renderStudent(p);
 assert.match(result,/Điểm và nhận xét của em/);
 assert.match(result,/Điểm: <strong>0 \/ 10/);
 assert.match(result,/chưa công bố nhận xét bằng chữ/);
});
test('Malformed student feedback does not leave the right column entirely blank',()=>{
 const p={id:'bad',boardId:'cls',by:'hs',studentAcc:'this-student',studentName:'Học sinh A',
  teacher:{approvedAt:123,score:4,comments:[null,{text:'Giáo viên góp ý',at:null}]},ai:{diem:4},similarQuestions:[]};
 const result=renderStudent(p);
 assert.match(result,/Điểm và nhận xét của em/);
 assert.match(result,/Giáo viên góp ý/);
});
