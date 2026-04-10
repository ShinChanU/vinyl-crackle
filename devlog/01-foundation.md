# 01. Foundation — 프로젝트 셋업

### esbuild + pnpm 선택이 만든 DX

**상황**: TypeScript 크롬 확장 프로그램의 빌드 파이프라인 구성
**문제**: 크롬 확장은 4개의 독립 번들이 필요하다 (content script, service worker, popup, AudioWorklet). Webpack이나 Vite로는 설정이 복잡해진다.
**시도**: esbuild를 선택하고 `esbuild.config.mjs`에서 4개 entryPoint를 각각 빌드하도록 구성.
**해결**: 각 번들을 독립 build() 호출로 분리. `Promise.all()`로 병렬 빌드. 전체 빌드가 수십 ms에 끝남.
**배운 것**: esbuild의 "한 파일에 여러 빌드 설정"은 크롬 확장처럼 여러 진입점이 있는 프로젝트에 이상적이다.

---

### AudioWorklet 타입 선언

**상황**: `crackle-processor.ts`에서 `AudioWorkletProcessor`를 extend하려 함
**문제**: TypeScript에 AudioWorklet 타입이 기본 포함되어 있지 않다. `AudioWorkletProcessor`, `registerProcessor`, `sampleRate` 등이 전부 "not found".
**시도**: `@types/audioworklet` npm 패키지를 찾아봤지만 존재하지 않음.
**해결**: `src/audio/audio-worklet.d.ts`에 직접 타입 선언 작성. `AudioWorkletProcessor` 클래스, `registerProcessor` 함수, `sampleRate` 글로벌 변수 등.
**배운 것**: AudioWorklet은 별도의 글로벌 스코프에서 실행되므로, DOM 타입과 AudioWorklet 타입이 같은 tsconfig에 공존하면 충돌 가능. 별도 d.ts 파일로 분리하는 게 안전하다.

---

### pnpm의 onlyBuiltDependencies

**상황**: `pnpm install` 시 esbuild의 post-install 스크립트가 차단됨
**문제**: pnpm v10은 보안을 위해 의존성의 build script를 기본 차단한다. esbuild는 post-install에서 플랫폼별 바이너리를 설치하므로 이 스크립트가 필요.
**시도**: `pnpm approve-builds`는 interactive UI라 자동화 불가.
**해결**: `package.json`에 `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` 추가하여 선언적으로 허용.
**배운 것**: pnpm v10의 새로운 보안 정책. CI에서도 이 설정이 없으면 esbuild가 동작하지 않는다.

---

> 다음: `02-core-audio.md` — AudioWorklet DSP 엔진과 Content Script 오디오 가로채기
