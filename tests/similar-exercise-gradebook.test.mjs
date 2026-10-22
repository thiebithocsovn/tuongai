import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/tuongai/index.ts',import.meta.url),'utf8');
const start=html.indexOf('function similarStudentName('),end=html.indexOf('/* Đề tương tự đã lọc',start);
assert.ok(start>=0&&end>start);
const helper=html.slice(start,end);
const uiStart=html.indexOf('function studentSimilarPreviewHtml(p) {'),uiEnd=html.indexOf('/* ---------- chi tiết bài ---------- */',uiStart);
const ui=html.slice(uiStart,uiEnd);
const escape=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const post={id:'post',boardId:'board',by:'hs',studentAcc:null,studentName:'Học sinh A',
  teacher:{approvedAt:123},similarQuestions:[{question:'Tính diện tích hình bình hành có đáy 9 cm và cao 4 cm.',hint:'Diện tích = đáy × chiều cao'}]};
function render({name='',attempts=[],showSimilar=true,sourcePost=post,guest={preview:true}}={}){
 const detail={id:'post',similarName:name,similarAttempts:attempts,similarDrafts:{},similarBusy:'',similarError:'',similarMessage:''};
 const S={guest,meId:'viewer'};
 const b={code:'ABC123',assignment:{studentView:{showSimilar}}};
 const ctx={detail,S,CAP:{aiReady:false},getBoard:()=>b,ic:()=>'',esc:escape,vnTime:()=> '23/10/2026',fmt:String,deviceToken:()=> 'a'.repeat(32),
   guestId:()=> 'g_1234',SS:{get:()=>''},api:()=>{throw Error('not connected')}};
 const fn=vm.runInNewContext(helper+'\n'+ui+'\nstudentSimilarPreviewHtml',ctx);
 return String(fn(sourcePost));
}
test('Student can submit an AI-derived similar question directly below the pupil review using class link',()=>{
 const result=render();
 assert.match(result,/Bài tập tương tự/);
 assert.match(result,/Nộp bài tập tương tự/);
 assert.match(result,/data-sim-name/);
 assert.match(result,/data-sim-answer="0"/);
 assert.match(result,/data-sim-send="0"/);
 assert.match(result,/giáo viên/i);
 assert.ok(!result.includes('expectedAnswer'));
});
test('When no similar worksheet exists, pupils can supply a similar question and hand in a worked answer',()=>{
 const result=render({sourcePost:{...post,similarQuestions:[]}});
 assert.match(result,/data-sim-question/);
 assert.match(result,/data-sim-answer="-1"/);
 assert.match(result,/data-sim-send="-1"/);
 assert.match(result,/Đề bài tương tự em chọn/);
 assert.match(result,/Nộp bài tập tương tự/);
 assert.match(edge,/index===-1 && !questions.length/);
 assert.match(edge,/exercise_question:task.question/);
});
test('Students can see only own provisional AI evaluation or final locked assessment',()=>{
 const pending=render({name:'Em A',attempts:[{id:'1',exercise_key:'q0',response:'S = 9 × 4 = 36',ai_score:9,ai_note:'Đúng phép tính'}]});
 assert.match(pending,/AI chấm sơ bộ/);
 assert.match(pending,/Đang chờ giáo viên khóa sổ/);
 assert.match(pending,/Nộp lại lời giải/);
 const closed=render({name:'Em A',attempts:[{id:'1',exercise_key:'q0',response:'S = 36',teacher_score:10,teacher_note:'Lập luận đúng',locked_at:'2026-10-23'}]});
 assert.match(closed,/Đã khóa sổ/);
 assert.match(closed,/10\/10/);
 assert.match(closed,/Lập luận đúng/);
 assert.doesNotMatch(closed,/data-sim-send="0"/);
 assert.match(closed,/disabled/);
});
test('Preview honors teacher sharing controls and approval',()=>{
 assert.equal(render({showSimilar:false}),'');
 assert.equal(render({sourcePost:{...post,teacher:{}}}),'');
});
test('Teacher gradebook shows submission, preliminary AI grade and requires a deliberate lock step',()=>{
 const ctx={detail:{teacherSimilar: [{id:'a',student_name:'Học sinh A',exercise_key:'q0',submitted_at:'2026-10-23',response:'36 cm²',ai_score:9,ai_note:'Tính đúng'}],
  teacherSimilarSummary:{submitted:1,locked:0,average_score:null,original_score:7},teacherSimilarLoaded:true,teacherSimilarLoading:false},
  CAP:{aiReady:false},ic:()=>'',esc:escape,vnTime:()=> '23/10/2026',fmt:String};
 const fn=vm.runInNewContext(helper+'\nteacherSimilarReviewHtml',ctx);
 const out=String(fn(post));
 assert.match(out,/Chấm và khóa sổ/);
 assert.match(out,/AI đề xuất/);
 assert.match(out,/data-pd="sim-teacher-lock"/);
 assert.match(out,/data-sim-teacher-score/);
 assert.match(out,/Đã nộp:/);
 assert.match(out,/Điểm bài gốc: 7/);
});
test('Server authenticates teacher before finalized scores and checks lock to forbid later edits',()=>{
 for(const action of ['similar_attempt_submit','similar_attempt_mine','similar_attempts_teacher','similar_attempt_ai_grade','similar_attempt_finalize']){
  assert.ok(edge.includes('case "'+action+'"'),action);
 }
 assert.match(edge,/if\(attempt.locked_at\) throw new Fail\("locked"/);
 assert.match(edge,/\.is\("locked_at",null\)/);
 assert.match(edge,/needActive\(me\)/);
 assert.match(edge,/similarQuestion\(post,index,str\(body.question,2000\)\)/);
 assert.match(edge,/student_token",token/);
 assert.match(edge,/aiGradeSimilar\(/);
 assert.match(edge,/teacher_score:Math.round\(score\*4\)\/4/);
 assert.match(edge,/teacher_note:str\(body.note,2000\)/);
});
test('Photographed practice solutions can be graded by AI and reviewed by teacher privately',()=>{
 assert.match(html,/data-sim-photo/);
 assert.match(html,/capture="environment"/);
 assert.match(html,/d\.similarPhotos\[key\]=await blobB64\(blob\)/);
 assert.match(html,/image:d\.similarPhotos\?\.\[key\]\|\|''/);
 assert.match(html,/teacher-similar-photo/);
 assert.match(edge,/decodeBase64\(image\)/);
 assert.match(edge,/db\.storage\.from\("work"\)\.upload\(path/);
 assert.match(edge,/db\.storage\.from\("work"\)\.download\(item.image_path\)/);
 assert.match(edge,/images:await signed\(/);
});
test('All inline JS remains valid with both student and teacher forms',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim())assert.doesNotThrow(()=>new vm.Script(m[1]));
 }
});
