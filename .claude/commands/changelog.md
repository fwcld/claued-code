전체 git 히스토리를 읽어 CHANGELOG.md를 생성하고 채팅에도 출력한다.

## 실행 절차

### 1단계 — git 로그 수집

아래 PowerShell 명령으로 전체 커밋 이력을 가져온다:

```powershell
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
cd c:\claude
git log --pretty=format:"%h|%ad|%s" --date=short
```

### 2단계 — 파싱 및 분류

각 줄을 `|` 기준으로 분리해 `해시`, `날짜`, `메시지`를 추출한다.

메시지의 prefix를 보고 아래 규칙으로 카테고리를 결정한다:

| prefix (대소문자 무관) | 카테고리 헤더 |
|----------------------|--------------|
| feat | ✨ 새 기능 |
| fix | 🐛 버그 수정 |
| docs | 📝 문서 |
| style | 💄 스타일 |
| refactor | ♻️ 리팩터링 |
| chore | 🔧 기타 작업 |
| 그 외 / prefix 없음 | 📌 기타 |

prefix 판별: 메시지가 `feat:`, `feat(...):`  형태로 시작하는지 확인한다.

### 3단계 — 날짜별 그룹핑 후 마크다운 생성

날짜 내림차순(최신 날짜가 위)으로 정렬한다.
같은 날짜 안에서는 카테고리 순서대로 정렬한다: ✨ → 🐛 → 📝 → 💄 → ♻️ → 🔧 → 📌

출력 형식:
```
# Changelog

## YYYY-MM-DD

### ✨ 새 기능
- 커밋 메시지 (`해시`)

### 🐛 버그 수정
- 커밋 메시지 (`해시`)
```

### 4단계 — 이중 출력

1. 생성된 전체 changelog 텍스트를 `c:\claude\CHANGELOG.md`에 **덮어쓰기**로 저장한다 (Write 도구 사용).
2. 동일한 내용을 채팅 응답에 마크다운으로 출력한다.

### 5단계 — 커밋 및 푸시

```powershell
$env:PATH = $env:PATH + ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
cd c:\claude
git add CHANGELOG.md
git commit -m "docs: CHANGELOG.md 자동 생성"
git push origin main
```

## 엣지 케이스

- git 히스토리가 없으면: "커밋 기록이 없습니다." 안내 후 종료
- prefix 없는 커밋은 `📌 기타`로 분류
- 같은 날짜·같은 카테고리 커밋은 시간순(오래된 순)으로 나열
