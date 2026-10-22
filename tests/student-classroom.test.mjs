import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {studentPost, ownsStudentPost, visibleToStudent, isTeacherAnnouncement} from '../supabase/functions/tuongai/student-visibility.ts';

const token='student-a-private-token';
const pending={id:'a',board_id:'class',by:'hs',student_token:token,body:'Bài A',ai:{diem:9},ai_at:'2026-10-20',teacher:{score:8.5,note:'Nháp riêng',comments:[{text:'Nháp'}],assist:{answer:'Đáp án bí mật'}}};
const approved={...pending,id:'b',student_token:'student-b-private-token',teacher:{...pending.teacher,approvedAt:123,privateDraft:'Không gửi',comments:[{id:'c',name:'Thầy cô',text:'Đã nhận xét',at:123,by:'teacher-id',draft:'Riêng'}]}};

test('Unapproved results are hidden even from the owner; graded work remains locked',()=>{
  const p=studentPost(pending,true);
  assert.equal(p.ai,null);assert.equal(p.ai_at,null);assert.equal(p.teacher.score,undefined);
  assert.equal(p.teacher.note,undefined);assert.equal(p.teacher.comments,undefined);
  assert.equal(p.graded,true);assert.equal(p.editable,false);
  assert.equal(JSON.stringify(p).includes('bí mật'),false);
});
test('Only the owning token can see approved scores and AI results',()=>{
  assert.equal(ownsStudentPost(pending,token),true);
  assert.equal(ownsStudentPost(approved,token),false);
  const own=studentPost(approved,true),peer=studentPost(approved,false);
  assert.equal(own.teacher.score,8.5);assert.equal(own.ai.diem,9);
  assert.equal(peer.ai,null);assert.equal(peer.teacher.score,undefined);assert.equal(peer.editable,false);
  assert.equal(peer.teacher.note,'Nháp riêng');assert.equal(peer.teacher.comments[0].text,'Đã nhận xét');
  for(const p of [own,peer]){
    for(const key of ['student_token','owner','assist','privateDraft','draft'])assert.equal(JSON.stringify(p).includes('"'+key+'"'),false);
  }
});
test('Classroom visibility cannot be claimed by an empty or another student token',()=>{
  assert.equal(visibleToStudent(pending,''),false);
  assert.equal(visibleToStudent(pending,'another-student-token'),false);
  assert.equal(visibleToStudent(pending,token),true);
  assert.equal(visibleToStudent(approved,''),true);
  assert.equal(ownsStudentPost({...pending,student_token:''},''),false);
});
test('Teacher posts are published to every class visitor without grade approval',()=>{
  const teacherPost={...pending,id:'teacher-announcement',by:'gv',student_token:null,body:'Làm bài tập trang 10',ai:null,ai_at:null,
    teacher:{postType:'announcement',assist:{answer:'Không công khai đáp án'},score:9,note:'Nhận xét riêng'},
    attachments:[{name:'Huong-dan.docx',path:'teacher/lesson.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:100}]};
  assert.equal(visibleToStudent(teacherPost,''),true);
  assert.equal(visibleToStudent(teacherPost,'another-student-token'),true);
  const p=studentPost(teacherPost,false);
  assert.equal(p.visibility,'class');
  assert.equal(p.teacher.postType,'announcement');
  assert.equal(p.editable,false);
  assert.equal(p.body,'Làm bài tập trang 10');
  assert.equal(p.attachments[0].path,'teacher/lesson.docx');
  assert.equal(p.attachments[0].viewOnly,false);
  assert.equal(p.teacher.score,undefined);
  assert.equal(p.teacher.note,undefined);
  assert.equal(p.ai,null);
  assert.equal(JSON.stringify(p).includes('Không công khai đáp án'),false);
  assert.equal(visibleToStudent(pending,'another-student-token'),false);
});
test('Teacher-photographed student work stays hidden until approval',()=>{
  const captured={...pending,id:'captured',by:'gv',student_name:'Em Mai',student_token:null,
    teacher:{postType:'student_work',assist:{answer:'Đáp án riêng'}},
    attachments:[{name:'Bai.doc',path:'secret/private.doc',type:'application/msword'}]};
  assert.equal(isTeacherAnnouncement(captured,'Nguyễn Trung Tuyền'),false);
  assert.equal(visibleToStudent(captured,'' ,'Nguyễn Trung Tuyền'),false);
  assert.equal(studentPost(captured,false,'Nguyễn Trung Tuyền').attachments[0].path,'');
  assert.equal(visibleToStudent({...captured,teacher:{...captured.teacher,approvedAt:123}},'', 'Nguyễn Trung Tuyền'),true);
  const legacy={...captured,student_name:'Nguyễn Trung Tuyền',teacher:{}};
  assert.equal(isTeacherAnnouncement(legacy,'Nguyễn Trung Tuyền'),true);
  assert.equal(visibleToStudent(legacy,'','Nguyễn Trung Tuyền'),true);
});

test('Class wall includes teacher posts immediately without exposing pending student work',()=>{
  assert.match(html,/p\.by === 'gv' \|\| p\.studentAcc === me\.id/);
  assert.match(html,/case 'publish-class': if \(b && canManage\(b\)\)/);
  assert.match(html,/Bài giáo viên · Cả lớp xem/);
  assert.match(html,/publishToClass \? \(me\?\.name \|\| ownerLabel\(b\)/);
  assert.match(html,/teacher: asTeacher \? \{ postType: publishToClass \? 'announcement' : 'student_work' \}/);
  assert.match(html,/if \(isTeacherAnnouncement\(p\)\) \{/);
  assert.match(html,/const reviewPosts = .* !isTeacherAnnouncement\(p\)/);
  assert.match(html,/if \(!announcement && autoGrade && gv/);
});

test('Unsupported peer attachments never expose the original path',()=>{
  const p={...approved,attachments:[{name:'Bài.doc',path:'private/original.doc',type:'application/msword',size:1},{name:'Bài.pdf',path:'private/preview.pdf',type:'application/pdf',size:2}]};
  assert.equal(studentPost(p,false).attachments[0].path,'');
  assert.equal(studentPost(p,false).attachments[0].viewOnly,true);
  assert.equal(studentPost(p,true).attachments[0].path,'private/original.doc');
  assert.equal(studentPost(p,false).attachments[1].path,'private/preview.pdf');
});

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function frontend(){
  const storage=()=>{const m=new Map();return{get:k=>m.get(k)||null,set:(k,v)=>m.set(k,v),del:k=>m.delete(k)}};
  const listeners={};
  const context={LS:storage(),SS:storage(),K_GUEST:'tuongai.guest',S:{posts:new Map(),boards:new Map(),members:new Map(),grading:new Set(),meId:'a',guest:{id:'a'}},
    ts:v=>Date.parse(v)||0,isNum:v=>typeof v==='number'&&Number.isFinite(v),rememberUrls:()=>{},pubToBoard:b=>b,SIGNED:new Map(),now:()=>Date.now(),
    document:{addEventListener:(name,fn)=>listeners[name]=fn},window:{getSelection:()=>null},Element:class{},
    $:()=>null,$:()=>[],detail:null,getPost:()=>null,getBoard:()=>null,isGV:()=>false,ME:()=>null,listeners};
  const code=section('const rowToPost =','const postToRow =')+'\n'+section('function readGuest()','async function addGuestBoard')+'\n'+section('function isTeacherAnnouncement(p)','function status(p)')+'\n({readGuest,saveGuest,applyStudentFeed,rowToPost,finalScore,studentCanEdit,peerPost,isTeacherAnnouncement})';
  const methods=vm.runInNewContext(code,context);
  return {context,methods,listeners};
}
test('Closing a tab preserves the student identity and accepts legacy session storage',()=>{
  const {context:c,methods:m}=frontend();
  const student={id:'a',name:'Học sinh A',token,codes:['ABC123'],role:'hs'};
  c.S.guest=student;m.saveGuest();
  c.SS.del('tuongai.guest');
  assert.deepEqual(JSON.parse(JSON.stringify(m.readGuest())),student);
  c.LS.del('tuongai.guest');c.SS.set('tuongai.guest',JSON.stringify(student));
  assert.equal(m.readGuest().token,token);
  c.S.guest={preview:true,id:'preview'};m.saveGuest();
  assert.equal(m.readGuest().token,token);
});
test('Feed refresh retains own identity and removes posts no longer approved',()=>{
  const {context:c,methods:m}=frontend();
  c.S.posts.set('old',{id:'old',boardId:'class'});c.S.posts.set('other',{id:'other',boardId:'other-class'});
  m.applyStudentFeed({posts:[{...studentPost(pending,true)},{...studentPost(approved,false)}]},c.S.guest,{id:'class'});
  assert.equal(c.S.posts.has('old'),false);assert.equal(c.S.posts.has('other'),true);
  assert.equal(c.S.posts.get('a').studentAcc,'a');assert.equal(c.S.posts.get('b').studentAcc,null);
  assert.equal(m.applyStudentFeed({posts:[{...studentPost(pending,true)},{...studentPost(approved,false)}]},c.S.guest,{id:'class'}),false);
  assert.equal(m.finalScore(c.S.posts.get('a')),null);assert.equal(m.finalScore(c.S.posts.get('b')),null);
  assert.equal(m.studentCanEdit(c.S.posts.get('a')),false);
  const ownApproved=m.rowToPost(studentPost({...approved,id:'a'},true),'a');
  assert.equal(m.finalScore(ownApproved),8.5);
  assert.equal(m.studentCanEdit(m.rowToPost(studentPost({...pending,ai:null,ai_at:null,teacher:null},true),'a')),true);
  c.S.guest=null;assert.equal(m.finalScore({...pending,teacher:{score:8.5}}),8.5);
});
test('Copy and save deterrents affect peer work while leaving own work usable',()=>{
  const {context:c,listeners}=frontend();
  const peer=new c.Element();peer.closest=()=>peer;
  const own=new c.Element();own.closest=()=>null;
  for(const type of ['copy','cut','contextmenu','dragstart','selectstart']){
    let prevented=false;listeners[type]({target:peer,preventDefault:()=>prevented=true});assert.equal(prevented,true,type);
    prevented=false;listeners[type]({target:own,preventDefault:()=>prevented=true});assert.equal(prevented,false,type);
  }
  let prevented=false;listeners.keydown({target:peer,ctrlKey:true,key:'s',preventDefault:()=>prevented=true});assert.equal(prevented,true);
});
