import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// 라우트 핸들러(Route Handler)는 app/(app)/layout.js의 requireUser()를 거치지
// 않는다 (레이아웃은 페이지에만 적용됨) — 그래서 여기서 직접 로그인 여부를
// 확인한다. 로그인 안 했으면 401, 했으면 "내 자료"만 내보낸다.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [plans, todos] = await Promise.all([
    prisma.plan.findMany({ where: { userId: user.id } }),
    prisma.todo.findMany({ where: { plan: { userId: user.id } } }),
  ]);
  const planIds = plans.map((p) => p.id);
  const todoIds = todos.map((t) => t.id);

  const [planRevisions, executionLogs, completionEvents, insights, ruleChanges] =
    await Promise.all([
      prisma.planRevision.findMany({ where: { planId: { in: planIds } } }),
      prisma.executionLog.findMany({ where: { todoId: { in: todoIds } } }),
      prisma.completionEvent.findMany({ where: { todoId: { in: todoIds } } }),
      prisma.insight.findMany({ where: { userId: user.id } }),
      prisma.ruleChange.findMany({ where: { userId: user.id }, orderBy: { changedAt: "asc" } }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user.email,
    plans,
    planRevisions,
    todos,
    executionLogs,
    completionEvents,
    insights,
    ruleChanges,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="plando-diary-export-${Date.now()}.json"`,
    },
  });
}
