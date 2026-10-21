const {chromium}=require('playwright');
const layouts=[
 ['Android 360',360,800,true], ['iPhone 390',390,844,true],
 ['iPhone Plus 430',430,932,true], ['Tablet 768',768,1024,true],
 ['iPad landscape 1024',1024,768,true], ['Laptop 1366',1366,768,false],
 ['MacBook 1440',1440,900,false], ['Desktop 1920',1920,1080,false],
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let fails=0;
 for(const [name,width,height,touch] of layouts){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:touch?2:1,hasTouch:touch,isMobile:touch});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/tuongai/',{waitUntil:'domcontentloaded'});
  await page.locator('#install-panel').waitFor({timeout:10000});
  const checks=await page.evaluate(()=>{
   const panel=document.querySelector('#install-panel'),card=document.querySelector('.auth-card'),opts=[...document.querySelectorAll('[data-install-os]')];
   const w=innerWidth,rect=panel.getBoundingClientRect(),c=card.getBoundingClientRect();
   return {visible:!!(rect.width>0&&rect.height>0),inViewport:rect.left>=-1&&rect.right<=w+1,cardInViewport:c.left>=-1&&c.right<=w+1,buttons:opts.length,allButtons:opts.every(x=>x.getBoundingClientRect().width>0),pageScrollWidth:document.documentElement.scrollWidth,viewport:w};
  });
  for(const platform of ['android','ios','windows','mac']){
   await page.locator('[data-install-os="'+platform+'"]').click();
   const label=await page.locator('#install-instructions').innerText();
   if(!label||label.length<25)throw Error(name+': no help for '+platform);
  }
  await page.screenshot({path:'screenshots/'+name.replace(/[^a-z0-9]+/gi,'-')+'.png',fullPage:true});
  const ok=checks.visible&&checks.inViewport&&checks.cardInViewport&&checks.buttons===4&&checks.allButtons;
  console.log((ok?'PASS ':'FAIL ')+name,JSON.stringify(checks));
  if(!ok)fails++;
  await context.close();
 }
 await browser.close();
 if(fails)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
