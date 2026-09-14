// 리치 텍스트(내용) 필드를 안전하게 거르는 함수. 외부 라이브러리 없이
// "허용 목록(allowlist)" 방식으로 동작한다: 아래 목록에 없는 태그와 속성은
// 전부 버린다. 따라서 <script>, onclick=, javascript: 같은 것은 통과할 수
// 없고, 글자 그대로 화면에 보이게 된다 (T06-C57).

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "span", "mark", "br", "div", "p",
  "table", "thead", "tbody", "tr", "td", "th",
]);

// style 속성에서 이 속성들만 남긴다. url(), expression() 등은 통째로 거른다.
const ALLOWED_STYLE_PROPS = new Set([
  "background-color", "color", "font-family", "font-weight", "font-style",
  "text-decoration",
]);

function sanitizeStyle(value) {
  const safe = [];
  for (const decl of String(value).split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    // 괄호나 따옴표를 이용한 우회를 막는다 (url(...), expression(...) 등).
    if (/[()\\"']|url|expression|javascript|import/i.test(val)) continue;
    if (val.length > 64) continue;
    safe.push(prop + ":" + val);
  }
  return safe.join(";");
}

function sanitizeAttrs(rawAttrs) {
  const out = [];
  const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
  let m;
  while ((m = attrRe.exec(rawAttrs)) !== null) {
    const name = (m[1] || m[3] || "").toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[4] || "";
    if (name !== "style") continue; // style 외의 모든 속성은 버린다
    const cleanStyle = sanitizeStyle(value);
    if (cleanStyle) out.push(' style="' + cleanStyle + '"');
  }
  return out.join("");
}

export function sanitizeHtml(dirty) {
  if (!dirty) return "";
  let html = String(dirty);

  // 스크립트/스타일 블록은 내용까지 통째로 제거한다.
  html = html.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 남은 태그들을 하나씩 검사해서, 허용 목록에 없으면 태그 자체를 글자로 바꾼다.
  html = html.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (match, closing, tagName, attrs) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // 허용되지 않은 태그는 이스케이프해서 "글자 그대로" 보이게 한다.
        return match.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      if (closing) return "</" + tag + ">";
      if (tag === "br") return "<br>";
      return "<" + tag + sanitizeAttrs(attrs) + ">";
    }
  );

  return html;
}
