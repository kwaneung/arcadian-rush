# 00 계약

상태: 리뷰 전. 잠기기 전에는 구현하지 않는다.

이 문서가 메시지, 상태, 틱, 수치, 저장의 기준이다. 슬라이스는 이 규칙을 어떤 순서로 켜는지와 완료 조건을 정한다.

## 모듈

```text
src/shared/protocol.ts     메시지 타입과 파서. 수치와 공식이 없다
src/server/sim/            상태, 틱, 난수, 수치. 각 파일 첫 줄은 import "server-only"
src/server/store/          토큰 발급, 활성화, 종료, 조회
src/client/                Canvas, 조이스틱, HUD. src/shared만 import
src/app/                   페이지와 라우트
```

`src/server`를 클라이언트 컴포넌트에서 import하면 빌드가 실패해야 한다. 규칙 수치는 `src/server/sim`에만 둔다.

메시지 유니언을 다루는 switch는 default에서 `never` 검사를 한다.

순수 함수 이름:

| 함수 | 역할 |
| --- | --- |
| `parseClientMessage(raw)` | 문자열을 메시지로 바꾸거나 `null` |
| `clampIntent(x, y)` | 이동 의도를 단위 원 안으로 넣거나 `null` |
| `createRunState(input)` | 한 판의 초기 상태 |
| `step(state, now)` | 벽시계 `now` 기준으로 틱 하나 |
| `apply(state, message, now)` | 파싱된 메시지 하나 |
| `derivedStats(ranks)` | 등급에서 전투 수치를 계산 |
| `rollOffer(ranks, random)` | 레벨업 후보 |
| `borderPoint(distance)` | 둘레 위치 |
| `toSnapshot(state)` | 클라이언트에 보낼 스냅샷 |

## 시간

| 이름 | 값 |
| --- | --- |
| 틱 | 50ms. 시뮬레이션 증가량도 50ms |
| 소켓 루프 | 벽시계 50ms마다 `step`을 한 번 호출. 밀린 틱을 몰아서 따라잡지 않는다 |
| 런 벽시계 예산 | 활성화 시각부터 270000ms |
| 함수 `maxDuration` | 소켓 라우트에 300을 명시. Hobby에서 이 값은 상한이다 |
| 토큰 수명 | 발급 시각부터 30000ms |
| `hello` 대기 | 소켓이 열린 뒤 5000ms |
| 이동 입력 | `now - 1000`보다 큰 `moveAcceptedAt`이 20개 이상이면 그 `move`는 무시. 같은 시각은 창 밖 |
| 일시정지 입력 | `now - 1000`보다 큰 `pauseAcceptedAt`이 4개 이상이면 그 `pause`와 `resume`는 무시. 같은 시각은 창 밖 |
| 클라이언트 전송 | 벡터가 바뀔 때, 그리고 소켓이 열려 있는 동안 최소 100ms마다 현재 벡터 |

생존 시간은 `simMs`다. 일시정지와 레벨업 선택 동안에는 오르지 않는다. 벽시계는 페이즈와 관계없이 흐른다. 활성화 직후 첫 스냅샷은 `step` 없이 보낸다. 첫 `step`의 `now`는 `activatedAt + 50`이고, 이후에는 50ms마다 한 번이다. 벽시계가 270000ms 이상이면 그 `step`은 `simMs`를 올리지 않고 `time_limit`으로 끝낸다. 그 일정으로 쉬지 않고 `playing`인 판의 마지막 `simMs`는 269950이다. 결과의 `mm:ss`는 그 값을 1000으로 나눈 몫이라 `04:29`다.

테스트는 타이머를 재우지 않고 `step`과 `apply`에 시각을 넣어 호출한다.

## 전송

페이지는 `/`다. 기록 목록 페이지는 `/records`다.

| 라우트 | 메서드 | 동작 |
| --- | --- | --- |
| `/api/runs` | POST | 토큰 발급. 본문의 게임 필드는 무시 |
| `/api/runs/socket` | GET | `upgradeWebSocket`으로 업그레이드 |
| `/api/runs/:id` | GET | 그 판의 공개 상태. 슬라이스 5 |
| `/api/records` | GET | 종료된 공식 기록. 슬라이스 5 |

