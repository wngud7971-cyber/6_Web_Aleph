import { prisma } from "./prisma";
import { kstTodayStr } from "./time";

// 완료 시각(completedAt)을 서울 기준 "YYYY-MM-DD"로 바꾼다.
function kstDateOf(dateLike) {
  return kstTodayStr(new Date(dateLike));
}

// 특정 계획(planId) 하나에 대한 돌아보기 집계를 계산한다.
// planId가 없으면 "내 계정" 전체(내 모든 계획) 기준으로 집계한다.
// userId는 반드시 넘겨야 한다 — 그래야 남의 할 일이 합계에 섞이지 않는다.
export async function computeReview(planId, userId) {
  const where = {
    deletedAt: null,
    plan: { userId }, // Todo에는 userId가 없으므로 Plan을 통해 소유자를 확인한다
    ...(planId ? { planId } : {}),
  };
  const todos = await prisma.todo.findMany({
    where,
    include: { executionLogs: true },
  });

  const today = kstTodayStr();

  const planCount = todos.length; // 그 계획에 딸린, 지우지 않은 할 일 수
  const doneCount = todos.filter((t) => t.status === "done").length;
  const overdueCount = todos.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < today
  ).length; // 완료는 지연으로 중복해서 세지 않는다
  const blockedCount = todos.filter((t) =>
    t.executionLogs.some((l) => l.blockerReason && l.blockerReason.trim() !== "")
  ).length;

  const estimatedTotal = todos.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
  const actualTotal = todos.reduce(
    (sum, t) => sum + t.executionLogs.reduce((s, l) => s + (l.actualMinutes || 0), 0),
    0
  );
  const diff = actualTotal - estimatedTotal;

  return {
    planId: planId || null,
    planCount,
    doneCount,
    overdueCount,
    blockedCount,
    estimatedTotal,
    actualTotal,
    diff,
    todoIds: todos.map((t) => t.id),
  };
}

// 카드5용: "그날 완료한 할 일들의 (실제분-예상분) 합산" 규칙을 실제 서울 기준
// 날짜별로 묶어서 계산한다. planId를 넘기면 그 계획만, 안 넘기면 내 계정
// 전체(모든 계획)를 대상으로 한다. userId는 필수 — 남의 자료가 안 섞이게 한다.
export async function computeDailyBreakdown(userId, planId = null) {
  const todos = await prisma.todo.findMany({
    where: {
      deletedAt: null,
      status: "done",
      completedAt: { not: null },
      plan: { userId },
      ...(planId ? { planId } : {}),
    },
    include: { executionLogs: true, plan: true },
    orderBy: { completedAt: "asc" },
  });

  const byDate = new Map();
  for (const t of todos) {
    const date = kstDateOf(t.completedAt);
    const actual = t.executionLogs.reduce((s, l) => s + (l.actualMinutes || 0), 0);
    const estimated = t.estimatedMinutes || 0;
    if (!byDate.has(date)) {
      byDate.set(date, { date, todoCount: 0, estimatedTotal: 0, actualTotal: 0, todos: [] });
    }
    const bucket = byDate.get(date);
    bucket.todoCount += 1;
    bucket.estimatedTotal += estimated;
    bucket.actualTotal += actual;
    bucket.todos.push({ id: t.id, title: t.title, planTitle: t.plan.title, estimated, actual });
  }

  return [...byDate.values()]
    .map((b) => ({ ...b, diff: b.actualTotal - b.estimatedTotal }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
