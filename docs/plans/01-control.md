# 슬라이스 1 조작 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버가 발급한 토큰으로 한 판을 열고, 조이스틱과 키보드의 이동 의도만으로 서버 위의 플레이어를 움직이며, 화면은 그 스냅샷만 그린다.

**Architecture:** `parseClientMessage`와 `clampIntent`는 공유 모듈이다. 속도, 틱, 메모리 저장소, 세션은 `src/server`에만 둔다. 로컬 개발 서버는 Next가 붙이는 업그레이드 리스너를 걷어 내고 `/api/runs/socket`을 `ws`로 받는다. Vercel 라우트는 `upgradeWebSocket`으로 같은 `attachRunSocket`을 호출한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, `@vercel/functions` 3.11.2, `ws` 8.

## Global Constraints

- 브라우저는 표시기다. 서버 권위로 쓰는 값은 서버 계산으로만 바뀐다.
- 수신 JSON에서 스키마 밖의 필드는 제거한다.
- `src/server` 파일의 첫 줄은 `import "server-only"`다.
- 이 슬라이스의 틱은 입력 창 확인과 플레이어 이동만 한다. 스폰, 공격, 경험치, 일시정지, 제한 시간 종료는 하지 않는다.
- 등급 0의 한 틱 이동 거리는 `140 * 0.05`다.
- `moveAcceptedAt`에서 `now - 1000`보다 큰 시각이 20개 이상이면 그 `move`는 무시한다.
- 토큰 수명은 발급 시각부터 30000ms이고, `now <= expiresAt`일 때만 활성화된다.
- 같은 주소 해시에서 `issuedAt > now - 60000`인 발급이 5개면 다음은 `rate`다.
- `hello`가 열린 시각부터 5000ms 이상 없으면 4002로 닫는다. 활성화 실패는 4001이다.
- 메모리 저장소의 `finish`는 `unrecorded`이고 `board`는 빈 배열이다.
- 조이스틱은 `(pointer: coarse)`일 때만 보인다. 일시정지 버튼은 보이고 비활성이다.
- `src/shared/protocol.ts`에는 공격력 10, 발사 간격 800, 적 체력 30을 넣지 않는다.

---

### Task 1: 파서와 의도 클램프

**Files:**
- Create: `src/shared/protocol.ts`
- Test: `src/shared/protocol.test.ts`

- [x] 스키마 밖 필드를 버린다. `(3, 4)`는 길이 1이 된다. 유한하지 않은 이동은 `null`이다.
- [x] `npm test`에서 protocol 테스트가 통과한다.

### Task 2: 이동 틱

**Files:**
- Create: `src/server/sim/state.ts`
- Create: `src/server/sim/rules.ts`
- Test: `src/server/sim/rules.test.ts`

- [x] 등급 0에서 한 틱의 이동 거리는 7이다. 체력 필드는 체력 100을 바꾸지 못한다.
- [x] 1초 안의 21번째 `move`는 의도를 바꾸지 않는다.
- [x] `pause`, `resume`, `choose`는 상태를 바꾸지 않는다.

### Task 3: 메모리 저장소

**Files:**
- Create: `src/server/store/memory.ts`
- Create: `src/server/store/global.ts`
- Create: `src/server/store/issue.ts`
- Test: `src/server/store/memory.test.ts`

- [x] 두 번째 활성화와 만료 토큰은 `reject`다.
- [x] 경계 시각 `issuedAt == now - 60000`은 5회 제한에 넣지 않는다.
- [x] `finish`는 항상 `unrecorded`이고, 그 뒤 `read`는 `missing`이다.

### Task 4: 세션

**Files:**
- Create: `src/server/session.ts`
- Create: `src/server/attach.ts`
- Test: `src/server/session.test.ts`

- [x] `hello` 없이 5000ms가 지나면 4002다.
- [x] 없는 토큰은 4001이고 스냅샷이 없다.
- [x] 끊긴 토큰으로 다시 열 수 없다.

### Task 5: 라우트와 로컬 서버

**Files:**
- Create: `src/app/api/runs/route.ts`
- Create: `src/app/api/runs/socket/route.ts`
- Create: `scripts/dev-server.ts`

- [x] `POST /api/runs`는 201과 `runId`, `token`, `expiresAt`를 준다.
- [x] 소켓 라우트는 `runtime = "nodejs"`, `maxDuration = 300`, `upgradeWebSocket`이다.
- [x] 로컬 서버는 Next가 붙인 업그레이드 리스너를 제거한 뒤 게임 소켓만 `attachRunSocket`으로 받는다.

### Task 6: 화면

**Files:**
- Create: `src/client/Game.tsx`
- Create: `src/client/intent.ts`
- Create: `src/client/paint.ts`
- Create: `src/app/page.tsx`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Test: `src/client/intent.test.ts`
- Test: `src/server/boundary.test.ts`

- [x] 반대 키는 그 축을 0으로 만들고, 합친 벡터 길이는 1을 넘지 않는다.
- [x] 클라이언트 그래프는 `src/server`를 import하지 않는다.
- [x] 시작 전에는 플레이어를 그리지 않는다. 실패 문구는 `시작하지 못했습니다`.
- [x] 카메라는 플레이어를 화면 중앙에 둔다. 일시정지 버튼은 항상 비활성이다.

### Task 7: 확인

- [x] `npm test`
- [x] `npx tsc --noEmit`
- [x] 로컬 소켓에서 오른쪽 의도의 x가 틱마다 7 증가하고 체력은 100이다.
- [x] 브라우저에서 시작, 키보드 이동, 스크롤 없음, 실패 문구, 좁은 화면의 조이스틱을 확인한다.
