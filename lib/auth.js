import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// 인증 구현 설명서 ①②에 대응:
// - 무엇으로 붙였나: 직접 구현 (라이브러리는 비밀번호 해싱에만 bcryptjs 사용)
// - 왜: 세션/토큰 발급·검증·무효화 로직을 투명하게 보여주기 쉽고,
//   OAuth·CAPTCHA 같은 부가 기능이 딸려오지 않아 "심사자가 계정 생성 없이
//   시크릿 창에서 결과물을 연다"는 제약과 충돌할 여지가 없다.
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일 뒤 만료
const BCRYPT_COST = 12; // 비용 인자가 커질수록 무차별 대입이 느려진다

// ----- 비밀번호 -----

export async function hashPassword(plain) {
  // bcrypt는 해시마다 무작위 소금(salt)을 자동으로 만들어 붙이므로
  // 같은 비밀번호를 넣어도 저장되는 값이 매번 달라진다 (T07-C104).
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ----- 세션 토큰 -----
// 쿠키에는 무작위 원문 토큰만 담고, DB에는 그 토큰의 SHA-256 해시만 저장한다.
// 이렇게 하면 DB가 그대로 유출되어도 쿠키 값(session_token)을 복원할 수 없고,
// 토큰에 서명을 하지 않으므로 "서명용 비밀키"가 애초에 존재하지 않는다
// (그래서 브라우저 코드·배포 파일·Git 기록 어디에도 있을 수가 없다, T07-C113).
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

export async function createSessionForUser(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, // JS(document.cookie)로 못 읽음 -> URL/브라우저 콘솔로 안 샌다
    secure: isProd(), // 배포(HTTPS)에서는 HTTPS로만 전송
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

// 현재 요청의 쿠키로 로그인한 사용자를 찾는다. 없거나 만료됐으면 null.
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    // 만료된 세션은 그 자리에서 정리한다.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

// 서버 컴포넌트/서버 액션 맨 앞에서 호출: 로그인 안 돼 있으면 즉시 로그인
// 화면으로 보낸다 (T07-C97). 페이지마다 이 함수를 부르므로 어떤 새 화면을
// 추가하더라도 이 줄을 빼먹지 않는 한 로그인 없이는 열리지 않는다.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroyCurrentSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    // 지금 브라우저가 들고 있는 세션 하나만 지운다 (다른 기기 로그인은 유지).
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  cookies().delete(SESSION_COOKIE);
}

// 비밀번호를 바꿀 때 등, 그 사용자의 모든 세션을 강제로 끊고 싶을 때 사용.
export async function destroyAllSessionsForUser(userId) {
  await prisma.session.deleteMany({ where: { userId } });
}
