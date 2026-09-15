import { requireUser } from "@/lib/auth";
import { deleteAccountAction } from "@/app/auth-actions";
import ConfirmButton from "@/app/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <section className="panel">
      <h1>계정</h1>
      <div className="table-scroll">
        <table>
          <tbody>
            <tr>
              <th>이메일</th>
              <td>{user.email}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>내 자료 내보내기</h2>
      <p className="sub">
        내 계획·할 일·실행 기록·돌아보기 메모를 파일 하나(JSON)로 내려받습니다. 다른
        계정의 자료는 섞이지 않습니다.
      </p>
      <a className="btn" href="/api/export">
        내보내기 (JSON 다운로드)
      </a>

      <h2 style={{ marginTop: 28, color: "#9a3b2f" }}>계정 삭제</h2>
      <p className="sub">
        계정을 지우면 이 계정에 속한 계획·할 일·실행 기록·완료 이력·수정 이력·메모·
        인사이트가 모두 함께 지워집니다. 되돌릴 수 없습니다.
      </p>
      <form action={deleteAccountAction}>
        <ConfirmButton
          type="submit"
          className="danger"
          message="정말로 계정과 모든 자료를 지울까요? 되돌릴 수 없습니다."
        >
          계정과 내 자료 모두 지우기
        </ConfirmButton>
      </form>
    </section>
  );
}
