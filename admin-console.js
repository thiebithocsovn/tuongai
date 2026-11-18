(function adminSource() {
  'use strict';
  /* Admin-only presentation layer. No database writes or teacher layout changes. */
  const KEY = 'tuongai.adminConsole.v1:';
  let currentId = '';
  let state = null;
  let context = null;
  let rows = [];
  let totals = {};
  const sortModes = [
    ['priority', 'Ưu tiên xử lý'],
    ['recent', 'Hoạt động gần đây'],
    ['pending', 'Bài chờ chấm nhiều nhất'],
    ['posts', 'Nhiều bài đăng nhất'],
    ['name', 'Tên bảng A–Z'],
    ['oldest', 'Bảng tạo lâu nhất'],
    ['manual', 'Thứ tự thủ công']
  ];
  const safe = (value) => context.esc(String(value == null ? '' : value));
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = (value) => numeric(value).toLocaleString('vi-VN');
  const nameSort = (a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' });
  const formatDate = (ts) => ts && Number.isFinite(ts) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts)) : '—';
  function readState(id) {
    if (currentId === id && state) return state;
    currentId = id;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY + id) || '{}') || {}; } catch (e) {}
    const views = ['list', 'cards', 'groups'];
    const sorts = sortModes.map((x) => x[0]);
    state = {
      q: typeof saved.q === 'string' ? saved.q.slice(0, 120) : '',
      school: typeof saved.school === 'string' ? saved.school : '',
      grade: typeof saved.grade === 'string' ? saved.grade : '',
      teacher: typeof saved.teacher === 'string' ? saved.teacher : '',
      quick: ['all', 'pending', 'recent', 'uncategorized', 'pinned'].includes(saved.quick) ? saved.quick : 'all',
      sort: sorts.includes(saved.sort) ? saved.sort : 'priority',
      view: views.includes(saved.view) ? saved.view : 'list',
      pinned: Array.isArray(saved.pinned) ? saved.pinned.filter((v) => typeof v === 'string').slice(0, 3000) : [],
      order: Array.isArray(saved.order) ? saved.order.filter((v) => typeof v === 'string').slice(0, 3000) : []
    };
    return state;
  }
  function saveState() {
    try { localStorage.setItem(KEY + currentId, JSON.stringify(state)); } catch (e) {}
  }
  function gather() {
    const list = context.visibleBoards('mine').filter((b) => !b.demo && !b.trashed && !b.archived);
    const ids = new Set(list.map((b) => b.id));
    const data = new Map(list.map((b) => [b.id, {
      board: b, count: 0, pending: 0, graded: 0, approved: 0,
      last: numeric(b.updatedAt) || numeric(b.createdAt)
    }]));
    for (const post of context.S.posts.values()) {
      if (!ids.has(post.boardId)) continue;
      const entry = data.get(post.boardId);
      if (!entry) continue;
      entry.count++;
      const status = context.status(post);
      if (status === 'cho' || status === 'dang') entry.pending++;
      else if (status === 'ai') entry.graded++;
      else if (status === 'duyet') entry.approved++;
      entry.last = Math.max(entry.last, numeric(post.createdAt), numeric(post.updatedAt), numeric(post.aiAt), numeric(post.teacher && post.teacher.approvedAt));
    }
    rows = [...data.values()].map((entry) => {
      const b = entry.board;
      return {
        ...entry,
        id: String(b.id),
        name: String(b.name || 'Chưa đặt tên'),
        school: String(b.school || '').trim(),
        grade: String(context.boardGrade(b) || '').trim(),
        teacher: String(context.ownerLabel(b) || 'Chưa xác định'),
        subject: String(b.subject || '').trim(),
        created: numeric(b.createdAt)
      };
    });
    totals = {
      boards: rows.length, posts: rows.reduce((sum, r) => sum + r.count, 0),
      pending: rows.reduce((sum, r) => sum + r.pending, 0),
      graded: rows.reduce((sum, r) => sum + r.graded, 0),
      approved: rows.reduce((sum, r) => sum + r.approved, 0),
      schools: new Set(rows.map((r) => r.school).filter(Boolean)).size
    };
  }
  function options(values, selected, blank) {
    return '<option value="">' + safe(blank) + '</option>' +
      values.sort(nameSort).map((v) => '<option value="' + safe(v) + '"' + (v === selected ? ' selected' : '') + '>' + safe(v) + '</option>').join('');
  }
  function isPinned(id) { return state.pinned.includes(id); }
  function filtered() {
    const query = state.q.trim().toLocaleLowerCase('vi');
    const now = Date.now();
    let list = rows.filter((r) => {
      if (state.school && r.school !== state.school) return false;
      if (state.grade && r.grade !== state.grade) return false;
      if (state.teacher && r.teacher !== state.teacher) return false;
      if (query && ![r.name, r.school, r.grade, r.teacher, r.subject].join(' ').toLocaleLowerCase('vi').includes(query)) return false;
      if (state.quick === 'pending' && r.pending === 0) return false;
      if (state.quick === 'recent' && (!r.last || now - r.last > 7 * 86400000)) return false;
      if (state.quick === 'uncategorized' && r.school && r.grade) return false;
      if (state.quick === 'pinned' && !isPinned(r.id)) return false;
      return true;
    });
    const manual = new Map(state.order.map((id, index) => [id, index]));
    list.sort((a, b) => {
      if (state.sort === 'manual') {
        const x = manual.has(a.id) ? manual.get(a.id) : Infinity;
        const y = manual.has(b.id) ? manual.get(b.id) : Infinity;
        return x - y || nameSort(a.name, b.name);
      }
      const pinned = Number(isPinned(b.id)) - Number(isPinned(a.id));
      if (pinned) return pinned;
      switch (state.sort) {
        case 'recent': return b.last - a.last || nameSort(a.name, b.name);
        case 'pending': return b.pending - a.pending || b.last - a.last || nameSort(a.name, b.name);
        case 'posts': return b.count - a.count || b.last - a.last || nameSort(a.name, b.name);
        case 'name': return nameSort(a.name, b.name);
        case 'oldest': return a.created - b.created || nameSort(a.name, b.name);
        default: return Number(b.pending > 0) - Number(a.pending > 0) || b.pending - a.pending || b.last - a.last || nameSort(a.name, b.name);
      }
    });
    return list;
  }
  function shortLabel(r) { return r.school || 'Chưa phân loại'; }
  function tag(text, variant) { return '<span class="adm-tag ' + (variant || '') + '">' + safe(text) + '</span>'; }
  function actions(r) {
    return '<div class="adm-actions">' +
      '<button type="button" class="adm-btn adm-btn-primary" data-act="open-board" data-id="' + safe(r.id) + '">Mở</button>' +
      '<button type="button" class="adm-btn" data-act="edit-board" data-id="' + safe(r.id) + '" title="Cài đặt bảng">Sửa</button>' +
      '<button type="button" class="adm-btn adm-pin' + (isPinned(r.id) ? ' active' : '') + '" data-admin-pin="' + safe(r.id) + '" aria-pressed="' + isPinned(r.id) + '" title="Ghim riêng trong trang quản trị">' + (isPinned(r.id) ? '★' : '☆') + '</button>' +
      (state.sort === 'manual' ? '<button type="button" class="adm-btn" data-admin-move="up" data-id="' + safe(r.id) + '" aria-label="Đưa bảng lên">↑</button><button type="button" class="adm-btn" data-admin-move="down" data-id="' + safe(r.id) + '" aria-label="Đưa bảng xuống">↓</button>' : '') +
      '</div>';
  }
  function tr(r) {
    return '<tr data-admin-id="' + safe(r.id) + '"' + (state.sort === 'manual' ? ' draggable="true"' : '') + '>' +
      '<td class="adm-board-name"><div class="adm-cell-name">' + (isPinned(r.id) ? '<span aria-label="Đã ghim">★</span>' : '') +
      '<button data-act="open-board" data-id="' + safe(r.id) + '">' + safe(r.name) + '</button></div><small>' + safe(r.subject || 'Bảng học tập') + '</small></td>' +
      '<td><div>' + safe(shortLabel(r)) + '</div><small>' + safe(r.grade ? 'Khối ' + r.grade : 'Chưa rõ khối') + '</small></td>' +
      '<td class="adm-ellipsis" title="' + safe(r.teacher) + '">' + safe(r.teacher) + '</td>' +
      '<td class="adm-num">' + fmt(r.count) + '</td>' +
      '<td class="adm-num">' + (r.pending ? tag(fmt(r.pending), 'adm-warning') : '<span class="adm-muted">0</span>') + '</td>' +
      '<td class="adm-muted">' + safe(formatDate(r.last)) + '</td><td>' + actions(r) + '</td></tr>';
  }
  function table(list) {
    return '<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th scope="col">Tên bảng</th><th scope="col">Trường / khối</th><th scope="col">Giáo viên</th><th scope="col">Bài đăng</th><th scope="col">Chờ chấm</th><th scope="col">Hoạt động</th><th scope="col">Thao tác</th></tr></thead><tbody>' +
      list.map(tr).join('') + '</tbody></table></div>';
  }
  function card(r) {
    return '<article class="adm-board-card"><div class="adm-card-top"><span class="adm-card-school">' + safe(shortLabel(r)) + (r.grade ? ' · Khối ' + safe(r.grade) : '') + '</span>' + (isPinned(r.id) ? '<span class="adm-card-star">★</span>' : '') + '</div>' +
      '<h3><button data-act="open-board" data-id="' + safe(r.id) + '">' + safe(r.name) + '</button></h3>' +
      '<p>' + safe(r.teacher) + '</p><div class="adm-card-stats"><span>' + fmt(r.count) + ' bài đăng</span>' + (r.pending ? tag(fmt(r.pending) + ' chờ chấm', 'adm-warning') : tag('Không tồn đọng', 'adm-good')) + '</div>' +
      '<div class="adm-card-bottom"><small>Cập nhật ' + safe(formatDate(r.last)) + '</small>' + actions(r) + '</div></article>';
  }
  function draw() {
    const target = document.getElementById('adm-results');
    if (!target) return;
    const list = filtered();
    const count = document.getElementById('adm-count');
    if (count) count.textContent = fmt(list.length) + ' / ' + fmt(rows.length) + ' bảng';
    if (!list.length) {
      target.innerHTML = '<div class="adm-empty"><strong>Không tìm thấy bảng phù hợp</strong><p>Hãy thay đổi từ khóa hoặc xóa bộ lọc đang chọn.</p><button type="button" class="adm-btn" data-admin-reset>Làm mới bộ lọc</button></div>';
      return;
    }
    if (state.view === 'cards') {
      target.innerHTML = '<div class="adm-card-grid">' + list.map(card).join('') + '</div>';
    } else if (state.view === 'groups') {
      const groups = new Map();
      list.forEach((r) => { const key = shortLabel(r); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
      target.innerHTML = '<div class="adm-groups">' + [...groups.entries()].sort((a, b) => nameSort(a[0], b[0])).map(([group, items]) =>
        '<details class="adm-group" open><summary><strong>' + safe(group) + '</strong><span>' + fmt(items.length) + ' bảng · ' + fmt(items.reduce((n, r) => n + r.pending, 0)) + ' chờ chấm</span></summary>' + table(items) + '</details>').join('') + '</div>';
    } else {
      target.innerHTML = table(list);
    }
    target.querySelectorAll('tr[data-admin-id]').forEach((row) => {
      row.addEventListener('dragstart', (event) => {
        if (state.sort !== 'manual') { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.adminId);
      });
      row.addEventListener('dragover', (event) => { if (state.sort === 'manual') { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
      row.addEventListener('drop', (event) => {
        if (state.sort !== 'manual') return;
        event.preventDefault();
        moveTo(event.dataTransfer.getData('text/plain'), row.dataset.adminId);
      });
    });
  }
  function moveTo(source, target) {
    if (!source || !target || source === target || state.sort !== 'manual') return;
    const ids = filtered().map((r) => r.id);
    const a = ids.indexOf(source), b = ids.indexOf(target);
    if (a < 0 || b < 0) return;
    ids.splice(a, 1);
    ids.splice(b, 0, source);
    state.order = [...ids, ...state.order.filter((id) => !ids.includes(id))];
    saveState();
    draw();
  }
  function reset() {
    state.q = ''; state.school = ''; state.grade = ''; state.teacher = ''; state.quick = 'all';
    saveState();
    render(context);
  }
  function render(c) {
    if (!c || !c.isAdmin() || c.S.view.name !== 'home' || c.S.view.tab !== 'mine' || c.S.view.owner) return false;
    context = c;
    readState(c.S.meId);
    gather();
    const root = document.getElementById('view');
    if (!root) return false;
    const schools = [...new Set(rows.map((r) => r.school).filter(Boolean))];
    const grades = [...new Set(rows.map((r) => r.grade).filter(Boolean))];
    const teachers = [...new Set(rows.map((r) => r.teacher).filter(Boolean))];
    const buttonGroup = (value, title) => '<button type="button" data-admin-view="' + value + '" aria-pressed="' + (state.view === value) + '">' + title + '</button>';
    root.innerHTML =
      '<div class="admin-console">' +
      '<div class="crumbs"><nav><span>Không gian làm việc</span><span>/</span><span class="cur">Toàn hệ thống</span></nav><div class="crumbs-r"><span class="pill">Quản trị</span>' + c.acctChip() + '</div></div>' +
      (c.ME().mustChange ? '<div class="warnline row-between"><span>Hãy thay đổi mật khẩu mặc định để bảo vệ tài khoản.</span><button class="btn btn-sm btn-navy" data-act="change-pw">Đổi mật khẩu</button></div>' : '') +
      '<header class="adm-header"><div><p class="adm-eyebrow">TƯỜNG HỌC TẬP AI · TRUNG TÂM ĐIỀU HÀNH</p><h1>Quản trị bảng toàn hệ thống</h1><p>Quản lý bảng theo trường học, khối lớp và giáo viên. Ưu tiên những lớp cần xử lý.</p></div>' +
      '<div class="adm-header-actions"><button type="button" class="btn btn-soft" data-act="school-manager">' + c.ic('users') + ' Quản lý trường</button><button type="button" class="btn btn-navy" data-act="new-board">' + c.ic('plus') + ' Tạo bảng</button></div></header>' +
      '<section class="adm-stats" aria-label="Số liệu bảng hiện tại">' +
      '<div class="adm-stat"><span>Tổng số bảng</span><strong>' + fmt(totals.boards) + '</strong><small>' + fmt(totals.schools) + ' trường đã phân loại</small></div>' +
      '<div class="adm-stat"><span>Bài chờ chấm</span><strong>' + fmt(totals.pending) + '</strong><small>Cần xử lý</small></div>' +
      '<div class="adm-stat"><span>AI đã chấm</span><strong>' + fmt(totals.graded) + '</strong><small>Chờ duyệt hoặc xử lý</small></div>' +
      '<div class="adm-stat"><span>Bài đã duyệt</span><strong>' + fmt(totals.approved) + '</strong><small>Tổng ' + fmt(totals.posts) + ' bài đăng</small></div></section>' +
      '<section class="adm-management" aria-label="Quản lý danh sách bảng">' +
      '<div class="adm-management-heading"><div><h2>Danh sách bảng</h2><p>Bộ lọc dành riêng cho quản trị viên</p></div><span id="adm-count" class="adm-count" role="status"></span></div>' +
      '<div class="adm-controls"><label class="adm-search"><span class="sr">Tìm bảng, trường, giáo viên</span><span>⌕</span><input id="adm-q" type="search" value="' + safe(state.q) + '" placeholder="Tìm bảng, trường, giáo viên, môn học…"></label>' +
      '<label><span class="sr">Lọc theo trường</span><select id="adm-school">' + options(schools, state.school, 'Tất cả trường') + '</select></label>' +
      '<label><span class="sr">Lọc theo khối</span><select id="adm-grade">' + options(grades, state.grade, 'Tất cả khối') + '</select></label>' +
      '<label><span class="sr">Lọc theo giáo viên</span><select id="adm-teacher">' + options(teachers, state.teacher, 'Tất cả giáo viên') + '</select></label>' +
      '<label><span class="sr">Sắp xếp</span><select id="adm-sort">' + sortModes.map(([value, title]) => '<option value="' + value + '"' + (state.sort === value ? ' selected' : '') + '>' + safe(title) + '</option>').join('') + '</select></label></div>' +
      '<div class="adm-toolbar"><div class="adm-quick" role="group" aria-label="Bộ lọc nhanh">' +
      [['all', 'Tất cả'], ['pending', 'Cần xử lý'], ['recent', '7 ngày gần đây'], ['uncategorized', 'Chưa phân loại'], ['pinned', 'Đã ghim']].map(([value, title]) => '<button type="button" data-admin-quick="' + value + '" aria-pressed="' + (state.quick === value) + '">' + title + '</button>').join('') +
      '</div><div class="adm-views" role="group" aria-label="Kiểu hiển thị">' + buttonGroup('list', '☷ Danh sách') + buttonGroup('cards', '▦ Thẻ') + buttonGroup('groups', '≡ Nhóm trường') + '</div></div>' +
      '<div id="adm-results" aria-live="polite"></div>' +
      '<p class="adm-note">Ghim, bộ lọc và thứ tự thủ công được lưu riêng trên trình duyệt này, không thay đổi bảng hay giao diện giáo viên. Trong chế độ thủ công, kéo thả hàng trên máy tính hoặc dùng mũi tên ↑ ↓.</p></section></div>';
    root.querySelector('#adm-q').addEventListener('input', (event) => {
      state.q = event.target.value; saveState(); draw();
    });
    const selectors = { 'adm-school': 'school', 'adm-grade': 'grade', 'adm-teacher': 'teacher', 'adm-sort': 'sort' };
    Object.entries(selectors).forEach(([id, key]) => {
      root.querySelector('#' + id).addEventListener('change', (event) => {
        state[key] = event.target.value; saveState(); draw();
      });
    });
    root.querySelector('.admin-console').addEventListener('click', (event) => {
      const quick = event.target.closest('[data-admin-quick]');
      const view = event.target.closest('[data-admin-view]');
      const pin = event.target.closest('[data-admin-pin]');
      const movement = event.target.closest('[data-admin-move]');
      if (quick) {
        state.quick = quick.dataset.adminQuick; saveState();
        root.querySelectorAll('[data-admin-quick]').forEach((el) => el.setAttribute('aria-pressed', String(el === quick)));
        draw();
      } else if (view) {
        state.view = view.dataset.adminView; saveState();
        root.querySelectorAll('[data-admin-view]').forEach((el) => el.setAttribute('aria-pressed', String(el === view)));
        draw();
      } else if (pin) {
        const id = pin.dataset.adminPin;
        state.pinned = isPinned(id) ? state.pinned.filter((x) => x !== id) : [...state.pinned, id];
        saveState(); draw();
      } else if (movement) {
        const source = movement.dataset.id, ids = filtered().map((r) => r.id);
        const index = ids.indexOf(source), next = index + (movement.dataset.adminMove === 'up' ? -1 : 1);
        if (index >= 0 && next >= 0 && next < ids.length) moveTo(source, ids[next]);
      } else if (event.target.closest('[data-admin-reset]')) reset();
    });
    draw();
    return true;
  }
  window.TuongAiAdminConsole = { render };
})();
