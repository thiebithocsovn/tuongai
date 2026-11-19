/* SchoolManager – server-side multi-school administration.
   No user/student rows are moved or reclassified automatically.
   All operations use verified user identity from tuongai/index.ts.
   New school tables have deny-by-default RLS, accessible only through service-role server. */
export const SCHOOL_FEATURES = Object.freeze(['agentReview','progressTracker','classReport']);
export function schoolPolicy(value) {
  const input=value && typeof value==='object' && !Array.isArray(value)?value:{};
  return Object.fromEntries(SCHOOL_FEATURES.map(key=>[key,input[key]!==false]));
}
export function mayManageSchool(user,memberRole) {
  return user?.status==='active' && (user.role==='admin' || memberRole==='manager');
}
export function schoolAdminRole(user,memberRole) {
  return user?.role==='admin'?'platform_admin':memberRole==='manager'?'manager':'teacher';
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE=/^[A-Z0-9][A-Z0-9_-]{2,23}$/;
const asText=(x,n=160)=>typeof x==='string'?x.trim().slice(0,n):'';
/* Conservative identity: remove display-only 'Trường', spacing, case and accents.
   Do NOT equate THCS and TH&THCS: those names require human verification. */
export function schoolNameKey(name) {
  return asText(name).replace(/[đĐ]/g,'D').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toUpperCase()
    .replace(/^\s*TRUONG\s+/,'').replace(/\s*&\s*/g,'&')
    .replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
}
export function suggestedSchoolCode(key) {
  let hash=2166136261;
  for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const short=key.replace(/[^A-Z0-9]+/g,'_').replace(/^_+/,'')
    .slice(0,11).replace(/_+$/,'')||'SCHOOL';
  return 'SM_'+short+'_'+(hash>>>0).toString(16).toUpperCase().padStart(8,'0');
}
export function schoolDirectory(schools,teachers,boards,linkedIds=[]) {
  const managed=new Map(schools.map(s=>[schoolNameKey(s.name),s.id]));
  const byId=new Map(teachers.map(t=>[t.id,t]));
  const links=new Set(linkedIds);
  const groups=new Map();
  function ensure(raw) {
    const key=schoolNameKey(raw);
    if(!key)return null;
    if(!groups.has(key))groups.set(key,{
      key,name:asText(raw),variants:[],teacherIds:[],boardIds:[],
      readyBoardIds:[],reviewBoardIds:[],schoolId:managed.get(key)||null,
    });
    const group=groups.get(key),value=asText(raw);
    if(value&&!group.variants.includes(value))group.variants.push(value);
    return group;
  }
  for(const teacher of teachers) {
    if(teacher.role!=='teacher'||teacher.status!=='active')continue;
    const group=ensure(teacher.school);
    if(group)group.teacherIds.push(teacher.id);
  }
  for(const board of boards) {
    const group=ensure(board.school);
    if(!group)continue;
    group.boardIds.push(board.id);
    const owner=byId.get(board.owner);
    if(owner&&owner.role==='teacher'&&owner.status==='active'&&
      schoolNameKey(owner.school)===group.key&&!links.has(board.id))
      group.readyBoardIds.push(board.id);
    else if(!links.has(board.id))group.reviewBoardIds.push(board.id);
  }
  const score=name=>(/^trường\s/i.test(name)?1000:0)+
    (name!==name.toUpperCase()?100:0)+name.length;
  return [...groups.values()].map(group=>{
    group.name=group.variants.slice().sort((a,b)=>score(b)-score(a))[0]||group.name;
    return group;
  }).sort((a,b)=>b.boardIds.length-a.boardIds.length||a.name.localeCompare(b.name,'vi'));
}
const getUuid=x=>typeof x==='string'&&UUID.test(x)?x:null;
function bad(Fail,code,message,status=400){throw new Fail(code,message,status);}
async function one(query,Fail) {
  const {data,error}=await query;
  if(error)bad(Fail,'server','Không đọc được dữ liệu SchoolManager.',500);
  return data;
}
async function getMembership(db,schoolId,userId,Fail) {
  return one(db.from('school_manager_members').select('role')
    .eq('school_id',schoolId).eq('user_id',userId).maybeSingle(),Fail);
}
async function getSchool(db,id,Fail) {
  const school=await one(db.from('school_manager_schools').select('*')
    .eq('id',id).maybeSingle(),Fail);
  if(!school)bad(Fail,'not_found','Trường không tồn tại.',404);
  return school;
}
async function allowedSchool(db,schoolId,user,Fail,write=false) {
  const school=await getSchool(db,schoolId,Fail);
  const membership=user.role==='admin'?{role:'manager'}:
    await getMembership(db,schoolId,user.id,Fail);
  if(!membership && user.role!=='admin')
    bad(Fail,'forbidden','Không có quyền truy cập trường này.',403);
  if(write && !mayManageSchool(user,membership?.role))
    bad(Fail,'forbidden','Chỉ quản trị trường được thay đổi cấu hình.',403);
  return {school,memberRole:membership?.role||'teacher'};
}
async function audit(db,schoolId,user,operation,targetId) {
  const {error}=await db.from('school_manager_audit').insert({
    school_id:schoolId,actor_id:user.id,operation,target_id:String(targetId||'').slice(0,80),
  });
  if(error)console.error('SchoolManager audit failed',operation);
}
export async function schoolFeatureEnabled(db,boardId,feature) {
  if(!SCHOOL_FEATURES.includes(feature))return false;
  const {data:link,error}=await db.from('school_manager_boards').select('school_id')
    .eq('board_id',boardId).maybeSingle();
  if(error)throw new Error('SchoolManager feature mapping unavailable');
  if(!link)return true; // Legacy boards remain unchanged and functional.
  const {data:school,error:schoolError}=await db.from('school_manager_schools')
    .select('status,agent_policy').eq('id',link.school_id).maybeSingle();
  if(schoolError||!school)return false;
  return school.status==='active'&&schoolPolicy(school.agent_policy)[feature];
}
async function schoolOverview(db,user,Fail) {
  const admin=user.role==='admin';
  let allowedIds=[];
  let ownMemberships=[];
  if(!admin) {
    ownMemberships=await one(db.from('school_manager_members')
      .select('school_id,role').eq('user_id',user.id).limit(200),Fail)||[];
    allowedIds=ownMemberships.map(x=>x.school_id);
    if(!allowedIds.length)
      return {schools:[],members:[],boards:[],audit:[],platformAdmin:false};
  }
  const schools=await one(admin?
    db.from('school_manager_schools').select('*').order('created_at',{ascending:false}).limit(200):
    db.from('school_manager_schools').select('*').in('id',allowedIds)
      .order('created_at',{ascending:false}).limit(200),Fail)||[];
  const managerIds=admin?schools.map(s=>s.id):
    ownMemberships.filter(x=>x.role==='manager').map(x=>x.school_id);
  const visibleMembers=managerIds.length?await one(db.from('school_manager_members')
    .select('school_id,user_id,role,created_at').in('school_id',managerIds).limit(400),Fail)||[]:[];
  const teacherMembers=ownMemberships.filter(x=>!managerIds.includes(x.school_id))
    .map(x=>({school_id:x.school_id,user_id:user.id,role:x.role}));
  const memberships=[...visibleMembers,...teacherMembers];
  const ids=[...new Set(memberships.map(x=>x.user_id))];
  const profiles=ids.length?await one(db.from('profiles')
    .select('id,email,full_name,subject,status,role').in('id',ids).limit(400),Fail)||[]:[];
  const profileMap=new Map(profiles.map(p=>[p.id,p]));
  const members=memberships.map(m=>({
    schoolId:m.school_id,userId:m.user_id,
    memberRole:m.role,...(profileMap.get(m.user_id)||{}),
  }));
  const mapRows=managerIds.length?await one(db.from('school_manager_boards')
    .select('school_id,board_id,created_at').in('school_id',managerIds).limit(500),Fail)||[]:[];
  const boardIds=mapRows.map(x=>x.board_id);
  const boardRows=boardIds.length?await one(db.from('boards')
    .select('id,owner,name,subject,grade').in('id',boardIds).limit(500),Fail)||[]:[];
  const boardsById=new Map(boardRows.map(x=>[x.id,x]));
  const boards=mapRows.map(link=>({
    schoolId:link.school_id,boardId:link.board_id,
    name:boardsById.get(link.board_id)?.name||'Bảng không còn tồn tại',
    subject:boardsById.get(link.board_id)?.subject||'',
    grade:boardsById.get(link.board_id)?.grade||'',
    ownerId:boardsById.get(link.board_id)?.owner||'',
  }));
  const availableTeachers=admin?await one(db.from('profiles')
    .select('id,email,full_name,school,status,role')
    .eq('role','teacher').eq('status','active')
    .order('full_name',{ascending:true}).limit(300),Fail)||[]:[];
  const availableBoards=admin?await one(db.from('boards')
    .select('id,name,owner,school,subject,grade')
    .order('created_at',{ascending:false}).limit(500),Fail)||[]:[];
  const metrics=managerIds.length?await one(db.rpc('school_manager_board_metrics',{
    p_school_ids:managerIds,
  }),Fail)||[]:[];
  const metricById=new Map(metrics.map(m=>[m.board_id,m]));
  for(const board of boards) {
    const metric=metricById.get(board.boardId);
    board.submissions=Number(metric?.submissions||0);
    board.reviewed=Number(metric?.reviewed||0);
  }
  const logs=managerIds.length?await one(db.from('school_manager_audit')
    .select('school_id,operation,recorded_at,actor_id')
    .in('school_id',managerIds).order('recorded_at',{ascending:false}).limit(40),Fail)||[]:[];
  const directory=admin?schoolDirectory(schools,availableTeachers,availableBoards,
    mapRows.map(row=>row.board_id)):[];
  return {platformAdmin:admin,
    schools:schools.map(s=>({id:s.id,code:s.code,name:s.name,status:s.status,
      policy:schoolPolicy(s.agent_policy),createdAt:s.created_at})),
    members,boards,audit:logs,availableTeachers,availableBoards,directory};
}
export async function handleSchoolManager(db,user,body,Fail) {
  if(!user||user.status!=='active'||!['admin','teacher'].includes(user.role))
    bad(Fail,'forbidden','Tài khoản không có quyền SchoolManager.',403);
  const op=asText(body.operation,32);
  if(op==='overview')return schoolOverview(db,user,Fail);
  if(op==='activate_directory') {
    if(user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị toàn hệ thống được đồng bộ danh bạ trường.',403);
    const overview=await schoolOverview(db,user,Fail);
    const selected=asText(body.key,160);
    const groups=selected?overview.directory.filter(g=>g.key===selected):overview.directory;
    if(selected&&!groups.length)
      bad(Fail,'not_found','Không tìm thấy trường trong dữ liệu thực tế.',404);
    const results=[];
    const linked=new Set(overview.boards.map(b=>b.boardId));
    for(const group of groups.slice(0,200)) {
      if(group.schoolId) {
        results.push({key:group.key,schoolId:group.schoolId,created:false,teachers:0,boards:0,review:group.reviewBoardIds.length});
        continue; // Never silently re-add a member previously removed by management.
      }
      const code=suggestedSchoolCode(group.key);
      const {data:school,error:createError}=await db.from('school_manager_schools')
        .insert({code,name:group.name,created_by:user.id,agent_policy:schoolPolicy({})})
        .select('id,code,name').single();
      if(createError||!school)
        bad(Fail,'server','Không khởi tạo được trường '+group.name+'. Vui lòng tải lại và kiểm tra mã trường.',500);
      const members=group.teacherIds.map(user_id=>({
        school_id:school.id,user_id,role:'teacher',assigned_by:user.id,
      }));
      if(members.length) {
        const {error}=await db.from('school_manager_members').insert(members);
        if(error)bad(Fail,'server','Trường đã tạo nhưng chưa thêm được giáo viên '+group.name+'.',500);
      }
      const ready=group.readyBoardIds.filter(id=>!linked.has(id));
      if(ready.length) {
        const {error}=await db.from('school_manager_boards')
          .upsert(ready.map(board_id=>({
            board_id,school_id:school.id,assigned_by:user.id,
          })),{onConflict:'board_id',ignoreDuplicates:true});
        if(error)bad(Fail,'server','Trường đã tạo nhưng chưa liên kết được bảng lớp '+group.name+'.',500);
        ready.forEach(id=>linked.add(id));
      }
      await audit(db,school.id,user,'create_school','import_directory');
      results.push({key:group.key,schoolId:school.id,created:true,
        teachers:members.length,boards:ready.length,review:group.reviewBoardIds.length});
    }
    return {ok:true,results};
  }
  if(op==='feature') {
    const boardId=getUuid(body.board_id),feature=asText(body.feature,40);
    if(!boardId||!SCHOOL_FEATURES.includes(feature))
      bad(Fail,'invalid','Lớp hoặc chức năng không hợp lệ.');
    const board=await one(db.from('boards').select('id,owner')
      .eq('id',boardId).maybeSingle(),Fail);
    if(!board || (board.owner!==user.id && user.role!=='admin'))
      bad(Fail,'forbidden','Không có quyền xem cấu hình lớp.',403);
    return {enabled:await schoolFeatureEnabled(db,boardId,feature),feature};
  }
  const schoolId=getUuid(body.school_id);
  if(op==='create_school') {
    if(user.role!=='admin')bad(Fail,'forbidden','Chỉ quản trị hệ thống tạo trường mới.',403);
    const code=asText(body.code,24).toUpperCase(),name=asText(body.name,160);
    if(!CODE.test(code)||name.length<2)
      bad(Fail,'invalid','Mã trường phải dài 3–24 ký tự chữ số, gạch dưới hoặc gạch nối; tên ít nhất 2 ký tự.');
    const {data,error}=await db.from('school_manager_schools').insert({
      code,name,created_by:user.id,agent_policy:schoolPolicy({}),
    }).select('id,code,name').single();
    if(error)bad(Fail,error.code==='23505'?'exists':'server',
      error.code==='23505'?'Mã trường đã tồn tại.':'Không tạo được trường.',error.code==='23505'?409:500);
    await audit(db,data.id,user,'create_school',data.id);
    return {ok:true,school:data};
  }
  if(!schoolId)bad(Fail,'invalid','Cần chọn trường hợp lệ.');
  const {school,memberRole}=await allowedSchool(db,schoolId,user,Fail,
    ['add_member','remove_member','set_manager','link_board','unlink_board','set_agents'].includes(op));
  if(op==='set_agents') {
    if(!mayManageSchool(user,memberRole))
      bad(Fail,'forbidden','Không có quyền chỉnh cấu hình AI.',403);
    const input=body.policy;
    if(!input||typeof input!=='object'||Array.isArray(input)||
      SCHOOL_FEATURES.some(k=>typeof input[k]!=='boolean'))
      bad(Fail,'invalid','Phải cung cấp đủ 3 lựa chọn bật/tắt AI Agent.');
    const policy=schoolPolicy(input);
    const {error}=await db.from('school_manager_schools')
      .update({agent_policy:policy,updated_at:new Date().toISOString()})
      .eq('id',schoolId);
    if(error)bad(Fail,'server','Không lưu được cấu hình AI.',500);
    await audit(db,schoolId,user,'set_agents',schoolId);
    return {ok:true,policy};
  }
  if(op==='add_member') {
    const role=body.member_role==='manager'?'manager':'teacher';
    if(role==='manager' && user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị hệ thống bổ nhiệm quản trị trường.',403);
    const userId=getUuid(body.user_id);
    const email=asText(body.email,200).toLowerCase();
    if(!userId && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      bad(Fail,'invalid','Nhập email giáo viên đã có tài khoản hoặc chọn giáo viên.');
    const profile=await one(userId?
      db.from('profiles').select('id,role,status').eq('id',userId).maybeSingle():
      db.from('profiles').select('id,role,status').eq('email',email).maybeSingle(),Fail);
    if(!profile||profile.role!=='teacher'||profile.status!=='active')
      bad(Fail,'invalid','Chỉ thêm tài khoản giáo viên đang hoạt động.',403);
    if(school.status!=='active')bad(Fail,'inactive','Trường đang tạm khóa.',409);
    const {error}=await db.from('school_manager_members').insert({
      school_id:schoolId,user_id:profile.id,role,assigned_by:user.id,
    });
    if(error)bad(Fail,error.code==='23505'?'exists':'server',
      error.code==='23505'?'Giáo viên đã thuộc trường.':'Không thêm được giáo viên.',error.code==='23505'?409:500);
    await audit(db,schoolId,user,'add_member',profile.id);
    return {ok:true};
  }
  if(op==='remove_member') {
    const userId=getUuid(body.user_id);
    if(!userId)bad(Fail,'invalid','Tài khoản không hợp lệ.');
    const member=await getMembership(db,schoolId,userId,Fail);
    if(!member)bad(Fail,'not_found','Thành viên không có trong trường.',404);
    if(member.role==='manager' && user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị toàn hệ thống được gỡ quản trị trường.',403);
    if(userId===user.id)bad(Fail,'self','Không thể tự gỡ quyền của mình.',403);
    // Preserve explicit ownership: do not orphan an active board assignment.
    const {data:linked}=await db.from('school_manager_boards').select('board_id')
      .eq('school_id',schoolId);
    if((linked||[]).length) {
      const {data:owned}=await db.from('boards').select('id')
        .in('id',(linked||[]).map(x=>x.board_id)).eq('owner',userId).limit(1);
      if(owned?.length)
        bad(Fail,'board_attached','Hãy bỏ liên kết các bảng của giáo viên trước khi gỡ thành viên.',409);
    }
    const {error}=await db.from('school_manager_members').delete()
      .eq('school_id',schoolId).eq('user_id',userId);
    if(error)bad(Fail,'server','Không gỡ được thành viên.',500);
    await audit(db,schoolId,user,'remove_member',userId);
    return {ok:true};
  }
  if(op==='set_manager') {
    if(user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị hệ thống bổ nhiệm quản trị trường.',403);
    const userId=getUuid(body.user_id),role=body.member_role;
    if(!userId||!['manager','teacher'].includes(role))
      bad(Fail,'invalid','Tài khoản hoặc vai trò không hợp lệ.');
    const {data,error}=await db.from('school_manager_members')
      .update({role}).eq('school_id',schoolId).eq('user_id',userId).select('user_id').maybeSingle();
    if(error||!data)bad(Fail,'not_found','Không tìm thấy thành viên.',404);
    await audit(db,schoolId,user,'set_manager',userId);
    return {ok:true};
  }
  if(op==='link_board') {
    if(user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị hệ thống được liên kết bảng lớp.',403);
    const boardId=getUuid(body.board_id);
    if(!boardId)bad(Fail,'invalid','Mã bảng không hợp lệ.');
    const board=await one(db.from('boards').select('id,owner')
      .eq('id',boardId).maybeSingle(),Fail);
    if(!board)bad(Fail,'not_found','Bảng không còn tồn tại.',404);
    const ownerMember=await getMembership(db,schoolId,board.owner,Fail);
    if(!ownerMember)bad(Fail,'owner_missing',
      'Giáo viên chủ bảng phải được thêm vào trường trước khi liên kết.',409);
    if(school.status!=='active')bad(Fail,'inactive','Trường đang tạm khóa.',409);
    const {error}=await db.from('school_manager_boards')
      .insert({board_id:boardId,school_id:schoolId,assigned_by:user.id});
    if(error)bad(Fail,error.code==='23505'?'already_linked':'server',
      error.code==='23505'?'Bảng đã được liên kết với một trường khác.':'Không liên kết được bảng.',error.code==='23505'?409:500);
    await audit(db,schoolId,user,'link_board',boardId);
    return {ok:true};
  }
  if(op==='unlink_board') {
    if(user.role!=='admin')
      bad(Fail,'forbidden','Chỉ quản trị hệ thống được bỏ liên kết bảng.',403);
    const boardId=getUuid(body.board_id);
    if(!boardId)bad(Fail,'invalid','Mã bảng không hợp lệ.');
    const {data,error}=await db.from('school_manager_boards').delete()
      .eq('board_id',boardId).eq('school_id',schoolId).select('board_id').maybeSingle();
    if(error||!data)bad(Fail,'not_found','Bảng không thuộc trường đã chọn.',404);
    await audit(db,schoolId,user,'unlink_board',boardId);
    return {ok:true};
  }
  bad(Fail,'bad_action','Tác vụ SchoolManager không hợp lệ.');
}
