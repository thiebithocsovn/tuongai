/* ClassReport – teacher-only read-only report, spreadsheet export and print/PDF. */
(function(root){
'use strict';
function open(board, deps) {
  if (!deps?.canUse?.() || !board || board.demo || board.trashed) {
    deps?.toast?.('Chỉ giáo viên quản lý bảng thật mới xem được ClassReport.'); return;
  }
  const engine=root.TuongAiClassReport;
  if (!engine) { deps.toast('Chưa tải được ClassReport. Hãy tải lại trang.'); return; }
  let period='all', from='', to='', busy=false;
  const modal=deps.openModal({
    title:'ClassReport · '+board.name,wide:true,
    body:'<div class="modal-b" id="cr-root"></div>',
    foot:'<button class="btn btn-ghost" data-close>Đóng</button>',
  });
  const panel=modal.el.querySelector('#cr-root');
  const esc=deps.esc;
  const fmt=n=>typeof n==='number' && Number.isFinite(n)
    ? n.toLocaleString('vi-VN',{maximumFractionDigits:2}) : '—';
  const pct=n=>n===null?'—':fmt(n)+'%';
  const dateValue=v=>typeof v==='number' && Number.isFinite(v)
    ? new Date(v).toLocaleDateString('vi-VN'):'—';
  const csvSafe=s=>{
    if (typeof s==='number' && Number.isFinite(s)) return String(s);
    const v=String(s??'');
    const guarded=/^[\s]*[=+\-@]/.test(v)?"'"+v:v;
    return '"'+guarded.replace(/"/g,'""')+'"';
  };
  const excelSafe=s=>typeof s==='string' && /^[\s]*[=+\-@]/.test(s)?"'"+s:s;
  function range() {
    const now=Date.now();
    if(period==='7')return {startAt:now-7*86400000,endAt:now};
    if(period==='30')return {startAt:now-30*86400000,endAt:now};
    if(period!=='custom')return {};
    if(from && to && from>to)throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    const startAt=from?new Date(from+'T00:00:00').getTime():null;
    const endAt=to?new Date(to+'T23:59:59.999').getTime():null;
    if(startAt!==null&&!Number.isFinite(startAt) || endAt!==null&&!Number.isFinite(endAt))
      throw new Error('Ngày báo cáo không hợp lệ.');
    return { ...(startAt!==null?{startAt}:{}), ...(endAt!==null?{endAt}:{}) };
  }
  function report(){
    if(!deps.canUse())throw new Error('Phiên làm việc đã hết quyền xem báo cáo.');
    return engine.build(deps.posts(),board,range());
  }
  function labelRange(r){
    if(r.startAt!==null&&r.endAt!==null)return dateValue(r.startAt)+' – '+dateValue(r.endAt);
    if(r.startAt!==null)return 'Từ '+dateValue(r.startAt);
    if(r.endAt!==null)return 'Đến '+dateValue(r.endAt);
    return 'Toàn bộ thời gian';
  }
  function stats(r) {
    const s=r.summary;
    return [['Bài học sinh nộp',s.submitted],['Bài có điểm GV duyệt',s.reviewed],
      ['Bài chưa có điểm duyệt hợp lệ',s.pending],['Tỷ lệ bài có điểm duyệt',pct(s.approvalRate)],
      ['Điểm trung bình /10',fmt(s.avgScore10)],['Số phiên học sinh',s.studentSessions],
      ['Lỗi được giáo viên xác nhận',s.confirmedErrors],['Lượt luyện tập GV đánh giá',s.verifiedAttempts]]
      .map(x=>'<div class="stat"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
  }
  function draw(error=''){
    if(!panel.isConnected)return;
    let r;
    try{r=report();}catch(e){error=e.message||'Không thể tính báo cáo.';}
    const skills=r?.topSkills||[],weekly=r?.weekly||[];
    panel.innerHTML=
      '<p class="meta">Báo cáo nội bộ cho giáo viên. Các chỉ số được tính <b>từ dữ liệu đang có</b>; không ghi lại điểm, không tự sửa căn cứ và không tự nhận hoàn thành nghiên cứu.</p>'+
      '<div class="row-gap" style="align-items:end;flex-wrap:wrap;gap:10px">'+
      '<label class="fld"><span>Kỳ báo cáo</span><select id="cr-period">'+
      [['all','Toàn bộ thời gian'],['7','7 ngày gần nhất'],['30','30 ngày gần nhất'],['custom','Tùy chọn ngày']]
        .map(x=>'<option value="'+x[0]+'"'+(period===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+
      '</select></label><label class="fld" id="cr-from-box" '+(period!=='custom'?'hidden':'')+
      '><span>Từ ngày</span><input id="cr-from" type="date" value="'+esc(from)+'"></label>'+
      '<label class="fld" id="cr-to-box" '+(period!=='custom'?'hidden':'')+
      '><span>Đến ngày</span><input id="cr-to" type="date" value="'+esc(to)+'"></label>'+
      '<button class="btn btn-soft" id="cr-refresh">Làm mới dữ liệu</button></div>'+
      '<p id="cr-error" class="form-err" role="alert">'+esc(error)+'</p>'+
      (r?'<div class="pg-stats">'+stats(r)+'</div>'+
      '<div class="pg-two"><section class="pg-box"><h4>Lỗi/kỹ năng cần hỗ trợ</h4>'+
      (skills.length?'<ol class="pg-skills">'+skills.slice(0,5).map(x=>
        '<li><span>'+esc(x.skill)+'</span><b>'+x.confirmedErrors+' lượt</b></li>').join('')+'</ol>':
        '<p class="meta">Chưa có nguyên nhân lỗi được giáo viên xác nhận.</p>')+'</section>'+
      '<section class="pg-box"><h4>Gợi ý công việc (tự tổng hợp)</h4><ul>'+
      r.recommendations.map(x=>'<li>'+esc(x)+'</li>').join('')+
      '</ul><p class="meta">Giáo viên quyết định nội dung nhận xét và biện pháp thực hiện.</p></section></div>'+
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tuần bắt đầu</th><th>Bài nộp</th><th>Bài duyệt</th><th>Điểm TB /10</th></tr></thead><tbody>'+
      (weekly.map(w=>'<tr><td>'+esc(w.week)+'</td><td>'+w.submitted+'</td><td>'+w.reviewed+
      '</td><td>'+fmt(w.avgScore10)+'</td></tr>').join('')||
      '<tr><td colspan="4">Chưa có bài nộp trong kỳ.</td></tr>')+'</tbody></table></div>'+
      '<p class="meta">'+esc(r.note)+'</p>':'')+
      '<div class="row-gap" style="flex-wrap:wrap;margin-top:14px">'+
      '<button type="button" class="btn btn-brand" id="cr-xlsx" '+(!r?'disabled':'')+'>Tải báo cáo Excel</button>'+
      '<button type="button" class="btn btn-soft" id="cr-print" '+(!r?'disabled':'')+'>In / Lưu PDF</button></div>'+
      '<p class="meta">Bản Excel chứa danh sách bài và nhận xét đã duyệt, chỉ gửi cho người có thẩm quyền. PDF sử dụng hộp thoại in của trình duyệt.</p>';
    panel.querySelector('#cr-period').onchange=e=>{period=e.target.value;draw();};
    if(period==='custom'){
      panel.querySelector('#cr-from').onchange=e=>{from=e.target.value;draw();};
      panel.querySelector('#cr-to').onchange=e=>{to=e.target.value;draw();};
    }
    panel.querySelector('#cr-refresh').onclick=async()=>{
      if(busy)return;
      busy=true; const button=panel.querySelector('#cr-refresh');button.disabled=true;
      try{await deps.reload();draw();}catch(e){draw('Không cập nhật được dữ liệu: '+(e.message||'Lỗi đọc dữ liệu'));}
      finally{busy=false;}
    };
    if(r) {
      panel.querySelector('#cr-xlsx').onclick=()=>downloadExcel(report()).catch(e=>deps.toast(
        'Không xuất được Excel: '+(e.message||'Lỗi tệp')));
      panel.querySelector('#cr-print').onclick=()=>printReport(report());
    }
  }
  function sheets(r) {
    const s=r.summary;
    const overview=[
      ['BÁO CÁO TỔNG HỢP LỚP HỌC – ClassReport'],
      ['Trường',r.school],['Bảng/lớp',r.boardName],['Môn',r.subject],
      ['Khối',r.grade],['Kỳ báo cáo',labelRange(r)],
      ['Ngày lập',new Date().toLocaleString('vi-VN')],
      ['Chỉ số','Giá trị'],
      ['Bài học sinh nộp',s.submitted],['Bài có điểm GV duyệt',s.reviewed],
      ['Bài chưa có điểm duyệt hợp lệ',s.pending],
      ['Tỷ lệ có điểm GV duyệt (%)',s.approvalRate??'Chưa có dữ liệu'],
      ['Điểm TB thang 10',s.avgScore10??'Chưa có dữ liệu'],
      ['Số phiên học sinh (không phải số người)',s.studentSessions],
      ['Lỗi giáo viên xác nhận',s.confirmedErrors],
      ['Lượt luyện tập giáo viên đánh giá',s.verifiedAttempts],
      ['Số lượt đánh giá Đã khắc phục',s.resolvedAttempts],
      ['Kỹ năng/bài tập chưa đủ đánh giá',s.unassessedSkills],
      [],['Gợi ý công việc do hệ thống tự tổng hợp'],
      ...r.recommendations.map(x=>[x]),
      [],['Giới hạn sử dụng',r.note],
      [],['Người lập báo cáo (ký, ghi rõ họ tên)',''],
    ];
    const entries=[['STT','Họ tên học sinh','Lớp','Ngày nộp','Trạng thái',
      'Điểm /10 GV duyệt','Kỹ năng/lỗi đã xác nhận','Nhận xét GV đã duyệt']];
    for(let i=0;i<r.entries.length;i++){
      const x=r.entries[i];
      entries.push([i+1,x.studentName,x.studentClass,dateValue(x.createdAt),x.status,
        x.score10??'',x.confirmedSkills.join('; '),x.teacherComment]);
    }
    const skills=[['Kỹ năng','Số lỗi GV xác nhận','Lượt luyện tập GV đánh giá',
      'Lượt đánh giá Đã khắc phục'],
      ...r.topSkills.map(x=>[x.skill,x.confirmedErrors,x.verifiedAttempts,x.resolvedAttempts])];
    const weeks=[['Tuần bắt đầu','Bài nộp','Bài duyệt','Điểm TB /10'],
      ...r.weekly.map(x=>[x.week,x.submitted,x.reviewed,x.avgScore10??''])];
    return [
      {name:'Tổng quan',data:overview},
      {name:'Bài nộp',data:entries},
      {name:'Kỹ năng',data:skills},
      {name:'Theo tuần',data:weeks},
    ];
  }
  async function downloadExcel(r) {
    if(busy)return;
    busy=true;
    try{
      const name='ClassReport_'+deps.slug(r.boardName)+'_'+new Date().toISOString().slice(0,10);
      const groups=sheets(r);
      if(await deps.loadXLSX()) {
        const wb=root.XLSX.utils.book_new();
        for(const group of groups) {
          const rows=group.data.map(row=>row.map(excelSafe));
          const ws=root.XLSX.utils.aoa_to_sheet(rows);
          ws['!cols']=rows[0]?.map((_,i)=>({wch:i===0?35:i===1?27:22}))||[];
          root.XLSX.utils.book_append_sheet(wb,ws,group.name);
        }
        root.XLSX.writeFile(wb,name+'.xlsx');
      } else {
        // UTF-8 CSV fallback when the existing XLSX dependency cannot be downloaded.
        const sections=groups.flatMap(g=>[[g.name],...g.data,[]]);
        const csv='\uFEFF'+sections.map(row=>row.map(csvSafe).join(',')).join('\r\n');
        const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        deps.toast('Không tải được thư viện Excel; đã xuất CSV UTF-8 thay thế.');
      }
    } finally {busy=false;}
  }
  function printReport(r) {
    if(!deps.canUse())return deps.toast('Không còn quyền xem báo cáo.');
    const x=r.summary;
    const area=document.createElement('div');
    area.id='print-area';
    const info=[r.school,r.subject,r.grade].filter(Boolean).join(' · ');
    area.innerHTML=
      '<header><h1>BÁO CÁO TỔNG HỢP KẾT QUẢ HỌC TẬP</h1>'+
      '<p><b>'+esc(r.boardName)+'</b> · '+esc(info)+'</p>'+
      '<p>Kỳ báo cáo: '+esc(labelRange(r))+' · Lập ngày '+
      esc(new Date().toLocaleString('vi-VN'))+'</p>'+
      '<p><em>Báo cáo nội bộ – dữ liệu giáo viên đã phê duyệt</em></p></header>'+
      '<table><tbody>'+
      [['Số bài nộp',x.submitted],['Bài có điểm GV duyệt',x.reviewed],
        ['Bài chưa có điểm duyệt hợp lệ',x.pending],
        ['Tỷ lệ duyệt',pct(x.approvalRate)],['Điểm trung bình /10',fmt(x.avgScore10)],
        ['Lỗi được giáo viên xác nhận',x.confirmedErrors],
        ['Lượt luyện tập GV đánh giá',x.verifiedAttempts],
        ['Số kỹ năng/bài tập chưa đủ đánh giá',x.unassessedSkills]]
        .map(row=>'<tr><th>'+esc(row[0])+'</th><td>'+esc(row[1])+'</td></tr>').join('')+
      '</tbody></table>'+
      '<h2>Kỹ năng cần hỗ trợ</h2>'+
      '<table><thead><tr><th>Kỹ năng</th><th>Lỗi được xác nhận</th>'+
      '<th>Lượt luyện tập GV đánh giá</th></tr></thead><tbody>'+
      (r.topSkills.slice(0,10).map(a=>'<tr><td>'+esc(a.skill)+'</td><td>'+
        a.confirmedErrors+'</td><td>'+a.verifiedAttempts+'</td></tr>').join('')||
        '<tr><td colspan="3">Chưa có dữ liệu giáo viên xác minh.</td></tr>')+
      '</tbody></table>'+
      '<h2>Tiến độ theo tuần</h2><table><thead><tr><th>Tuần bắt đầu</th>'+
      '<th>Bài nộp</th><th>Đã duyệt</th><th>Điểm TB /10</th></tr></thead><tbody>'+
      (r.weekly.map(w=>'<tr><td>'+esc(w.week)+'</td><td>'+w.submitted+'</td><td>'+
        w.reviewed+'</td><td>'+fmt(w.avgScore10)+'</td></tr>').join('')||
        '<tr><td colspan="4">Chưa có bài trong kỳ báo cáo.</td></tr>')+
      '</tbody></table>'+
      '<h2>Nhận định và đề xuất chuyên môn (cần giáo viên kiểm chứng)</h2><ul>'+
      r.recommendations.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>'+
      '<p><i>'+esc(r.note)+'</i></p>'+
      '<div style="display:flex;justify-content:flex-end;margin:24pt 12pt">'+
      '<div style="text-align:center;min-width:210px"><b>NGƯỜI LẬP BÁO CÁO</b>'+
      '<p>(Ký, ghi rõ họ tên)</p><div style="height:54pt"></div></div></div>';
    document.querySelector('#print-area')?.remove();
    document.body.appendChild(area); document.body.classList.add('printing');
    let cleaned=false;
    const done=()=>{
      if(cleaned)return;cleaned=true;
      document.body.classList.remove('printing');area.remove();
      root.removeEventListener('afterprint',done);
    };
    root.addEventListener('afterprint',done);
    try{root.print();}catch(e){done();deps.toast('Không mở được hộp thoại in: '+e.message);}
    setTimeout(()=>{if(!root.matchMedia?.('print').matches)done();},1500);
  }
  draw();
}
root.TuongAiClassReportUI=Object.freeze({open});
})(typeof window!=='undefined'?window:globalThis);
