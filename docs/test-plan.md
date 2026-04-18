# Vinyl Crackle — Test Plan

> 목표: Chrome 확장 프로그램의 품질을 "스토어 심사 통과 + 회귀 방지" 수준까지 끌어올린다.
> 단위 테스트(Vitest)로 순수 로직을 보호하고, Playwright E2E로 실제 확장 로드/재생 흐름을 검증한다.

---

## 1. 테스트 피라미드

```
            ┌────────────┐
            │  E2E (P1)  │   Playwright — 확장 로드, popup 조작, 재생 상태 스모크
            ├────────────┤
            │ Integration│   (미포함, MVP에선 생략)
            ├────────────┤
            │    Unit    │   Vitest — DSP, storage 마이그레이션, 프리셋 유효성
            └────────────┘
```

- **Unit**: 빠르고 결정적. CI/pre-commit에서 항상 통과해야 함.
- **E2E**: 느리지만 실사용 흐름 보장. 로컬/CI manual 또는 PR 단위 1회 실행.

---

## 2. 단위 테스트 (Vitest)

### 2.1 도구
- `vitest` — 테스트 러너 + assertion
- `@vitest/ui` — 선택적(개발 중 UI)
- `jsdom` — DOM/Chrome API 모킹 환경

### 2.2 스코프 (우선순위 순)

#### ① `src/shared/crackle-engine.ts` — **최우선 (DSP 순수 로직)**

`CrackleEngine.renderSample()`의 결정적 속성을 검증한다.

| 케이스 | 기대 동작 |
|---|---|
| `surface=0, popsPerSec=0, dust=0` 이고 masterIntensity=0 | 출력은 항상 0 |
| masterIntensity=0 | 파라미터 무관 출력은 0 |
| masterIntensity=1, surface=1 | 출력 샘플이 `[-1, 1]` 유한값, NaN/Infinity 없음 |
| 다수 샘플(1초치) 렌더 후 | 평균 절대값이 `> 0` (실제 노이즈 생성됨) |
| popsPerSec=40, 대용량 샘플 | 0이 아닌 임펄스가 최소 N회 등장 (Poisson 분포 검증) |
| dust burst 발생 시 | `dustBurstRemaining`이 감쇠하며 0까지 감소 |

**결정성 확보**: `Math.random`을 `vi.spyOn(Math, 'random').mockImplementation(seededRng)` 로 주입.

#### ② `src/shared/storage.ts` — **레거시 마이그레이션**

`chrome.storage.sync`를 모킹하고 다음 시나리오를 검증:

| 입력 | 기대 결과 |
|---|---|
| storage 비어있음 | `DEFAULT_SETTINGS` 반환 |
| 레거시 `{ enabled: true, ... }` | `mode === 'overlay'`로 마이그레이션 + 즉시 재저장 |
| 레거시 `{ enabled: false }` | `mode === 'off'` |
| 신규 `{ mode: 'ambient', ... }` | 그대로 반환 |
| 누락 필드 (예: preset 없음) | `DEFAULT_SETTINGS` 값으로 채움 |

#### ③ `src/shared/presets.ts` / `constants.ts` — **데이터 무결성**

| 케이스 | 기대 동작 |
|---|---|
| 모든 프리셋의 `surface` ∈ [0, 1] | OK |
| 모든 프리셋의 `dust` ∈ [0, 1] | OK |
| 모든 프리셋의 `popsPerSec` ∈ [0, 40] | OK |
| `PRESET_NAMES`에 모든 `PresetName` 포함 | 타입과 일치 |
| `DEFAULT_SETTINGS.params` = `PRESETS.warmVinyl` | 일치 |

### 2.3 환경 세팅

```ts
// tests/setup.ts
import { vi } from "vitest";

// chrome.storage.sync 전역 스텁
globalThis.chrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
} as never;
```

### 2.4 실행

```bash
pnpm test           # 1회 실행
pnpm test:watch     # 감시 모드
```

---

## 3. E2E 테스트 (Playwright)

