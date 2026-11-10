import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const schoolFile=fs.readFileSync(new URL('../supabase/functions/tuongai/school-manager.ts',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../supabase/functions/tuongai/index.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../school-manager-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261110111000_school_manager.sql',import.meta.url),'utf8');
const sandbox={console};
const plain=schoolFile.replace(/^export /gm,'')+
  '\nthis.schoolExports={schoolPolicy,mayManageSchool,schoolAdminRole,schoolFeatureEnabled,handleSchoolManager};';
vm.runInNewContext(plain,sandbox);
const api=sandbox.schoolExports;
class Fail extends Error {
  constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
const schoolId='12345678-1234-4234-8234-123456789012';
const schoolB='22345678-1234-4234-8234-123456789012';
const boardId='33345678-1234-4234-8234-123456789012';
const teacherId='44445678-1234-4234-8234-123456789012';
const managerId='55545678-1234-4234-8234-123456789012';
const school={id:schoolId,name:'School A',status:'active',agent_policy:{agentReview:false,progressTracker:true,classReport:true}};
const manager={id:managerId,role:'teacher',status:'active'};
const teacher={id:teacherId,role:'teacher',status:'active'};
function stub({board={id:boardId,owner:teacherId},link=null,membership=null,schoolRow=school}={}){
  const calls=[];
  const db={
    from(table){
      const filters={};
      const q={
        select(){return q;},
        eq(key,value){filters[key]=value;return q;},
        async maybeSingle(){
          calls.push({table,filters:{...filters}});
          if(table==='school_manager_schools')return {data:schoolRow,error:null};
          if(table==='school_manager_members')return {data:membership,error:null};
          if(table==='school_manager_boards')return {data:link,error:null};
          if(table==='boards')return {data:board,error:null};
          return {data:null,error:null};
        },
      };
      return q;
    }
  };
  return {db,calls};
}
test('policy defaults to on, explicit false is honored',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(api.schoolPolicy({}))),{
    agentReview:true,progressTracker:true,classReport:true});
  assert.equal(api.schoolPolicy({classReport:false}).classReport,false);
});
test('school manager never becomes platform administrator',()=>{
  assert.equal(api.mayManageSchool(manager,'manager'),true);
  assert.equal(api.schoolAdminRole(manager,'manager'),'manager');
  assert.equal(api.mayManageSchool(teacher,'teacher'),false);
  assert.equal(api.schoolAdminRole({role:'admin'},'teacher'),'platform_admin');
});
test('ordinary teachers cannot create schools or set policies',async()=>{
  const {db}=stub();
  await assert.rejects(api.handleSchoolManager(db,teacher,{operation:'create_school',code:'ABC',name:'School'},Fail),
    e=>e.code==='forbidden'&&e.status===403);
  await assert.rejects(api.handleSchoolManager(db,teacher,{operation:'set_agents',school_id:schoolId},Fail),
    e=>e.code==='forbidden');
});
test('school A manager cannot modify school B',async()=>{
  const {db}=stub({membership:null,schoolRow:{...school,id:schoolB}});
  await assert.rejects(api.handleSchoolManager(db,manager,{
    operation:'set_agents',school_id:schoolB,
    policy:{agentReview:true,progressTracker:true,classReport:true}
  },Fail),e=>e.code==='forbidden'&&e.status===403);
});
test('school manager cannot appoint school managers or assign other teachers boards',async()=>{
  const {db}=stub({membership:{role:'manager'}});
  await assert.rejects(api.handleSchoolManager(db,manager,{
    operation:'add_member',school_id:schoolId,user_id:teacherId,member_role:'manager'
  },Fail),e=>e.code==='forbidden');
  await assert.rejects(api.handleSchoolManager(db,manager,{
    operation:'link_board',school_id:schoolId,board_id:boardId
  },Fail),e=>e.code==='forbidden');
});
test('school feature check denies mapped AgentReview when school disabled policy',async()=>{
  const {db}=stub({link:{school_id:schoolId}});
  assert.equal(await api.schoolFeatureEnabled(db,boardId,'agentReview'),false);
  assert.equal(await api.schoolFeatureEnabled(db,boardId,'progressTracker'),true);
  assert.equal(await api.schoolFeatureEnabled(db,boardId,'classReport'),true);
  assert.equal(await api.schoolFeatureEnabled(db,boardId,'unknownFeature'),false);
});
test('unlinked legacy boards retain current behavior',async()=>{
  const {db}=stub({link:null});
  assert.equal(await api.schoolFeatureEnabled(db,boardId,'agentReview'),true);
});
test('feature endpoint is scoped to board owner and cannot enumerate other teachers boards',async()=>{
  const {db}=stub({board:{id:boardId,owner:managerId}});
  await assert.rejects(api.handleSchoolManager(db,teacher,{
    operation:'feature',board_id:boardId,feature:'classReport'
  },Fail),e=>e.code==='forbidden'&&e.status===403);
});
test('migration uses deny-by-default RLS and does not reassign study data',()=>{
  for(const table of ['school_manager_schools','school_manager_members','school_manager_boards','school_manager_audit']){
    assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security','i'));
    assert.match(migration,new RegExp('revoke all on public\\.'+table+' from public, anon, authenticated','i'));
  }
  assert.match(migration,/revoke all on function public\.school_manager_board_metrics\(uuid\[\]\)/i);
  assert.doesNotMatch(migration,/update\s+public\.(?:posts|boards|profiles)\b/i);
  assert.doesNotMatch(migration,/insert\s+into\s+public\.(?:posts|boards|profiles)\b/i);
});
test('client only uses verified backend for school operations and scopes report features',()=>{
  new vm.Script(ui);
  assert.match(html,/school-manager-ui\.js\?v=sm-20261110a/);
  assert.match(html,/data-act="school-manager"/);
  assert.match(html,/schoolManagerFeatureAllowed\(b,'classReport'\)/);
  assert.match(html,/schoolManagerFeatureAllowed\(b,'progressTracker'\)/);
  assert.match(server,/case "school_manager": return await handleSchoolManager\(db, needActive\(me\), body, Fail\)/);
  assert.match(server,/await schoolFeatureEnabled\(db, board\.id, "agentReview"\)/);
  assert.match(server,/await schoolFeatureEnabled\(db, candidate\.id, "agentReview"\)/);
  assert.doesNotMatch(ui,/\.from\(['"]school_manager/);
});
