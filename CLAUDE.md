# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 구현 전 인터뷰 규칙

새로운 기능, 페이지, 또는 의미 있는 변경사항을 구현하기 전에 **반드시 먼저 사용자를 인터뷰**한다.

- 기술적 구현 방식, UI/UX, 우려사항, 트레이드오프를 모두 다루는 **상세하고 심도 있는 질문**을 한다.
- 뻔하거나 형식적인 질문(예: "색상은 무엇으로 할까요?")은 피하고, 구체적인 시나리오·엣지 케이스·의사결정 배경을 파고드는 질문을 한다.
- 인터뷰가 끝나면 수집된 답변을 바탕으로 **plan spec 파일**(`C:\Users\qoehd\.claude\plans\<topic>.md`)을 작성하고, 사용자 확인 후 구현을 시작한다.
- 사용자가 명백히 사소한 수정(오타 수정, 색상 한 줄 변경 등)을 요청할 때는 인터뷰를 생략할 수 있다.

## 언어 규칙

모든 응답, 설명, 코드 주석은 **반드시 한국어**로 작성한다.

## 커밋 규칙

파일 수정 후 **반드시 즉시 커밋과 푸시를 실행**한다. 작업 완료 후 별도 요청 없이도 자동으로 적용한다.

## Running the App

No build step or server required. Open any HTML file directly in a browser:

```
start index.html       # 홈 (랜딩 페이지)
start focus.html       # 포커스 세션
start stock.html       # 마켓 세션
start weight.html      # 바디 세션
```

## Git Workflow

```powershell
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
git add .
git commit -m "..."
git push origin main
```

Git is installed at `C:\Program Files\Git\bin\git.exe` but is not in the default PATH — always prepend it.

## Architecture

**Pure static web app** — no framework, no build tool, no npm. Three pages share one stylesheet.

| File | Role |
|------|------|
| `index.html` | Landing page — links to the three session pages |
| `focus.html` + `app.js` | 포커스 세션: timer, category tracking, heatmap, session log |
| `stock.html` + `stock.js` | 마켓 세션: holdings, watchlist, realized P&L |
| `weight.html` + `weight.js` | 바디 세션: meals, exercise, calorie balance |
| `style.css` | Shared stylesheet for all pages (dark theme, CSS variables) |

**Data persistence**: `localStorage` only — no backend. Each page uses its own key namespace (`fs_*`, `st_*`, `bd_*`). Data is scoped per-device/browser.

**CSS variables** defined in `:root` — `--primary` (purple, focus), `--stock` (amber, market), `--body-color` (green, body). Add new pages by defining a new accent color and following the same card/form pattern.

**No external dependencies** except Chart.js (CDN, focus page only).
