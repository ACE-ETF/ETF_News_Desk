# 무료 뉴스데스크 실행기

기존 사이트와 R2 데이터를 유지하고 실행만 GitHub의 표준 Ubuntu runner에서 수행합니다.
공개 저장소의 표준 GitHub-hosted runner는 무료입니다. 별도 유료 AI API를 호출하지 않습니다.

## 최초 설정
1. 이 저장소 Settings → Secrets and variables → Actions → New repository secret.
2. 이름: SITE_COLLECTOR_KEY. 값: 기존 Sites 서버의 COLLECTOR_KEY.
3. 값은 채팅·커밋·워크플로 입력란에 붙여넣지 않습니다.
4. Actions → ETF News Free Runner → Run workflow → stored-release 실행.
5. 실제 공개 성공 및 공개 GET의 구간·건수를 확인한 후 기존 ChatGPT 수집/공개 예약을 중지합니다.

기존 비밀키는 Sites 조회 API에서 반환되지 않으며 이 연결은 GitHub Secrets 등록을 지원하지 않습니다.
키를 모르면 임의로 인증을 해제하지 말고 원래 설정한 키를 확인해야 합니다.
Sites 환경변수를 변경하려면 해당 환경변수 revision을 적용하는 배포도 필요하므로 GitHub에 다른 키만 넣어서는 작동하지 않습니다.

## 시간
- 수집: 매일 한국시간 01:10·07:10·13:10·19:10.
- 공개: 평일 07:40 이후, 한국 공휴일은 서버 기준으로 제한합니다.
- GitHub 예약은 지연될 수 있어 07:40 정각 공개를 보장하지 않습니다.
- 수동 stored-release는 저장 기사만 준비하고 공개합니다. RSS 회차를 다시 실행하지 않습니다.
- 같은 회차의 중복 차단과 요청량 제한은 기존 서버·collector.py가 담당합니다.

## 무료 처리의 범위와 검증
- 국내: 원문에서 짧은 완결 문장을 확인할 수 있는 상위 최대 5건만 '본문 발췌:'로 저장합니다.
  직접 확인할 수 없는 본문, Google RSS 중간 화면, 과도하게 긴 문장은 제목 기반 표시를 유지합니다.
- 해외: 무료 Argos en→ko 모델을 runner에서 실행합니다.
  숫자·퍼센트·대문자 티커가 달라진 번역은 저장하지 않고 미번역 건수로 보고합니다.
- 브리핑: 서버가 압축·선정한 대표 기사와 기존 검증 문구로 규칙 기반 문안을 구성합니다.
  별도의 투자판단이나 AI 해석을 생성하지 않습니다.
- 데이터가 0건이면 기존 공개본을 유지합니다.
- 미래/지난 영업일 구간은 공개하지 않습니다. 인증 403은 중단하며 접근 정책을 바꾸지 않습니다.
- 실행 로그의 published=true, window, count 및 untranslated를 확인합니다.
  번역·본문 확인 실패를 성공으로 표시하지 않습니다.

워크플로: .github/workflows/news-free.yml
실행기: scripts/free-news-runner.py
