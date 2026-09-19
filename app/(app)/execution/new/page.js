import { prisma } from "@/lib/prisma";
import { createExecutionLog } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewExecutionLogPage({ searchParams }) {
  const user = await requireUser();
  const todos = await prisma.todo.findMany({
    where: { deletedAt: null, plan: { userId: user.id } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  const preselect = searchParams?.todoId || "";

  return (
    <section className="panel">
      <h1>실제로 한 일 적기</h1>
      <p className="sub">
        계획 값은 그대로 두고, 실제로 언제 시작해서 얼마나 걸렸고 어디서 막혔는지만
        따로 남깁니다.
      </p>
      {todos.length === 0 ? (
        <p className="muted">
          먼저 <a className="link" href="/todos/new">할 일을 만들어야</a> 실행 기록을
          남길 수 있습니다.
        </p>
      ) : (
        <form action={createExecutionLog}>
          <label>
            할 일
            <select name="todoId" defaultValue={preselect} required>
              <option value="" disabled>
                할 일을 고르세요
              </option>
              {todos.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.plan.title}] {t.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>시작 시각 (오전/오후 없이 0~23시로 입력)</legend>
            <div className="row3">
              <label>
                날짜
                <input type="date" name="startedAtDate" required />
              </label>
              <label>
                시 (0~23)
                <input type="number" name="startedAtHour" min="0" max="23" step="1" required />
              </label>
              <label>
                분 (0~59)
                <input type="number" name="startedAtMinute" min="0" max="59" step="1" required />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>끝난 시각 (오전/오후 없이 0~23시로 입력)</legend>
            <div className="row3">
              <label>
                날짜
                <input type="date" name="endedAtDate" required />
              </label>
              <label>
                시 (0~23)
                <input type="number" name="endedAtHour" min="0" max="23" step="1" required />
              </label>
              <label>
                분 (0~59)
                <input type="number" name="endedAtMinute" min="0" max="59" step="1" required />
              </label>
            </div>
          </fieldset>
          <label>
            실제로 걸린 시간(분) — 비워두면 시작·끝 시각으로 자동 계산합니다
            <input type="number" min="0" step="1" name="actualMinutes" />
          </label>
          <label>
            막혔던 이유 (없으면 비워두세요)
            <textarea name="blockerReason" placeholder="예: API 연동 오류로 40분 지연" />
          </label>
          <button type="submit">실행 기록 저장</button>
        </form>
      )}
    </section>
  );
}