소켓 라우트는 `export const runtime = "nodejs"`와 `export const maxDuration = 300`을 가진다. 웹소켓은 Fluid Compute가 켜져 있어야 한다.

POST `/api/runs`의 201 본문:

```json
{ "runId": "uuid", "token": "string", "expiresAt": "ISO-8601" }
```

같은 주소에서 `issued_at > now - 60000`인 발급이 5개면 다음 발급은 429이고 행을 만들지 않는다. 주소는 `x-forwarded-for`의 가장 왼쪽 값을 다듬은 것이다. 헤더가 없으면 버킷은 `unknown`이다. 저장하는 값은 그 문자열의 SHA-256 hex다. 원문 주소, 토큰, 해시, `DATABASE_URL`은 로그에 남기지 않는다.

토큰은 32바이트를 base64url로 만든 문자열이다. 저장소에는 SHA-256 hex만 둔다. 비교는 상수 시간 비교다. `runId`는 UUID v4다.

소켓을 연 뒤 첫 처리 메시지는 `hello`여야 한다. URL 쿼리에 토큰을 넣지 않는다. `hello` 전에 온 다른 메시지는 무시하고 대기 시간을 리셋하지 않는다. 열린 시각부터 5000ms 이상 지날 때까지 올바른 `hello`가 없으면 4002로 닫고 스냅샷을 보내지 않는다. 활성화 전에 닫히면 `finish`를 호출하지 않는다.

`hello`가 활성화에 실패하면 4001로 닫고 스냅샷을 보내지 않는다. 성공하면 페이즈 `playing`의 스냅샷을 보내고 벽시계를 시작한다.

클라이언트 프레임이 1024바이트를 넘거나 JSON이 아니면 그 프레임은 무시한다. 이진 프레임은 무시한다.

종료 스냅샷을 보낸 뒤에는 1000으로 닫는다. 한 페이지의 시작 조작은 기존 소켓을 먼저 닫는다. 그 닫힘은 그 판의 끊김 종료다.

## 클라이언트 메시지

```ts
type ClientMessage =
  | { type: "hello"; runId: string; token: string }
  | { type: "move"; x: number; y: number }
  | { type: "choose"; index: number }
  | { type: "pause" }
  | { type: "resume" };
```

`parseClientMessage`는 이 모양만 돌려준다. 다른 필드가 있어도 결과 객체에는 복사하지 않는다. 타입이 없거나 필드 타입이 다르면 `null`이다.

- `runId`는 UUID 문자열이다.
- `token`은 길이 1 이상 200 이하의 문자열이다.
- `move`의 `x`와 `y`는 유한한 수다. `clampIntent`가 각 성분을 -1 이상 1 이하로 자른 뒤, 길이가 1을 넘으면 길이 1로 줄인다.
- `choose.index`는 0 이상의 정수다. JSON 소수와 문자열은 `null`이다.
- 활성화 이후의 `hello`는 무시한다.
- 속도는 마지막 유효 `move`만 쓴다. 메시지 수가 늘어도 틱당 이동은 한 번이다.

## 스냅샷

서버가 보내는 JSON:

```ts
type Snapshot = {
  type: "snapshot";
  runId: string;
  phase: "playing" | "choosing" | "paused" | "ended";
  simMs: number;
  player: {
    x: number;
    y: number;
    radius: number;
    hp: number;
    maxHp: number;
    level: number;
    xp: number;
    xpToNext: number;
    facingX: number;
    facingY: number;
    kills: number;
  };
  entities: Array<{
    id: number;
    kind: "enemy" | "projectile" | "gem";
    subtype: string;
    x: number;
    y: number;
    radius: number;
    hpFraction?: number;
  }>;
  offer: null | Array<{
    index: number;
    id: string;
    title: string;
    detail: string;
  }>;
  result: null | {
    simMs: number;
    kills: number;
    level: number;
    reason: "death" | "time_limit" | "disconnect";
    recorded: boolean;
  };
};
```

스냅샷에는 시드, 토큰, 공격력, 발사 간격, 이동 속도, 접촉 누적값이 없다. 적의 `hpFraction`은 `hp / maxHp`이고 0 이상 1 이하다.

