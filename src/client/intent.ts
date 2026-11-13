import { clampIntent } from "@/shared/protocol";

const LEFT = ["KeyA", "ArrowLeft"] as const;
const RIGHT = ["KeyD", "ArrowRight"] as const;
const UP = ["KeyW", "ArrowUp"] as const;
const DOWN = ["KeyS", "ArrowDown"] as const;

export const MOVEMENT_KEYS = new Set<string>([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export function keyboardVector(pressed: ReadonlySet<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (LEFT.some((key) => pressed.has(key))) x -= 1;
  if (RIGHT.some((key) => pressed.has(key))) x += 1;
  if (UP.some((key) => pressed.has(key))) y -= 1;
  if (DOWN.some((key) => pressed.has(key))) y += 1;
  return { x, y };
}

export function combineIntent(
  keyboard: { x: number; y: number },
  joystick: { x: number; y: number },
): { x: number; y: number } {
  return clampIntent(keyboard.x + joystick.x, keyboard.y + joystick.y) ?? { x: 0, y: 0 };
}

export function formatSim(simMs: number): string {
  const totalSeconds = Math.floor(simMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
