import { signupAction } from "@/app/auth-actions";

const ERROR_MESSAGES = {
  email: "이메일 형식이 올바르지 않습니다.",
  weak: "비밀번호는 8자 이상이어야 합니다.",
  exists: "이미 가입된 이메일입니다.",
};

export default function SignupPage({ searchParams }) {
  const error = searchParams?.error;
  const message = error ? ERROR_MESSAGES[error] : null;

  return (
    <>
      <h1>가입하기</h1>
      <p className="sub">
        가입하면 6번 과제 때부터 넣어 둔 내 자료(계정 없이 만들었던 계획·할 일·메모)가
        자동으로 이 계정 것이 됩니다. 이 자동 이전은 이 시스템의 <b>첫 번째 계정</b>에만
        적용됩니다.
      </p>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <form action={signupAction}>
        <label>
          이메일
          <input type="email" name="email" required autoFocus placeholder="you@example.com" />
        </label>
        <label>
          비밀번호 (8자 이상)
          <input type="password" name="password" required minLength={8} />
        </label>
        <button type="submit">가입하기</button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        이미 계정이 있나요? <a className="link" href="/login">로그인하기</a>
      </p>
    </>
  );
}
