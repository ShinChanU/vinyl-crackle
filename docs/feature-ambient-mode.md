# Feature Spec: Ambient Mode (Standalone Crackle)

> 미디어 재생 여부와 무관하게, 바이닐 크래클 소리만 단독으로 재생할 수 있는 모드를 추가한다.
> 배경 소음(ASMR·집중·수면 보조)으로서의 쓰임새를 확보하는 것이 목표.

---

## 1. Problem

현재 Vinyl Crackle은 `<audio>` / `<video>` 요소가 **실제로 재생 중일 때만** 크래클이 오버레이된다.
즉, 크래클은 "음악의 양념" 역할만 가능하며, 아래 니즈를 충족시키지 못한다.

- 유튜브/스포티파이를 틀지 않고도 "**LP 방 분위기**"만 갖고 싶은 순간
- 공부/작업 중 백색소음처럼 **크래클만** 틀어두고 싶은 순간
- 수면 전 **은은한 바이닐 노이즈**만 틀고 싶은 순간

결과적으로 "미디어가 있어야만 쓸모 있는 확장"에 머물러 있어, 설치 후 일상적 사용 빈도가 떨어진다.

## 2. Goal

- **미디어 없이도** 크래클을 재생할 수 있는 **Ambient Mode**를 도입한다.
- Overlay Mode(기존)와 Ambient Mode(신규)를 **명시적 모드 스위치**로 전환한다.
- 사용자가 미디어를 재생하면 자연스럽게 **Overlay가 우선**되도록 한다.
- 팝업을 닫아도 **백그라운드에서 계속 재생**된다.

## 3. Non-Goals (MVP)

- 자동 종료 타이머(슬립 모드): MVP 제외, 수동 OFF만.
- Ambient 전용 볼륨 슬라이더 분리: **Master Intensity 공유**로 통일.
- Ambient용 별도 프리셋/사운드 뱅크: 기존 4개 프리셋 그대로 사용.
- 모바일/다른 플랫폼 지원.

---

## 4. User Stories

1. *"작업할 때 크래클만 틀어두고 싶다"*
   → 팝업 열기 → 모드 스위치를 **Ambient**로 → 크래클이 즉시 재생됨.
2. *"Ambient 틀어둔 채로 유튜브 영상을 보면 어떻게 되지?"*
   → 영상 재생 시작 → Ambient 자동 중지 → 영상에 오버레이 → 영상 일시정지 시 Ambient 자동 재개 (같은 모드 유지).
3. *"팝업 닫아도 계속 나오길 원한다"*
   → 팝업 X → 백그라운드 Offscreen Document에서 계속 재생.
4. *"그만 듣고 싶다"*
   → 모드 스위치를 **Off** 혹은 **Overlay**로 → 즉시 정지.

---

## 5. UX / UI

### 5.1 모드 스위치

팝업 상단에 **3-state 세그먼티드 컨트롤**을 둔다:

```
┌──────────────────────────────────────────┐
│  🎵 Vinyl Crackle                        │
│                                          │
│  ┌─────────┬──────────┬────────────┐     │
│  │  Off    │ Overlay  │  Ambient   │     │   ← 3-state 모드 선택
│  └─────────┴──────────┴────────────┘     │
│                                          │
│  ── Preset ────────────────────────      │
│  [Light Dust] [Warm Vinyl] …             │
│                                          │
│  ── Fine Tune / Master 그대로 ──         │
└──────────────────────────────────────────┘
```

- `Off`: 기존 OFF. 아무것도 재생하지 않음.
- `Overlay`: 기존 ON. 미디어 재생 시 오버레이.
- `Ambient`: 신규. 미디어 유무 무관하게 크래클 단독 재생 + 미디어 재생 시 자동으로 Overlay 동작.

> **왜 3-state인가?**
> ON/OFF + Ambient 토글 2개로 나누면 "ON+Ambient ON", "OFF+Ambient ON" 같은 모호한 상태가 생긴다.
> 서로 배타적인 3가지 모드로 단순화하는 편이 사용자에게도, 상태 관리에도 깔끔하다.

### 5.2 상태 전이

