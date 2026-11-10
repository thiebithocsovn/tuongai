import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../progress-tracker.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../progress-tracker-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const model={window:{}};
vm.runInNewContext(script,model);
const build=(posts,board='b',max=10)=>
  JSON.parse(JSON.stringify(model.window.TuongAiProgressTracker.buildBoard(posts,board,max)));
function post(id,token='student-device-identifier-001',score=8,at=1000) {
  return {id,boardId:'b',by:'hs',studentName:'Học sinh thử',studentClass:'8A',
    studentToken:token,createdAt:at,teacher:{approvedAt:at+1,score}};
}
const review=(statuses,decision='confirmed')=>({
  id:'review-001',review:{status:'approved',at:1200},
  analysis:{errors:[{id:'e1',skill:'Hằng đẳng thức',decision,
    teacherCause:'Nhầm quy tắc',verificationEvidence:'Học sinh giải thích nhầm phép nhân'}]},
  practice:{id:'prac-001',status:'assigned',
    exercises:[{id:'x1',errorId:'e1'},{id:'x2',errorId:'e1'}],
    attempts:statuses.map((verdict,i)=>({exerciseId:'x'+(i+1),
      verdict,by:'teacher-1',evidence:'Đối chiếu bài làm đã nộp',at:1500+i}))}
});
test('only approved teacher scores count, never unapproved AI predictions',()=>{
  const a=post('1','student-device-identifier-001',6,1000);
  const b=post('2','student-device-identifier-001',9,2000);
  const c=post('3','student-device-identifier-001',10,3000);
  c.teacher={};c.ai={diem:10};
  const out=build([a,b,c]);
  assert.equal(out.students.length,1);
  assert.equal(out.summary.reviewedScores,2);
  assert.equal(out.summary.pendingPosts,1);
  assert.equal(out.students[0].scoreAverage,7.5);
  assert.equal(out.students[0].scoreDelta,3);
});
test('all exercises with teacher evidence and resolved verdict confirm a skill',()=>{
  const p=post('1');p.teacher.assist={a:review(['resolved','resolved'])};
  const out=build([p]);
  assert.equal(out.summary.verifiedAttempts,2);
  assert.equal(out.summary.skillsResolved,1);
  assert.equal(out.students[0].skills[0].status,'resolved');
});
test('one improving exercise or evidence missing means not resolved',()=>{
  const p=post('1');p.teacher.assist={a:review(['resolved','improving'])};
  assert.equal(build([p]).students[0].skills[0].status,'improving');
  p.teacher.assist.a.practice.attempts[1].evidence='';
  assert.equal(build([p]).students[0].skills[0].status,'unassessed');
});
test('AI drafts and insufficient causes create no verified skills',()=>{
  const p=post('1');p.teacher.assist={a:review(['resolved','resolved'])};
  p.teacher.assist.a.review.status='draft';
  assert.equal(build([p]).students[0].skillsTotal,0);
  p.teacher.assist.a.review.status='approved';
  p.teacher.assist.a.analysis.errors[0].decision='insufficient';
  assert.equal(build([p]).students[0].skillsTotal,0);
});
test('new confirmed unresolved skill cannot inherit previously resolved label',()=>{
  const p=post('1');const first=review(['resolved','resolved']);
  const newCycle=review(['resolved','resolved']);newCycle.id='review-002';newCycle.practice=null;
  p.teacher.assist={history:[first],a:newCycle};
  assert.equal(build([p]).students[0].skills[0].status,'unassessed');
});
test('different device identifiers with same student name remain separate',()=>{
  const a=post('1','device-identifier-111111111');
  const b=post('2','device-identifier-222222222');
  const c=post('3','',6,3000);
  const out=build([a,b,c]);
  assert.equal(out.students.length,3);
  assert.equal(out.students.filter(s=>s.identityConfidence==='name_only').length,1);
});
test('other class and teacher-only posts are excluded',()=>{
  const a=post('1'),b=post('2'),c=post('3');
  b.boardId='other';c.by='gv';
  assert.equal(build([a,b,c]).students.length,1);
});
test('different maximum scores normalize to ten-point scale',()=>{
  const x=post('1','device-identifier-111111111',4);
  const out=build([x],'b',5);
  assert.equal(out.students[0].approvedScores[0].value,8);
});
test('board toolbar opens the standalone dashboard with authorized app data',async()=>{
  assert.match(html,/progress-tracker\.js\?v=pt-20261110a/);
  assert.match(html,/progress-tracker-ui\.js\?v=pt-20261110b/);
  assert.match(html,/data-act="progress-tracker"/);
  assert.match(html,/function asProgress\(p\)[\s\S]*TuongAiProgressTracker/);

  const window={};
  vm.runInNewContext(script, {window});
  vm.runInNewContext(ui, {window});
  const board={id:'b',name:'Toán 8A'};
  const posts=[post('1',undefined,0),post('2',undefined,10,2000),
    {...post('3'),boardId:'other',studentName:'Học sinh bảng khác'}];
  const filter={},search={},refresh={};
  const detail={dataset:{ptDetail:'0'}},evidence={dataset:{ptOpen:'2'}};
  const panel={isConnected:true,innerHTML:'',
    querySelector:selector=>({'#pt-filter':filter,'#pt-search':search,'#pt-refresh':refresh}[selector]),
    querySelectorAll:selector=>selector==='[data-pt-detail]'?[detail]:[evidence]};
  const S={guest:null}, opened=[], modals=[];
  let enabled=false;
  const start=html.indexOf('function openProgressTracker(board) {');
  const end=html.indexOf('/* ---------- ClassReport:',start);
  const entry=html.match(/case 'progress-tracker':[^\n]*/)[0];
  const click=vm.runInNewContext(`(() => {
    ${html.slice(start,end)}
    return async b => { switch ('progress-tracker') { ${entry} } };
  })()`, {
    window,S,getBoard:id=>id===board.id?board:null,canManage:b=>b===board,
    schoolManagerFeatureAllowed:async (b,feature)=>enabled && b===board && feature==='progressTracker',
    postsOf:id=>posts.filter(p=>p.boardId===id),getPost:id=>posts.find(p=>p.id===id),
    esc:String,toast:()=>{},openDetail:(...args)=>opened.push(args),
    openModal:({title})=>{
      modals.push(title);
      panel.isConnected=true;
      return {el:{querySelector:()=>panel},close:()=>{panel.isConnected=false;}};
    },
  });

  await click(board);
  assert.deepEqual(modals,[]);
  enabled=true;
  await click(board);
  assert.deepEqual(modals,['ProgressTracker · Toán 8A']);
  assert.match(panel.innerHTML,/Học sinh thử/);
  assert.doesNotMatch(panel.innerHTML,/Học sinh bảng khác/);
  search.onchange({target:{value:'Không có tên này'}});
  assert.match(panel.innerHTML,/Chưa có dữ liệu/);
  search.onchange({target:{value:''}});
  detail.onclick();
  assert.match(panel.innerHTML,/points="4\.0,44\.0 176\.0,4\.0"/);
  evidence.dataset.ptOpen='3';
  evidence.onclick();
  assert.deepEqual(opened,[]);
  evidence.dataset.ptOpen='2';
  evidence.onclick();
  assert.deepEqual(opened,[['2',false]]);

  S.guest={};
  await click(board);
  assert.equal(modals.length,1);
});
