/**
 * The bridge between "something asked for a cast" and the live viewport.
 *
 * Abilities need a scene, a light pool, a particle engine and the rest of the
 * shared services, and those only exist once the viewport has mounted. Anything
 * outside the canvas -- a Copilot tool, a panel button, a hotkey -- therefore
 * cannot cast directly; it queues a request here and the viewport drains it on
 * its next frame.
 *
 * Queuing rather than calling also means a request made before the viewport is
 * ready is honoured a moment later instead of being dropped, which is what
 * happens when Copilot casts as the first thing it does in a fresh session.
 */

import type { ElementId } from "@blud/vfx";

export type VfxCastRequest = {
  element: ElementId;
  /** Ground-plane origin of the cast, world metres. */
  origin: { x: number; y: number; z: number };
  /** Flat heading. Normalised by the ability; need not be unit here. */
  direction: { x: number; z: number };
  /** How far the cast reaches, metres. */
  distance: number;
};

export type VfxCastOutcome = {
  element: ElementId;
  accepted: boolean;
  reason?: string;
};

const queue: VfxCastRequest[] = [];
let viewportReady = false;

/** Requests a cast. Safe before the viewport exists. */
export function requestVfxCast(request: VfxCastRequest): VfxCastOutcome {
  // A runaway loop of casts is worse than a dropped one: each spawns geometry,
  // particles and a dynamic light, and the manager only retires them on its own
  // schedule.
  if (queue.length >= 16) {
    return { element: request.element, accepted: false, reason: "Cast queue is full; wait for the current casts to finish." };
  }
  queue.push(request);
  return { element: request.element, accepted: true };
}

/** Drained by the viewport once per frame. */
export function drainVfxCasts(): VfxCastRequest[] {
  if (queue.length === 0) return [];
  return queue.splice(0, queue.length);
}

export function setVfxViewportReady(ready: boolean): void {
  viewportReady = ready;
  if (!ready) queue.length = 0;
}

export function isVfxViewportReady(): boolean {
  return viewportReady;
}
