/* ClassReport – deterministic, read-only class analytics.
 * No AI call, DB write, or access to a student's private work text. */
(function (root) {
  'use strict';
  const text = value => String(value ?? '').trim();
  const time = value => typeof value === 'number' && Number.isFinite(value) ? value :
    typeof value === 'string' ? Date.parse(value) || 0 : 0;
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const round = value => Math.round(value * 100) / 100;
  const fold = s => text(s).toLocaleLowerCase('vi').normalize('NFC');
  const cleanNote = note => text(note).slice(0, 700);
  const allowed = new Set(['resolved', 'remains', 'improving']);
  function weekOf(when) {
    const d = new Date(when);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return monday.toISOString().slice(0, 10);
  }
  function verifiedReviews(p) {
    const assist = p.teacher?.assist;
    if (!assist) return [];
    const seen = new Set();
    return [...(Array.isArray(assist.history) ? assist.history : []), assist.a].filter(r => {
      if (r?.review?.status !== 'approved' || !Array.isArray(r.analysis?.errors)) return false;
      if (r.id && seen.has(r.id)) return false;
      if (r.id) seen.add(r.id);
      return true;
    });
  }
  function build(posts, board, options = {}) {
    if (!board || !text(board.id)) throw new Error('Cần chọn bảng lớp hợp lệ.');
    const max = Number(board.assignment?.maxScore);
    const maxScore = Number.isFinite(max) && max > 0 && max <= 1000 ? max : 10;
    const from = Number.isFinite(options.startAt) ? options.startAt : -Infinity;
    const to = Number.isFinite(options.endAt) ? options.endAt : Infinity;
    const candidate = (Array.isArray(posts) ? posts : []).filter(p => {
      if (!p || p.boardId !== board.id || p.by !== 'hs') return false;
      const at = time(p.createdAt);
      return at >= from && at <= to;
    });
    const skills = new Map(), weeks = new Map(), sessions = new Set();
    const entries = [];
    let reviewed = 0, submitted = candidate.length, totalPoints = 0, confirmed = 0;
    let verifiedAttempts = 0, resolvedAttempts = 0, unassessedSkills = 0;
    for (const p of candidate) {
      const createdAt = time(p.createdAt);
      if (text(p.studentToken).length >= 16)
        sessions.add('token:' + p.studentToken);
      else
        sessions.add('post:' + p.id);
      const key = createdAt ? weekOf(createdAt) : 'Chưa rõ ngày';
      if (!weeks.has(key)) weeks.set(key, { week: key, submitted: 0, reviewed: 0, avgScore10: null, sumScore10: 0 });
      const week = weeks.get(key);
      week.submitted++;
      const approvedAt = time(p.teacher?.approvedAt);
      const value = number(p.teacher?.score);
      const hasGrade = approvedAt > 0 && value !== null && value >= 0 && value <= maxScore;
      const converted = hasGrade ? round(value / maxScore * 10) : null;
      if (hasGrade) {
        reviewed++; totalPoints += converted; week.reviewed++; week.sumScore10 += converted;
      }
      const reports = verifiedReviews(p);
      const verifiedOnPost = [];
      for (const review of reports) {
        const practice = review.practice?.status === 'assigned' ? review.practice : null;
        const exercises = Array.isArray(practice?.exercises) ? practice.exercises : [];
        const attempts = Array.isArray(practice?.attempts) ? practice.attempts : [];
        for (const err of review.analysis.errors) {
          if (err?.decision !== 'confirmed' || !text(err.skill) ||
              !text(err.teacherCause) || !text(err.verificationEvidence)) continue;
          const label = text(err.skill).slice(0, 120), skillKey = fold(label);
          if (!skills.has(skillKey))
            skills.set(skillKey, { skill: label, confirmedErrors: 0, verifiedAttempts: 0, resolvedAttempts: 0 });
          const metric = skills.get(skillKey);
          confirmed++; metric.confirmedErrors++;
          verifiedOnPost.push(label);
          const matching = exercises.filter(ex => ex?.errorId === err.id && text(ex.id));
          if (!matching.length) unassessedSkills++;
          for (const exercise of matching) {
            const valid = attempts.filter(a => a?.exerciseId === exercise.id &&
              allowed.has(a.verdict) && text(a.by) && text(a.evidence) && time(a.at) > 0);
            if (!valid.length) unassessedSkills++;
            metric.verifiedAttempts += valid.length;
            metric.resolvedAttempts += valid.filter(a => a.verdict === 'resolved').length;
            verifiedAttempts += valid.length;
            resolvedAttempts += valid.filter(a => a.verdict === 'resolved').length;
          }
        }
      }
      entries.push({
        postId: text(p.id), studentName: text(p.studentName) || 'Chưa ghi tên',
        studentClass: text(p.studentClass), createdAt,
        status: hasGrade ? 'Giáo viên đã duyệt điểm' : approvedAt ? 'Đã duyệt, điểm chưa hợp lệ' : 'Chưa duyệt',
        score10: converted, teacherComment: approvedAt ? cleanNote(p.teacher?.note) : '',
        confirmedSkills: [...new Set(verifiedOnPost)],
      });
    }
    const weekly = [...weeks.values()].sort((a,b) => a.week.localeCompare(b.week)).map(w => ({
      week: w.week, submitted: w.submitted, reviewed: w.reviewed,
      avgScore10: w.reviewed ? round(w.sumScore10 / w.reviewed) : null,
    }));
    const topSkills = [...skills.values()].sort((a,b) => b.confirmedErrors - a.confirmedErrors ||
      a.skill.localeCompare(b.skill,'vi')).slice(0,20);
    const pending = submitted - reviewed;
    const summary = {
      submitted, reviewed, pending, approvalRate: submitted ? round(reviewed / submitted * 100) : null,
      avgScore10: reviewed ? round(totalPoints / reviewed) : null,
      studentSessions: sessions.size, confirmedErrors: confirmed, verifiedAttempts, resolvedAttempts,
      unassessedSkills,
    };
    const recommendations = [];
    if (pending) recommendations.push('Ưu tiên rà soát ' + pending + ' bài chưa có điểm giáo viên duyệt hợp lệ.');
    if (topSkills.length) recommendations.push('Ôn tập kỹ năng "' + topSkills[0].skill +
      '" (' + topSkills[0].confirmedErrors + ' lỗi đã được giáo viên xác nhận).');
    if (unassessedSkills) recommendations.push('Bổ sung kiểm chứng cho ' + unassessedSkills +
      ' lượt bài tập/kỹ năng chưa đủ đánh giá; không kết luận đã khắc phục.');
    if (!recommendations.length) recommendations.push(
      submitted ? 'Tiếp tục theo dõi khi có bài nộp và lượt luyện tập mới.' :
        'Chưa có bài nộp trong kỳ báo cáo. Không đủ dữ liệu để đánh giá kết quả.');
    return {
      boardId:board.id, boardName:text(board.name), subject:text(board.subject),
      grade:text(board.grade), school:text(board.school),
      startAt:Number.isFinite(from)?from:null, endAt:Number.isFinite(to)?to:null,
      summary, weekly, topSkills, entries, recommendations,
      note:'Chỉ thống kê dữ liệu trong bảng và kỳ đã chọn. Điểm AI chưa duyệt không được tính. ' +
        'Số phiên học sinh không phải số học sinh duy nhất. Số lượt đạt không phải chứng minh tự động rằng đã khắc phục lỗi.',
    };
  }
  root.TuongAiClassReport = Object.freeze({ build });
})(typeof window !== 'undefined' ? window : globalThis);