| 현재 | 사용자 액션 | 결과 |
|---|---|---|
| Off | Overlay 선택 | 미디어 재생 시 오버레이 대기 |
| Off | Ambient 선택 | 즉시 크래클 재생 (미디어 없어도) |
| Ambient | 미디어 재생 시작 | Ambient 자동 정지 → 해당 미디어에 오버레이 |
| Ambient | (오버레이 중) 미디어 정지/종료 | Ambient 자동 재개 |
| Ambient | Overlay 선택 | Ambient 정지, Overlay 대기 |
| Ambient | Off 선택 | 모두 정지 |

### 5.3 시각적 피드백

- Ambient 재생 중엔 아이콘에 **점(•) 배지** 또는 amber 링을 표시해 "울리고 있다"는 것을 드러낸다.
- 팝업 내에서는 모드 스위치의 선택된 칸이 amber(#c97d3a) 액센트로 강조.

---

## 6. 기술 설계

### 6.1 재생 주체: Offscreen Document

Service Worker는 오디오를 재생할 수 없고, Content Script는 탭이 닫히면 사라진다.
**전역(탭 무관) 재생**을 위해 Chrome의 **Offscreen Document API**를 사용한다.

```
┌──────────────┐   mode change    ┌──────────────────┐
│   Popup UI   │ ───────────────▶ │  Service Worker  │
└──────────────┘                  └──────────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼                             ▼
                 ┌──────────────────┐          ┌──────────────────┐
                 │ Offscreen Doc    │          │ Content Scripts  │
                 │ (Ambient 재생)   │          │ (Overlay 재생)    │
                 │ AudioContext     │          │ per tab           │
                 └──────────────────┘          └──────────────────┘
```

- **Offscreen Document**(`src/offscreen/`)는 `audio_playback` reason으로 생성.
- 동일한 크래클 DSP 코드(ScriptProcessor 기반)를 재사용 — `src/shared/crackle-engine.ts`로 추출.
- Service Worker는 Offscreen Document의 lifecycle(생성/파괴)을 관리.

### 6.2 모드 간 조정(Coexistence Rule)

> **원칙:** 한 순간에는 하나의 소스만 크래클을 낸다.

- Ambient 재생 중에 **어느 탭이든 미디어가 재생**되면:
  - Content Script가 `MEDIA_PLAY_STARTED` 메시지 Service Worker로 전송.
  - Service Worker가 Offscreen Document에 `PAUSE_AMBIENT` 지시.
  - 해당 탭의 Content Script는 평소처럼 오버레이 수행.
- **마지막 재생 중 미디어가 멈추면**:
  - 모든 탭의 Content Script가 상태를 주기적으로 보고(또는 stop 이벤트 시점).
  - Service Worker가 "재생 중 미디어 카운트 = 0"으로 판단하면 Offscreen Document에 `RESUME_AMBIENT`.

> **엣지 케이스 메모**
> - 여러 탭이 동시에 재생 중일 수도 있다 → 카운트 기반이면 안전.
> - 미디어가 아주 짧게 on/off를 반복하면 Ambient가 덜컥거릴 수 있다 → `RESUME_AMBIENT`에 **300ms debounce**.

### 6.3 상태 모델

```ts
type PlaybackMode = 'off' | 'overlay' | 'ambient';

interface Settings {
  mode: PlaybackMode;          // 기존 enabled: boolean 대체
  preset: PresetName;
  params: CrackleParams;
  masterIntensity: number;
}
```

- **마이그레이션:** 기존 `enabled: boolean` 값을 읽으면 `true → 'overlay'`, `false → 'off'`로 변환 후 새 키로 저장.
- `chrome.storage.sync`에 1회성 migration 헬퍼 추가.

### 6.4 메시지 프로토콜 (신규/변경)

| Message | From → To | Payload | 용도 |
|---|---|---|---|
| `SET_MODE` | Popup → SW | `{ mode }` | 모드 전환 |
| `ENSURE_OFFSCREEN` | SW internal | - | Offscreen Doc 생성 보장 |
| `AMBIENT_START` | SW → Offscreen | `{ params }` | Ambient 재생 시작 |
| `AMBIENT_STOP` | SW → Offscreen | - | Ambient 즉시 정지 |
| `AMBIENT_UPDATE_PARAMS` | SW → Offscreen | `{ params }` | 슬라이더 조정 시 실시간 반영 |
| `MEDIA_PLAY_STARTED` | CS → SW | `{ tabId }` | 오버레이가 시작됨 |
| `MEDIA_PLAY_ENDED` | CS → SW | `{ tabId }` | 오버레이가 끝남 |

### 6.5 디렉토리 변화

```
src/
├── content/                  (기존 유지)
├── background/
│   ├── index.ts              ← Offscreen 라이프사이클 + 미디어 카운트 관리 추가
│   └── offscreen-manager.ts  ← [신규] Offscreen Doc 생성/파괴 래퍼
├── offscreen/                ← [신규] Ambient 전용 페이지
│   ├── index.html
│   └── index.ts              ← crackle-engine 재사용
├── popup/                    (모드 스위치 UI로 토글 교체)
└── shared/
    ├── crackle-engine.ts     ← [리팩토링] content/index.ts에서 DSP 부분을 추출
    ├── types.ts              ← PlaybackMode, Settings 갱신
    ├── constants.ts          ← 신규 메시지 키
    └── storage.ts            ← enabled → mode 마이그레이션
```

### 6.6 Manifest 변경

```json
{
  "permissions": ["storage", "offscreen"],
  ...
}
```

`offscreen` 권한 추가. Chrome Web Store 리스팅의 "권한 사용 근거"도 함께 갱신 필요.

---

## 7. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|---|---|---|
| Offscreen Document가 자동으로 종료되는 시나리오 | Ambient가 끊김 | 재생 중일 땐 SW가 주기적으로 heartbeat(keepAlive) 메시지 전송, 필요 시 재생성 |
| 미디어 play/pause가 빠르게 토글될 때 Ambient 튐 | UX 저하 | `RESUME_AMBIENT`에 300ms debounce |
| 기존 사용자 설정(`enabled: true`) 호환성 | 업데이트 후 모드 초기화되는 듯 보임 | migration 시 `overlay`로 자동 매핑 + 릴리즈 노트 공지 |
| 오디오 자동재생 정책(autoplay policy) | Ambient 선택해도 소리 안 날 수 있음 | 팝업의 "Ambient 선택" 자체가 user gesture → Offscreen 생성 시 바로 resume() |
| 크롬 웹스토어 재심사 지연 | 배포 딜레이 | `offscreen` 권한 근거를 리스팅에 명확히 기재 |

---

## 8. Success Criteria

- [ ] 팝업에서 `Off / Overlay / Ambient` 3-state 스위치를 선택할 수 있다.
- [ ] Ambient 모드에서 어떤 탭에도 미디어가 없어도 크래클이 들린다.
- [ ] 팝업을 닫아도 Ambient가 계속 재생된다.
- [ ] Ambient 재생 중에 유튜브 영상을 재생하면 자동으로 오버레이로 전환되고, 영상이 멈추면 Ambient가 재개된다.
- [ ] 모드 전환은 500ms 이내에 반영된다.
- [ ] 슬라이더 조절이 Ambient 재생에도 실시간 반영된다.
- [ ] 기존 `enabled` 설정이 자동 마이그레이션되어 기능 유실이 없다.
- [ ] OFF 선택 시 Offscreen Document가 정리되어 리소스가 해제된다.

---

## 9. Rollout Plan

1. **Phase A — Refactor:** Content Script의 DSP 로직을 `shared/crackle-engine.ts`로 분리 (동작 동일).
2. **Phase B — Offscreen & Mode:** Offscreen Document + 새로운 `mode` 상태 모델 + 팝업 3-state UI.
3. **Phase C — Coexistence:** 미디어 이벤트 → Ambient pause/resume 조율 로직 + debounce.
4. **Phase D — Polish:** 아이콘 배지, 자동 마이그레이션, 수동 체크리스트 전수, 릴리즈 노트.
5. **Phase E — 스토어 제출:** `offscreen` 권한 근거 갱신 후 재심사 제출.

각 Phase 종료 시 devlog에 기록: `devlog/03-ambient-mode.md`.

---

## 10. Open Questions

- [ ] 모드 스위치 UI를 3-state 세그먼티드 vs 드롭다운 vs 토글+드롭다운 중 뭐가 가장 직관적일지 — 실제 팝업 폭(320px) 기준 프로토타입 필요.
- [ ] Ambient 재생 시 아이콘 배지에 숫자/점/링 중 어느 쪽이 바이닐 감성에 맞는지.
- [ ] "Overlay에서 미디어 없을 때 Ambient로 자동 재생" 옵션도 설정으로 넣을지 (Open vs Explicit Mode 철학 선택).
