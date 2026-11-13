import type { Snapshot } from "@/shared/protocol";

const VIEW_SHORT = 640;
const WORLD_HALF = 800;

export function paintArena(
  canvas: HTMLCanvasElement,
  snapshot: Snapshot | null,
): void {
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "#14161c";
  context.fillRect(0, 0, width, height);
  if (!snapshot) return;

  const zoom = Math.min(width, height) / VIEW_SHORT;
  const toX = (worldX: number) => (worldX - snapshot.player.x) * zoom + width / 2;
  const toY = (worldY: number) => (worldY - snapshot.player.y) * zoom + height / 2;
  context.strokeStyle = "#9aa0ab";
  context.strokeRect(toX(-WORLD_HALF), toY(-WORLD_HALF), WORLD_HALF * 2 * zoom, WORLD_HALF * 2 * zoom);
  context.fillStyle = "#e8e6e3";
  context.beginPath();
  context.arc(width / 2, height / 2, snapshot.player.radius * zoom, 0, Math.PI * 2);
  context.fill();
}
