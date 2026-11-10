/* SchoolManager console: no direct database reads/writes. All access is rechecked server-side. */
(function(root){
  'use strict';
  function open(deps){
    const esc=deps.esc;
    const modal=deps.openModal({
      title:'SchoolManager · Quản lý nhiều trường',wide:true,
      body:'<div class="modal-b" id="school-manager-root"></div>',
      foot:'<button class="btn btn-ghost" data-close>Đóng</button>',
    });
    const panel=modal.el.querySelector('#school-manager-root');
    let state=null,selected='',busy=false,message='',showCreate=false;
    const actionName={
      create_school:'Tạo trường',add_member:'Thêm giáo viên',remove_member:'Gỡ giáo viên',
      set_manager:'Đổi quản trị trường',link_board:'Gắn bảng vào trường',
      unlink_board:'Bỏ liên kết bảng',set_agents:'Thay đổi AI Agent',
    };
    const friendly=e=>e?.message || 'Không thể thực hiện yêu cầu.';
    const text=v=>String(v??'').trim();
    const b=(label,value)=>'<div class="stat"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
    function allowed(s) {
      return state.platformAdmin ||
        state.members.some(m=>m.schoolId===s.id && m.userId===deps.myId() && m.memberRole==='manager');
    }
    async function refresh(preserve=true) {
      try{
        const updated=await deps.api('school_manager',{operation:'overview'});
        state=updated;
        if(!preserve||!state.schools.some(s=>s.id===selected))selected=state.schools[0]?.id||'';
        draw();
      }catch(e){
        panel.innerHTML='<p class="form-err" role="alert">Không tải được SchoolManager: '+
          esc(friendly(e))+'</p><p class="meta">Cần đăng nhập giáo viên và có quyền xem trường.</p>';
      }
    }
    async function run(operation,fields,success){
      if(busy)return;
      busy=true;
      panel.querySelectorAll('button').forEach(el=>el.disabled=true);
      try{
        const response=await deps.api('school_manager',{operation,...fields});
        message=success||'Đã cập nhật SchoolManager.';
        if(operation==='create_school')selected=response.school?.id||selected;
        await refresh();
      }catch(e){
        message='Không thực hiện được: '+friendly(e);
        draw();
      }finally{busy=false;}
    }
    const memberTitle=m=>text(m.full_name)||text(m.email)||'Giáo viên';
    const rule='<p class="meta">Dữ liệu lớp học chỉ được liên kết khi quản trị hệ thống chọn rõ bảng và trường. SchoolManager không tự di chuyển bài, điểm hoặc hồ sơ TN1–TN4.</p>';
    function draw(){
      if(!state||!panel.isConnected)return;
      const s=state.schools.find(x=>x.id===selected);
      const manager=s&&allowed(s);
      const members=s?state.members.filter(x=>x.schoolId===s.id):[];
      const boards=s?state.boards.filter(x=>x.schoolId===s.id):[];
      const memberIds=new Set(members.map(m=>m.userId));
      const profileMap=new Map(state.members.map(m=>[m.userId,m]));
      const boardLinks=new Set(state.boards.map(b=>b.boardId));
      const availableTeachers=(state.availableTeachers||[]).filter(p=>!memberIds.has(p.id));
      const availableBoards=(state.availableBoards||[]).filter(b=>memberIds.has(b.owner)&&!boardLinks.has(b.id));
      const submitted=boards.reduce((n,b)=>n+Number(b.submissions||0),0);
      const reviewed=boards.reduce((n,b)=>n+Number(b.reviewed||0),0);
      panel.innerHTML=
        '<p class="meta">Trung tâm quản lý trường, giáo viên, bảng lớp và chính sách AI Agent. '+
        'Chỉ hiển thị các trường và thông tin thuộc phạm vi được phân quyền.</p>'+
        '<div class="row-gap" style="align-items:end;flex-wrap:wrap">'+
        '<label class="fld"><span>Chọn trường</span><select id="sm-school">'+
        (state.schools.map(x=>'<option value="'+esc(x.id)+'"'+
          (x.id===selected?' selected':'')+'>'+esc(x.code+' – '+x.name)+'</option>').join('')||
          '<option value="">Chưa có trường được phân quyền</option>')+
        '</select></label><button type="button" class="btn btn-soft" id="sm-refresh">Cập nhật</button>'+
        (state.platformAdmin?'<button type="button" class="btn btn-brand" id="sm-show-create">Thêm trường mới</button>':'')+
        '</div><p class="meta" role="status">'+esc(message)+'</p>'+
        (state.platformAdmin&&showCreate?
          '<section class="pg-box"><h4>Tạo trường học</h4>'+
          '<div class="row-gap" style="flex-wrap:wrap">'+
          '<label class="fld"><span>Mã trường</span><input id="sm-code" maxlength="24" placeholder="VD: TRUONG_NARI_1"></label>'+
          '<label class="fld"><span>Tên trường</span><input id="sm-name" maxlength="160" placeholder="Tên trường đầy đủ"></label>'+
          '<button type="button" class="btn btn-brand" id="sm-create">Tạo trường</button></div>'+
          '<p class="meta">Mã trường không trùng. Không tự gán giáo viên hoặc bảng lớp hiện có.</p></section>':'')+
        (s?
          '<div class="pg-stats">'+b('Giáo viên/thành viên',members.length)+
          b('Bảng lớp đã liên kết',boards.length)+b('Bài học sinh đã nộp',submitted)+
          b('Bài có điểm GV duyệt',reviewed)+'</div>'+
          '<p class="meta"><strong>'+esc(s.name)+'</strong> · '+esc(s.code)+
          ' · Vai trò: '+(state.platformAdmin?'Quản trị hệ thống':manager?'Quản trị trường':'Giáo viên')+
          '</p>'+
          '<section class="pg-box"><h4>AI Agent của trường</h4>'+
          '<div class="row-gap" style="flex-wrap:wrap">'+
          [['agentReview','AgentReview · Phân tích và duyệt'],['progressTracker','ProgressTracker · Tiến bộ'],
          ['classReport','ClassReport · Báo cáo']].map(([key,label])=>
            '<label class="chk"><input type="checkbox" data-sm-agent="'+key+'"'+
            (s.policy?.[key]!==false?' checked':'')+(!manager?' disabled':'')+
            '> '+label+'</label>').join('')+'</div>'+
          (manager?'<p><button type="button" class="btn btn-brand" id="sm-save-policy">Lưu cấu hình AI Agent</button></p>':'')+
          '<p class="meta">Chính sách áp dụng cho các bảng đã liên kết với trường này. AgentReview được kiểm tra phía máy chủ; hai báo cáo được kiểm tra quyền khi mở. Chấm điểm AI cũ và lớp chưa liên kết không tự bị thay đổi.</p></section>'+
          (manager?
          '<section class="pg-box"><h4>Giáo viên trong trường</h4>'+
          '<div class="row-gap" style="flex-wrap:wrap;align-items:end">'+
          (state.platformAdmin?
            '<label class="fld"><span>Giáo viên đang hoạt động</span><select id="sm-member-choice"><option value="">Chọn giáo viên</option>'+
            availableTeachers.map(p=>'<option value="'+esc(p.id)+'">'+esc((p.full_name||p.email)+' · '+p.email)+'</option>').join('')+
            '</select></label>':
            '<label class="fld"><span>Email giáo viên đã đăng ký</span><input id="sm-member-email" type="email" placeholder="giaovien@truong.edu.vn"></label>')+
          (state.platformAdmin?
            '<label class="fld"><span>Vai trò</span><select id="sm-member-role"><option value="teacher">Giáo viên</option><option value="manager">Quản trị trường</option></select></label>':'')+
          '<button type="button" class="btn btn-brand" id="sm-add-member">Thêm giáo viên</button>'+
          '</div><p class="meta">Chỉ thêm tài khoản giáo viên đã đăng ký và đang hoạt động. Quản trị trường không có quyền quản trị toàn hệ thống.</p>'+
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Giáo viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>'+
          (members.map(m=>
            '<tr><td><b>'+esc(memberTitle(m))+'</b><small style="display:block">'+
            esc(m.email||'')+'</small></td><td>'+
            (m.memberRole==='manager'?'Quản trị trường':'Giáo viên')+'</td><td>'+
            esc(m.status||'')+'</td><td>'+
            (state.platformAdmin?
              '<button type="button" class="btn btn-sm btn-soft" data-sm-role="'+esc(m.userId)+
              '" data-sm-next="'+(m.memberRole==='manager'?'teacher':'manager')+
              '">'+(m.memberRole==='manager'?'Hạ quyền':'Bổ nhiệm')+'</button> ':'')+
            (m.userId!==deps.myId()&&(m.memberRole!=='manager'||state.platformAdmin)?
              '<button type="button" class="btn btn-sm btn-ghost" data-sm-remove="'+esc(m.userId)+
              '">Gỡ</button>':'')+
            '</td></tr>').join('')||'<tr><td colspan="4">Chưa có thành viên</td></tr>')+
          '</tbody></table></div></section>':'')+
          (manager?
          '<section class="pg-box"><h4>Bảng lớp được gắn với trường</h4>'+
          (state.platformAdmin?
            '<div class="row-gap" style="flex-wrap:wrap;align-items:end">'+
            '<label class="fld"><span>Chọn bảng lớp của giáo viên đã thuộc trường</span>'+
            '<select id="sm-board-choice"><option value="">Chọn bảng lớp</option>'+
            availableBoards.map(b=>'<option value="'+esc(b.id)+'">'+
              esc((b.name||'Bảng')+' · '+(profileMap.get(b.owner)?.full_name||'Giáo viên'))+
              '</option>').join('')+'</select></label>'+
            '<button type="button" class="btn btn-brand" id="sm-link-board">Gắn bảng vào trường</button></div>':'')+
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bảng lớp</th><th>Giáo viên</th>'+
          '<th>Bài nộp</th><th>Đã duyệt</th><th></th></tr></thead><tbody>'+
          (boards.map(b=>
            '<tr><td>'+esc(b.name)+'</td><td>'+
            esc(profileMap.get(b.ownerId)?.full_name||'Chủ bảng')+'</td><td>'+
            Number(b.submissions||0)+'</td><td>'+Number(b.reviewed||0)+'</td><td>'+
            (state.platformAdmin?'<button type="button" class="btn btn-sm btn-ghost" data-sm-unlink="'+
              esc(b.boardId)+'">Bỏ liên kết</button>':'')+'</td></tr>').join('')||
            '<tr><td colspan="5">Chưa có bảng nào liên kết. Dữ liệu cũ được giữ nguyên.</td></tr>')+
          '</tbody></table></div></section>':'')+
          (manager?
          '<details class="pg-box"><summary>Nhật ký quản trị gần đây</summary><ol>'+
          (state.audit||[]).filter(x=>x.school_id===s.id).map(x=>
            '<li>'+esc(new Date(x.recorded_at).toLocaleString('vi-VN'))+' · '+
            esc(actionName[x.operation]||x.operation)+'</li>').join('')+
          '</ol></details>':'')+
          rule:
          '<div class="empty"><h3>Chưa được phân quyền trường học</h3>'+
          '<p>Quản trị hệ thống hãy tạo trường, thêm giáo viên và liên kết bảng một cách chủ động.</p></div>'+
          rule);
      const q=(id)=>panel.querySelector(id);
      q('#sm-school').onchange=e=>{selected=e.target.value;draw();};
      q('#sm-refresh').onclick=()=>refresh();
      q('#sm-show-create')?.addEventListener('click',()=>{showCreate=!showCreate;draw();});
      q('#sm-create')?.addEventListener('click',()=>{
        const code=text(q('#sm-code')?.value),name=text(q('#sm-name')?.value);
        if(code.length<3||name.length<2)return deps.toast('Nhập mã trường và tên trường hợp lệ.');
        run('create_school',{code,name},'Đã tạo trường. Hãy thêm giáo viên và liên kết bảng.');
      });
      if(!s)return;
      q('#sm-save-policy')?.addEventListener('click',()=>{
        const policy={};
        panel.querySelectorAll('[data-sm-agent]').forEach(input=>{
          policy[input.dataset.smAgent]=input.checked;
        });
        run('set_agents',{school_id:s.id,policy},'Đã lưu cấu hình AI Agent của trường.');
      });
      q('#sm-add-member')?.addEventListener('click',()=>{
        const role=q('#sm-member-role')?.value||'teacher';
        const user_id=q('#sm-member-choice')?.value||'';
        const email=text(q('#sm-member-email')?.value).toLowerCase();
        if(!user_id&&!email)return deps.toast('Chọn giáo viên hoặc nhập email đã đăng ký.');
        run('add_member',{school_id:s.id,member_role:role,
          ...(user_id?{user_id}:{email})},'Đã thêm giáo viên vào trường.');
      });
      q('#sm-link-board')?.addEventListener('click',()=>{
        const board_id=q('#sm-board-choice')?.value;
        if(!board_id)return deps.toast('Chọn bảng lớp cần liên kết.');
        run('link_board',{school_id:s.id,board_id},'Đã gắn bảng lớp vào trường.');
      });
      panel.querySelectorAll('[data-sm-role]').forEach(btn=>btn.onclick=()=>{
        const next=btn.dataset.smNext;
        if(!root.confirm('Xác nhận chuyển vai trò thành '+(next==='manager'?'Quản trị trường':'Giáo viên')+'?'))return;
        run('set_manager',{school_id:s.id,user_id:btn.dataset.smRole,member_role:next},'Đã đổi vai trò.');
      });
      panel.querySelectorAll('[data-sm-remove]').forEach(btn=>btn.onclick=()=>{
        if(!root.confirm('Gỡ giáo viên khỏi trường? Dữ liệu bảng lớp không bị xóa.'))return;
        run('remove_member',{school_id:s.id,user_id:btn.dataset.smRemove},'Đã gỡ thành viên.');
      });
      panel.querySelectorAll('[data-sm-unlink]').forEach(btn=>btn.onclick=()=>{
        if(!root.confirm('Bỏ liên kết bảng khỏi trường? Bài và điểm vẫn giữ nguyên.'))return;
        run('unlink_board',{school_id:s.id,board_id:btn.dataset.smUnlink},'Đã bỏ liên kết bảng.');
      });
    }
    panel.innerHTML='<p class="meta">Đang xác minh quyền SchoolManager…</p>';
    void refresh(false);
  }
  root.TuongAiSchoolManagerUI=Object.freeze({open});
})(typeof window!=='undefined'?window:globalThis);
