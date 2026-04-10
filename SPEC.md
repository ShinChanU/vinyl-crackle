# Spec: Vinyl Crackle — Chrome Extension

## Objective

모든 웹사이트에서 재생되는 오디오에 실시간으로 LP 바이닐 크래클(서피스 노이즈)을 오버레이하는 크롬 확장 프로그램.

**유저 시나리오:** 유튜브, 스포티파이 웹, SoundCloud, 또는 어떤 웹사이트에서든 음악을 들을 때, 확장 프로그램을 켜면 마치 LP 턴테이블에서 듣는 것처럼 아날로그 감성의 크래클 노이즈가 입혀진다.

**핵심 기능:**
- ON/OFF 토글
- 크래클 강도(intensity) 슬라이더
- 프리셋 선택 (Light Dust, Warm Vinyl, Worn Record, Antique)
- 모든 웹사이트에서 동작

## Tech Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Language:** TypeScript (strict mode)
- **Build:** esbuild (번들링 + TS → JS 변환)
- **Audio:** Web Audio API + AudioWorklet
- **UI:** HTML + CSS (팝업)
- **Storage:** chrome.storage.sync (설정 동기화)
- **향후 확장:** AudioWorklet DSP 부분만 Rust → WASM으로 교체 가능

## Commands

```
Install:  pnpm install
Dev:      pnpm dev           (esbuild watch mode → dist/ 출력)
Build:    pnpm build         (프로덕션 빌드 → dist/)
Typecheck:pnpm typecheck     (tsc --noEmit)
Load:     chrome://extensions → 개발자 모드 → dist/ 폴더를 "압축해제된 확장 프로그램 로드"
Package:  pnpm package       (dist/ → vinyl-crackle.zip)
```

## Project Structure

설계 원칙:
- **Entry-point-first**: 각 폴더가 esbuild의 별도 번들 출력과 1:1 대응
- **Shared kernel**: 타입/상수/유틸은 shared/에 모으고, 빌드 시 각 번들에 인라인
- **AudioWorklet 격리**: crackle-processor는 독립 파일 (URL로 로드되는 특수 컨텍스트)

```
vinyl-crackle/
├── src/
│   ├── content/               → [번들 1] Content Script (웹페이지 안에서 실행)
│   │   └── index.ts           →   미디어 요소 감지 & 오디오 파이프라인 연결
│   ├── background/            → [번들 2] Service Worker (백그라운드)
│   │   └── index.ts           →   확장 프로그램 상태 관리, 메시지 라우팅
│   ├── popup/                 → [번들 3] Popup UI (팝업 클릭 시)
│   │   ├── index.html
│   │   ├── index.css
│   │   └── index.ts           →   설정 UI 로직
│   ├── audio/                 → [번들 4] AudioWorklet (오디오 스레드)
│   │   └── crackle-processor.ts →  크래클 노이즈 생성 DSP
│   └── shared/                → 공유 코드 (번들에 인라인됨, 독립 실행 안 됨)
│       ├── types.ts           →   CrackleParams, PresetName, Settings 등
│       ├── presets.ts         →   프리셋 상수 정의
│       ├── storage.ts         →   chrome.storage.sync 래퍼
│       └── constants.ts       →   메시지 키, 기본값 등
├── public/                    → 빌드 시 dist/에 그대로 복사
│   ├── manifest.json
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── dist/                      → 빌드 출력 (git 무시)
├── esbuild.config.mjs
├── tsconfig.json
├── package.json
├── .gitignore
├── SPEC.md
├── PLAN.md
└── devlog/                    → 개발 과정 기록 (문제/고민/해결 → 블로그 원재료)
    ├── README.md              →   구조 설명 + 엔트리 포맷
    ├── 00-kickoff.md          →   아이디어 출발, 기술 선택 이유
    ├── 01-foundation.md       →   프로젝트 셋업 이슈
    ├── 02-core-audio.md       →   AudioWorklet, 오디오 가로채기 (핵심)
    ├── 03-extension-wiring.md →   메시지 통신
    ├── 04-popup-ui.md         →   UI 구현
    └── 05-polish.md           →   엣지케이스, 마무리
```

### 빌드 출력 (dist/)

```
dist/
├── manifest.json              → public/에서 복사
├── icons/                     → public/에서 복사
├── content.js                 → src/content/ 번들
├── service-worker.js          → src/background/ 번들
├── popup/
│   ├── index.html             → src/popup/에서 복사
│   ├── index.css              → src/popup/에서 복사
│   └── index.js               → src/popup/ 번들
└── crackle-processor.js       → src/audio/ 번들 (AudioWorklet용)
```

## 기술 아키텍처

### 오디오 처리 파이프라인

```
웹페이지의 <audio>/<video> 요소
         │
         ▼
  MediaElementSource
         │
         ▼
  AudioWorklet (CrackleProcessor)
  ┌─────────────────────────┐
  │ 원본 오디오              │
  │    +                    │
  │ 프로시저럴 크래클 생성    │
  │  - Surface noise        │
  │  - Clicks & pops        │
  │  - Dust particles       │
  │    =                    │
  │ 합성된 출력              │
  └─────────────────────────┘
         │
         ▼
     GainNode (마스터 볼륨)
         │
         ▼
   AudioContext.destination (스피커)
```

### 크래클 노이즈 생성 알고리즘

**Surface Noise (연속적 잡음):**
- 화이트 노이즈 생성 → 밴드패스 필터 (200Hz~3kHz) → 볼륨 조절
- LP의 배경 "쉬~" 소리를 시뮬레이션

