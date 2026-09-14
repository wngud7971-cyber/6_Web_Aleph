import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { todos: true, revisions: true } } },
  });

  return (
    <section className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>계획</h1>
        <a className="btn" href="/plans/new">
          + 새 계획
        </a>
      </div>
      <p className="sub">
        지금 실제로 하고 있는 일을 계획으로 옮겨 두세요. 남의 예시가 아니라 내 계획을
        넣어야 합니다.
      </p>
      {plans.length === 0 ? (
        <p className="muted">아직 계획이 없습니다.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>기간</th>
              <th>우선순위</th>
              <th>성공 기준</th>
              <th>예상 시간</th>
              <th>할 일</th>
              <th>수정 이력</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>
                  {p.periodStart} ~ {p.periodEnd}
                </td>
                <td>{p.priority}</td>
                <td>{p.successCriteria}</td>
                <td>{p.estimatedHours}시간</td>
                <td>{p._count.todos}개</td>
                <td>{p._count.revisions}건</td>
                <td className="inline-actions">
                  <a className="link" href={`/plans/${p.id}`}>
                    열기
                  </a>
                  <a className="link" href={`/plans/${p.id}/edit`}>
                    고치기
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
