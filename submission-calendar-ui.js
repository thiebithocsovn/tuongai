/* Tường học tập AI – teacher submission browser, read-only. */
(function(host){
'use strict';
function start(board,deps){
  if(!deps.canUse(board)){deps.toast('Không có quyền xem bài nộp của bảng này.');return;}
  var scope='board',tab='date',period='day',dateKey=localKey(new Date()),monthKey=dateKey.slice(0,7);
  var search='',student='all',state='all',selected='',limit=50;
  var modal=deps.openModal({
    title:'Bài nộp & tiến bộ · '+board.name,wide:true,cls:'progress-modal submission-browser',
    body:'<div class="modal-b" id="pg"></div>',
    foot:'<button class="btn btn-ghost" data-close>Đóng</button><button class="btn btn-brand" data-pt2-export>Xuất Excel hoặc in PDF</button>'
  });
  var root=modal.el.querySelector('#pg');
  var esc=deps.esc;
  function localKey(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function dayDate(key){
    var d=new Date(key+'T12:00:00');
    return Number.isFinite(d.getTime())?d:new Date();
  }
  function keyOf(p){
    var t=Number(p.createdAt);
    if(!Number.isFinite(t)||t<=0){t=Date.parse(p.createdAt)||0;}
    return t>0?localKey(new Date(t)):'';
  }
  function timeOf(p){
    var t=Number(p.createdAt);
    if(!Number.isFinite(t)||t<=0)t=Date.parse(p.createdAt)||0;
    return t>0?t:0;
  }
  function fmtTime(p){
    var t=timeOf(p);
    return t?new Date(t).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'Chưa có giờ nộp';
  }
  function fmtDate(key){
    var d=dayDate(key);
    return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function shift(days){
    var d=dayDate(dateKey);d.setDate(d.getDate()+days);
    dateKey=localKey(d);monthKey=dateKey.slice(0,7);
  }
  function authorized(){
    if(!deps.canUse(board)){modal.close();return [];}
    var p=scope==='board'?deps.posts():deps.allPosts().filter(function(x){
      var b=deps.getBoard(x.boardId);
      return b&&!b.demo&&!b.trashed&&deps.canUse(b);
    });
    return p.filter(function(x){
      return x&&x.by==='hs'&&x.id&&!deps.isTeacherAnnouncement(x)&&timeOf(x)>0;
    }).sort(function(a,b){return timeOf(b)-timeOf(a);});
  }
  function stateLabel(p){
    var s=deps.status(p);
    if(s==='duyet')return ['Đã duyệt','done'];
    if(s==='ai')return ['AI đã chấm · chờ duyệt','ai'];
    if(s==='dang')return ['Đang xử lý','ai'];
    return ['Chờ chấm','pending'];
  }
  function score(p){
    var n=deps.finalScore(p);
    if(n==null||typeof n!=='number'||!Number.isFinite(n))return 'Chưa có điểm';
    var b=deps.getBoard(p.boardId);
    var max=Number(b&&b.assignment&&b.assignment.maxScore)||10;
    return n.toLocaleString('vi-VN',{maximumFractionDigits:2})+' / '+max;
  }
  function groupKey(p){return String(p.studentName||'').trim().toLocaleLowerCase('vi')+'|'+String(p.studentClass||'').trim().toLocaleLowerCase('vi');}
  function calendar(posts){
    var parts=monthKey.split('-').map(Number),y=parts[0],m=parts[1];
    var first=new Date(y,m-1,1),len=new Date(y,m,0).getDate();
    var offset=(first.getDay()+6)%7;
    var counts={};
    posts.forEach(function(p){var k=keyOf(p);counts[k]=(counts[k]||0)+1;});
    var cells=['T2','T3','T4','T5','T6','T7','CN'].map(function(s){return '<span class="pt2-weekday">'+s+'</span>';}).join('');
    for(var z=0;z<offset;z++)cells+='<span aria-hidden="true"></span>';
    for(var d=1;d<=len;d++){
      var key=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      cells+='<button type="button" class="pt2-date'+(key===dateKey&&period==='day'&&tab==='date'?' selected':'')+(key===localKey(new Date())?' today':'')+'" data-pt2-day="'+key+'" aria-label="'+fmtDate(key)+', '+(counts[key]||0)+' bài nộp" title="'+(counts[key]||0)+' bài nộp">'+d+(counts[key]?'<small>'+counts[key]+'</small>':'')+'</button>';
    }
    return '<div class="pt2-calendar-head"><button type="button" data-pt2-month="-1" aria-label="Tháng trước">‹</button><strong>Tháng '+m+'/'+y+'</strong><button type="button" data-pt2-month="1" aria-label="Tháng tiếp theo">›</button></div><div class="pt2-calendar">'+cells+'</div><p class="pt2-hint">Số nhỏ dưới ngày là số bài đã nộp.</p>';
  }
  function draw(){
    if(!root.isConnected)return;
    var all=authorized();if(!root.isConnected)return;
    var students=new Map();
    all.forEach(function(p){var id=groupKey(p);if(!students.has(id))students.set(id,[(p.studentName||'Chưa ghi tên'),p.studentClass||'']);});
    var keys=Array.from(students.keys()).sort(function(a,b){return a.localeCompare(b,'vi');});
    var q=search.trim().toLocaleLowerCase('vi');
    var cutoff=Date.now()-(period==='7'?7:30)*86400000;
    var filtered=all.filter(function(p){
      if(tab==='date'){
        if(period==='day'&&keyOf(p)!==dateKey)return false;
        if(period!=='day'&&timeOf(p)<cutoff)return false;
      }
      if(student!=='all'&&groupKey(p)!==student)return false;
      if(q&&!(String(p.studentName||'')+' '+String(p.studentClass||'')+' '+String(deps.getBoard(p.boardId)?.name||'')).toLocaleLowerCase('vi').includes(q))return false;
      var s=deps.status(p);
      if(state==='approved'&&s!=='duyet')return false;
      if(state==='ai'&&s!=='ai'&&s!=='dang')return false;
      if(state==='pending'&&s!=='cho')return false;
      return true;
    });
    if(!filtered.some(function(p){return p.id===selected;}))selected=filtered[0]?.id||'';
    var active=filtered.find(function(p){return p.id===selected;});
    var pos=filtered.findIndex(function(p){return p.id===selected;});
    if(pos>=limit)limit=Math.ceil((pos+1)/50)*50;
    var reviewed=filtered.filter(function(p){return !!p.teacher?.approvedAt;}).length;
    var uniq=new Set(filtered.map(groupKey)).size;
    var statCards=[['Bài nộp',filtered.length],['Đã duyệt',reviewed],['Chờ giáo viên duyệt',filtered.length-reviewed],['Học sinh / nhóm tên',uniq]]
      .map(function(x){return '<div class="pt2-stat"><span>'+x[0]+'</span><b>'+x[1].toLocaleString('vi-VN')+'</b></div>';}).join('');
    var title=tab==='student'?'Lịch sử bài nộp':period==='day'?'Ngày '+fmtDate(dateKey):period==='7'?'7 ngày gần nhất':'30 ngày gần nhất';
    var cards=filtered.slice(0,limit).map(function(p){
      var info=stateLabel(p),b=deps.getBoard(p.boardId);
      return '<button type="button" class="pt2-post'+(selected===p.id?' active':'')+'" data-pt2-open="'+esc(String(p.id))+'" aria-pressed="'+(selected===p.id)+'">'+
      '<span class="pt2-post-top"><strong>'+esc(p.studentName||'Chưa ghi tên')+'</strong><time>'+fmtTime(p)+'</time></span>'+
      '<span class="pt2-post-sub">'+esc(p.studentClass||'Chưa ghi lớp')+' · '+esc(b?.assignment?.title||b?.name||'Bài học')+'</span>'+
      '<span class="pt2-post-end"><em class="pt2-chip '+info[1]+'">'+info[0]+'</em><span>'+esc(score(p))+'</span></span></button>';
    }).join('');
    var preview='';
    if(active){
      var ab=deps.getBoard(active.boardId), images=Array.isArray(active.images)?active.images:[];
      var src=images.length?deps.imgSrc(images[0]):'';
      var body=String(active.text||'').trim();
      var attachments=Array.isArray(active.attachments)?active.attachments:[];
      preview='<div class="pt2-preview-head"><div><h3>'+esc(active.studentName||'Chưa ghi tên')+'</h3><p class="pt2-hint">'+esc(active.studentClass||'Chưa ghi lớp')+' · '+esc(ab?.name||'')+' · '+fmtDate(keyOf(active))+' '+fmtTime(active)+'</p></div><div class="pt2-next">'+
        '<button type="button" data-pt2-step="-1" '+(pos<=0?'disabled':'')+' aria-label="Bài trước">‹</button>'+
        '<button type="button" data-pt2-step="1" '+(pos<0||pos>=filtered.length-1?'disabled':'')+' aria-label="Bài tiếp theo">›</button></div></div>'+
        '<div class="pt2-preview-scroll"><div class="pt2-info"><span class="pt2-chip '+stateLabel(active)[1]+'">'+stateLabel(active)[0]+'</span><strong>'+esc(score(active))+'</strong></div>'+
        '<h4>'+esc(ab?.assignment?.title||'Bài làm đã nộp')+'</h4>'+
        (src?'<img class="pt2-image" alt="Ảnh bài làm đã nộp" src="'+esc(src)+'">':images.length?'<div class="pt2-placeholder">Ảnh cần được tải qua trình xem bài đầy đủ.</div>':'')+
        (images.length>1?'<p class="pt2-hint">Bài có '+images.length+' ảnh. Mở bài đầy đủ để xem toàn bộ.</p>':'')+
        (body?'<div class="pt2-text">'+esc(body)+'</div>':'')+
        (attachments.length?'<div class="pt2-attachments"><strong>'+attachments.length+' tệp đính kèm</strong>'+attachments.map(function(a,i){return '<span>📎 '+esc(a.name||a.filename||'Tệp '+(i+1))+'</span>';}).join('')+'</div>':'')+
        (!src&&!body&&!attachments.length?'<div class="pt2-placeholder">Nội dung có thể là ảnh, video hoặc tệp. Chọn “Mở bài đầy đủ” để xem.</div>':'')+
        '<p class="pt2-hint">Điểm và nhận xét chi tiết được xem trong bài gốc. Trạng thái AI chưa đồng nghĩa giáo viên đã duyệt.</p></div>'+
        '<div class="pt2-preview-footer"><button type="button" class="btn btn-brand" data-pt2-detail="'+esc(String(active.id))+'">Mở bài đầy đủ · Xem & chấm</button></div>';
    }else preview='<div class="pt2-no-preview">Chưa có bài phù hợp. Chọn ngày khác hoặc bỏ bớt bộ lọc để xem.</div>';
    root.innerHTML='<div class="pt2-shell">'+
      '<div class="pt2-tabs" role="tablist" aria-label="Quản lý bài nộp">'+
      '<button type="button" data-pt2-tab="date" aria-selected="'+(tab==='date')+'">📅 Bài nộp theo ngày</button>'+
      '<button type="button" data-pt2-tab="student" aria-selected="'+(tab==='student')+'">👤 Theo học sinh</button>'+
      '<button type="button" data-pt2-legacy>📈 Phân tích tiến bộ</button>'+
      '<button type="button" data-pt2-export>📄 Báo cáo</button></div>'+
      '<div class="pt2-toolbar"><label>Phạm vi <select id="pt2-scope"><option value="board"'+(scope==='board'?' selected':'')+'>Bảng này</option><option value="all"'+(scope==='all'?' selected':'')+'>Tất cả bảng tôi quản lý</option></select></label>'+
      '<label>Tìm nhanh <input id="pt2-search" type="search" value="'+esc(search)+'" placeholder="Tên học sinh, lớp, bảng"></label>'+
      '<label>Trạng thái <select id="pt2-status">'+[['all','Tất cả'],['approved','Đã duyệt'],['pending','Chờ chấm'],['ai','AI đã chấm']].map(function(x){return '<option value="'+x[0]+'"'+(state===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label></div>'+
      '<div class="pt2-stats">'+statCards+'</div>'+
      '<div class="pt2-layout">'+
        '<section class="pt2-panel pt2-left"><h3>01 · Chọn ngày</h3>'+
          '<div class="pt2-quick"><button data-pt2-quick="today">Hôm nay</button><button data-pt2-quick="yesterday">Hôm qua</button><button data-pt2-quick="7">7 ngày</button><button data-pt2-quick="30">30 ngày</button></div>'+
          calendar(all)+
          '<label class="pt2-label">Ngày cụ thể <input id="pt2-date" type="date" value="'+dateKey+'"></label>'+
          '<div class="pt2-date-nav"><button data-pt2-shift="-1">‹ Ngày trước</button><button data-pt2-shift="1">Ngày sau ›</button></div>'+
          '<button class="pt2-latest" data-pt2-latest>Đi đến ngày nộp gần nhất</button>'+
        '</section>'+
        '<section class="pt2-panel pt2-middle"><div class="pt2-section-head"><h3>02 · Danh sách bài</h3><span>'+filtered.length+' bài</span></div>'+
          '<label class="pt2-label">Học sinh <select id="pt2-student"><option value="all">Tất cả học sinh</option>'+keys.map(function(k){var v=students.get(k);return '<option value="'+esc(k)+'"'+(k===student?' selected':'')+'>'+esc(v[0]+(v[1]?' · '+v[1]:''))+'</option>';}).join('')+'</select></label>'+
          '<p class="pt2-hint">'+title+' · Mới nhất trước</p>'+
          '<div class="pt2-post-list">'+(cards||'<div class="pt2-empty">Không tìm thấy bài nộp phù hợp.</div>')+'</div>'+
          (filtered.length>limit?'<button class="pt2-more" data-pt2-more>Hiển thị thêm ('+limit+'/'+filtered.length+')</button>':'')+
        '</section>'+
        '<section class="pt2-panel pt2-right"><div class="pt2-section-head"><h3>03 · Xem trước bài nộp</h3></div>'+preview+'</section>'+
      '</div><p class="pt2-bottom-note">Chỉ hiển thị bài nộp thuộc các bảng được quyền quản lý. Thời gian lấy từ bản ghi nộp thực tế; xem và chấm trong bài gốc.</p></div>';
    root.querySelector('#pt2-scope').onchange=function(e){scope=e.target.value;student='all';selected='';limit=50;draw();};
    root.querySelector('#pt2-search').onchange=function(e){search=e.target.value;selected='';limit=50;draw();};
    root.querySelector('#pt2-status').onchange=function(e){state=e.target.value;selected='';limit=50;draw();};
    root.querySelector('#pt2-student').onchange=function(e){student=e.target.value;tab='student';selected='';limit=50;draw();};
    root.querySelector('#pt2-date').onchange=function(e){if(e.target.value){dateKey=e.target.value;monthKey=dateKey.slice(0,7);tab='date';period='day';selected='';draw();}};
    root.querySelectorAll('[data-pt2-tab]').forEach(function(el){el.onclick=function(){tab=el.dataset.pt2Tab;selected='';limit=50;draw();};});
    root.querySelectorAll('[data-pt2-quick]').forEach(function(el){el.onclick=function(){
      var q=el.dataset.pt2Quick;tab='date';selected='';limit=50;
      if(q==='today'||q==='yesterday'){dateKey=localKey(new Date(Date.now()-(q==='yesterday'?86400000:0)));monthKey=dateKey.slice(0,7);period='day';}
      else period=q;
      draw();
    };});
    root.querySelectorAll('[data-pt2-day]').forEach(function(el){el.onclick=function(){dateKey=el.dataset.pt2Day;monthKey=dateKey.slice(0,7);tab='date';period='day';selected='';draw();};});
    root.querySelectorAll('[data-pt2-month]').forEach(function(el){el.onclick=function(){var parts=monthKey.split('-').map(Number);var d=new Date(parts[0],parts[1]-1+Number(el.dataset.pt2Month),1);monthKey=localKey(d).slice(0,7);draw();};});
    root.querySelectorAll('[data-pt2-shift]').forEach(function(el){el.onclick=function(){shift(Number(el.dataset.pt2Shift));tab='date';period='day';selected='';draw();};});
    root.querySelector('[data-pt2-latest]').onclick=function(){if(all.length){dateKey=keyOf(all[0]);monthKey=dateKey.slice(0,7);period='day';tab='date';selected='';draw();}else deps.toast('Chưa có bài nộp để chọn ngày.');};
    root.querySelectorAll('[data-pt2-open]').forEach(function(el){el.onclick=function(){selected=el.dataset.pt2Open;draw();};});
    root.querySelectorAll('[data-pt2-step]').forEach(function(el){el.onclick=function(){var next=filtered[pos+Number(el.dataset.pt2Step)];if(next){selected=next.id;draw();}};});
    root.querySelector('[data-pt2-more]')?.addEventListener('click',function(){limit+=50;draw();});
    root.querySelector('[data-pt2-detail]')?.addEventListener('click',function(e){
      var p=deps.getPost(e.currentTarget.dataset.pt2Detail);
      if(!p||!deps.canUse(deps.getBoard(p.boardId))||p.by!=='hs')return deps.toast('Không thể mở bài hoặc đã hết quyền truy cập.');
      deps.openDetail(p.id,false);
    });
    root.querySelector('[data-pt2-legacy]').onclick=function(){modal.close();deps.openLegacy();};
    root.querySelectorAll('[data-pt2-export]').forEach(function(el){el.onclick=function(){modal.close();deps.openExport();};});
  }
  modal.el.querySelector('.modal-f [data-pt2-export]')?.addEventListener('click',function(){modal.close();deps.openExport();});
  draw();
}
host.TuongAiSubmissionCalendarUI=Object.freeze({open:start});
})(window);
