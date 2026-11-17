import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPool,reviewRetryDue,savedGradeAnalysis} from '../supabase/functions/tuongai/review-parallel.ts';
test('one failed task does not cancel independent jobs or exceed the pool cap',async()=>{
 let active=0,peak=0,finished=0;
 const results=await reviewPool([0,1,2,3,4,5],3,async n=>{
  active++;peak=Math.max(peak,active);await new Promise(setImmediate);active--;
  if(n===1)throw Error('one job');finished++;
 });
 assert.equal(peak,3);assert.equal(finished,5);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('manual recovery gets a new bounded cycle without erasing the lifetime attempt count',()=>{
 const job={status:'failed',attempts:7,cycleAttempts:2,retryAt:100};
 assert.equal(reviewRetryDue(job,101),true);assert.equal(reviewRetryDue({...job,cycleAttempts:3},101),false);
 assert.equal(reviewRetryDue({...job,retryAt:200},101),false);
});
test('never reuse approved work, a different score scale, missing source or an existing draft',()=>{
 const b={assignment:{maxScore:10}},p={ai:{diem:5,diem_toi_da:10,nhan_xet:'Nhận xét'},ai_at:'2026-11-17T00:00:00Z'};
 assert.ok(savedGradeAnalysis(p,b));
 for(const bad of [{...p,teacher:{approvedAt:1}},{...p,teacher:{score:0}},{...p,ai_at:null},{...p,teacher:{assist:{a:{}}}},{...p,ai:{...p.ai,diem_toi_da:20}}])assert.equal(savedGradeAnalysis(bad,b),null);
});
