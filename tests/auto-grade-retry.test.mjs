import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTO_GRADE_RETRY_MS,gradeFailure,gradeAttemptsValid} from '../supabase/functions/tuongai/auto-grade-retry.ts';

test('rate limit and upstream errors retry with bounded backoff', ()=>{
  assert.deepEqual(AUTO_GRADE_RETRY_MS,[8000,20000]);
  for(const code of ['rate_limited','upstream_error','network','timeout','empty_completion']){
    const r=gradeFailure({code,message:'SECRET: AI raw response'});
    assert.equal(r.code,code);
    assert.equal(r.retryable,true);
    assert.equal(r.message.includes('SECRET'),false);
  }
});
test('never retry invalid key/model, ungradable files or stale work',()=>{
  for(const code of ['bad_key','bad_model','invalid_json','no_grade_input','stale_submission']){
    assert.equal(gradeFailure({code}).retryable,false);
  }
  assert.equal(gradeFailure({code:'other',message:'secret'}).message,'Máy chủ chưa hoàn tất chấm AI.');
});
test('do not leak credentials or upstream details into teacher-visible error labels',()=>{
  const secret='AIza-not-a-real-key';
  const result=gradeFailure({code:'bad_key',message:secret});
  assert.equal(result.code,'bad_key');
  assert.equal(result.message.includes(secret),false);
});
test('network/timeout errors are separately classified',()=>{
  assert.equal(gradeFailure(new TypeError('fetch failed')).code,'network');
  assert.equal(gradeFailure(Object.assign(new Error('Timeout'),{name:'TimeoutError'})).code,'timeout');
});
test('retry attempt markers are bounded',()=>{
  assert.equal(gradeAttemptsValid(3),3);
  assert.equal(gradeAttemptsValid(4),1);
  assert.equal(gradeAttemptsValid('garbage'),1);
});
