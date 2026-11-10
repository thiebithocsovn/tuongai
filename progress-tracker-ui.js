/* Teacher-only ProgressTracker dashboard, rendered from already-authorized posts. */
(function (host) {
'use strict';
function open(board, { canUse, openModal, toast, esc, posts, getPost, openDetail }) {
  if (!canUse()) {
    toast('Chỉ giáo viên quản lý lớp được xem ProgressTracker.'); return;
  }
  const model=host.TuongAiProgressTracker;
  if (!model) { toast('Chưa tải được ProgressTracker. Hãy tải lại trang.'); return; }
  const modal=openModal({
    title:'ProgressTracker · '+board.name, wide:true, cls:'progress-modal',
    body:'<div class="modal-b" id="pt-panel"></div>',
    foot:'<button class="btn btn-ghost" data-close>Đóng</button>',
  });
  const root=modal.el.querySelector('#pt-panel');
  let filter='all',query='',selected=null;
  const labels={
    resolved:'Đã khắc phục (GV xác nhận)', improving:'Đang cải thiện',
    remains:'Còn mắc lỗi', unassessed:'Chưa đủ đánh giá',no_evidence:'Chưa xác minh lỗi',
  };
  const fmtNum=v => typeof v==='number' && Number.isFinite(v)
    ? v.toLocaleString('vi-VN',{maximumFractionDigits:2}) : '—';
  function plot(scores) {
    if(scores.length<2) return '<span class="meta">Cần ít nhất 2 bài có điểm giáo viên duyệt.</span>';
    const series=scores.slice(-12),w=180,h=48;
    const pts=series.map((s,i)=>
      (4+i*(w-8)/(series.length-1)).toFixed(1)+','+
      (h-4-Math.max(0,Math.min(10,s.value))*(h-8)/10).toFixed(1)).join(' ');
    return '<svg viewBox="0 0 180 48" width="180" height="48" role="img" aria-label="Biểu đồ điểm đã được giáo viên duyệt theo thời gian"><polyline points="'+pts+
      '" stroke="var(--blue)" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function draw() {
    if (!root.isConnected) return;
    if (!canUse()) { modal.close(); return; }
    const data=model.buildBoard(posts(),board.id,board.assignment?.maxScore||10);
    const summary=data.summary;
    const visible=data.students.filter(s=>
      (filter==='all' || s.status===filter ||
        (filter==='unassessed' && s.skills.some(x=>x.status==='unassessed'))) &&
      (!query || (s.name+' '+s.className).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))));
    const cards=[
      ['Học sinh / phiên',summary.students],
      ['Bài có điểm GV duyệt',summary.reviewedScores],
      ['Lượt luyện tập xác minh',summary.verifiedAttempts],
      ['Kỹ năng đã khắc phục',summary.skillsResolved],
    ].map(x=>'<div class="stat"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
    const rows=visible.map((s,i)=>{
      const delta=s.scoreDelta==null?'Chưa đủ bài':(s.scoreDelta>0?'+':'')+fmtNum(s.scoreDelta)+' /10';
      const identity=s.identityConfidence==='name_only'?' · Cần đối chiếu định danh':'';
      return '<tr><td><strong>'+esc(s.name)+'</strong><small style="display:block">'+
        esc(s.className||'Chưa ghi lớp')+identity+'</small></td><td>'+s.approvedScores.length+
        '</td><td>'+fmtNum(s.scoreAverage)+'</td><td>'+esc(delta)+'</td><td>'+
        (s.skillsTotal?s.skillsResolved+'/'+s.skillsTotal:'—')+
        '<small style="display:block">'+esc(labels[s.status])+'</small></td>'+
        '<td><button type="button" class="btn btn-sm btn-soft" data-pt-detail="'+i+
        '">Xem</button></td></tr>';
    }).join('');
    const active=visible.find(s=>s.postIds.includes(selected));
    const detail=active?'<section class="pg-box" style="margin-top:16px">'+
      '<h4>Chi tiết '+esc(active.name)+'</h4>'+
      '<p class="meta">Điểm thay đổi chỉ mang tính mô tả; các bài có thể khác độ khó.</p>'+
      plot(active.approvedScores)+
      '<p class="meta">Điểm đã duyệt: '+active.approvedScores.length+
      ' bài; chênh lệch đầu đến cuối: '+(active.scoreDelta==null?'Chưa đủ dữ liệu':
        (active.scoreDelta>0?'+':'')+fmtNum(active.scoreDelta)+' /10')+'.</p><ul>'+
      (active.skills.map(k=>'<li><strong>'+esc(k.skill)+'</strong>: '+
        esc(labels[k.status])+' · '+k.attempts+' lượt giáo viên đánh giá'+
        ' <button type="button" class="btn btn-sm btn-soft" data-pt-open="'+
        esc(k.samplePostId)+'">Mở minh chứng</button></li>').join('')||
        '<li>Chưa có kỹ năng được giáo viên xác minh.</li>')+
      '</ul><button type="button" class="btn btn-sm btn-soft" data-pt-open="'+
      esc(active.latestPostId)+'">Xem bài nộp gần nhất</button></section>':'';
    root.innerHTML=
      '<p class="meta">Thống kê được tính tự động từ kết quả <b>giáo viên đã duyệt</b>. '+
      'Không sử dụng điểm AI chưa duyệt hoặc suy đoán nguyên nhân. Dữ liệu chỉ hiển thị cho giáo viên có quyền quản lý bảng.</p>'+
      '<div class="pg-stats">'+cards+'</div>'+
      '<div class="pg-two">'+
      '<section class="pg-box"><h4>Cần giáo viên xử lý</h4><p>'+
      summary.pendingPosts+' bài chưa có phê duyệt; '+summary.skillsUnassessed+
      ' kỹ năng chưa đủ đánh giá luyện tập.</p>'+
      '<p class="meta">Chỉ ghi “Đã khắc phục” khi mọi bài luyện tập liên quan có đánh giá gần nhất đạt và có căn cứ xác minh của giáo viên.</p></section>'+
      '<section class="pg-box"><h4>Độ tin cậy dữ liệu</h4>'+
      '<p class="meta">Chỉ tính lớp '+esc(board.name)+
      '. Học sinh nộp ở các thiết bị khác nhau có thể xuất hiện ở nhiều dòng; '+
      'không tự gộp chỉ bằng họ tên. Không dùng thống kê này làm minh chứng thực nghiệm nếu chưa thẩm định.</p></section></div>'+
      '<div class="row-gap" style="align-items:end;flex-wrap:wrap;margin:12px 0">'+
      '<label class="fld"><span>Trạng thái</span><select id="pt-filter">'+[
        ['all','Tất cả'],['unassessed','Chưa đủ đánh giá'],['remains','Còn mắc lỗi'],
        ['improving','Đang cải thiện'],['resolved','Đã khắc phục'],['no_evidence','Chưa xác minh lỗi'],
      ].map(x=>'<option value="'+x[0]+'"'+(x[0]===filter?' selected':'')+'>'+x[1]+'</option>').join('')+
      '</select></label>'+
      '<label class="fld"><span>Tìm học sinh</span><input id="pt-search" type="search" placeholder="Tên hoặc lớp" value="'+
      esc(query)+'"></label><button type="button" class="btn btn-soft" id="pt-refresh">Cập nhật</button></div>'+
      (rows?'<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
       '<th>Học sinh</th><th>Bài duyệt</th><th>Điểm TB /10</th>'+
       '<th>Thay đổi điểm</th><th>Kỹ năng</th><th></th></tr></thead><tbody>'+
       rows+'</tbody></table></div>':
       '<div class="empty"><h3>Chưa có dữ liệu</h3><p>Hãy duyệt bài và đánh giá luyện tập để theo dõi tiến bộ.</p></div>')+
      detail+
      '<p class="meta" style="margin-top:12px">Bảng phân tích chỉ đọc, không sửa điểm, nhận xét hay hồ sơ TN1–TN4.</p>';
    root.querySelector('#pt-filter').onchange=e=>{filter=e.target.value;selected=null;draw();};
    root.querySelector('#pt-search').onchange=e=>{query=e.target.value.trim();selected=null;draw();};
    root.querySelector('#pt-refresh').onclick=draw;
    root.querySelectorAll('[data-pt-detail]').forEach(btn=>btn.onclick=()=>{
      const person=visible[Number(btn.dataset.ptDetail)];
      if(person){selected=person.latestPostId;draw();}
    });
    root.querySelectorAll('[data-pt-open]').forEach(btn=>btn.onclick=()=>{
      if (!canUse()) return;
      const p=getPost(btn.dataset.ptOpen);
      if(!p || p.boardId!==board.id)return;
      modal.close();openDetail(p.id,false);
    });
  }
  draw();
}
host.TuongAiProgressTrackerUI = Object.freeze({ open });
})(window);
