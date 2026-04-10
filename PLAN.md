# Implementation Plan: Vinyl Crackle Chrome Extension

## Overview

모든 웹사이트에서 재생되는 오디오에 LP 크래클을 실시간 오버레이하는 크롬 확장 프로그램.
Risk-first 전략: 가장 불확실한 "오디오 가로채기 + 실시간 크래클 합성"을 먼저 검증한 뒤 UI와 설정을 쌓아 올린다.

## Architecture Decisions

- **Content Script 방식 채택**: chrome.tabCapture 대신 content script에서 직접 MediaElement를 잡아 Web Audio API로 연결. 모든 사이트에서 작동하고 퍼미션이 가벼움.
- **AudioWorklet 사용**: ScriptProcessorNode(deprecated) 대신 AudioWorklet. 별도 오디오 스레드에서 돌아서 메인 스레드 블로킹 없음.
- **프로시저럴 노이즈 생성**: 샘플 파일 없이 코드로 크래클 생성. 확장 프로그램 크기를 최소화하고, 파라미터로 실시간 조절 가능.
- **메시지 기반 통신**: Popup ↔ Service Worker ↔ Content Script 간 chrome.runtime.sendMessage / chrome.tabs.sendMessage 사용.

## Dependency Graph

```
[Phase 1] Foundation
  package.json, tsconfig, esbuild, manifest
  shared/types + shared/presets + shared/constants
         │
         ▼
[Phase 2] Core Audio ← 최고 리스크, 먼저 검증
  audio/crackle-processor.ts (AudioWorklet DSP)
  content/index.ts (미디어 감지 + 오디오 파이프라인)
         │
         ▼
[Phase 3] Extension Wiring
  background/service-worker.ts (상태 관리, 메시지 라우팅)
  shared/storage.ts (chrome.storage.sync 래퍼)
         │
         ▼
[Phase 4] Popup UI
  popup/index.html + index.css + index.ts
  Popup ↔ Content Script 실시간 연동
         │
         ▼
[Phase 5] Polish
  설정 persistence, 엣지 케이스, 아이콘
```

## Task List

### Phase 1: Foundation

