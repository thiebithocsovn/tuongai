const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {classify}=require('../device-layout.js');
test('adapts phones, tablets and desktop windows without a saved device preference',()=>{
 assert.deepEqual(classify({width:393,screenWidth:393,screenHeight:851,touch:true,mobile:true}),{device:'phone',layout:'compact'});
 assert.equal(classify({width:980,screenWidth:393,screenHeight:851,touch:true}).layout,'compact');
 assert.equal(classify({width:851,screenWidth:851,screenHeight:393,touch:true}).layout,'compact');
 assert.deepEqual(classify({width:820,screenWidth:820,screenHeight:1180,touch:true}),{device:'tablet',layout:'medium'});
 assert.deepEqual(classify({width:1440,screenWidth:1440,screenHeight:900,touch:false}),{device:'desktop',layout:'wide'});
 assert.equal(classify({width:600,screenWidth:1440,screenHeight:900,touch:false}).layout,'compact');
});
function setup({width=980,mobile=true,touch=5,screenWidth=393,screenHeight=851}={}){
 const listeners={},meta={content:'width=device-width,initial-scale=1,viewport-fit=cover'},root={clientWidth:width,dataset:{},style:{setProperty(){}}};
 const window={document:{documentElement:root,querySelector:()=>meta},navigator:{maxTouchPoints:touch,userAgent:mobile?'Android Mobile':'Desktop'},screen:{width:screenWidth,height:screenHeight},innerWidth:width,innerHeight:800,
  matchMedia:()=>({matches:touch>0,addEventListener(){}}),requestAnimationFrame:fn=>fn(),addEventListener:(event,fn)=>listeners[event]=fn};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../device-layout.js'),'utf8'),{window});return{window,root,meta,listeners};
}
test('corrects an oversized phone viewport and retains pinch zoom access',()=>{
 const f=setup();assert.equal(f.root.dataset.layout,'compact');assert.match(f.meta.content,/width=393/);assert.doesNotMatch(f.meta.content,/maximum-scale|user-scalable=no/);
 f.window.screen.width=851;f.window.screen.height=393;f.root.clientWidth=851;f.listeners.orientationchange();assert.match(f.meta.content,/width=851/);assert.equal(f.root.dataset.layout,'compact');
});
test('resizing the desktop window switches layout and keeps the default viewport',()=>{
 const f=setup({width:1440,mobile:false,touch:0,screenWidth:1440,screenHeight:900});assert.equal(f.root.dataset.layout,'wide');
 f.root.clientWidth=600;f.listeners.resize();assert.equal(f.root.dataset.layout,'compact');
 f.root.clientWidth=1440;f.listeners.resize();assert.equal(f.root.dataset.layout,'wide');assert.match(f.meta.content,/width=device-width/);
});
