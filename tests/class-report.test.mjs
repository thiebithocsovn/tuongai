import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const engine=fs.readFileSync(new URL('../class-report.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../class-report-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const env={window:{}};
vm.runInNewContext(engine,env);
const board={id:'board-1',name:'Toán 8A',school:'Trường thử nghiệm',
  subject:'Toán',grade:'8',assignment:{maxScore:10}};
const make=(id='p1',overrides={})=>({
  id,boardId:'board-1',by:'hs',studentName:'HS thử nghiệm',
  studentClass:'8A',studentToken:'student-device-token-abcdefgh',
  createdAt:Date.UTC(2026,10,10),body:'PRIVATE-STUDENT-WORK',
  ai:{diem:10,nhan_xet:'PRIVATE-AI-DRAFT'},
  teacher:{approvedAt:null},...overrides
});
const build=(posts,options={},b=board)=>
  JSON.parse(JSON.stringify(env.window.TuongAiClassReport.build(posts,b,options)));
const review=(opts={})=>({
  id:'review-1',
  review:{status:opts.status||'approved',at:Date.UTC(2026,10,10)},
  analysis:{errors:[{id:'err1',skill:'Hằng đẳng thức',
    decision:opts.decision||'confirmed',teacherCause:'Quên hai tích chéo',
    verificationEvidence:'HS giải thích bài làm khi được hỏi'}]},
  practice:{status:'assigned',exercises:[{id:'ex1',errorId:'err1'}],
    attempts:[{exerciseId:'ex1',verdict:'resolved',by:'teacher1',
      evidence:'GV đã đối chiếu phép khai triển',at:Date.UTC(2026,10,11)}]},
});
test('approved grades alone contribute to aggregate and approval rate',()=>{
  const p1=make('p1',{teacher:{approvedAt:Date.UTC(2026,10,10),score:8,note:'Nhận xét GV'}});
  const p2=make('p2',{teacher:{approvedAt:null},ai:{diem:10}});
  const r=build([p1,p2]);
  assert.equal(r.summary.submitted,2);
  assert.equal(r.summary.reviewed,1);
  assert.equal(r.summary.pending,1);
  assert.equal(r.summary.avgScore10,8);
  assert.equal(r.summary.approvalRate,50);
  assert.equal(r.entries[0].teacherComment,'Nhận xét GV');
  assert.equal(r.entries[1].teacherComment,'');
  assert.equal(JSON.stringify(r).includes('PRIVATE-STUDENT-WORK'),false);
  assert.equal(JSON.stringify(r).includes('PRIVATE-AI-DRAFT'),false);
  assert.equal(JSON.stringify(r).includes('student-device-token-abcdefgh'),false);
});
test('only confirmed teacher-grounded causes contribute to skill counts',()=>{
  const p=make('p1',{teacher:{approvedAt:Date.UTC(2026,10,10),score:7,
    assist:{a:review()}}});
  let r=build([p]);
  assert.equal(r.summary.confirmedErrors,1);
  assert.equal(r.topSkills[0].skill,'Hằng đẳng thức');
  assert.equal(r.summary.verifiedAttempts,1);
  assert.equal(r.summary.resolvedAttempts,1);
  p.teacher.assist.a.review.status='draft';
  r=build([p]);
  assert.equal(r.summary.confirmedErrors,0);
  p.teacher.assist.a.review.status='approved';
  p.teacher.assist.a.analysis.errors[0].decision='insufficient';
  r=build([p]);
  assert.equal(r.summary.confirmedErrors,0);
});
test('practice is only counted when teacher evidence and assigned task exist',()=>{
  const p=make('p1',{teacher:{approvedAt:Date.UTC(2026,10,10),score:7,
    assist:{a:review()}}});
  p.teacher.assist.a.practice.attempts[0].evidence='';
  let r=build([p]);
  assert.equal(r.summary.verifiedAttempts,0);
  assert.equal(r.summary.unassessedSkills,1);
  p.teacher.assist.a.practice.status='draft';
  r=build([p]);
  assert.equal(r.summary.verifiedAttempts,0);
  assert.equal(r.summary.unassessedSkills,1);
});
test('board scope, submission scope and time range are enforced',()=>{
  const p1=make('p1');
  const p2=make('p2',{boardId:'another-board'});
  const p3=make('p3',{by:'gv'});
  const p4=make('p4',{createdAt:Date.UTC(2026,9,1)});
  assert.equal(build([p1,p2,p3,p4]).summary.submitted,2);
  assert.equal(build([p1,p2,p3,p4],{
    startAt:Date.UTC(2026,10,1),endAt:Date.UTC(2026,10,30)}).summary.submitted,1);
});
test('empty report is not made up and recommendations disclose limits',()=>{
  const r=build([]);
  assert.equal(r.summary.submitted,0);
  assert.equal(r.summary.approvalRate,null);
  assert.equal(r.summary.avgScore10,null);
  assert.equal(r.topSkills.length,0);
  assert.match(r.recommendations[0],/Chưa có bài nộp/);
});
test('grades are normalized to board maximum, not AI scores',()=>{
  const b={...board,assignment:{maxScore:5}};
  const p=make('p',{teacher:{approvedAt:Date.UTC(2026,10,10),score:4}});
  assert.equal(build([p],{},b).summary.avgScore10,8);
});
test('interface integrates teacher permission guard, spreadsheet and PDF export',()=>{
  assert.match(html,/class-report\.js\?v=cr-20261110a/);
  assert.match(html,/class-report-ui\.js\?v=cr-20261110a/);
  assert.match(html,/data-act="class-report"/);
  assert.match(html,/case 'class-report': if \(b\) openClassReport\(b\)/);
  assert.match(html,/const canUse = \(\) =>/);
  assert.match(html,/!S\.guest && !latest\.demo && !latest\.trashed && canManage\(latest\)/);
  assert.match(ui,/root\.XLSX\.utils\.book_append_sheet/);
  assert.match(ui,/root\.print\(\)/);
  assert.match(ui,/NGƯỜI LẬP BÁO CÁO/);
  assert.doesNotMatch(engine,/(?:from\(|fetch\(|\.update\(|\.insert\(|\.delete\(|\bapi\()/);
  new vm.Script(engine);
  new vm.Script(ui);
});