`step`이 한 번 끝날 때마다, 그리고 `hello`, `choose`, `pause`, `resume`가 상태에 반영될 때마다 스냅샷을 만든다. 소켓에 아직 나가지 못한 스냅샷이 있으면 최신 것으로 바꾼다. 연결당 대기 스냅샷은 하나다.

## 상태

```ts
type UpgradeId =
  | "might"
  | "haste"
  | "stride"
  | "vigor"
  | "magnet"
  | "volley";

type Ranks = Record<UpgradeId, number>;

type RunState = {
  runId: string;
  phase: "playing" | "choosing" | "paused" | "ended";
  random: () => number;
  activatedAt: number;
  simMs: number;
  nextEntityId: number;
  nextSpawnSimMs: number;
  lastShotSimMs: number;
  player: {
    x: number;
    y: number;
    hp: number;
    level: number;
    xp: number;
    facingX: number;
    facingY: number;
    kills: number;
    intentX: number;
    intentY: number;
    ranks: Ranks;
  };
  enemies: Array<{
    id: number;
    subtype: "normal" | "fast" | "tank";
    x: number;
    y: number;
    hp: number;
    contactBank: number;
  }>;
  projectiles: Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    bornSimMs: number;
  }>;
  gems: Array<{
    id: number;
    x: number;
    y: number;
    xp: number;
    bornOrder: number;
  }>;
  offer: null | Array<{
    index: number;
    id: UpgradeId;
    title: string;
    detail: string;
  }>;
  result: Snapshot["result"];
  moveAcceptedAt: number[];
  pauseAcceptedAt: number[];
};
```

`createRunState`의 초기값:

| 필드 | 값 |
| --- | --- |
| phase | `playing` |
| simMs | 0 |
| nextEntityId | 1 |
| nextSpawnSimMs | 1000 |
| lastShotSimMs | 0 |
| player | x 0, y 0, hp 100, level 1, xp 0, facing 1과 0, kills 0, intent 0과 0, 등급 전부 0 |
| 목록 | 적, 투사체, 조각, offer, result는 비어 있다 |

좌표는 +x가 오른쪽, +y가 아래다. Canvas에 그릴 때 y를 뒤집지 않는다.

엔티티 id는 1부터 올리고 재사용하지 않는다. 조각의 `bornOrder`도 만든 순서로 올린다.

## 페이즈

```text
hello 성공 -> playing
playing + pause -> paused
paused + resume -> playing
playing + 레벨업 -> choosing
choosing + 유효한 choose -> playing
playing + 체력 0 이하 -> ended, death
playing | paused | choosing + 벽시계 270000ms -> ended, time_limit
소켓 닫힘 -> ended, disconnect
```

`ended` 이후의 메시지는 무시한다. `choosing`에서 `pause`와 `resume`와 `move`는 무시한다. `paused`에서 `move`와 `choose`는 무시한다. `playing`에서 `resume`와 `choose`는 무시한다. 잘못된 `choose` 번호는 무시하고 후보를 유지한다.

`pause`를 받아들이면 그 시각을 `pauseAcceptedAt`에 남긴다. 무시된 메시지는 간격 창에 넣지 않는다. `move`도 같다.

## 틱

