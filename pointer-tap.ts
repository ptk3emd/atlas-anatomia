/** Distinguish a tap/click from an orbit, pinch, or drag gesture. */
export class PointerTap {
 private active = new Map<number, { x: number; y: number; threshold: number; time: number }>();
 private blocked = false;

 down(id: number, x: number, y: number, threshold = 16) {
  if (this.active.size === 0) this.blocked = false;
  this.active.set(id, { x, y, threshold, time: performance.now() });
  if (this.active.size > 1) this.blocked = true;
 }

 move(id: number, x: number, y: number) {
  const start = this.active.get(id);
  if (start && Math.hypot(x - start.x, y - start.y) > start.threshold) {
   this.blocked = true;
  }
 }

 up(id: number, x: number, y: number) {
  this.move(id, x, y);
  const start = this.active.get(id);
  const tap = !!start && this.active.size === 1 && !this.blocked;
  this.active.delete(id);
  return tap;
 }

 cancel(id: number) {
  this.active.delete(id);
  this.blocked = true;
 }
}

