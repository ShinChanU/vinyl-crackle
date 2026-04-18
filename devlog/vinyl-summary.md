# Vinyl Crackle — 개발 전체 요약

## 아이디어

LP 턴테이블로 노래를 들으면 나는 "지지직" 소리 — 이걸 **crackle** 또는 **surface noise**라고 부른다. 유튜브, 스포티파이 같은 스트리밍 서비스로 음악을 들을 때 이 크래클이 자동으로 입혀지면 어떨까? 에서 출발.

## 플랫폼 선택

스트리밍 서비스에 바이닐 모드를 오버레이하려면 유저 환경마다 진입점이 다르다:

| 환경 | 진입점 | 난이도 |
|------|--------|--------|
| PC 브라우저 | 크롬 확장 프로그램 | 낮음 |
| PC 데스크톱 앱 | 가상 오디오 드라이버 | 높음 |
| Android | AudioPlaybackCapture API | 중간 |
| iOS | 불가능 (자체 플레이어만) | 매우 높음 |

**결정: 크롬 확장 프로그램**부터 시작. 만들기 가장 쉽고, 검증이 가장 빠르다.

## 개발 워크플로우

프로젝트 스킬(spec-driven-development, planning-and-task-breakdown, incremental-implementation)을 따라 4단계 게이트 워크플로우 진행:

```
SPECIFY → PLAN → TASKS → IMPLEMENT
```

### Phase 1: Specify

스펙 문서(`SPEC.md`) 작성:
- **대상**: 모든 웹사이트의 `<audio>` / `<video>` 요소
- **크래클 구성**: Surface Noise + Clicks & Pops + Dust Particles
- **프리셋**: Light Dust / Warm Vinyl / Worn Record / Antique
- **UI**: 팝업에서 토글 + 프리셋 + 슬라이더
- **Tech Stack**: TypeScript + esbuild + Manifest V3 + pnpm

주요 결정:
- Vanilla JS → **TypeScript** (타입 안전성, 향후 Rust WASM 확장 가능)
- npm → **pnpm** (빠르고 디스크 효율적)
- 테스트: 자동 테스트 없음 (MVP 단계, AudioWorklet/Content Script는 브라우저 컨텍스트 필수)

### Phase 2: Plan

구현 계획서(`PLAN.md`) 작성. **Risk-first 전략** 채택:

| Phase | 내용 | 핵심 검증 |
|-------|------|-----------|
| 1. Foundation | pnpm + esbuild + 타입/프리셋 | 빌드가 돈다 |
| 2. Core Audio | AudioWorklet + Content Script | 크래클이 들린다 |
| 3. Wiring | Service Worker + Storage | ON/OFF 동작 |
| 4. UI | Popup + 연동 | 실시간 반영 |
| 5. Polish | 엣지케이스 + 아이콘 | 안정적 동작 |

### Phase 3-4: Tasks & Implement

총 10개 Task를 순서대로 구현.

**폴더 구조 설계 원칙 3가지:**
1. **Entry-point-first** — 각 폴더가 esbuild 번들과 1:1 대응
2. **Shared kernel** — 타입/상수/유틸은 shared/에 모아 빌드 시 인라인
3. **AudioWorklet 격리** — crackle-processor는 독립 파일

## 핵심 기술적 문제와 해결

### 문제 1: YouTube CSP가 AudioWorklet을 차단

**원래 계획**: Content Script에서 `createMediaElementSource`로 미디어 오디오를 가로채고, AudioWorklet으로 크래클을 합성.

**현실**: YouTube의 CSP(Content Security Policy)가 AudioWorklet 모듈 로딩을 차단.
- `chrome-extension://` URL → 차단
- `blob:` URL → 차단
- `data:` URL → 차단

**해결**: 접근 방식 근본 전환.

```
Before: 미디어 오디오를 가로채서 크래클 합성
After:  크래클을 별도 오디오 소스로 재생 (오버레이)
```

- AudioWorklet → **ScriptProcessorNode** (모듈 로딩 불필요, CSP 무관)
- `createMediaElementSource` → **미디어 재생 상태만 감시**
- 원본 오디오를 건드리지 않고, 크래클을 "위에 겹침"

**교훈**: 크롬 확장에서 "사이트의 오디오를 직접 가공"하는 것은 CSP 때문에 대부분의 사이트에서 불가능. 오버레이 방식이 훨씬 범용적이고, 사용자 경험 차이는 거의 없다.