**Clicks & Pops (단발성 소리):**
- 푸아송 분포 기반 랜덤 타이밍으로 임펄스 생성
- 각 임펄스의 진폭과 지속 시간을 랜덤으로 변조
- "톡", "탁" 하는 클릭 소리

**Dust Particles (먼지 긁힘):**
- 짧은 노이즈 버스트 (1~5ms) + 엔벨로프
- LP 표면 먼지가 바늘에 닿을 때의 "치직" 소리

### 미디어 요소 감지

Content script에서:
1. 페이지 로드 시 모든 `<audio>`, `<video>` 요소 탐색
2. `MutationObserver`로 동적으로 추가되는 미디어 요소 감지
3. 각 미디어 요소에 AudioContext + CrackleProcessor 연결
4. Shadow DOM 내부의 미디어 요소도 탐색

## 프리셋 정의

| 프리셋 | Surface Noise | Clicks/Pops 빈도 | Dust | 설명 |
|--------|--------------|------------------|------|------|
| Light Dust | 0.15 | 낮음 (2~4/sec) | 0.1 | 거의 새 LP, 미세한 질감만 |
| Warm Vinyl | 0.3 | 중간 (5~8/sec) | 0.2 | 잘 관리된 빈티지 LP |
| Worn Record | 0.5 | 높음 (10~15/sec) | 0.4 | 많이 들은 LP |
| Antique | 0.8 | 매우 높음 (20~30/sec) | 0.7 | 아주 오래된 레코드 |

각 프리셋은 3개 파라미터의 조합이며, Custom 모드에서 개별 조절 가능.

## UI 디자인 (팝업)

```
┌─────────────────────────────┐
│  🎵 Vinyl Crackle      [ON] │  ← 토글 스위치
│                             │
│  ── Preset ──────────────── │
│  [Light Dust] [Warm Vinyl]  │  ← 프리셋 버튼
│  [Worn Record] [Antique]    │
│                             │
│  ── Fine Tune ───────────── │
│  Surface  ●────────────  30%│  ← 슬라이더
│  Pops     ●──────────── 5/s │  
│  Dust     ●────────────  20%│  
│                             │
│  ── Master ──────────────── │
│  Intensity ●──────────  50% │  ← 전체 강도
│                             │
└─────────────────────────────┘
```

## Code Style

- TypeScript strict mode (`strict: true`)
- 세미콜론 사용
- 2 space indent
- camelCase for variables/functions, PascalCase for types/interfaces/classes
- `const` 기본, 변경 필요시에만 `let`
- 명시적 타입 선언, `any` 금지

```typescript
interface CrackleParams {
  surface: number;
  popsPerSec: number;
  dust: number;
}

type PresetName = 'lightDust' | 'warmVinyl' | 'wornRecord' | 'antique';

const DEFAULT_PRESETS: Record<PresetName, CrackleParams> = {
  lightDust: { surface: 0.15, popsPerSec: 3, dust: 0.1 },
  warmVinyl: { surface: 0.3, popsPerSec: 6, dust: 0.2 },
  wornRecord: { surface: 0.5, popsPerSec: 12, dust: 0.4 },
  antique: { surface: 0.8, popsPerSec: 25, dust: 0.7 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

## Testing Strategy

- 자동 테스트 없음 (MVP 단계 — AudioWorklet, Content Script, chrome.* API 모두 브라우저 컨텍스트 필요)
- 수동 테스트 체크리스트로 품질 확보:
  1. 유튜브에서 동영상 재생 시 크래클 오버레이 확인
  2. 스포티파이 웹에서 음악 재생 시 동작 확인
  3. ON/OFF 토글 시 즉시 반영 확인
  4. 프리셋 변경 시 소리 차이 확인
  5. 슬라이더 조절 시 실시간 반영 확인
  6. 탭 이동 후 돌아왔을 때 상태 유지 확인
  7. 브라우저 재시작 후 설정 복원 확인
- 향후 확장 시: shared/ 유틸에 vitest 도입 고려

## Boundaries

**Always:**
- 원본 오디오 품질을 훼손하지 않는다 (크래클은 오버레이, 원본을 변형하지 않음)
- 사용자가 OFF 하면 즉시 오디오 처리 중단
- 설정은 chrome.storage.sync에 저장하여 디바이스 간 동기화

**Ask first:**
- 새로운 퍼미션 추가
- 외부 라이브러리 도입

**Never:**
- 사용자 오디오 데이터를 외부로 전송
- 웹페이지의 원본 오디오를 영구적으로 변경
- 불필요한 퍼미션 요청

## Success Criteria

- [ ] 크롬 확장 프로그램으로 설치 가능
- [ ] 유튜브에서 영상 재생 시 크래클 노이즈가 들린다
- [ ] ON/OFF 토글이 즉시 반영된다
- [ ] 4개 프리셋이 각각 다른 소리를 낸다
- [ ] 슬라이더로 세밀한 조절이 가능하다
- [ ] 설정이 저장되어 브라우저 재시작 후에도 유지된다
- [ ] 어떤 웹사이트에서든 `<audio>`/`<video>` 요소의 소리에 적용된다
- [ ] 크래클 OFF 시 원본 오디오 품질이 완벽하게 복원된다

## Open Questions

- [ ] 이름 최종 결정 (Crackle / VinylFi / Dusty / Needle Drop / Patina)
- [ ] 아이콘 디자인 (간단한 SVG로 시작할지, 이미지로 할지)
