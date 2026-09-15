import { loginAction } from "@/app/auth-actions";

// 아이디가 없을 때와 비밀번호만 틀렸을 때, 화면에 보이는 문구가 완전히
// 같아야 한다 (T07-C99). 그래서 서버 쪽 에러 코드도 "invalid" 하나뿐이고,
// 이 화면도 그 코드 하나에만 반응한다 — 애초에 문구를 나눌 수 있는
// 방법 자체가 없다.
const ERROR_MESSAGES = {
  invalid: "아이디 또는 비밀번호가 올바르지 않습니다.",
  loggedout: "로그아웃되었습니다.",
  accountdeleted: "계정이 삭제되었습니다.",
};

export default function LoginPage({ searchParams }) {
  const error = searchParams?.error;
  const message = error ? ERROR_MESSAGES[error] : null;
  const isError = error === "invalid";

  return (
    <>
      <h1>로그인</h1>
      {message && (
        <p className={isError ? "auth-error" : "muted"} role={isError ? "alert" : undefined}>
          {message}
        </p>
      )}
      <form action={loginAction}>
        <label>
          이메일
          <input type="email" name="email" required autoFocus placeholder="you@example.com" />
        </label>
        <label>
          비밀번호
          <input type="password" name="password" required minLength={8} />
        </label>
        <button type="submit">로그인</button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        계정이 없나요? <a className="link" href="/signup">가입하기</a>
      </p>
    </>
  );
}
