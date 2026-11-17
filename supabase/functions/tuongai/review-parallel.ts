// Bounded I/O concurrency. Database leases enforce the same cap across Edge instances.
export const REVIEW_PARALLELISM = 3;
export const REVIEW_MODEL_BATCH = 6;
export const REVIEW_REQUEST_MS = 65_000;
export async function reviewPool<T>(items: T[], concurrency: number, run: (item: T) => Promise<unknown>) {
  let cursor = 0;
  const results: PromiseSettledResult<unknown>[] = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await run(items[index]) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}
export function reviewCycleAttempts(job: any) {
  return Math.max(0, Number(job?.cycleAttempts ?? job?.attempts ?? 0) || 0);
}
export function reviewRetryDue(job: any, at = Date.now()) {
  return job?.status === 'failed' && reviewCycleAttempts(job) < 3 && job.retryAt > 0 && job.retryAt <= at;
}

// Reuse only an existing grade on a submission whose student-edit endpoint is locked.
// The original AI result and timestamp stay intact; the new record is a teacher-only draft.
export function savedGradeAnalysis(post: any, board: any) {
  const ai = post.ai, max = Number(board.assignment?.maxScore) || 10;
  if (!ai || !post.ai_at || post.teacher?.approvedAt || post.teacher?.score != null || post.teacher?.assist?.a ||
      typeof ai.nhan_xet !== 'string' || !ai.nhan_xet.trim() || typeof ai.diem !== 'number' ||
      !Number.isFinite(ai.diem) || ai.diem < 0 || ai.diem > max || Number(ai.diem_toi_da) !== max) return null;
  return {
    summary: ai.nhan_xet, feedback: ai.nhan_xet, strengths: ai.diem_manh || [],
    limitations: [ai.canh_bao, 'Tái sử dụng kết quả AI đã lưu. Giáo viên đối chiếu đề và bài trước khi duyệt.'].filter(Boolean),
    suggestedScore: ai.diem, scoreReason: 'Điểm đề xuất từ kết quả AI đã lưu lúc ' + post.ai_at,
    errors: (Array.isArray(ai.loi_sai) ? ai.loi_sai : []).filter((e: any) => e.buoc || e.vi_tri).map((e: any) => ({
      title: e.loi, skill: e.loi, evidence: [e.cau || e.vi_tri, e.buoc].filter(Boolean).join(' · '),
      hypothesis: e.nguyen_nhan, verificationQuestion: 'Em hãy giải thích bước này và thử làm lại.',
      remediation: e.sua, confidence: ai.canh_bao ? 'low' : 'medium',
    })),
  };
}
