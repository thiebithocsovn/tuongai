import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const ROOT='http://127.0.0.1:4173/tuongai/index.html';
function fixtureSDK(ROLE) {
  const person={
    id:'00000000-0000-4000-8000-000000000099',
    email:'fixture@example.test',full_name:'Tài khoản kiểm thử',
    school:'Trường thử nghiệm',subject:'Toán',role:ROLE,
    status:'active',must_change:false,
  };
  const query=(table)=>{
    const q={
      select(){return q},eq(){return q},in(){return q},
      order(){return q},limit(){return q},
      async maybeSingle(){return {data:table==='profiles'?person:null,error:null}},
      async single(){return {data:table==='profiles'?person:null,error:null}},
      async range(){return {data:table==='profiles'?[person]:[],error:null}},
      then(resolve){resolve({data:[],error:null})},
    };
    return q;
  };
  const channel=()=>({
    on(){return this},subscribe(){return this},
    track:async()=>({}),untrack:async()=>({}),
  });
  const db={
    auth:{
      getSession:async()=>({data:{session:{access_token:'fixture-token'}}}),
      getUser:async()=>({data:{user:{id:person.id}}}),
      signOut:async()=>({error:null}),
    },
    from:query,channel,removeChannel:()=>{},
    rpc:async(name)=>({data:name==='site_public_metrics'?
      {users:0,units:0,visits:0}:0,error:null}),
    storage:{from:()=>({
      download:async()=>({data:null,error:new Error('No fixture avatar')}),
      createSignedUrl:async()=>({data:null,error:new Error('No fixture avatar')}),
      createSignedUrls:async()=>({data:[],error:null}),
    })},
  };
  window.supabase={createClient:()=>db};
}
function setupNetwork(page,role){
  return Promise.all([
    page.route('**/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',route=>
      route.fulfill({status:200,contentType:'application/javascript',
        body:'('+fixtureSDK.toString()+')('+JSON.stringify(role)+');'})),
    page.route('https://vnxffqpszykkjueawtfr.supabase.co/functions/v1/tuongai',async route=>{
      const body=JSON.parse(route.request().postData()||'{}');
      let output={};
      if(body.action==='school_manager'&&body.operation==='overview'){
        output={platformAdmin:role==='admin',schools:[],members:[],boards:[],
          audit:[],availableTeachers:[],availableBoards:[]};
      }else if(body.action==='admin_list'){
        output={members:[],auto_approve:false};
      }else if(body.action==='ai_status'){
        output={ready:false,model:'gemini-flash-latest'};
      }else if(body.action==='agent_review_queue'){
        output={items:[],counts:{},aiReady:false};
      }
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(output)});
    }),
  ]);
}
async function app(page,role){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await setupNetwork(page,role);
  await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#app').waitFor({state:'visible',timeout:15000});
  await page.locator('#view .hero').waitFor({state:'visible',timeout:15000});
  assert.deepEqual(errors,[],'JavaScript runtime errors '+role+': '+errors.join(';\n'));
  return errors;
}
async function openManager(page,selector){
  const button=page.locator(selector).first();
  assert.equal(await button.isVisible(),true,selector+' is hidden');
  await button.click({timeout:10000});
  const dialog=page.getByRole('dialog',{name:/SchoolManager/i});
  await dialog.waitFor({state:'visible',timeout:10000});
  await dialog.getByText('Trung tâm quản lý trường, giáo viên').waitFor({state:'visible',timeout:10000});
  await dialog.getByRole('button',{name:/Thêm trường mới/}).waitFor({state:'visible',timeout:10000});
  await dialog.getByRole('button',{name:'Đóng'}).first().click();
  await dialog.waitFor({state:'detached',timeout:10000});
}
const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height] of [
    ['Android 360px',360,740],['Android 390px',390,844],
    ['Android tablet 768px',768,1024],['Desktop 1366px',1366,850],
  ]){
    const page=await browser.newPage({viewport:{width,height},isMobile:false,
      deviceScaleFactor:width<500?2:1});
    const errors=await app(page,'admin');
    const home=page.locator('#view .admin-school-entry');
    assert.equal(await home.count(),1,'Admin home CTA missing');
    assert.equal(await home.isVisible(),true,'Admin home CTA invisible');
    assert.equal(await page.locator('#side .admin-school-nav').count(),1);
    const bounds=await home.boundingBox();
    assert.ok(bounds.width>100&&bounds.height>=38,
      'Admin CTA too small on '+name+': '+JSON.stringify(bounds));
    const widthInfo=await page.evaluate(()=>{
      const bad=[...document.querySelectorAll('body *')].filter(e=>{
        const r=e.getBoundingClientRect(),style=getComputedStyle(e);
        return r.right>innerWidth+5 && r.width>0 && style.position!=='fixed' &&
          style.visibility!=='hidden';
      }).slice(0,14).map(e=>{
        const r=e.getBoundingClientRect();
        return {tag:e.tagName,cls:String(e.className||'').slice(0,90),
          text:(e.textContent||'').slice(0,36),left:Math.round(r.left),
          right:Math.round(r.right),width:Math.round(r.width)};
      });
      return {window:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:bad};
    });
    assert.ok(widthInfo.scrollWidth<=widthInfo.window+4,
      'Horizontal overflow '+name+' '+JSON.stringify(widthInfo));
    await openManager(page,'#view .admin-school-entry');
    console.log('PASS admin home CTA and SchoolManager dialog',name);
    await page.locator('#side [data-tab="members"]').click();
    await page.locator('#mb-list').waitFor();
    assert.equal(await page.locator('#view .admin-school-entry').count(),1);
    await openManager(page,'#view .admin-school-entry');
    console.log('PASS admin members CTA',name);
    await openManager(page,'#side .admin-school-nav');
    assert.deepEqual(errors,[]);
    console.log('PASS navigation CTA and responsive layout',name);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await app(page,'teacher');
  assert.equal(await page.locator('#view .admin-school-entry').count(),0);
  assert.equal(await page.locator('#side .admin-school-nav').count(),0);
  assert.equal(await page.locator('#side [data-tab="members"]').count(),0);
  console.log('PASS teacher cannot see admin-only SchoolManager shortcuts');
  await page.close();
}finally{
  await browser.close();
}
console.log('ADMIN SCHOOLMANAGER ANDROID TESTS PASS');
