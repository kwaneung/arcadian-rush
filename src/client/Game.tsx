"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { combineIntent, formatSim, keyboardVector, MOVEMENT_KEYS } from "@/client/intent";
import { paintArena } from "@/client/paint";
import { parseSnapshot, type Snapshot } from "@/shared/protocol";

type Phase = "idle" | "connecting" | "live" | "failed";

export function Game() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const generationRef = useRef(0);
  const intentRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      paintArena(canvas, snapshotRef.current);
      frame = window.requestAnimationFrame(draw);
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function publishIntent(): void {
    const vector = combineIntent(keyboardVector(keysRef.current), joystickRef.current);
    intentRef.current = vector;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "move", x: vector.x, y: vector.y }));
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const vector = intentRef.current;
      socket.send(JSON.stringify({ type: "move", x: vector.x, y: vector.y }));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!MOVEMENT_KEYS.has(event.code)) return;
      event.preventDefault();
      keysRef.current.add(event.code);
      publishIntent();
    }
    function onKeyUp(event: KeyboardEvent): void {
      if (!MOVEMENT_KEYS.has(event.code)) return;
      event.preventDefault();
      keysRef.current.delete(event.code);
      publishIntent();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function setJoystick(vector: { x: number; y: number }, pixel: { x: number; y: number }): void {
    joystickRef.current = vector;
    setKnob(pixel);
    publishIntent();
  }

  async function start(): Promise<void> {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    socketRef.current?.close();
    socketRef.current = null;
    setPhase("connecting");
    setSnapshot(null);
    try {
      const response = await fetch("/api/runs", { method: "POST" });
      if (!response.ok) throw new Error("issue failed");
      const body = (await response.json()) as { runId?: unknown; token?: unknown };
      if (typeof body.runId !== "string" || typeof body.token !== "string") {
        throw new Error("issue failed");
      }
      if (generationRef.current !== generation) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/api/runs/socket`);
      socketRef.current = socket;
      let sawSnapshot = false;
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "hello", runId: body.runId, token: body.token }));
      });
      socket.addEventListener("message", (event) => {
        if (generationRef.current !== generation || typeof event.data !== "string") return;
        const next = parseSnapshot(event.data);
        if (!next) return;
        sawSnapshot = true;
        setSnapshot(next);
        setPhase("live");
      });
      socket.addEventListener("close", () => {
        if (generationRef.current !== generation) return;
        socketRef.current = null;
        if (!sawSnapshot) {
          setSnapshot(null);
          setPhase("failed");
        }
      });
    } catch {
      if (generationRef.current !== generation) return;
      setSnapshot(null);
      setPhase("failed");
    }
  }

  const player = snapshot?.player;

  return (
    <main className="game">
      <canvas ref={canvasRef} className="arena" aria-label="전장" />
      <header className="hud">
        <div className="meters">
          <p>체력 {player ? `${player.hp}/${player.maxHp}` : "—"}</p>
          <div className="bar hp" aria-hidden="true">
            <span style={{ width: player ? `${(player.hp / player.maxHp) * 100}%` : "0%" }} />
          </div>
          <p>경험치 {player ? `${player.xp}/${player.xpToNext}` : "—"}</p>
          <div className="bar xp" aria-hidden="true">
            <span
              style={{
                width: player && player.xpToNext > 0 ? `${(player.xp / player.xpToNext) * 100}%` : "0%",
              }}
            />
          </div>
          <p data-testid="sim-time">생존 {player ? formatSim(snapshot.simMs) : "—"}</p>
        </div>
        <button type="button" className="pause" disabled>
          일시정지
        </button>
      </header>
      {coarse ? (
        <div
          className="joystick"
          aria-label="이동"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointJoystick(event, setJoystick);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            pointJoystick(event, setJoystick);
          }}
          onPointerUp={() => setJoystick({ x: 0, y: 0 }, { x: 0, y: 0 })}
          onPointerCancel={() => setJoystick({ x: 0, y: 0 }, { x: 0, y: 0 })}
        >
          <span className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : null}
      {phase === "live" ? null : (
        <div className="gate">
          {phase === "failed" ? <p>시작하지 못했습니다</p> : null}
          <button type="button" onClick={() => void start()} disabled={phase === "connecting"}>
            시작
          </button>
        </div>
      )}
    </main>
  );
}

function pointJoystick(
  event: ReactPointerEvent<HTMLDivElement>,
  setJoystick: (vector: { x: number; y: number }, pixel: { x: number; y: number }) => void,
): void {
  const rect = event.currentTarget.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const travel = 48;
  const length = Math.hypot(dx, dy);
  const scale = length > travel ? travel / length : 1;
  const pixel = { x: dx * scale, y: dy * scale };
  setJoystick(combineIntent({ x: 0, y: 0 }, { x: pixel.x / travel, y: pixel.y / travel }), pixel);
}
