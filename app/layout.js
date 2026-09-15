import "./globals.css";

export const metadata = {
  title: "플랜두씨 다이어리",
  description: "계획(Plan) → 실제로 한 일(Do) → 돌아보기(See)를 잇는 다이어리",
};

export default function RootLayout({ children }) {
  // 이 루트 레이아웃은 로그인 화면(/login, /signup)과 로그인 뒤 화면
  // 양쪽에 다 씌워진다. 그래서 다이어리 전용 UI(사이드바, 로그아웃 버튼)는
  // 여기 두지 않고 app/(app)/layout.js 쪽으로 옮겼다 — 그래야 로그인하지
  // 않은 사람에게 "할 일/계획" 링크가 보이는 일이 없다 (T07-C03).
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