아래 순서는 다섯 슬라이스가 모두 켜진 뒤의 `step`이다. 앞 슬라이스는 자기 문서에 적힌 단계만 실행한다. 끝낸다는 것은 [종료 절차](#종료-절차)를 따른다는 뜻이다. 활성화에 성공한 뒤에만 `RunState`를 만든다.

`step(state, now)`:

1. 페이즈가 `ended`면 반환한다.
2. `now - activatedAt >= 270000`이면 `time_limit`으로 끝낸다.
3. 페이즈가 `paused` 또는 `choosing`이면 시뮬레이션 시간을 올리지 않고 스냅샷만 만든다.
4. `simMs += 50`.
5. 스폰을 시도한다.
6. 적을 이동한다.
7. 플레이어를 이동한다.
8. 접촉 피해를 적용한다. 체력이 0 이하면 0으로 맞추고 `death`로 끝낸다.
9. 발사한다.
10. 투사체를 이동하고 맞힌다.
11. 체력이 0 이하인 적을 제거하고 조각을 만들며 처치 수를 올린다.
12. 조각을 줍는다.
13. 레벨업 조건이면 `choosing`으로 바꾼다.
14. 스냅샷을 만든다.

## 이동과 경계

플레이어 반경은 14다. 월드 반폭은 800이다. 중심은 0, 0이다. 중심의 각 성분은 `-(800 - 반경)` 이상 `800 - 반경` 이하다. 플레이어 한계는 786이다. 적 이동과 접촉은 id가 작은 적부터 처리한다. 투사체 이동과 맞힘도 id가 작은 투사체부터 처리한다.

적 이동은 플레이어 중심을 향한 단위 벡터에 `속력 * 0.05`를 곱한 뒤, 두 원이 겹치면 그 적만 반경 합 거리까지 되돌리고, 그 다음 월드 한계로 자른다. 거리가 0이면 이동량만 0이다. 이 되돌림은 적 이동 단계에만 있다. 이어서 플레이어가 움직이면 다시 겹칠 수 있고, 그때는 접촉 피해가 적용된다. 투사체는 월드 밖으로 나갈 수 있고, 수명이 끝나면 제거한다.

플레이어 이동량:

```text
속력 = derivedStats(ranks).speed
거리 = 속력 * 0.05
이동 = intent * 거리
```

의도 길이가 0이면 좌표는 그대로고 facing도 그대로다. 길이가 0보다 크면 facing은 그 의도의 단위 벡터다.

## 스폰

한 틱에 시도는 한 번이다. `simMs >= nextSpawnSimMs`일 때만 시도한다. 살아있는 적이 200이면 만들지 않고 `nextSpawnSimMs = simMs + 현재 간격`으로 민다.

간격과 가중치:

| simMs | 간격 ms | normal | fast | tank |
| --- | ---: | ---: | ---: | ---: |
| 30000 미만 | 1000 | 1 | 0 | 0 |
| 90000 미만 | 700 | 0.7 | 0.3 | 0 |
| 180000 미만 | 500 | 0.5 | 0.3 | 0.2 |
| 그 이후 | 400 | 0.4 | 0.35 | 0.25 |

처음 `nextSpawnSimMs`는 1000이다. 스폰에 성공해도 간격을 한 번 더한다.

`random()`은 0 이상 1 미만이다. 종류는 `random()` 하나를 이렇게 비교한다. 누적을 0에서 시작해 normal, fast, tank 순으로 가중치를 더하고, `r < 누적`인 첫 종류를 고른다. 일치가 없으면 가중치가 양수인 마지막 종류를 고른다.

위치는 둘레 길이 6400 위의 거리 `random() * 6400`을 `borderPoint`에 넣은 뒤, 그 적 반경으로 월드 안에 자른 좌표다. 자른 점과 플레이어의 거리가 280 미만이면 최대 8번까지 다시 뽑는다. 8번째도 가까우면 그 점을 쓴다. 성공한 시도에서 멈춘다.

`borderPoint`:

```text
둘레 = 6400
거리 = ((distance % 6400) + 6400) % 6400
0 이상 1600 미만: x = -800 + 거리, y = -800
1600 이상 3200 미만: x = 800, y = -800 + (거리 - 1600)
3200 이상 4800 미만: x = 800 - (거리 - 3200), y = 800
4800 이상 6400 미만: x = -800, y = 800 - (거리 - 4800)
```

## 전투 수치

적:

| subtype | hp | 속력 | 반경 | 초당 접촉 | 조각 경험치 |
| --- | ---: | ---: | ---: | ---: | ---: |
| normal | 30 | 80 | 12 | 10 | 1 |
| fast | 16 | 150 | 10 | 8 | 1 |
| tank | 90 | 46 | 18 | 16 | 3 |

접촉: `contactBank`는 체력 1000분의 1의 정수다. 두 원의 거리가 반경 합 이하인 적마다 `contactBank += 초당 접촉 * 50`이다. `contactBank >= 1000`인 동안 1000을 빼고 플레이어 체력을 1 줄인다. normal은 틱마다 500이 쌓여 두 틱마다 체력이 1 줄어든다. 같은 틱의 모든 적에게 적용한 뒤 사망을 본다.

기본 공격:

| 이름 | 값 |
| --- | --- |
| 공격력 기반 | 10 |
| 발사 간격 기반 | 800ms |
| 투사체 속력 | 240 |
| 투사체 반경 | 5 |
| 투사체 수명 | 1000ms |
| 투사체 수 기반 | 1 |
| 살아있는 투사체 상한 | 100 |
| 조각 반경 | 6 |
| 조각 상한 | 200 |
| 획득 반경 기반 | 36 |

`simMs - lastShotSimMs >= 간격`이고 살아있는 적이 있을 때만 발사한다. 적이 없으면 시각을 갱신하지 않는다. 대상은 플레이어와의 거리가 가까운 순이고, 거리가 같으면 id가 작은 순이다. 대상 수는 현재 투사체 수와 남은 상한 중 작은 값이다. 적이 그보다 적으면 가장 가까운 적을 다시 조준한다.

발사 순간의 방향으로 직진한다. 유도하지 않는다. 방향 길이가 0이면 그 발은 만들지 않는다. 이동량은 속력 240에 0.05를 곱한 12다. 맞은 판정은 이동 뒤의 거리로 하고, 틱 사이의 터널은 1차에서 허용한다.

겹친 적이 여럿이면 가장 가까운 적, 같으면 id가 작은 적에게 공격력만큼 체력을 깎고 투사체를 제거한다. 한 투사체는 한 명에게만 맞는다. 수명 `simMs - bornSimMs >= 1000`이면 맞지 않아도 제거한다.

사망한 적은 조각이 된다. 조각 위치가 적 위치다. 처치 수는 제거된 적 하나당 1이다. 조각이 200을 넘으면 `bornOrder`가 작은 것부터 200개가 될 때까지 제거한다.

획득: 플레이어와 조각의 거리가 `14 + 6 + 획득 반경` 이하이면 경험치를 더하고 조각을 제거한다.

## 성장

다음 레벨 요구량:

```text
xpToNext(level) = 5 + (level - 1) * 3
```

스냅샷의 `xpToNext`는 현재 레벨의 `xpToNext(level)`이다. 더 올릴 업그레이드가 없으면 `xp`는 0이고 `xpToNext`는 0이다. 있으면 줍는 단계 뒤에, 페이즈가 `playing`이고 `xp >= xpToNext(level)`일 때 한 틱에 한 레벨만 올린다.

```text
xp -= xpToNext(level)
level += 1
offer = rollOffer(ranks, random)
phase = choosing
```

후보가 3개 미만이면 있는 것만 낸다. 후보가 0개면 이 전이를 하지 않고 경험치와 레벨을 유지한 채 `xp`를 0으로 둔다.

업그레이드 기본 순서는 might, haste, stride, vigor, magnet, volley다. `rollOffer`는 등급이 5 미만인 것을 이 순서로 고른 뒤 Fisher-Yates로 섞고 앞에서 최대 3개를 자른다. 인덱스는 잘린 배열의 0부터다.

Fisher-Yates:

```text
i를 n - 1부터 1까지:
  j = floor(random() * (i + 1))
  i와 j를 교환
```

`random()`이 항상 0.999면 `j = i`라 기본 순서가 유지된다. 전원 등급 0이면 후보는 might, haste, stride다.

등급이 기준이고 전투 수치는 매번 `derivedStats`로 다시 계산한다.

```text
might 공격력 = max(1, round(10 * 1.2 ^ rank))
haste 간격 = max(250, round(800 * 0.88 ^ rank))
stride 속력 = min(280, 140 * 1.12 ^ rank)
vigor 최대 체력 = 100 + 20 * rank
magnet 획득 반경 = 36 + 28 * rank
volley 투사체 수 = 1 + rank
```

`round`는 양의 수에서 0.5를 올림한다. JavaScript `Math.round`와 같다. 속력은 반올림하지 않는다. 등급 상한은 전부 5다. 투사체 수는 등급 5에서 6이다.

유효한 `choose`는 그 후보의 등급을 1 올린다. vigor이면 새 최대 체력을 계산한 뒤 체력을 `min(새 최대 체력, 체력 + 20)`으로 둔다. 그 다음 offer를 비우고 페이즈를 `playing`으로 둔다.

문구:

| id | title | detail |
| --- | --- | --- |
| might | 공격력 | 공격력이 오른다 |
| haste | 연사 | 더 자주 발사한다 |
| stride | 이동 | 더 빨리 움직인다 |
| vigor | 체력 | 최대 체력이 오르고 조금 회복한다 |
| magnet | 획득 반경 | 경험치 조각을 더 멀리서 줍는다 |
| volley | 투사체 | 한 번에 쏘는 투사체가 늘어난다 |

## 난수

운영의 `random`은 mulberry32다. 시드는 서버가 만든 부호 없는 32비트 정수이고 클라이언트에 보내지 않는다.

```text
function mulberry32(seed):
  a = seed >>> 0
  return function random():
    a = (a + 0x6D2B79F5) | 0
    t = imul(a ^ (a >>> 15), 1 | a)
    t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
```

한 틱 안의 `random()` 호출 순서는 스폰의 종류, 스폰의 위치 재시도, 레벨업의 Fisher-Yates다. 테스트는 `random`을 주입할 수 있다.

## 화면

성능의 기준 장면은 스냅샷 안의 적 200과 투사체 100이다. 그 장면을 그리는 목표 프레임은 60이고, 중간 사양 폰에서의 바닥은 30이다. 자동화 테스트는 그 규모의 `step` 한 번이 반환되는 것까지다. 프레임 수는 기기에서 확인한다.

짧은 변이 월드 640을 보이도록 줌을 잡는다. 긴 변은 같은 줌으로 더 보인다. 카메라 중심은 플레이어다.

```text
zoom = min(viewportWidth, viewportHeight) / 640
screenX = (worldX - playerX) * zoom + viewportWidth / 2
screenY = (worldY - playerY) * zoom + viewportHeight / 2
```

`devicePixelRatio`는 2를 넘기지 않는다. 글꼴은 `system-ui, sans-serif`다. 외부 글꼴 요청은 없다.

| 용도 | 색 |
| --- | --- |
| 배경 | `#14161c` |
| 플레이어, 글자 | `#e8e6e3`, 글자 `#f4f1ea` |
| 보조 글자 | `#9aa0ab` |
| normal, 체력 | `#d24b4b` |
| fast | `#e0a106` |
| tank | `#6e56b8` |
| 투사체 | `#f4f1ea` |
| 조각, 경험치 | `#3dbeb3` |
| 카드 | `#222633` |
| 일시정지 덮개 | `rgba(10, 12, 16, 0.72)` |

플레이어와 적과 투사체는 원이다. 조각은 45도 회전한 정사각형이다. 조이스틱 바탕 지름은 120, 스틱 이동 반경은 48이다. 왼쪽 16px와 아래 16px에 안전 영역 inset을 더한다. 누르는 컨트롤의 한 변은 44 이상이다. 레벨업 카드 높이는 72 이상이다.

조이스틱은 `(pointer: coarse)`일 때 보인다. 키보드 이동은 항상 받는다. 키는 `KeyW`, `KeyA`, `KeyS`, `KeyD`와 화살표다. 같은 축의 반대 키는 그 축을 0으로 만든다. 키보드 벡터와 조이스틱 벡터를 더한 뒤 길이가 1을 넘으면 1로 줄여 서버에 보낸다. 이 키의 기본 스크롤은 막는다.

페이지 언어는 `ko`다. 게임 라우트는 `100dvh`이고 문서 스크롤은 없다. viewport는 `width=device-width, initial-scale=1, viewport-fit=cover`다. `maximum-scale`은 넣지 않는다. 조이스틱과 Canvas의 `touch-action`은 `none`이다.

일시정지 버튼은 항상 보인다. 문구는 페이즈 `playing`에서 `일시정지`, `paused`에서 `계속`이다. `choosing`과 `ended`에서는 비활성이다. `Escape`는 `playing`과 `paused`에서 버튼과 같은 메시지를 보낸다. `choosing`에서는 아무 일도 하지 않는다.

생존 시각은 `simMs`를 1000으로 나눈 몫을 `mm:ss`로 보여 준다.

## 저장소

```ts
type EndReason = "death" | "time_limit" | "disconnect";

interface RunStore {
  issue(input: {
    now: number;
    ipHash: string;
  }): Promise<
    | { ok: true; runId: string; token: string; expiresAt: number }
    | { ok: false; error: "rate" | "unavailable" }
  >;
  activate(input: {
    runId: string;
    token: string;
    now: number;
  }): Promise<"ok" | "reject">;
  finish(input: {
    runId: string;
    simMs: number;
    kills: number;
    level: number;
    reason: EndReason;
    now: number;
  }): Promise<"recorded" | "unrecorded">;
  read(runId: string): Promise<
    | { status: "issued" | "active" }
    | {
        status: "ended";
        simMs: number;
        kills: number;
        level: number;
        reason: EndReason;
        endedAt: number;
        recorded: boolean;
      }
    | { status: "missing" }
  >;
  board(input: { limit: number }): Promise<
    Array<{
      simMs: number;
      kills: number;
      level: number;
      endedAt: number;
      reason: EndReason;
    }>
  >;
}
```

`finish`는 같은 판에 두 번 성공하지 않는다. 두 번째는 `unrecorded`다. 쿼리는 파라미터로만 값을 넣는다.

메모리 저장소는 슬라이스 1의 구현 대상이다. 발급 제한, 만료, `activate`의 1회 성공은 Neon과 같은 규칙이다. `finish`는 `unrecorded`를 반환하고 `board`는 빈 배열이다. `read`는 프로세스 안의 발급, 활성 상태만 돌려주고, 종료 뒤에는 `missing`이다. 공식 기록이 아니다.

Neon 저장소는 슬라이스 5의 구현 대상이다. 스키마:

```sql
create table runs (
  id uuid primary key,
  token_hash char(64) not null unique,
  issue_ip_hash char(64) not null,
  status text not null check (status in ('issued', 'active', 'ended')),
  issued_at timestamptz not null,
  connected_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null,
  sim_ms integer,
  kills integer,
  level integer,
  end_reason text,
  constraint runs_end_reason check (
    end_reason is null
    or end_reason in ('death', 'time_limit', 'disconnect')
  ),
  constraint runs_ended_fields check (
    status <> 'ended'
    or (
      sim_ms is not null and sim_ms >= 0
      and kills is not null and kills >= 0
      and level is not null and level >= 1
      and end_reason is not null
      and ended_at is not null
    )
  )
);

create index runs_board
  on runs (sim_ms desc, kills desc, ended_at asc)
  where status = 'ended';

create index runs_issue_rate
  on runs (issue_ip_hash, issued_at desc);
```

열 `sim_ms`, `kills`, `level`, `end_reason`, `ended_at`은 응답의 `simMs`, `kills`, `level`, `reason`, `endedAt`이다. Neon에서 `ended`인 행의 `recorded`는 참이다. 종료에 실패해 `active`로 남은 판은 점수를 돌려주지 않는다.

활성화는 `status = 'issued'`이고 `now <= expires_at`인 행만 `active`로 바꾼다. 갱신 행 수가 0이면 `reject`다. 종료는 `status = 'active'`인 행만 점수와 함께 `ended`로 바꾼다. 갱신 행 수가 1일 때만 `recorded`다.

목록은 `ended`만, `sim_ms` 내림차순, `kills` 내림차순, `ended_at` 오름차순이다. `limit` 기본값은 20이고 1 이상 50 이하로 자른다.

`active`로 남은 행은 공식 기록이 아니다. 청소 작업은 1차 범위 밖이다.

## 종료 절차

`death`와 `time_limit`은 `finish`를 호출한 뒤 `recorded`를 넣은 종료 스냅샷을 보내고 1000으로 닫는다. `finish`가 실패하면 같은 호출을 한 번 더 한다. 두 번도 실패하면 `recorded: false`로 스냅샷을 보낸다.

소켓이 이미 끊긴 `disconnect`는 `finish`만 한다. 클라이언트는 종료 스냅샷이 없으면 마지막 생존 시간을 기록처럼 그리지 않는다. 문구는 `연결이 끊겼습니다`다. 슬라이스 5의 클라이언트는 `GET /api/runs/:id`를 한 번 호출해 `ended`이고 `recorded`가 참일 때만 공식 숫자를 보여 준다.

## 표현

결과 이유 문구: `death`는 `사망`, `time_limit`은 `시간 종료`, `disconnect`는 `연결 끊김`.

시작 버튼 문구는 `시작`이다. 발급이나 소켓이 실패하면 `시작하지 못했습니다`이고 로컬 시뮬레이션을 만들지 않는다.

토큰은 페이지 메모리에만 둔다. `localStorage`, `sessionStorage`, `IndexedDB`에 쓰지 않는다.
