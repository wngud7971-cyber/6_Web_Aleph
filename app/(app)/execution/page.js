import { prisma } from "@/lib/prisma";
import { formatKST, formatMinutes } from "@/lib/time";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExecutionListPage({ searchParams }) {
  const user = await requireUser();
  const sort = searchParams?.sort === "asc" ? "asc" : "desc";
  const logs = await prisma.executionLog.findMany({
    where: { todo: { plan: { userId: user.id } } },
    include: { todo: { include: { plan: true } } },
    orderBy: { startedAt: sort },
  });

  return (
    <section className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>실행 기록 전체 ({logs.length}건)</h1>
        <a className="btn" href="/execution/new">
          + 실행 기록 남기기
        </a>
      </div>
      <p className="muted">
        정렬: {sort === "asc" ? <b>오래된 순</b> : <a className="link" href="/execution?sort=asc">오래된 순</a>}
        {" · "}
        {sort === "desc" ? <b>최신 순</b> : <a className="link" href="/execution?sort=desc">최신 순</a>}
      </p>
      {logs.length === 0 ? (
        <p className="muted">아직 실행 기록이 없습니다.</p>
      ) : (
        <div className="table-scroll">
            <table>
          <thead>
            <tr>
              <th>할 일</th>
              <th>계획</th>
              <th>시작</th>
              <th>종료</th>
              <th>실제 걸린 시간</th>
              <th>막혔던 이유</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  <a className="link" href={`/todos/${l.todo.id}/edit`}>
                    {l.todo.title}
                  </a>
                </td>
                <td>{l.todo.plan.title}</td>
                <td>{formatKST(l.startedAt)}</td>
                <td>{formatKST(l.endedAt)}</td>
                <td>{formatMinutes(l.actualMinutes)}</td>
                <td>{l.blockerReason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
            </div>
      )}
    </section>
  );
}
