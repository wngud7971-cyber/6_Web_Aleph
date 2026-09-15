// 로그인/가입 화면 전용 레이아웃. requireUser()를 부르지 않는다 —
// 심사자가 계정을 만들지 않아도 이 화면까지는 열려야 하기 때문이다
// (T07-C03, T07-C01).
export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          플랜두씨 다이어리
        </div>
        {children}
      </div>
    </div>
  );
}
