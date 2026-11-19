/* SchoolManager live directory: displays registered schools before tenant activation.
   The browser only renders server-verified admin-scoped data; writes go through the server. */
(function(root){
  'use strict';
  let expandedKey='';
  const number=v=>Number(v||0).toLocaleString('vi-VN');
  const txt=v=>String(v??'');
  const unique=a=>[...new Set(a)];
  function render(state,esc){
    if(!state?.platformAdmin)return '';
    const groups=state.directory||[];
    if(!groups.length)return '';
    const pending=groups.filter(x=>!x.schoolId);
    const totalBoards=groups.reduce((n,x)=>n+x.boardIds.length,0);
    const totalTeachers=unique(groups.flatMap(x=>x.teacherIds)).length;
    const review=groups.reduce((n,x)=>n+x.reviewBoardIds.length,0);
    const unassigned=(state.availableTeachers||[]).filter(t=>!txt(t.school).trim());
    const picked=groups.find(x=>x.key===expandedKey);
    const people=new Map((state.availableTeachers||[]).map(t=>[t.id,t]));
    const boards=new Map((state.availableBoards||[]).map(b=>[b.id,b]));
    const linked=new Set((state.boards||[]).map(b=>b.boardId));
    const stat=(label,value)=>'<div class="stat"><span>'+label+'</span><b>'+esc(number(value))+'</b></div>';
    let html='<section class="pg-box" id="sm-live-directory" aria-label="Danh bạ trường hiện có">'+
      '<h4>Danh bạ trường học · Đồng bộ từ dữ liệu hiện có</h4>'+
      '<p class="meta">Tự phát hiện từ hồ sơ giáo viên và bảng lớp. Gộp cách viết tương đương, giữ riêng các tên có thể khác cấp học.</p>'+
      '<div class="pg-stats">'+stat('Đơn vị nhận diện',groups.length)+
      stat('Giáo viên',totalTeachers)+stat('Bảng lớp',totalBoards)+
      stat('Cần đối chiếu',review)+'</div>'+
      '<div class="row-gap" style="flex-wrap:wrap;align-items:end">'+
      '<label class="fld"><span>Tìm nhanh trường học</span><input type="search" id="sm-directory-search" placeholder="Nhập tên trường…"></label>'+
      (pending.length?'<button type="button" class="btn btn-brand" id="sm-directory-sync-all">Đồng bộ '+pending.length+' trường</button>':'')+
      '</div>'+(unassigned.length?'<p class="meta"><strong>'+esc(number(unassigned.length))+' giáo viên chưa khai báo trường.</strong> Hãy bổ sung đơn vị trong hồ sơ thành viên trước khi gán vào trường.</p>':'')+
      '<p class="meta">Bảng phù hợp với trường của giáo viên chủ sở hữu sẽ được liên kết; bảng do quản trị tạo hoặc ghi khác tên trường được giữ lại để xác minh. Không thay đổi bài, điểm hay quyền quản trị.</p>'+
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Trường / đơn vị</th><th>Giáo viên</th><th>Bảng lớp</th><th>Cần rà soát</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
    html+=groups.map(x=>
      '<tr data-sm-directory-row data-sm-search="'+esc([x.name,...x.variants].join(' ').toLocaleLowerCase('vi'))+'">'+
      '<td><strong>'+esc(x.name)+'</strong><small style="display:block">'+
      esc(x.variants.length>1?x.variants.length+' cách ghi tên đã nhóm':'Từ hồ sơ hiện có')+'</small></td>'+
      '<td>'+esc(number(x.teacherIds.length))+'</td>'+
      '<td>'+esc(number(x.boardIds.length))+'</td>'+
      '<td>'+(x.reviewBoardIds.length?'<strong>'+esc(number(x.reviewBoardIds.length))+' cần kiểm tra</strong>':'Đã khớp')+'</td>'+
      '<td>'+(x.schoolId?'Đang quản lý':'Đã phát hiện')+'</td>'+
      '<td><button type="button" class="btn btn-sm btn-soft" data-sm-directory-detail="'+esc(x.key)+'">Xem</button> '+
      (x.schoolId?'<button type="button" class="btn btn-sm btn-soft" data-sm-directory-manage="'+esc(x.schoolId)+'">Quản lý</button>':
        '<button type="button" class="btn btn-sm btn-brand" data-sm-directory-activate="'+esc(x.key)+'">Kích hoạt</button>')+
      '</td></tr>').join('');
    html+='</tbody></table></div>';
    if(picked){
      html+='<details class="pg-box" open><summary>Chi tiết · '+esc(picked.name)+'</summary>'+
        '<p class="meta">Các cách ghi đã nhóm: '+esc(picked.variants.join(' • '))+'</p>'+
        '<p><strong>Giáo viên:</strong> '+(picked.teacherIds.map(id=>esc(people.get(id)?.full_name||'Giáo viên')).join(', ')||'Chưa có')+'</p>'+
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bảng lớp</th><th>Chủ sở hữu</th><th>Tên trường khai báo</th><th>Đối chiếu</th></tr></thead><tbody>'+
        picked.boardIds.map(id=>{
          const b=boards.get(id)||{},p=people.get(b.owner);
          return '<tr><td>'+esc(b.name||'Bảng lớp')+'</td><td>'+esc(p?.full_name||'Quản trị / tài khoản khác')+
            '</td><td>'+esc(b.school||'')+'</td><td>'+
            (linked.has(id)?'Đã liên kết':picked.readyBoardIds.includes(id)?'Đủ điều kiện liên kết':'Cần xác minh')+
            '</td></tr>';
        }).join('')+'</tbody></table></div>'+
        (picked.reviewBoardIds.length&&state.schools.length?
          '<section class="pg-box"><h4>Phê duyệt liên kết hàng loạt</h4>'+
          '<p class="meta">Có '+esc(number(picked.reviewBoardIds.length))+' bảng chưa khớp tự động. Chỉ chọn trường đích sau khi xác minh chính xác đơn vị và chủ bảng; các bảng không đủ quyền vẫn được bỏ qua.</p>'+
          '<div class="row-gap" style="flex-wrap:wrap;align-items:end"><label class="fld"><span>Trường đích đã xác minh</span>'+
          '<select id="sm-directory-target"><option value="">-- Chọn trường đích --</option>'+
          state.schools.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')+
          '</select></label><button type="button" class="btn btn-brand" id="sm-directory-reconcile">Duyệt và liên kết</button></div></section>':'')+
        '</details>';
    }
    return html+'</section>';
  }
  function bind(panel,state,{redraw,run,manage,confirm}){
    if(!state?.platformAdmin)return;
    panel.querySelector('#sm-directory-search')?.addEventListener('input',event=>{
      const query=txt(event.target.value).trim().toLocaleLowerCase('vi');
      panel.querySelectorAll('[data-sm-directory-row]').forEach(row=>{
        row.hidden=!txt(row.dataset.smSearch).includes(query);
      });
    });
    panel.querySelectorAll('[data-sm-directory-detail]').forEach(el=>{
      el.addEventListener('click',()=>{expandedKey=el.dataset.smDirectoryDetail;redraw();});
    });
    panel.querySelectorAll('[data-sm-directory-manage]').forEach(el=>{
      el.addEventListener('click',()=>manage(el.dataset.smDirectoryManage));
    });
    panel.querySelectorAll('[data-sm-directory-activate]').forEach(el=>{
      el.addEventListener('click',()=>{
        const group=(state.directory||[]).find(g=>g.key===el.dataset.smDirectoryActivate);
        if(!group)return;
        if(!confirm('Kích hoạt '+group.name+'? Hệ thống chỉ tự gắn giáo viên và bảng lớp khớp chính xác; các bảng có mâu thuẫn được giữ để xác minh.'))return;
        run('activate_directory',{key:group.key},'Đã kích hoạt '+group.name+'. Các trường hợp chưa khớp vẫn chờ rà soát.');
      });
    });
    panel.querySelector('#sm-directory-reconcile')?.addEventListener('click',()=>{
      const target=panel.querySelector('#sm-directory-target')?.value;
      const group=(state.directory||[]).find(g=>g.key===expandedKey);
      const school=(state.schools||[]).find(s=>s.id===target);
      if(!group||!school)return;
      if(!confirm('Xác nhận chuyển liên kết các bảng chưa khớp của “'+group.name+
        '” sang “'+school.name+'”? Chỉ các bảng do giáo viên thuộc trường đích hoặc tài khoản quản trị sở hữu mới được gắn. Bài và điểm không thay đổi.'))return;
      run('reconcile_directory',{key:group.key,school_id:school.id},
        'Đã ghi nhận kết quả phê duyệt bảng lớp.');
    });
    panel.querySelector('#sm-directory-sync-all')?.addEventListener('click',()=>{
      const pending=(state.directory||[]).filter(g=>!g.schoolId);
      if(!pending.length)return;
      if(!confirm('Đồng bộ '+pending.length+' trường từ dữ liệu đã đăng ký? Chỉ tạo liên kết rõ ràng; trường hợp không khớp và các bảng do quản trị tạo sẽ chờ đối chiếu.'))return;
      run('activate_directory',{},'Đã đồng bộ các trường từ dữ liệu hiện có. Hãy kiểm tra những bảng cần đối chiếu.');
    });
  }
  root.TuongAiSchoolDirectoryUI=Object.freeze({render,bind});
})(typeof window!=='undefined'?window:globalThis);
