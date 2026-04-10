# 02. Core Audio — AudioWorklet DSP와 오디오 가로채기

### 크래클을 코드로 만든다는 것

**상황**: LP 크래클을 프로시저럴하게 생성해야 함 (샘플 파일 없이)
**문제**: 실제 LP 크래클은 단일 노이즈가 아니라, 3가지 서로 다른 물리적 현상의 합이다.
**시도**: 먼저 화이트 노이즈만 넣어봤지만, "라디오 잡음" 같았지 LP 느낌이 아니었다.
**해결**: 3개 컴포넌트를 분리:
1. **Surface Noise**: 화이트 노이즈 → 밴드패스 필터(~1.5kHz). LP 홈을 바늘이 따라갈 때의 배경 "쉬~".
2. **Clicks & Pops**: 푸아송 분포 랜덤 임펄스. 먼지/흠집에 바늘이 부딪힐 때의 "톡, 탁".
3. **Dust Particles**: 1~5ms 길이의 짧은 노이즈 버스트 + 엔벨로프. 먼지 입자의 "치직".
**배운 것**: 소리를 시뮬레이션하려면 물리적 원인을 이해해야 한다. "LP 소리"는 하나의 소리가 아니라 물리적 현상 여러 개의 합이다.

---

### 밴드패스 필터를 AudioWorklet 안에서 직접 구현

**상황**: Surface noise에 밴드패스 필터가 필요
**문제**: AudioWorklet 안에서는 `BiquadFilterNode`를 쓸 수 없다. AudioWorklet은 별도의 오디오 스레드에서 돌아가는 경량 환경이라, Web Audio API의 고수준 노드를 사용할 수 없고 raw sample을 직접 처리해야 한다.
**시도**: 외부에서 BiquadFilterNode를 체이닝하는 것도 방법이지만, AudioWorklet 하나로 모든 처리를 하면 오디오 스레드 간 불필요한 전달이 없다.
**해결**: 2nd-order IIR 밴드패스 필터를 직접 구현. 쿡북 공식(Audio EQ Cookbook)으로 계수를 계산하고, 4개의 상태 변수(bpY1, bpY2, bpX1, bpX2)를 유지.
**배운 것**: AudioWorklet은 "무엇이든 할 수 있는" 자유도를 주지만, 그만큼 저수준 DSP 지식이 필요하다. Web Audio API의 편의 노드들이 내부적으로 얼마나 많은 일을 해주는지 체감.

---

### createMediaElementSource의 "한 번만" 제약

**상황**: Content script에서 `<video>` 요소를 AudioContext에 연결
**문제**: `createMediaElementSource()`는 하나의 미디어 요소에 한 번만 호출 가능. 이미 다른 코드(또는 이전 호출)에서 연결했으면 에러 발생.
**시도**: 에러를 잡지 않으면 확장 프로그램 전체가 크래시.
**해결**: `WeakMap<HTMLMediaElement, AudioPipeline>`으로 이미 연결된 요소를 추적하고, try-catch로 감싸서 실패 시 graceful하게 스킵.
**배운 것**: WeakMap은 DOM 요소를 키로 쓸 때 메모리 누수를 방지하는 정확한 자료구조다. DOM에서 요소가 제거되면 WeakMap 엔트리도 자동 GC된다.

---

### MutationObserver로 동적 미디어 감지

**상황**: 유튜브 같은 SPA는 페이지 이동 시 `<video>` 요소가 동적으로 추가/교체됨
**문제**: 페이지 로드 시 한 번만 스캔하면 이후에 추가되는 미디어를 놓침
**해결**: `MutationObserver`로 DOM 변화를 감시하고, 새로 추가된 `<audio>`, `<video>` 요소에 자동 연결. 추가로 `play` 이벤트도 capture phase로 리슨해서, 지연 로드되는 플레이어도 잡음.
**배운 것**: SPA 환경에서 Content Script가 안정적으로 동작하려면 "한 번 스캔"이 아니라 "지속적 감시"가 필수.

---

### CSP가 AudioWorklet을 죽였다 — 접근 방식 전환

**상황**: AudioWorklet + createMediaElementSource 파이프라인 구현 완료. 빌드/타입체크 통과. 크롬에 로드.
**문제**: YouTube에서 `AbortError: Unable to load a worklet's module.` 에러 발생.
YouTube의 CSP(Content Security Policy)가 `blob:` URL과 `chrome-extension://` URL 모두를 script-src에서 차단.
AudioWorklet의 `addModule(url)`은 URL로 모듈을 로드해야 하는데, 어떤 형태의 URL이든 YouTube CSP에 막힘.
**시도**:
1. `chrome-extension://` URL → CSP 차단
2. fetch → Blob → `URL.createObjectURL()` → CSP가 `blob:` URL도 차단
3. `data:` URL도 마찬가지로 CSP 차단됨
**해결**: 근본적 접근 방식 전환.

"미디어 오디오를 가로채서 크래클을 합성" → "크래클을 별도 오디오 소스로 재생 (오버레이)"

- 미디어 요소를 건드리지 않음 (createMediaElementSource 불필요)
- AudioWorklet 대신 ScriptProcessorNode 사용 (모듈 로딩 불필요, CSP 무관)
- 미디어 재생 상태를 감시해서, 미디어가 재생 중일 때만 크래클 출력

**배운 것**: 크롬 확장에서 "사이트의 오디오를 직접 가공"하는 것은 CSP 때문에 사실상 불가능한 사이트가 많다. "옆에서 별도로 소리를 재생"하는 오버레이 방식이 훨씬 범용적이다. 결과적으로 사용자 경험 차이는 거의 없다 — 어차피 크래클은 원본 위에 겹치는 소리니까.

---

> 다음: `03-extension-wiring.md` — 확장 프로그램 메시지 통신
