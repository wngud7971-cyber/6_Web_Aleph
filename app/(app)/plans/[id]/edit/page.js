import { prisma } from "@/lib/prisma";
import { updatePlan } from "@/app/actions";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }) {
  const user = await requireUser();
  const plan = await prisma.plan.findFirst({ where: { id: params.id, userId: user.id } });
  if (!plan) notFound();

  return (
    <section className="panel">
      <h1>계획 고치기</h1>
      <p className="sub">
        저장하면 지금 값이 "고치기 전 값"으로 수정 이력에 남고, 그 다음 새 값으로
        바뀝니다.
      </p>
      <form action={updatePlan}>
        <input type="hidden" name="id" value={plan.id} />
        <label>
          제목
          <input name="title" defaultValue={plan.title} required />
        </label>
        <div className="row2">
          <label>
            시작일
            <input type="date" name="periodStart" defaultValue={plan.periodStart} required />
          </label>
          <label>
            종료일
            <input type="date" name="periodEnd" defaultValue={plan.periodEnd} required />
          </label>
        </div>
        <label>
          우선순위
          <select name="priority" defaultValue={plan.priority}>
            <option value="최우선">최우선</option>
                  <option value="높음">높음</option>
            <option value="보통">보통</option>
            <option value="낮음">낮음</option>
          </select>
        </label>
        <label>
          성공 기준
          <textarea name="successCriteria" defaultValue={plan.successCriteria} required />
        </label>
        <label>
          예상 시간(시간 단위)
          <input
            type="number"
            step="0.5"
            min="0"
            name="estimatedHours"
            defaultValue={plan.estimatedHours}
            required
          />
        </label>
        <label>
          이번에 규칙(성공 기준 등)을 바꾼 이유 — 카드5의 "3일차 전 규칙 변경"에
          해당한다면 여기에 적으세요 (안 바꿨으면 비워 두세요)
          <textarea
            name="ruleChangeReason"
            placeholder="예: 하루 평균 30분으로는 부족해서 성공 기준을 45분으로 올림"
          />
        </label>
        <button type="submit">고친 내용 저장</button>
      </form>
    </section>
  );
}