### 문제 2: chrome.storage.sync 쓰기 제한

**현상**: 슬라이더 드래그 시 `MAX_WRITE_OPERATIONS_PER_MINUTE quota` 에러.

**원인**: 슬라이더 `input` 이벤트마다 `chrome.storage.sync`에 저장. Chrome은 분당 120회 제한.

**해결**: Service Worker에서 `debouncedSave` (1초 디바운스) 적용. 메시지 브로드캐스트는 즉시, 스토리지 쓰기만 지연.

### 문제 3: AudioWorklet 타입 선언

**현상**: TypeScript에 `AudioWorkletProcessor`, `registerProcessor`, `sampleRate` 타입이 없음.

**해결**: `src/audio/audio-worklet.d.ts`에 직접 타입 선언 작성.

### 문제 4: pnpm v10 빌드 스크립트 차단

**현상**: esbuild의 post-install 스크립트가 pnpm v10 보안 정책에 의해 차단.

**해결**: `package.json`에 `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` 추가.

## 크래클 DSP 알고리즘

세 가지 노이즈를 샘플 단위로 합성:

1. **Surface Noise**: 화이트 노이즈 → 2nd-order IIR 밴드패스 필터 (center ~1.5kHz, Q=0.7). 바늘이 홈을 따라갈 때의 연속 hiss.

2. **Clicks & Pops**: 샘플당 푸아송 확률 (`probability = rate / sampleRate`). 랜덤 진폭(0.1~0.35) + 랜덤 극성. 먼지/흠집에 의한 단발성 소리.

3. **Dust Particles**: 랜덤 시작, 1~5ms 노이즈 버스트 + 선형 감쇠 엔벨로프. 먼지 입자가 바늘에 닿을 때의 짧은 치직.

## 오픈소스 공개

- **GitHub**: https://github.com/ShinChanU/vinyl-crackle
- **라이선스**: MIT
- 불필요한 `console.log` 전부 제거
- `node_modules/`, `dist/`, `*.zip` gitignore 처리
- 영문 README (설치법, 아키텍처, DSP 설명)
- PRIVACY.md (데이터 수집 없음)
- devlog/ (블로그 원재료)

## 크롬 웹스토어 등록

1. **개발자 등록**: $5 일회성 결제
2. **2단계 인증**: Google 계정에 2FA 필수 (없으면 업로드 차단)
3. **ZIP 패키징**: `pnpm build && pnpm package`
4. **스토어 리스팅**: 영문/한글 상세설명, 스크린샷, 카테고리(Entertainment)
5. **개인정보 보호**: 전용 목적 설명, 각 퍼미션 사용 근거, 데이터 수집 없음 체크
6. **제출**: 광범위 호스트 권한(`<all_urls>`)으로 인한 상세 검토 경고 → 정당한 사용이므로 그대로 제출

검토 대기 중. 승인까지 수 시간 ~ 며칠 소요 예상.

## 프로젝트 구조 (최종)

```
vinyl-crackle/
├── src/
│   ├── content/index.ts        → 미디어 감지 + ScriptProcessor 크래클 오버레이
│   ├── background/index.ts     → 메시지 라우팅 + debounced storage
│   ├── popup/                  → 토글 + 프리셋 + 슬라이더 UI
│   ├── audio/                  → AudioWorklet (실험적, CSP로 미사용)
│   └── shared/                 → 타입, 프리셋, 상수, storage 래퍼
├── public/
│   ├── manifest.json           → MV3 매니페스트
│   └── icons/                  → LP 레코드 아이콘 (16/48/128px)
├── devlog/                     → 개발 과정 기록 (블로그 원재료)
├── SPEC.md                     → 스펙 문서
├── PLAN.md                     → 구현 계획서
├── PRIVACY.md                  → 프라이버시 정책
├── LICENSE                     → MIT
└── README.md                   → 오픈소스 README
```

## 향후 가능성

- AudioWorklet DSP 부분을 **Rust → WASM**으로 교체 (성능 극대화)
- **Android 앱** (AudioPlaybackCapture API)
- **데스크톱 앱** (시스템 오디오 라우팅)
- 크래클 외에 **와우/플러터**, **테이프 히스** 등 추가 아날로그 이펙트
- 크롬 웹스토어 반응 보고 **제품 방향 결정**
