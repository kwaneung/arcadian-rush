# Arcadian Rush

모바일 우선이고 데스크톱에서도 되는 뱀파이어 서바이버류 웹 게임이다. 브라우저는 서버가 보낸 스냅샷을 그린다. 공격력, 체력, 난수, 레벨업 후보는 서버만 가진다.

스펙은 잠겼다.

- [헌법](docs/constitution.md)
- [스펙 목록](docs/specs/README.md)
- [슬라이스 1 구현](docs/plans/01-control.md)

## 로컬

```bash
npm test
npm run dev
```

`npm run dev`는 페이지와 웹소켓을 한 프로세스에서 연다. 배포된 Vercel에서는 `/api/runs/socket`이 `upgradeWebSocket`으로 같은 세션 코드를 쓴다.
