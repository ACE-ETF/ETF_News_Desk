# ETF 뉴스 데스크

국내 ETF 뉴스를 수집하고 주요 이슈·간단 요약·원문 링크로 확인하는 모바일 대응 뉴스 데스크입니다.

현재 운영 사이트: https://etf-news-desk-insik.openfawn16384.chatgpt.site/

## 현재 연결 상태

- 이 저장소는 2026-10-29 운영 버전의 소스 스냅샷입니다.
- 운영 호스팅과 한국 영업일 오전 8시 수집은 기존 Sites 환경에서 계속 실행됩니다.
- `main` 변경 시 GitHub Actions가 Pages 화면을 빌드하고 배포합니다. 최초 1회 저장소 Settings → Pages → Source를 GitHub Actions로 설정해야 합니다.
- 수집 기사, 요약 데이터, 운영 인증키, 호스팅 식별자와 로컬 실행 기록은 포함하지 않습니다.
- GitHub Pages는 뉴스 화면을 제공하고, 기존 Sites API와 R2가 수집·저장을 담당합니다. API 데이터는 페이지를 열거나 새로고침할 때 읽으므로 매일 재배포할 필요가 없습니다.

## 주요 기능

- 중요도·다양성을 고려한 핵심 이슈 최대 10건, 관련 기사 묶기
- 상품·수급·제도·운용 위험·배당 및 분배 이슈 분류
- 키워드 탐색, 기사 번호, 요약, 새 탭 원문 열기, 브라우저 북마크
- 영업일 오전 8시 기준 직전 영업일 오전 8시부터 수집
- 주말·공휴일·연휴 기사 다음 영업일 합산
- 직접 확인한 이미지에만 노출 허용 (`lib/verified-images.ts`)
- 공유용 기본 이미지와 Open Graph 메타데이터

## 개발 환경

Node.js 22.13 이상과 `package.json`의 `packageManager`에 지정된 pnpm을 사용합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

```bash
pnpm exec tsc --noEmit
node tests/collector.mjs
node tests/brief.mjs
pnpm build
```

로컬 화면에는 운영 데이터가 자동 복사되지 않습니다. 로컬 R2에 뉴스 데이터가 없다면 빈 목록이 표시됩니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx`, `app/globals.css` | 뉴스 목록과 모바일 UI |
| `lib/news.ts` | RSS 수집, 기간 계산, R2 읽기·저장 |
| `lib/ranking.ts`, `lib/brief.ts` | 중요도와 이슈 묶기 |
| `lib/classify.ts`, `lib/holidays.ts` | 분류와 한국 영업일 |
| `lib/verified-images.ts` | 기사 ID·제목에 대응하는 검증 이미지 목록 |
| `app/api/collect/route.ts` | 인증된 수집 실행 |
| `app/api/summaries/route.ts` | 인증된 요약 저장 |
| `public/social/` | 공유 기본 이미지 |

## 운영 설정

- `BUCKET`: R2 저장소 바인딩
- `COLLECTOR_KEY`: 수집·요약 쓰기 API 인증키. 호스팅의 비밀 설정으로만 주입합니다.
- 수집 요청은 `POST /api/collect`와 `X-Collector-Key` 헤더를 사용합니다.
- 외부 스케줄러에서 한국 영업일 오전 8시에 호출하는 구조입니다. 이 저장소 자체에는 예약 실행 설정이 없습니다.
- Sites 이외의 호스팅으로 이전할 경우 Workers/R2 바인딩, 비밀 설정, 예약 실행, 기존 데이터 이전과 공유 이미지 URL 설정이 별도로 필요합니다.

## 이미지 검증

대표 이미지 메타데이터만으로 상품 일치를 판단하지 않습니다. 기사 제목·본문의 상품, 사진 속 상품명·설명·금액을 확인한 뒤 해당 기사 ID와 제목에만 이미지를 연결합니다. 확인되지 않은 이미지는 노출하지 않습니다.

## GitHub Pages 자동 배포

- 화면 주소(첫 배포 완료 후): https://ace-etf.github.io/ETF_News_Desk/
- 첫 설정: 저장소 Settings → Pages → Build and deployment → Source → GitHub Actions
- 배포 파일: `.github/workflows/pages.yml`
- 프런트엔드 전용 빌드: `npm install --prefix pages` 후 `npm run build --prefix pages`
- `pages/main.tsx`가 운영 앱의 `app/page.tsx`와 CSS를 그대로 사용합니다.
- Pages 화면은 공개 읽기 API만 사용합니다. 인증키는 프런트엔드와 Actions에 저장하지 않습니다.
- 서버 수집/분류/저장 코드 변경은 기존 Sites 서버 배포가 별도로 필요합니다. Pages 자동 배포 대상은 화면입니다.
- 저장소 Settings에서 Pages를 활성화하기 전에는 Actions의 Configure Pages 단계가 실패할 수 있습니다. 설정 후 Actions에서 재실행하세요.

## 국내·해외 구분

상장 시장 기준으로 국내·해외·공통/미분류를 선택합니다. 국내 상장 해외투자 ETF는 국내에 포함합니다. 제목과 검증된 요약에서 상품/시장 단서를 사용하며, 상장 시장을 확인할 수 없는 기사는 국내 또는 해외로 임의 배정하지 않습니다. 기본 화면은 국내입니다. 해외 화면은 한국어 기사와 별도 영어 뉴스 검색 피드(미국 상장 ETF·운용사·신상품·수급·제도)를 함께 추적합니다. 전 세계 모든 매체를 빠짐없이 수집하는 범위는 아닙니다. 한국 영업일 오전 8시 수집 주기는 두 시장에 동일하게 적용됩니다.

해외 영어 기사의 원제목은 유지합니다. 한국어 문구는 실제 본문을 확인한 '한국어 요약'과 원제목만 옮긴 '제목 번역'을 구분해 저장합니다(`summaryKind`). 자동 번역의 오역·누락 가능성을 화면에서 안내합니다. 번역되지 않은 전체 목록 기사에는 대기 상태를 표시하며, 매일 핵심 해외 이슈 최대 10건을 우선 번역합니다.
