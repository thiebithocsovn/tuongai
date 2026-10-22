import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {studentPost, ownsStudentPost} from '../supabase/functions/tuongai/student-visibility.ts';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Missing source fragment '+start);
  return html.slice(a,b);
}
const originalToken='student-owner-high-entropy-token';
const approved={id:'scored',board_id:'class',student_name:'Học sinh A',by:'hs',
  student_token:originalToken,body:'Bài tự luận',ai:{diem:8},ai_at:'2026-10-21',
  teacher:{approvedAt:123,score:9.5,note:'Đã sửa đúng'},images:[]};
test('Approved grades are visible to the owning submission, never to classmates',()=>{
  assert.equal(ownsStudentPost(approved,originalToken),true);
  assert.equal(ownsStudentPost(approved,'student-other-high-entropy-token'),false);
  const own=studentPost(approved,true),peer=studentPost(approved,false);
  assert.equal(own.visibility,'mine');
  assert.equal(own.teacher.score,9.5);
  assert.equal(own.teacher.note,'Đã sửa đúng');
  assert.equal(peer.visibility,'class');
  assert.equal(peer.teacher.score,undefined);
  assert.equal(peer.ai,null);
  assert.equal(JSON.stringify(peer).includes('9.5'),false);
  assert.equal(JSON.stringify(own).includes('student_token'),false);
});
test('Teacher approval is required and a grade of zero is still displayed',()=>{
  const pending={...approved,teacher:{score:7, note:'Nháp'}};
  assert.equal(studentPost(pending,true).teacher.score,undefined);
  const zero=studentPost({...approved,teacher:{approvedAt:123,score:0}},true);
  assert.equal(zero.teacher.score,0);
  const context={S:{guest:{id:'student',role:'hs'},meId:'student',members:new Map()},getBoard:()=>null,isGV:()=>false,ME:()=>null,isNum:Number.isFinite};
  const source=section('function isTeacherAnnouncement(p)','const peerPost =');
  const score=vm.runInNewContext(source+'\nfinalScore',context);
  const myApproved={...zero,studentAcc:'student',boardId:'class',studentName:'Học sinh A',teacher:zero.teacher};
  assert.equal(score(myApproved),0);
  assert.equal(score({...myApproved,teacher:{score:10}}),null);
  assert.equal(score({...myApproved,studentAcc:'another'}),null);
});
test('Student classroom exposes a prominently labeled personal grade dashboard',()=>{
  assert.match(html,/student-result-panel/);
  assert.match(html,/ownStudentPosts = gv \? \[\] : ps\.filter\(p => p\.by === 'hs' && p\.studentAcc === S\.meId\)/);
  assert.match(html,/Điểm giáo viên đã duyệt/);
  assert.match(html,/data-act="student-refresh"/);
  assert.match(html,/data-act="student-private-link"/);
  assert.match(html,/student-result-score/);
  assert.match(html,/data-act="student-restore"/);
});
test('Student result links keep the secret in URL fragment, not in a query string',()=>{
  const context={URL,encodeURIComponent,shareLink:()=> 'https://example.test/?lop=ABC123'};
  const f=vm.runInNewContext(section('function privateStudentResultLink','async function openStudentLink')+'\nprivateStudentResultLink',context);
  const token='device-'+originalToken;
  const result=f({token},{code:'ABC123'});
  const u=new URL(result);
  assert.equal(u.searchParams.get('lop'),'ABC123');
  assert.equal(u.searchParams.has('ketqua'),false);
  assert.equal(new URLSearchParams(u.hash.slice(1)).get('ketqua'),token);
  assert.equal(f({token:'short'},{code:'ABC123'}),'');
  assert.match(html,/api\('student_mine', \{ code, token:resultToken \}\)/);
  assert.match(html,/history\.replaceState\(null, '', location\.pathname \+ location\.search\)/);
});
test('All inline JavaScript sections compile',()=>{
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(match[1].trim()) assert.doesNotThrow(()=>new vm.Script(match[1]));
  }
});
