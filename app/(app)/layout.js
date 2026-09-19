import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/auth-actions";

// (app) 라우트 그룹 아래 있는 모든 페이지(계획/할 일/실행기록/돌아보기/날짜/
// 계정)는 이 레이아웃을 반드시 거친다. requireUser()가 여기 한 곳에만
// 있어도, 이 그룹 밑에 새 페이지를 아무리 추가해도 로그인 없이는 절대
// 열리지 않는다 (T07-C97) — 페이지마다 따로 검사하는 걸 잊을 걱정이 없다.
export default async function AppLayout({ children }) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          플랜두씨 다이어리
        </a>
        <nav className="nav">
          <a href="/plans">계획</a>
          <a href="/todos">할 일</a>
          <a href="/execution">실행 기록</a>
          <a href="/review">돌아보기</a>
          <a href="/api/export">내보내기</a>
          <a href="/account">계정</a>
        </nav>
        <div className="notice-banner" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>{user.email} 로 로그인함</span>
          <form action={logoutAction}>
            <button type="submit" className="secondary" style={{ width: "100%" }}>
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
