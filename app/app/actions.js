"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- 계획 (Plan) ----------

export async function createPlan(formData) {
  const plan = await prisma.plan.create({
    data: {
      title: String(formData.get("title") || "").trim(),
      periodStart: String(formData.get("periodStart") || ""),
      periodEnd: String(formData.get("periodEnd") || ""),
      priority: String(formData.get("priority") || "보통"),
      successCriteria: String(formData.get("successCriteria") || "").trim(),
      estimatedHours: num(formData.get("estimatedHours")),
    },
  });
  revalidatePath("/plans");
  redirect(`/plans/${plan.id}`);
}

// 계획을 고칠 때: 먼저 "고치기 전" 값을 PlanRevision에 스냅샷으로 남긴 뒤 갱신한다.
export async function updatePlan(formData) {
  const id = String(formData.get("id"));
  const before = await prisma.plan.findUnique({ where: { id } });
  if (!before) throw new Error("계획을 찾을 수 없습니다.");

  await prisma.planRevision.create({
    data: {
      planId: id,
      title: before.title,
      periodStart: before.periodStart,
      periodEnd: before.periodEnd,
      priority: before.priority,
      successCriteria: before.successCriteria,
      estimatedHours: before.estimatedHours,
    },
  });

  await prisma.plan.update({
    where: { id },
    data: {
      title: String(formData.get("title") || "").trim(),
      periodStart: String(formData.get("periodStart") || ""),
      periodEnd: String(formData.get("periodEnd") || ""),
      priority: String(formData.get("priority") || "보통"),
      successCriteria: String(formData.get("successCriteria") || "").trim(),
      estimatedHours: num(formData.get("estimatedHours")),
    },
  });

  revalidatePath(`/plans/${id}`);
  revalidatePath("/plans");
  redirect(`/plans/${id}`);
}

// ---------- 할 일 (Todo) ----------

export async function createTodo(formData) {
  const planId = String(formData.get("planId"));
  await prisma.todo.create({
    data: {
      planId,
      title: String(formData.get("title") || "").trim(),
      content: String(formData.get("content") || "").trim() || null,
      dueDate: String(formData.get("dueDate") || "") || null,
      priority: String(formData.get("priority") || "보통"),
      tags: String(formData.get("tags") || "").trim(),
      estimatedMinutes: num(formData.get("estimatedMinutes")),
    },
  });
  const redirectTo = String(formData.get("redirectTo") || "") || `/plans/${planId}`;
  revalidatePath("/todos");
  revalidatePath("/");
  revalidatePath(`/plans/${planId}`);
  redirect(redirectTo);
}

export async function updateTodo(formData) {
  const id = String(formData.get("id"));
  const todo = await prisma.todo.update({
    where: { id },
    data: {
      title: String(formData.get("title") || "").trim(),
      content: String(formData.get("content") || "").trim() || null,
      dueDate: String(formData.get("dueDate") || "") || null,
      priority: String(formData.get("priority") || "보통"),
      tags: String(formData.get("tags") || "").trim(),
      estimatedMinutes: num(formData.get("estimatedMinutes")),
    },
  });
  revalidatePath("/todos");
  revalidatePath(`/plans/${todo.planId}`);
  redirect(`/todos`);
}

export async function deleteTodo(formData) {
  const id = String(formData.get("id"));
  // 소프트 삭제: deletedAt 만 채우고 실제 행은 남긴다 (집계·이력 보존).
  await prisma.todo.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/todos");
  redirect("/todos");
}

// 완료 처리: status가 지금 'todo' 일 때만 원자적으로 'done'으로 바꾸고,
// 그때만 CompletionEvent를 만든다. 연달아 두 번 눌러도 두 번째 요청은
// updateMany 결과 count가 0이라 아무 기록도 남기지 않는다.
export async function completeTodo(formData) {
  const id = String(formData.get("id"));
  const redirectTo = String(formData.get("redirectTo") || "/todos");
  const result = await prisma.todo.updateMany({
    where: { id, status: "todo" },
    data: { status: "done", completedAt: new Date() },
  });
  if (result.count === 1) {
    await prisma.completionEvent.create({ data: { todoId: id, action: "complete" } });
  }
  revalidatePath("/todos");
  revalidatePath("/review");
  revalidatePath("/");
  redirect(redirectTo);
}

export async function uncompleteTodo(formData) {
  const id = String(formData.get("id"));
  const redirectTo = String(formData.get("redirectTo") || "/todos");
  const result = await prisma.todo.updateMany({
    where: { id, status: "done" },
    data: { status: "todo", completedAt: null },
  });
  if (result.count === 1) {
    await prisma.completionEvent.create({ data: { todoId: id, action: "uncomplete" } });
  }
  revalidatePath("/todos");
  revalidatePath("/review");
  revalidatePath("/");
  redirect(redirectTo);
}

// ---------- 실행 기록 (ExecutionLog) ----------

export async function createExecutionLog(formData) {
  const todoId = String(formData.get("todoId"));
  const startedAt = new Date(String(formData.get("startedAt")));
  const endedAt = new Date(String(formData.get("endedAt")));
  const explicitMinutes = formData.get("actualMinutes");
  const actualMinutes =
    explicitMinutes && String(explicitMinutes).trim() !== ""
      ? num(explicitMinutes)
      : Math.max(0, (endedAt - startedAt) / 60000);

  // 실행 기록 저장은 Todo(계획 관련 값)를 절대 덮어쓰지 않는다 - 별도 테이블에만 insert.
  await prisma.executionLog.create({
    data: {
      todoId,
      startedAt,
      endedAt,
      actualMinutes,
      blockerReason: String(formData.get("blockerReason") || "").trim() || null,
    },
  });
  revalidatePath("/execution");
  revalidatePath("/todos");
  revalidatePath("/review");
  redirect(`/todos`);
}

// ---------- 돌아보기 -> 다음 계획 ----------

export async function createInsight(formData) {
  const note = String(formData.get("note") || "").trim();
  const planId = String(formData.get("planId") || "") || null;
  await prisma.insight.create({ data: { note, planId } });
  revalidatePath("/review");
  redirect("/review");
}

// ---------- 날짜 이벤트 (자유 메모/일정) ----------

export async function createEvent(formData) {
  const date = String(formData.get("date"));
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  await prisma.event.create({ data: { date, title, note } });
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
  redirect(`/day/${date}`);
}

export async function deleteEvent(formData) {
  const id = String(formData.get("id"));
  const date = String(formData.get("date"));
  await prisma.event.delete({ where: { id } });
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
  redirect(`/day/${date}`);
}
