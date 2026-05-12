# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 규칙

모든 응답, 설명, 코드 주석은 **반드시 한국어**로 작성한다.

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
