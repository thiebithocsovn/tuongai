import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {studentPost,studentSimilarQuestions} from '../supabase/functions/tuongai/student-visibility.ts';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const token='private-student-token-abcdef';
const question={id:'one',question:'Tính diện tích hình bình hành có đáy 5 cm, chiều cao 3 cm.',hint:'Nhớ công thức diện tích.',expectedAnswer:'15 cm²',successCriteria:'Phải giải đủ'};
const approved={id:'p1',board_id:'b1',by:'hs',student_token:token,student_name:'Học sinh A',body:'Bài toán',
  ai:{diem:7,nhan_xet:'AI chỉ gửi cho chủ bài',bai_tap:[{de:'Tìm diện tích hình bình hành có đáy 7, chiều cao 4.',loi_giai:'28 cm²'}]},
  teacher:{approvedAt:'2026-10-22T12:00:00.000Z',score:8,note:'Em cần chú ý phép tính.',comments:[{id:'c1',name:'Thầy giáo',text:'Sửa câu 2',at:42}],assist:{privateAnswer:'Bí mật'}}};
test('Approved peer sees comments and question-only similar exercises, never scores or private AI analysis',()=>{
  const peer=studentPost(approved,false,'Giáo viên');
  assert.equal(peer.teacher.note,'Em cần chú ý phép tính.');
  assert.equal(peer.teacher.comments[0].text,'Sửa câu 2');
  assert.equal(peer.teacher.score,undefined);
  assert.equal(peer.ai,null);
  assert.equal(peer.visibility,'class');
  assert.equal(peer.similar_questions.length,1);
  assert.equal(peer.similar_questions[0].question,'Tìm diện tích hình bình hành có đáy 7, chiều cao 4.');
  assert.equal(peer.similar_questions[0].origin,'ai');
  assert.ok(!JSON.stringify(peer).includes('28 cm²'));
  assert.ok(!JSON.stringify(peer).includes('Bí mật'));
  assert.ok(!JSON.stringify(peer).includes('"diem":7'));
});
test('Teachers can hide comments and similar exercises for the whole class',()=>{
  const hidden=studentPost(approved,false,'',{showFeedback:false,showSimilar:false});
  assert.equal(hidden.teacher.note,undefined);
  assert.equal(hidden.teacher.comments,undefined);
  assert.equal(hidden.similar_questions.length,0);
  assert.equal(hidden.teacher.score,undefined);
  assert.equal(hidden.ai,null);
  const own=studentPost(approved,true,'',{showFeedback:false,showSimilar:false});
  assert.equal(own.teacher.score,8);
  assert.equal(own.ai,null);
});
test('Undeclared and unapproved information is never published',()=>{
  const draft={...approved,teacher:{score:7,note:'Nháp riêng',assist:approved.teacher.assist}};
  assert.deepEqual(studentSimilarQuestions(draft),[]);
  const peer=studentPost(draft,false);
  assert.equal(peer.teacher.note,undefined);
  assert.equal(peer.similar_questions.length,0);
});
test('Teacher-approved similar questions expose no expected answers or criteria',()=>{
  const assigned={...approved,teacher:{...approved.teacher,assist:{similar:{status:'assigned',exercises:[question]}}}};
  const peer=studentPost(assigned,false);
  assert.equal(peer.similar_questions[0].question,question.question);
  assert.equal(peer.similar_questions[0].hint,question.hint);
  assert.equal(peer.similar_questions[0].origin,'teacher');
  assert.ok(!JSON.stringify(peer).includes('expectedAnswer'));
  assert.ok(!JSON.stringify(peer).includes('successCriteria'));
  assert.ok(!JSON.stringify(peer).includes('15 cm²'));
});
test('The right-hand column explicitly renders student peer feedback and similar tasks',()=>{
  assert.match(html,/if \(!gv && peerPost\(p\)\) \{/);
  assert.match(html,/studentFeedbackDetail\(p\)\+studentSimilarPreviewHtml\(p\)/);
  assert.match(html,/Điểm và nhận xét AI riêng của bạn không hiển thị/);
  assert.match(html,/function studentSimilarPreviewHtml\(p\)/);
  assert.match(html,/similarQuestions: r\.similar_questions \|\| \[\]/);
  assert.match(html,/id="bf-feedback"/);
  assert.match(html,/id="bf-similar"/);
  assert.match(html,/studentView: \{ showFeedback: \$\('#bf-feedback', el\)\.checked, showSimilar: \$\('#bf-similar', el\)\.checked \}/);
});
test('Public class link shows approved teacher feedback without authenticating as a student',()=>{
  const context={S:{guest:{preview:true,id:'preview-class'},meId:'preview-class'},getBoard:()=>({assignment:{studentView:{showFeedback:true}}}),ic:()=>'',esc:(x)=>String(x),vnTime:()=>'',isGV:()=>false,ME:()=>null};
  const start=html.indexOf('function publishedStudentFeedback(p)'),end=html.indexOf('const postColor =',start);
  assert.ok(start>=0&&end>start);
  const feedback=vm.runInNewContext(html.slice(start,end)+'\nstudentFeedbackDetail',context);
  const publicPost=studentPost(approved,false,'',{showFeedback:true,showSimilar:true});
  const peer={...publicPost,boardId:'b1',studentAcc:null};
  assert.match(feedback(peer),/Nhận xét sau khi chấm/);
  assert.match(feedback(peer),/Em cần chú ý phép tính/);
  assert.match(feedback(peer),/Sửa câu 2/);
  assert.ok(!feedback(peer).includes('Điểm: 8'));
  const noComment={...peer,teacher:{approvedAt:123}};
  assert.match(feedback(noComment),/chưa công bố nhận xét bằng chữ/);
  assert.match(html,/api\('student_feed', \{ code \}\)/);
});
test('Opening the shared student link displays approved teacher remarks directly under each post AND in the eye viewer',()=>{
  const context={S:{guest:{preview:true,id:'anonymous-viewer'},meId:'anonymous-viewer'},
    getBoard:()=>({assignment:{studentView:{showFeedback:true}}}),isTeacherAnnouncement:p=>p?.teacher?.postType==='announcement',
    ic:()=>'<svg></svg>',esc:(x)=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    vnTime:()=>''};
  const start=html.indexOf('function publishedStudentFeedback(p)'),end=html.indexOf('const postColor =',start);
  const view=vm.runInNewContext(html.slice(start,end)+'\n({studentFeedbackInlineHtml,studentFeedbackDetail})',context);
  const approvedPeer=studentPost(approved,false,'',{showFeedback:true});
  const peer={...approvedPeer,boardId:'b1',studentAcc:null};
  const wall=view.studentFeedbackInlineHtml(peer);
  const detail=view.studentFeedbackDetail(peer);
  assert.match(wall,/Nhận xét của giáo viên sau khi chấm/);
  assert.match(wall,/Em cần chú ý phép tính/);
  assert.match(wall,/Sửa câu 2/);
  assert.match(wall,/data-act="open-post"/);
  assert.match(wall,/Xem bài và nhận xét đầy đủ/);
  assert.match(detail,/Nhận xét sau khi chấm/);
  assert.match(detail,/Em cần chú ý phép tính/);
  assert.match(detail,/Sửa câu 2/);
  assert.ok(!wall.includes('AI chỉ gửi cho chủ bài'));
  assert.ok(!wall.includes('Bí mật'));
  assert.ok(!wall.includes('Điểm: 8'));
  assert.equal(peer.teacher.score,undefined);
  assert.match(html,/!gv && approved \? studentFeedbackInlineHtml\(p\)/);
  assert.match(html,/!gv && approved \? '📝 Xem bài và nhận xét'/);
});
test('The wall never exposes draft comments, hidden class feedback, teacher announcements or unsafe HTML',()=>{
  let hidden=false;
  const context={S:{guest:{preview:true,id:'anonymous-viewer'},meId:'anonymous-viewer'},
    getBoard:()=>({assignment:{studentView:{showFeedback:!hidden}}}),
    isTeacherAnnouncement:p=>p?.teacher?.postType==='announcement',
    ic:()=>'',esc:(v)=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),vnTime:()=>''};
  const start=html.indexOf('function publishedStudentFeedback(p)'),end=html.indexOf('const postColor =',start);
  const inline=vm.runInNewContext(html.slice(start,end)+'\nstudentFeedbackInlineHtml',context);
  const draft={id:'draft',boardId:'b1',by:'hs',studentAcc:null,teacher:{note:'Không công bố'}};
  assert.equal(inline(draft),'');
  const teacher={id:'notice',boardId:'b1',by:'gv',teacher:{postType:'announcement',approvedAt:123,note:'Thông báo'}};
  assert.equal(inline(teacher),'');
  const escaped=studentPost({...approved,teacher:{...approved.teacher,note:'<img src=x onerror="alert(1)">'}},false);
  const post={...escaped,boardId:'b1',studentAcc:null};
  assert.ok(!inline(post).includes('<img src=x'));
  assert.match(inline(post),/&lt;img/);
  // Separate class settings API strips feedback for every student; UI still guards disabled state.
  const suppressed=studentPost(approved,false,'',{showFeedback:false});
  assert.equal(suppressed.teacher.note,undefined);
  assert.equal(suppressed.teacher.comments,undefined);
  assert.equal(inline({...suppressed,boardId:'b1',studentAcc:null}).includes('Em cần chú ý phép tính'),false);
});
test('Student guest preview considers teacher-photographed student work a classmate post',()=>{
  const c={S:{guest:{preview:true,id:'preview-b1'},meId:'preview-b1',members:new Map()},getBoard:()=>null,isGV:()=>false,ME:()=>null};
  const start=html.indexOf('function isTeacherAnnouncement(p)'),end=html.indexOf('/* Browser-level deterrents',start);
  const fn=vm.runInNewContext(html.slice(start,end)+'\npeerPost',c);
  assert.equal(fn({by:'hs',studentAcc:null,teacher:{approvedAt:123}}),true);
  assert.equal(fn({by:'gv',studentAcc:null,teacher:{postType:'student_work',approvedAt:123}}),true);
  assert.equal(fn({by:'gv',studentAcc:null,teacher:{postType:'announcement'}}),false);
});
test('All inline application scripts remain syntactically valid',()=>{
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(m[1].trim())assert.doesNotThrow(()=>new vm.Script(m[1]));
  }
});
