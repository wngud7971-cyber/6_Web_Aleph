"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSessionForUser,
  destroyCurrentSession,
  destroyAllSessionsForUser,
  requireUser,
} from "@/lib/auth";

// 아이디 없음/비밀번호 틀림 안내 문구를 반드시 같게 만든다 (T07-C99).
// 이 값 하나로 로그인 실패의 모든 경우를 가리킨다.
const LOGIN_ERROR = "invalid";

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function signupAction(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!isValidEmail(email)) {
    redirect(`/signup?error=email`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=weak`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // 같은 아이디로 두 번 가입되지 않는다 (T07-C98).
    redirect(`/signup?error=exists`);
  }

  const passwordHash = await hashPassword(password);

  // 이 시스템에 아직 아무 계정도 없었다면, 6번에서 만들어 둔(주인 없는) 내
  // 자료를 이번에 만드는 첫 계정으로 옮긴다 (T07-C100).
  const isFirstAccount = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({ data: { email, passwordHash } });

  if (isFirstAccount) {
    await prisma.$transaction([
      prisma.plan.updateMany({ where: { userId: null }, data: { userId: user.id } }),
      prisma.event.updateMany({ where: { userId: null }, data: { userId: user.id } }),
      prisma.insight.updateMany({ where: { userId: null }, data: { userId: user.id } }),
    ]);
  }

  await createSessionForUser(user.id);
  redirect("/");
}

export async function loginAction(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect(`/login?error=${LOGIN_ERROR}`);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    redirect(`/login?error=${LOGIN_ERROR}`);
  }

  await createSessionForUser(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login?error=loggedout");
}

// ----- 계정 삭제 (T07-C134) -----
// User 행을 지우면 onDelete: Cascade로 그 사람의 Plan/Todo/ExecutionLog/
// CompletionEvent/PlanRevision/Event/Insight/Session/RuleChange가 전부 함께
// 지워진다 (스키마 참고). "지워진다는 안내"가 아니라 실제로 지운다.
export async function deleteAccountAction() {
  const user = await requireUser();
  await destroyAllSessionsForUser(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  redirect("/login?error=accountdeleted");
}
