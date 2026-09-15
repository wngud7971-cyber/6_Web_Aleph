import { prisma } from "@/lib/prisma";
import { formatMinutes } from "@/lib/time";
import OkBanner from "@/app/components/OkBanner";
import ConfirmButton from "@/app/components/ConfirmButton";
import {
  createTodo,
  completeTodo,
  uncompleteTodo,
  deleteTodo,
  createEvent,
  deleteEvent,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function DayDetailPage({ params, searchParams }) {
  const { date } = params;
  const weekday = WEEKDAY_LABELS[new Date(date + "T00:00:00").getDay()];

  const [plansToday, events] = await Promise.all([
    prisma.plan.findMany({
      where: { periodStart: { lte: date }, periodEnd: { gte: date } },
      include: {
        todos: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({ where: { date }, orderBy: { createdAt: "desc" } }),
  ]);

  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);
  const [y, m, d] = date.split("-").map(Number);

  return (
    <>
      <section className="panel">
        <div className="cal-header">
          <div className="cal-nav">
            <a className="cal-nav-btn" href={`/day/${prevDate}`}>‹</a>
            <h1>
              {y}년 {m}월 {d}일 ({weekday})
            </h1>
            <a className="cal-nav-btn" href={`/day/${nextDate}`}>›</a>
          </div>
          <a className="link" href={`/?ym=${y}-${String(m).padStart(2, "0")}`}>
            달력으로
          </a>
        </div>
        <OkBanner ok={searchParams?.ok} />
      </section>

      <section className="panel">
        <h2>진행 중인 계획 ({plansToday.length}개)</h2>
        {plansToday.length === 0 ? (
          <p className="muted">
            이 날짜를 기간에 포함하는 계획이 없습니다.{" "}
            <a className="link" href="/plans/new">계획 만들기</a>
          </p>
        ) : (
          plansToday.map((p) => {
            const doneCount = p.todos.filter((t) => t.status === "done").length;
            return (
              <details key={p.id} className="plan-accordion">
                <summary>
                  <span className="plan-accordion-title">{p.title}</span>
                  <span className="muted">
                    {p.periodStart} ~ {p.periodEnd} · {p.priority} · 할 일 {doneCount}/
                    {p.todos.length}
                  </span>
                </summary>

                <div className="plan-accordion-body">
                  {p.todos.length === 0 ? (
                    <p className="muted">아직 딸린 할 일이 없습니다.</p>
                  ) : (
                    <ul className="checklist">
                      {p.todos.map((t) => (
                        <li key={t.id} className={t.status === "done" ? "checklist-done" : ""}>
                          {t.status === "todo" ? (
                            <form action={completeTodo}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="redirectTo" value={`/day/${date}`} />
                              <button type="submit" className="check-toggle" aria-label="완료로 표시">
                                ☐
                              </button>
                            </form>
                          ) : (
                            <form action={uncompleteTodo}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="redirectTo" value={`/day/${date}`} />
                              <button type="submit" className="check-toggle" aria-label="진행중으로 되돌리기">
                                ☑
                              </button>
                            </form>
                          )}
                          <span className="checklist-label">
                            {t.title}
                            {t.dueDate && <span className="muted"> · {t.dueDate}</span>}
                            {t.priority === "최우선" && <span className="badge overdue">최우선</span>}
                          </span>
                          <a className="link" href={`/todos/${t.id}/edit`}>
                            고치기
                          </a>
                          <form action={deleteTodo}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="redirectTo" value={`/day/${date}`} />
                            <ConfirmButton type="submit" className="danger" message="이 할 일을 지울까요?">
                              지우기
                            </ConfirmButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={createTodo} className="checklist-add-form">
                    <input type="hidden" name="planId" value={p.id} />
                    <input type="hidden" name="redirectTo" value={`/day/${date}`} />
                    <input type="hidden" name="estimatedMinutes" value={30} />
                    <input type="hidden" name="priority" value="보통" />
                    <input name="title" required placeholder="+ 할 일 추가" />
                    <button type="submit" className="secondary">추가</button>
                  </form>
                  <p className="muted" style={{ marginTop: 6 }}>
                    마감일·우선순위·태그 등 자세한 값은{" "}
                    <a className="link" href={`/todos/new?planId=${p.id}`}>
                      할 일 추가 화면
                    </a>
                    에서 설정할 수 있습니다.
                  </p>
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className="panel">
        <h2>자유 메모 / 일정 ({events.length}개)</h2>
        <p className="sub">생일, 공휴일처럼 할 일은 아니지만 이 날짜에 남기고 싶은 메모입니다.</p>
        {events.length === 0 ? (
          <p className="muted">아직 없습니다.</p>
        ) : (
          <div className="grid-cards" style={{ marginBottom: 16 }}>
            {events.map((e) => (
              <div className="stat-card" key={e.id}>
                <span className="label">
                  {e.title}
                  {e.note ? ` — ${e.note}` : ""}
                </span>
                <form action={deleteEvent}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="date" value={date} />
                  <ConfirmButton type="submit" className="danger" message="이 메모를 지울까요?">
                    지우기
                  </ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={createEvent}>
          <input type="hidden" name="date" value={date} />
          <label>
            제목
            <input name="title" required placeholder="예: 생일, 공휴일" />
          </label>
          <label>
            메모 (선택)
            <textarea name="note" placeholder="자세한 내용" />
          </label>
          <button type="submit">메모 추가</button>
        </form>
      </section>
    </>
  );
}
