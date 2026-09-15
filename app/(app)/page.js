import { prisma } from "@/lib/prisma";
import { buildMonthGrid, parseYearMonth, shiftMonth, WEEKDAY_LABELS } from "@/lib/calendar";
import { kstTodayStr } from "@/lib/time";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CalendarHomePage({ searchParams }) {
  const user = await requireUser();
  const { year, month } = parseYearMonth(searchParams?.ym);
  const weeks = buildMonthGrid(year, month);
  const rangeStart = weeks[0][0].date;
  const rangeEnd = weeks[5][6].date;
  const today = kstTodayStr();

  const [plans, events] = await Promise.all([
    prisma.plan.findMany({
      where: {
        userId: user.id,
        periodStart: { lte: rangeEnd },
        periodEnd: { gte: rangeStart },
      },
    }),
    prisma.event.findMany({
      where: { userId: user.id, date: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const dayMap = {};
  const ensure = (d) => (dayMap[d] ||= { events: [], plans: [] });
  for (const e of events) ensure(e.date).events.push(e);
  for (const p of plans) {
    for (const week of weeks) {
      for (const cell of week) {
        if (cell.date >= p.periodStart && cell.date <= p.periodEnd) {
          ensure(cell.date).plans.push(p);
        }
      }
    }
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthLabel = `${year}년 ${month}월`;

  return (
    <section className="panel calendar-panel">
      <div className="cal-header">
        <div className="cal-nav">
          <a className="cal-nav-btn" href={`/?ym=${prev.year}-${String(prev.month).padStart(2, "0")}`}>
            ‹
          </a>
          <h1>{monthLabel}</h1>
          <a className="cal-nav-btn" href={`/?ym=${next.year}-${String(next.month).padStart(2, "0")}`}>
            ›
          </a>
        </div>
        <div className="inline-actions">
          <a className="btn" href="/plans/new">+ 계획</a>
          <a className="btn secondary" href="/review">돌아보기</a>
        </div>
      </div>

      <div className="cal-grid cal-weekday-row">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={`cal-weekday ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>
            {w}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div className="cal-grid" key={wi}>
          {week.map((cell) => {
            const data = dayMap[cell.date] || { events: [], plans: [] };
            const isToday = cell.date === today;
            const dayNum = Number(cell.date.slice(-2));

            // 이 날의 계획·메모만 모은다 (할 일은 계획을 펼쳐야 보임).
            const allItems = [
              ...data.plans.map((p) => ({ kind: "plan", obj: p })),
              ...data.events.map((e) => ({ kind: "event", obj: e })),
            ];
            const shown = allItems.slice(0, 2);
            const restCount = allItems.length - shown.length;

            return (
              <a
                key={cell.date}
                href={`/day/${cell.date}`}
                className={`cal-cell ${cell.inMonth ? "" : "cal-cell-out"} ${isToday ? "cal-cell-today" : ""}`}
              >
                <div className="cal-cell-num">{dayNum}</div>
                <div className="cal-cell-body">
                  {shown.map((item) => {
                    if (item.kind === "event") {
                      return (
                        <div key={`e-${item.obj.id}`} className="cal-chip cal-chip-event" title={item.obj.title}>
                          {item.obj.title}
                        </div>
                      );
                    }
                    return (
                      <div key={`p-${item.obj.id}`} className="cal-chip cal-chip-plan" title={item.obj.title}>
                        {item.obj.title}
                      </div>
                    );
                  })}
                  {restCount > 0 && <div className="cal-chip-more">+{restCount}개 더</div>}
                </div>
              </a>
            );
          })}
        </div>
      ))}
    </section>
  );
}
