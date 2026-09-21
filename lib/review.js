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
//
// 날짜는 "할 일을 완료 버튼으로 체크한 시각"(Todo.completedAt)이 아니라
// "그 실행 기록의 시작 시각"(ExecutionLog.startedAt) 기준으로 묶는다.
// completedAt은 체크한 그 순간 한 번 고정되고 고칠 방법이 없어서, 실행 기록만
// 나중에 다른 날짜로 고쳐도 날짜별 집계에 반영되지 않는 문제가 있었다.
// 실행 기록의 시작 시각이 "실제로 언제 일했는지"를 더 정확히 나타낸다.
export async function computeDailyBreakdown(userId, planId = null) {
  const logs = await prisma.executionLog.findMany({
    where: {
      todo: {
        deletedAt: null,
        plan: { userId, ...(planId ? { id: planId } : {}) },
      },
    },
    include: { todo: { include: { plan: true } } },
    orderBy: { startedAt: "asc" },
  });

  const byDate = new Map();
  for (const l of logs) {
    const date = kstDateOf(l.startedAt);
    const actual = l.actualMinutes || 0;
    const estimated = l.todo.estimatedMinutes || 0;
    if (!byDate.has(date)) {
      byDate.set(date, { date, todoCount: 0, estimatedTotal: 0, actualTotal: 0, todos: [] });
    }
    const bucket = byDate.get(date);
    bucket.todoCount += 1;
    bucket.estimatedTotal += estimated;
    bucket.actualTotal += actual;
    bucket.todos.push({
      id: l.todo.id,
      title: l.todo.title,
      planTitle: l.todo.plan.title,
      estimated,
      actual,
    });
  }

  return [...byDate.values()]
    .map((b) => ({ ...b, diff: b.actualTotal - b.estimatedTotal }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
