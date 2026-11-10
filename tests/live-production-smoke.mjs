import { chromium, request } from 'playwright';
import assert from 'node:assert/strict';
const ORIGIN='https://tuonghoctap.vercel.app';
const reports=[];
function check(name,detail='ok'){reports.push({name,detail});console.log('PASS '+name+' '+detail);}
const req=await request.newContext({timeout:20000,ignoreHTTPSErrors:false});
try {
  const root=await req.get(ORIGIN+'/');
  assert.equal(root.status(),200);
  const html=await root.text();
  assert.match(html,/school-manager-ui\.js\?v=sm-20261110a/);
  assert.match(html,/class-report-ui\.js\?v=cr-20261110a/);
  assert.match(html,/progress-tracker-ui\.js\?v=pt-20261110a/);
  assert.match(html,/SchoolManager · Quản lý trường/);
  check('Production home + six-agent integration',String(root.status()));
  for (const asset of [
    '/school-manager-ui.js?v=sm-20261110a',
    '/class-report-ui.js?v=cr-20261110a',
    '/progress-tracker-ui.js?v=pt-20261110a',
    '/progress-tracker.js?v=pt-20261110a',
    '/class-report.js?v=cr-20261110a',
    '/service-worker-vercel.js',
  ]) {
    const response=await req.get(ORIGIN+asset);
    assert.equal(response.status(),200,asset+':'+response.status());
    const body=await response.text();
    assert.ok(body.length>100,'Empty asset '+asset);
    assert.doesNotMatch(body,/^<!doctype html>/i,'Wrong response for '+asset);
    check('Production asset',asset);
  }
  const api='https://vnxffqpszykkjueawtfr.supabase.co/functions/v1/tuongai';
  for (const action of [{action:'school_manager',operation:'overview'},
    {action:'agent_review_queue',operation:'overview'},
    {action:'admin_list'}]) {
    const res=await req.post(api,{data:action,timeout:20000});
    const raw=await res.text();
    assert.ok([401,403].includes(res.status()),
      'Anonymous action '+action.action+' must be denied, got '+res.status()+' '+raw.slice(0,200));
    check('Reject unauthenticated API',action.action+': HTTP '+res.status());
  }
  const browser=await chromium.launch({headless:true});
  try {
    for (const [name,viewport] of [
      ['Android mobile',{width:390,height:844}],
      ['Narrow mobile',{width:360,height:740}],
      ['Desktop',{width:1366,height:800}],
    ]) {
      const page=await browser.newPage({viewport});
      const pageErrors=[];
      page.on('pageerror',err=>pageErrors.push(err.message.slice(0,220)));
      await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#f-login').waitFor({state:'visible',timeout:20000});
      await page.locator('#li-user').waitFor({state:'visible',timeout:20000});
      await page.waitForTimeout(1500);
      const metrics=await page.evaluate(()=>({
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        hasManager:document.documentElement.outerHTML.includes('SchoolManager · Quản lý trường'),
        loginVisible:!document.querySelector('#f-login')?.hidden,
        ready:document.readyState,
      }));
      assert.equal(metrics.hasManager,true,'SchoolManager missing from '+name);
      assert.equal(metrics.loginVisible,true,'Login not visible on '+name);
      assert.equal(pageErrors.length,0,'JS errors on '+name+': '+pageErrors.join('; '));
      // Small overflow allowance for browser scrollbar and home landing design.
      assert.ok(metrics.scrollWidth<=metrics.width+24,
        name+' horizontal overflow '+metrics.scrollWidth+'/'+metrics.width);
      check('Browser UI runtime',name+': '+JSON.stringify(metrics));
      await page.close();
    }
  } finally { await browser.close(); }
} finally { await req.dispose(); }
console.log('LIVE TEST COMPLETE checks='+reports.length);