### 3.1 도구
- `@playwright/test` — 테스트 러너
- Chromium with `--disable-extensions-except` / `--load-extension` 플래그

### 3.2 스코프 (MVP 스모크)

| # | 시나리오 | 검증 |
|---|---|---|
| E1 | 확장 로드 후 popup이 열린다 | Popup HTML이 렌더링되고 모드 버튼 3개(Off/Overlay/Ambient) 표시 |
| E2 | Ambient 모드 토글 | "Ambient" 버튼 클릭 → 상태 active 표시, `chrome.storage.sync` 업데이트 |
| E3 | Preset 변경 | 4개 프리셋 버튼 각각 클릭 시 슬라이더 값이 프리셋 값으로 갱신 |
| E4 | Intensity 슬라이더 | 드래그 시 값이 0~1 범위로 동기화, 과도한 write 없음(debounce 검증) |
| E5 | Overlay 모드 + 미디어 재생 | `<video>` 가 있는 간단한 테스트 페이지에서 play() 호출 시 크래클 오디오 컨텍스트가 running |
| E6 | 설정 persistence | 리로드 후에도 마지막 설정 유지 |

### 3.3 한계 / Non-goals

- **실제 YouTube/Spotify에서의 재생 검증**은 외부 서비스 의존성·인증 이슈로 자동화에서 제외. 수동 체크리스트로 관리.
- **오디오 파형 검증**(실제 "지지직" 소리가 들리는지) 자동화 생략. AudioContext running 상태만 확인.
- AudioWorklet/CSP 관련 회귀는 브라우저 버전마다 달라 자동화 어려움. 이슈 발생 시 수동 재현.

### 3.4 확장 로드 방식

```ts
// playwright.config.ts
const extensionPath = path.join(__dirname, "dist");
// BrowserContext with persistent context + load-extension flags
```

### 3.5 실행

```bash
pnpm build          # dist/ 준비
pnpm e2e            # Playwright 실행
pnpm e2e:ui         # Playwright UI 모드 (디버깅)
```

---

## 4. 수동 회귀 체크리스트

자동 테스트로 커버 못 하는 영역. 릴리스 전 수동으로 돌린다.

- [ ] YouTube 영상 재생 시 크래클 오버레이 정상
- [ ] Spotify Web 재생 시 크래클 오버레이 정상
- [ ] SoundCloud 재생 시 크래클 오버레이 정상
- [ ] Ambient 모드에서 탭 전환해도 재생 지속
- [ ] Ambient + 미디어 재생 시 Ambient 자동 중지, 미디어 종료 시 재개
- [ ] 팝업 닫았다 다시 열어도 상태/슬라이더 값 유지
- [ ] 다른 기기(동일 Google 계정)에서 설정 동기화 확인
- [ ] 노이즈 OFF 상태에서 CPU 사용량 ≈ 0
- [ ] 크래클 켠 상태에서 CPU 영향 1~2% 내외

---

## 5. CI 통합 (향후)

MVP 이후 단계:

```yaml
# .github/workflows/ci.yml (예시)
- pnpm install
- pnpm typecheck
- pnpm test           # Vitest
- pnpm build
- pnpm e2e            # Playwright (별도 job)
```

---

## 6. 측정 지표

| 지표 | 목표 |
|---|---|
| Unit test 커버리지 (shared/) | ≥ 80% |
| Unit test 실행 시간 | < 2s |
| E2E 스모크 통과율 | 100% (6/6) |
| Flaky test | 0건 (재현 안 되는 실패 용납 X) |

---

## 7. 안티패턴 주의

- ❌ `Math.random`을 mock 안 한 채로 DSP 출력을 숫자로 assert → flaky
- ❌ 실제 `AudioContext`를 jsdom에서 만들려 시도 → 지원 안 됨, skip 또는 E2E로
- ❌ 설정 저장 로직을 chrome.storage mock 없이 테스트 → 모든 테스트가 globalThis에 의존
- ❌ E2E에서 너무 많은 케이스 커버 → 스모크 한정, 상세 로직은 유닛으로
