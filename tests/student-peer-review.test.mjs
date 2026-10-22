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
test('All inline application scripts remain syntactically valid',()=>{
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(m[1].trim())assert.doesNotThrow(()=>new vm.Script(m[1]));
  }
});
