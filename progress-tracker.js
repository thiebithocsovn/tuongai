/* ProgressTracker: read-only analysis of teacher-verified evidence. */
(function (root) {
'use strict';
const clean = x => String(x ?? '').trim();
const norm = x => clean(x).toLocaleLowerCase('vi').normalize('NFC');
const date = x => typeof x === 'number' && Number.isFinite(x) ? x :
  (typeof x === 'string' ? Date.parse(x) || 0 : 0);
const verdicts = new Set(['resolved','improving','remains']);
function identity(p) {
  const token = clean(p.studentToken);
  return token.length >= 16 ?
    { key:'device:' + token, confidence:'device' } :
    { key:'name:' + norm(p.studentName) + '|' + norm(p.studentClass), confidence:'name_only' };
}
function reviews(p) {
  const assist = p.teacher?.assist;
  if (!assist) return [];
  const seen = new Set();
  return [...(Array.isArray(assist.history) ? assist.history : []), assist.a]
    .filter(a => {
      if (a?.review?.status !== 'approved' || !Array.isArray(a.analysis?.errors)) return false;
      if (a.id && seen.has(a.id)) return false;
      if (a.id) seen.add(a.id);
      return true;
    });
}
function validAttempts(practice, exerciseId) {
  return (Array.isArray(practice?.attempts) ? practice.attempts : [])
    .filter(a => a && a.exerciseId === exerciseId && verdicts.has(a.verdict) &&
      clean(a.by) && clean(a.evidence) && date(a.at) > 0)
    .sort((a,b) => date(a.at) - date(b.at));
}
function buildBoard(posts, boardId, maxScore=10) {
  const m = new Map();
  const max = Number(maxScore) > 0 ? Number(maxScore) : 10;
  for (const p of Array.isArray(posts) ? posts : []) {
    if (!p || p.by !== 'hs' || p.boardId !== boardId || !clean(p.studentName)) continue;
    const identityData = identity(p);
    if (!m.has(identityData.key)) m.set(identityData.key, {
      name:clean(p.studentName), className:clean(p.studentClass),
      identityConfidence:identityData.confidence, postIds:[],
      latestPostId:'', latestPostAt:0, approvedScores:[], pendingPosts:0,
      confirmedErrors:0, verifiedAttempts:0, skillMap:new Map(),
    });
    const s = m.get(identityData.key);
    s.postIds.push(p.id);
    if (date(p.createdAt) >= s.latestPostAt) {
      s.latestPostAt = date(p.createdAt); s.latestPostId = p.id;
    }
    const approvedAt = date(p.teacher?.approvedAt);
    if (!approvedAt) s.pendingPosts++;
    const score = p.teacher?.score;
    if (approvedAt && typeof score === 'number' && Number.isFinite(score) &&
        score >= 0 && score <= max)
      s.approvedScores.push({ at: date(p.createdAt) || approvedAt,
        value:Math.round(score/max*1000)/100, postId:p.id });
    // AI-only marks and hypotheses never count.
    for (const r of reviews(p)) {
      const practice = r.practice?.status === 'assigned' ? r.practice : null;
      const exercises = Array.isArray(practice?.exercises) ? practice.exercises : [];
      for (const e of r.analysis.errors) {
        if (e?.decision !== 'confirmed' || !clean(e.skill) ||
            !clean(e.teacherCause) || !clean(e.verificationEvidence)) continue;
        const k = norm(e.skill);
        if (!s.skillMap.has(k)) s.skillMap.set(k, {
          skill:clean(e.skill), states:[], attempts:0, updated:0, samplePostId:p.id,
        });
        const sk = s.skillMap.get(k);
        const assignedExercises = exercises.filter(x => x?.errorId === e.id && clean(x.id));
        const latest = assignedExercises.map(x => {
          const a = validAttempts(practice,x.id);
          sk.attempts += a.length; s.verifiedAttempts += a.length;
          return a.at(-1) || null;
        });
        const state = !assignedExercises.length || latest.some(x => !x) ? 'unassessed' :
          latest.every(x => x.verdict === 'resolved') ? 'resolved' :
          latest.some(x => x.verdict === 'remains') ? 'remains' : 'improving';
        sk.states.push(state);
        sk.updated = Math.max(sk.updated,date(r.review.at),...latest.filter(Boolean).map(x => date(x.at)));
        sk.samplePostId = p.id; s.confirmedErrors++;
      }
    }
  }
  const students = [...m.values()].map(s => {
    s.approvedScores.sort((a,b) => a.at-b.at);
    const skills = [...s.skillMap.values()].map(k => ({
      skill:k.skill, attempts:k.attempts, updated:k.updated,
      samplePostId:k.samplePostId, confirmedErrors:k.states.length,
      status:k.states.every(x => x==='resolved') ? 'resolved' :
        k.states.some(x => x==='remains') ? 'remains' :
        k.states.some(x => x==='improving') ? 'improving' : 'unassessed',
    })).sort((a,b) => a.skill.localeCompare(b.skill,'vi'));
    const points=s.approvedScores, total=skills.length, resolved=skills.filter(x=>x.status==='resolved').length;
    return {
      name:s.name, className:s.className, identityConfidence:s.identityConfidence,
      postIds:s.postIds, latestPostId:s.latestPostId, approvedScores:points,
      pendingPosts:s.pendingPosts, confirmedErrors:s.confirmedErrors, verifiedAttempts:s.verifiedAttempts,
      skills, skillsTotal:total, skillsResolved:resolved,
      scoreAverage:points.length ? Math.round(points.reduce((n,x)=>n+x.value,0)/points.length*100)/100 : null,
      scoreDelta:points.length>=2 ? Math.round((points.at(-1).value-points[0].value)*100)/100 : null,
      status:!total ? 'no_evidence' : resolved===total ? 'resolved' :
        skills.some(x=>x.status==='remains') ? 'remains' :
        skills.some(x=>x.status==='improving') ? 'improving' : 'unassessed',
    };
  }).sort((a,b)=>a.name.localeCompare(b.name,'vi') || a.className.localeCompare(b.className,'vi'));
  const sum=fn=>students.reduce((n,s)=>n+fn(s),0);
  return { students, summary:{
    students:students.length, pendingPosts:sum(s=>s.pendingPosts),
    reviewedScores:sum(s=>s.approvedScores.length), confirmedErrors:sum(s=>s.confirmedErrors),
    verifiedAttempts:sum(s=>s.verifiedAttempts), skillsResolved:sum(s=>s.skillsResolved),
    skillsUnassessed:sum(s=>s.skills.filter(x=>x.status==='unassessed').length),
  }};
}
root.TuongAiProgressTracker=Object.freeze({buildBoard});
})(typeof window !== 'undefined' ? window : globalThis);
