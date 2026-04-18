# Session Summary: Vinyl Crackle 개발 전체 과정

## 타임라인

### 1. 아이디어 발견
- "LP 턴테이블의 지지직 소리(crackle/surface noise)를 스트리밍 서비스에서도 들을 수 있으면 좋겠다"
- 유튜브, 스포티파이, 사운드클라우드 등 모든 웹사이트 대상
- 플랫폼별 진입점 분석: 크롬 확장(쉬움) → Android(중간) → 데스크톱(어려움) → iOS(불가)
- **결정: 크롬 확장 프로그램부터 시작** (가장 빠르게 검증 가능)

### 2. 스펙 작성 (Phase 1: Specify)
- spec-driven-development 스킬 워크플로우 적용
- 핵심 기능: ON/OFF + 강도 조절 + 프리셋 4종 + 모든 웹사이트 동작
- 기술 선택 논의:
  - Vanilla JS → **TypeScript** (strict mode) 전환
  - npm → **pnpm** 전환
  - 빌드: **esbuild** (4개 독립 번들)
- 테스트: 자동 테스트 없음 (MVP, 수동 체크리스트)
- 이름 후보: Crackle / VinylFi / Dusty / Needle Drop / Patina
- 폴더 구조 설계 원칙: Entry-point-first + Shared kernel + AudioWorklet 격리

### 3. 구현 계획 (Phase 2: Plan)
- **Risk-first 전략**: 가장 불확실한 "오디오 가로채기"를 먼저 검증
- 5 Phase, 10 Task로 분할
- devlog/ 디렉토리 추가: 문제/고민/해결 과정을 블로그 원재료로 기록

### 4. 구현 (Phase 3-4: Tasks → Implement)

**Phase 1 - Foundation:**
- pnpm + TypeScript + esbuild 셋업
- Manifest V3 + 공유 타입/프리셋/상수 정의
- AudioWorklet 타입 선언 파일 직접 작성 (d.ts)
- pnpm v10의 `onlyBuiltDependencies` 이슈 해결

**Phase 2 - Core Audio (최고 리스크):**
- CrackleProcessor AudioWorklet 구현 (3개 노이즈 컴포넌트)
  - Surface Noise: 밴드패스 필터링된 화이트 노이즈
  - Clicks & Pops: 푸아송 분포 랜덤 임펄스
  - Dust Particles: 짧은 노이즈 버스트 + 엔벨로프
- Content Script: MutationObserver로 미디어 요소 감지

**Phase 3 - Extension Wiring:**
- Service Worker: 상태 관리 + 메시지 라우팅
- Storage 래퍼: chrome.storage.sync + debounce

**Phase 4 - Popup UI:**
- 다크 테마 + 바이닐 감성 (amber/copper 액센트 #c97d3a)
- 프리셋 4종 + 개별 슬라이더 3개 + 마스터 강도

### 5. 디버깅 — 가장 큰 전환점

**문제:** YouTube의 CSP가 AudioWorklet 모듈 로딩을 완전 차단
- `chrome-extension://` URL → CSP 차단
- `fetch → Blob → blob:` URL → CSP 차단
- `data:` URL → CSP 차단

**해결:** 근본적 접근 방식 전환
- AudioWorklet + createMediaElementSource (가로채기) → **ScriptProcessorNode + 오버레이**
- 미디어 오디오를 가공하지 않고, 크래클을 별도 오디오로 재생
- 미디어 play/pause 이벤트 감시 → 재생 중일 때만 크래클 출력
- CSP/CORS 제약 완전 우회

**추가 버그:** `MAX_WRITE_OPERATIONS_PER_MINUTE` quota 초과
- 원인: 슬라이더 드래그 시 매 input 이벤트마다 chrome.storage.sync 쓰기
- 해결: Service Worker에서 debounce (1초) 적용

### 6. 오픈소스 공개
- 불필요한 console.log 전부 제거
- README.md (영문, 설치/개발/아키텍처/DSP 설명)
- MIT LICENSE
- PRIVACY.md
- GitHub: https://github.com/ShinChanU/vinyl-crackle

### 7. 크롬 웹스토어 등록
- 개발자 등록 ($5 일회성)
- 2단계 인증(2FA) 필수 → Google 계정에서 활성화
- 스토어 리스팅: 상세 설명 (영문/한글), 카테고리, 스크린샷
- 개인정보 보호 관행: 전용 목적, 권한 사용 근거, 데이터 미수집 확인
- 광범위한 호스트 권한 경고 → 그대로 제출 (검토 지연 가능하나 거부 아님)
- **제출 완료** — 검토 대기 중

## 기술 스택 최종

| 항목 | 선택 |
|------|------|
| Language | TypeScript (strict) |
| Build | esbuild (4 entry points) |
| Package Manager | pnpm |
| Audio | Web Audio API — ScriptProcessorNode |
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.sync |
| UI | HTML + CSS (dark theme) |

## 핵심 교훈

1. **CSP는 크롬 확장의 최대 적이다** — AudioWorklet은 URL로 모듈을 로드해야 하는데, YouTube 등의 CSP가 모든 형태의 URL을 차단. "오디오 가로채기" 대신 "오디오 오버레이"가 범용적.

2. **Risk-first가 맞았다** — 가장 불확실한 오디오 처리를 먼저 검증했기에, 접근 방식 전환이 Phase 2에서 일어남. UI를 먼저 만들었으면 전부 버렸을 것.

3. **chrome.storage.sync에 쓰기 제한이 있다** — 분당 120회. 슬라이더처럼 빈번한 업데이트는 반드시 debounce.

4. **크롬 웹스토어 등록은 코드보다 서류가 더 많다** — 전용 목적, 권한 사유, 프라이버시 정책, 2FA, 이메일 인증 등.

## 파일 구조 최종

```
vinyl-crackle/
├── src/
│   ├── content/index.ts       → 크래클 DSP + 미디어 감지 (ScriptProcessor)
│   ├── background/index.ts    → 메시지 라우팅 + 설정 저장
│   ├── popup/                 → UI (HTML + CSS + TS)
│   ├── audio/                 → AudioWorklet (실험적, 미사용)
│   └── shared/                → 타입, 프리셋, 상수, 스토리지
├── public/                    → manifest.json + 아이콘
├── devlog/                    → 개발 과정 기록 (블로그 원재료)
├── SPEC.md                    → 스펙 문서
├── PLAN.md                    → 구현 계획
├── PRIVACY.md                 → 프라이버시 정책
├── README.md                  → 오픈소스 README
└── LICENSE                    → MIT
```
