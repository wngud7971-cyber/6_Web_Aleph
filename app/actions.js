"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { requireUser } from "@/lib/auth";

function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// 리다이렉트 경로에 ok=<메시지키>를 붙여서, 이동한 페이지가 "방금 처리됐다"는
// 배너를 보여줄 수 있게 한다 (서버 액션은 alert()을 못 띄우므로 이 방식을 쓴다).
function withOk(url, key) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ok=${key}`;
}

// ---------------------------------------------------------------------------
// 소유권 확인 헬퍼. 자료가 없거나 "내 것이 아니면" 있는지 없는지조차 알려주지
// 않고 404로 처리한다 (존재를 감추는 방식, T07-C121). id를 다른 계정 것으로
// 바꿔 보내는 공격을 여기서 전부 막는다 (T07-C117~T07-C120, T07-C123).
// ---------------------------------------------------------------------------

async function loadOwnedPlan(id, userId) {
  const plan = await prisma.plan.findFirst({ where: { id, userId } });
  if (!plan) notFound();
  return plan;
}

async function loadOwnedTodo(id, userId) {
  const todo = await prisma.todo.findFirst({
    where: { id, plan: { userId } },
    include: { plan: true },
  });
  if (!todo) notFound();
  return todo;
}

// ---------- 계획 (Plan) ----------

export async function createPlan(formData) {
  const user = await requireUser();
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      title: String(formData.get("title") || "").trim(),
      periodStart: String(formData.get("periodStart") || ""),
      periodEnd: String(formData.get("periodEnd") || ""),
      priority: String(formData.get("priority") || "보통"),
      successCriteria: String(formData.get("successCriteria") || "").trim(),
      estimatedHours: num(formData.get("estimatedHours")),
    },
  });
  revalidatePath("/plans");
  revalidatePath("/");
  redirect(withOk(`/plans/${plan.id}`, "plan-created"));
}

// 계획을 고칠 때: 먼저 "고치기 전" 값을 PlanRevision에 스냅샷으로 남긴 뒤 갱신한다.
export async function updatePlan(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const before = await loadOwnedPlan(id, user.id);

  const ruleChangeReason = String(formData.get("ruleChangeReason") || "").trim();
  const nextData = {
    title: String(formData.get("title") || "").trim(),
    periodStart: String(formData.get("periodStart") || ""),
    periodEnd: String(formData.get("periodEnd") || ""),
    priority: String(formData.get("priority") || "보통"),
    successCriteria: String(formData.get("successCriteria") || "").trim(),
    estimatedHours: num(formData.get("estimatedHours")),
  };

  // 세 가지(고치기 전 스냅샷 남기기 / 규칙 변경 이유 남기기 / 실제 값 갱신)를
  // 한 트랜잭션으로 묶는다 — 중간에 하나라도 실패하면 전부 되돌아간다.
  await prisma.$transaction([
    prisma.planRevision.create({
      data: {
        planId: id,
        title: before.title,
        periodStart: before.periodStart,
        periodEnd: before.periodEnd,
        priority: before.priority,
        successCriteria: before.successCriteria,
        estimatedHours: before.estimatedHours,
      },
    }),
    ...(ruleChangeReason
      ? [prisma.ruleChange.create({ data: { userId: user.id, planId: id, reason: ruleChangeReason } })]
      : []),
    prisma.plan.update({ where: { id }, data: nextData }),
  ]);

  revalidatePath(`/plans/${id}`);
  revalidatePath("/plans");
  redirect(withOk(`/plans/${id}`, "plan-updated"));
}

// 계획을 지우면 딸린 할 일·실행기록·완료이력·수정이력도 함께 지워진다 (DB cascade).
export async function deletePlan(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await loadOwnedPlan(id, user.id); // 내 것이 아니면 여기서 404
  await prisma.plan.delete({ where: { id } });
  revalidatePath("/plans");
  revalidatePath("/todos");
  revalidatePath("/review");
  revalidatePath("/");
  redirect(withOk("/plans", "plan-deleted"));
}

// ---------- 할 일 (Todo) ----------

export async function createTodo(formData) {
  const user = await requireUser();
  const planId = String(formData.get("planId"));
  await loadOwnedPlan(planId, user.id); // 남의 planId를 끼워 넣어도 여기서 막힘

  await prisma.todo.create({
    data: {
      planId,
      title: String(formData.get("title") || "").trim(),
      content: sanitizeHtml(formData.get("content")) || null,
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
  redirect(withOk(redirectTo, "todo-created"));
}

export async function updateTodo(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const existing = await loadOwnedTodo(id, user.id);

  const todo = await prisma.todo.update({
    where: { id },
    data: {
      title: String(formData.get("title") || "").trim(),
      content: sanitizeHtml(formData.get("content")) || null,
      dueDate: String(formData.get("dueDate") || "") || null,
      priority: String(formData.get("priority") || "보통"),
      tags: String(formData.get("tags") || "").trim(),
      estimatedMinutes: num(formData.get("estimatedMinutes")),
    },
  });
  revalidatePath("/todos");
  revalidatePath("/");
  revalidatePath(`/plans/${existing.planId}`);
  redirect(withOk("/todos", "todo-updated"));
}

export async function deleteTodo(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await loadOwnedTodo(id, user.id);
  const redirectTo = String(formData.get("redirectTo") || "") || "/todos";
  // 소프트 삭제: deletedAt 만 채우고 실제 행은 남긴다 (집계·이력 보존).
  await prisma.todo.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/todos");
  revalidatePath("/review");
  revalidatePath("/");
  redirect(withOk(redirectTo, "todo-deleted"));
}

// 완료 처리: 먼저 소유권을 확인한 뒤, status가 지금 'todo' 일 때만 원자적으로
// 'done'으로 바꾸고, 그때만 CompletionEvent를 만든다. 연달아 두 번 눌러도
// 두 번째 요청은 updateMany 결과 count가 0이라 아무 기록도 남기지 않는다.
export async function completeTodo(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await loadOwnedTodo(id, user.id);
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
  redirect(withOk(redirectTo, "todo-done"));
}

export async function uncompleteTodo(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await loadOwnedTodo(id, user.id);
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
  redirect(withOk(redirectTo, "todo-undone"));
}

// ---------- 실행 기록 (ExecutionLog) ----------

function pad2(n) {
  return String(n).padStart(2, "0");
}

// date(YYYY-MM-DD) + hour(0~23) + minute(0~59)을 "+09:00"(KST) 오프셋을 명시해
// 조합한다. datetime-local처럼 브라우저가 오전/오후로 잘못 보여줄 여지도 없고,
// 서버가 어느 시간대에서 돌든(Vercel은 보통 UTC) +09:00을 직접 박아뒀으므로
// 항상 "입력한 그 숫자 그대로"가 서울 시간으로 저장된다.
function kstDateTimeFromParts(dateStr, hourStr, minuteStr) {
  const h = pad2(parseInt(hourStr, 10) || 0);
  const m = pad2(parseInt(minuteStr, 10) || 0);
  return new Date(`${dateStr}T${h}:${m}:00+09:00`);
}

export async function createExecutionLog(formData) {
  const user = await requireUser();
  const todoId = String(formData.get("todoId"));
  await loadOwnedTodo(todoId, user.id); // 남의 todoId를 끼워 넣어도 여기서 막힘

  const startedAt = kstDateTimeFromParts(
    formData.get("startedAtDate"),
    formData.get("startedAtHour"),
    formData.get("startedAtMinute")
  );
  const endedAt = kstDateTimeFromParts(
    formData.get("endedAtDate"),
    formData.get("endedAtHour"),
    formData.get("endedAtMinute")
  );
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
  redirect(withOk("/todos", "log-created"));
}

// 실행 기록 하나를 지운다. todo -> plan -> userId를 거쳐 소유자를 확인하므로,
// 남의 실행 기록 id를 넣어도 404로 막힌다.
export async function deleteExecutionLog(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const log = await prisma.executionLog.findFirst({
    where: { id, todo: { plan: { userId: user.id } } },
  });
  if (!log) notFound();
  await prisma.executionLog.delete({ where: { id } });
  const redirectTo = String(formData.get("redirectTo") || "/todos");
  revalidatePath("/execution");
  revalidatePath("/todos");
  revalidatePath("/review");
  redirect(withOk(redirectTo, "log-deleted"));
}

// ---------- 돌아보기 -> 다음 계획 ----------

export async function createInsight(formData) {
  const user = await requireUser();
  const note = String(formData.get("note") || "").trim();
  const planId = String(formData.get("planId") || "") || null;
  if (planId) await loadOwnedPlan(planId, user.id); // 남의 계획에 인사이트를 붙이는 것 방지
  await prisma.insight.create({ data: { userId: user.id, note, planId } });
  revalidatePath("/review");
  redirect(withOk("/review", "insight-created"));
}

// ---------- 날짜 이벤트 (자유 메모/일정) ----------

export async function createEvent(formData) {
  const user = await requireUser();
  const date = String(formData.get("date"));
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  await prisma.event.create({ data: { userId: user.id, date, title, note } });
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
  redirect(withOk(`/day/${date}`, "memo-created"));
}

export async function deleteEvent(formData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const date = String(formData.get("date"));
  const owned = await prisma.event.findFirst({ where: { id, userId: user.id } });
  if (!owned) notFound();
  await prisma.event.delete({ where: { id } });
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
  redirect(withOk(`/day/${date}`, "memo-deleted"));
}