- [ ] **Task 1: 프로젝트 초기화**
  - Description: pnpm, TypeScript, esbuild 설정. 빌드 파이프라인이 돌아가는 상태까지.
  - Acceptance:
    - [ ] `pnpm install` 성공
    - [ ] `pnpm build`로 dist/ 에 빈 번들 출력
    - [ ] `pnpm dev`로 watch mode 동작
  - Verify: `pnpm build && ls dist/`
  - Files: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore`
  - Scope: S (4 files)

- [ ] **Task 2: Manifest + 공유 타입/상수**
  - Description: MV3 manifest.json, 공유 타입 정의, 프리셋 상수, 메시지 키 정의.
  - Acceptance:
    - [ ] manifest.json이 MV3 스펙에 맞음
    - [ ] CrackleParams, PresetName, Settings 타입 정의 완료
    - [ ] 4개 프리셋 상수 정의 완료
    - [ ] `pnpm typecheck` 통과
  - Verify: `pnpm typecheck`
  - Files: `public/manifest.json`, `src/shared/types.ts`, `src/shared/presets.ts`, `src/shared/constants.ts`
  - Scope: S (4 files)

### Checkpoint: Foundation
- [ ] `pnpm build` 성공
- [ ] `pnpm typecheck` 통과
- [ ] dist/ 폴더에 manifest.json 포함

---

### Phase 2: Core Audio (최고 리스크)

- [ ] **Task 3: CrackleProcessor AudioWorklet**
  - Description: 크래클 노이즈를 생성하는 AudioWorklet 프로세서. Surface noise + clicks/pops + dust particles 3가지를 합성.
  - Acceptance:
    - [ ] AudioWorkletProcessor 클래스 구현
    - [ ] surface, popsPerSec, dust 3개 파라미터를 AudioParam으로 받음
    - [ ] 파라미터 변경 시 실시간 반영
    - [ ] 빌드 시 독립 파일(crackle-processor.js)로 출력
  - Verify: `pnpm build && ls dist/crackle-processor.js`
  - Files: `src/audio/crackle-processor.ts`
  - Scope: M (1 file, but complex DSP logic)

- [ ] **Task 4: Content Script — 미디어 감지 + 오디오 파이프라인**
  - Description: 페이지의 `<audio>`/`<video>` 요소를 감지하고 AudioContext → CrackleProcessor → destination 파이프라인을 연결.
  - Acceptance:
    - [ ] 페이지 로드 시 기존 미디어 요소 감지
    - [ ] MutationObserver로 동적 미디어 요소 감지
    - [ ] MediaElementSource → CrackleProcessor → GainNode → destination 연결
    - [ ] 유튜브에서 영상 재생 시 크래클이 들림
  - Verify: 유튜브에서 영상 재생 → 크래클 소리 확인 (수동)
  - Files: `src/content/index.ts`
  - Scope: M (1 file, but audio pipeline logic)

### Checkpoint: Core Audio 검증
- [ ] 크롬에 확장 프로그램 로드 가능
- [ ] 유튜브에서 영상 재생 시 크래클이 들린다
- [ ] 원본 오디오도 정상 재생된다
→ **여기서 실패하면 접근 방식 재검토 (tabCapture 등 대안)**

---

### Phase 3: Extension Wiring

- [ ] **Task 5: Service Worker + 메시지 라우팅**
  - Description: 확장 프로그램 상태(ON/OFF) 관리. Popup ↔ Content Script 간 메시지 중계.
  - Acceptance:
    - [ ] ON/OFF 상태를 Service Worker에서 관리
    - [ ] Popup → Service Worker → Content Script 메시지 전달
    - [ ] Content Script → Service Worker → Popup 상태 응답
  - Verify: 콘솔에서 메시지 흐름 확인 (수동)
  - Files: `src/background/index.ts`, `src/shared/constants.ts`
  - Scope: S (2 files)

- [ ] **Task 6: Storage 래퍼**
  - Description: chrome.storage.sync를 감싸는 유틸. 설정 저장/로드, 기본값 처리.
  - Acceptance:
    - [ ] saveSettings / loadSettings 함수
    - [ ] 기본값(Warm Vinyl 프리셋) 자동 적용
    - [ ] 타입 안전한 인터페이스
  - Verify: `pnpm typecheck`
  - Files: `src/shared/storage.ts`
  - Scope: XS (1 file)

### Checkpoint: Extension Wiring
- [ ] Popup에서 ON/OFF 토글 → 유튜브에서 크래클 켜짐/꺼짐
- [ ] 설정 저장 후 브라우저 재시작 → 설정 복원

---

### Phase 4: Popup UI

- [ ] **Task 7: Popup UI 구현**
  - Description: HTML + CSS로 팝업 레이아웃. 토글, 프리셋 버튼, 슬라이더 3개, 마스터 강도.
  - Acceptance:
    - [ ] ON/OFF 토글 스위치
    - [ ] 4개 프리셋 버튼 (선택 시 하이라이트)
    - [ ] Surface / Pops / Dust 슬라이더 3개
    - [ ] Master Intensity 슬라이더
    - [ ] 다크 테마, 바이닐 감성 디자인
  - Verify: 팝업 열어서 UI 확인 (수동)
  - Files: `src/popup/index.html`, `src/popup/index.css`
  - Scope: S (2 files)

- [ ] **Task 8: Popup ↔ Content Script 연동**
  - Description: Popup의 토글/프리셋/슬라이더 조작이 실시간으로 Content Script의 오디오 파이프라인에 반영.
  - Acceptance:
    - [ ] 토글 → ON/OFF 즉시 반영
    - [ ] 프리셋 선택 → 3개 파라미터 일괄 변경
    - [ ] 슬라이더 → 해당 파라미터 실시간 변경
    - [ ] 현재 탭의 상태를 팝업에 표시
  - Verify: 유튜브 재생 중 팝업에서 조작 → 소리 변화 확인 (수동)
  - Files: `src/popup/index.ts`
  - Scope: S (1 file)

### Checkpoint: Full Feature
- [ ] 유튜브에서 영상 재생 + 크래클 ON
- [ ] 프리셋 4개 각각 소리가 다름
- [ ] 슬라이더 조작 시 실시간 반영
- [ ] OFF 하면 원본 오디오 복원
- [ ] 설정이 저장되고 복원됨

---

### Phase 5: Polish

- [ ] **Task 9: 엣지 케이스 처리**
  - Description: 여러 미디어 요소, 탭 전환, SPA 네비게이션, 동적 미디어 로드 등.
  - Acceptance:
    - [ ] 한 페이지에 여러 video/audio → 모두 크래클 적용
    - [ ] SPA(유튜브) 내 페이지 이동 시에도 유지
    - [ ] 이미 AudioContext에 연결된 미디어 요소 처리
  - Verify: 유튜브 내 영상 이동, 스포티파이 웹 테스트 (수동)
  - Files: `src/content/index.ts`
  - Scope: S (1 file)

- [ ] **Task 10: 아이콘**
  - Description: 16x16, 48x48, 128x128 아이콘 생성. 간단한 LP 디스크 또는 바늘 모티프.
  - Acceptance:
    - [ ] 3가지 사이즈 아이콘 존재
    - [ ] 크롬 툴바에서 아이콘 정상 표시
  - Verify: 크롬 툴바 확인 (수동)
  - Files: `public/icons/icon16.png`, `public/icons/icon48.png`, `public/icons/icon128.png`
  - Scope: XS (3 files)

### Checkpoint: Complete
- [ ] Success Criteria 전체 충족
- [ ] 최소 3개 사이트에서 테스트 (유튜브, 스포티파이 웹, SoundCloud)
- [ ] 크롬 웹스토어 제출 가능한 상태

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `createMediaElementSource`가 이미 연결된 요소에 실패 | High | try-catch + 실패 시 해당 요소 스킵, 대안으로 tabCapture 검토 |
| AudioWorklet이 특정 사이트에서 CSP에 막힘 | Medium | blob URL로 워크릿 로드, 또는 ScriptProcessorNode 폴백 |
| CORS로 인해 cross-origin 미디어 처리 불가 | Medium | crossOrigin 속성 설정 시도, 불가 시 해당 요소 스킵 |
| 크래클 소리가 부자연스러움 | Low | 프리셋 파라미터 튜닝으로 해결, 실제 LP 녹음 참고 |

## Open Questions

- [ ] 이름 최종 결정
- [ ] 아이콘 디자인 방향
