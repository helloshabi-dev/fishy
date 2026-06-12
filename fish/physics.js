// Physics functions — fish-to-fish collision resolution and feeding
import { randomRange } from './utils.js';

// Resolves fish-to-fish collisions: faster fish (the pusher) pushes the slower/stationary fish
// and slides smoothly around it rather than bouncing backward elastically.
export function resolveCollisions(fishes) {
  for (let i = 0; i < fishes.length; i++) {
    for (let j = i + 1; j < fishes.length; j++) {
      const f1 = fishes[i];
      const f2 = fishes[j];

      const dx = f2.x - f1.x;
      const dy = f2.y - f1.y;
      const distSq = dx * dx + dy * dy;
      const minDist = f1.radius + f2.radius;

      if (distSq < minDist * minDist) {
        let dist = Math.sqrt(distSq);
        if (dist === 0 || isNaN(dist)) {
          dist = 0.1; // Prevent division by zero
        }

        const overlap = minDist - dist;
        const nx = (dx / dist) || 1;
        const ny = (dy / dist) || 0;

        // Determine pusher based on speeds
        const s1 = f1.currentSpeed;
        const s2 = f2.currentSpeed;
        const totalSpeed = s1 + s2;
        const ratio = totalSpeed > 0.05 ? s1 / totalSpeed : 0.5;

        // 1. Soft overlap separation push biased by relative speed
        // Slower fish gets pushed away more than the faster fish
        f1.x += -nx * overlap * (1 - ratio);
        f1.y += -ny * overlap * (1 - ratio);
        f2.x +=  nx * overlap * ratio;
        f2.y +=  ny * overlap * ratio;

        // 2. Momentum transfer: faster fish pushes the slower fish and slides around it
        if (s1 > s2) {
          // f1 pushes f2
          const pushForce = Math.max(0.3, s1 * 0.85);
          f2.vx += nx * pushForce;
          f2.vy += ny * pushForce;
          f2.currentSpeed = Math.hypot(f2.vx, f2.vy);
          if (f2.currentSpeed > f2.maxSpeed * 1.5) {
            f2.vx = (f2.vx / f2.currentSpeed) * f2.maxSpeed * 1.5;
            f2.vy = (f2.vy / f2.currentSpeed) * f2.maxSpeed * 1.5;
            f2.currentSpeed = f2.maxSpeed * 1.5;
          }
          f2.wanderAngle = Math.atan2(f2.vy, f2.vx);

          // f1 slides tangentially around f2
          const tx = -ny;
          const ty = nx;
          const dot = f1.vx * tx + f1.vy * ty;
          const tangentSign = dot >= 0 ? 1 : -1;
          f1.vx += tx * tangentSign * s1 * 0.35;
          f1.vy += ty * tangentSign * s1 * 0.35;
          const newSpeed = Math.hypot(f1.vx, f1.vy);
          if (newSpeed > 0) {
            f1.vx = (f1.vx / newSpeed) * s1;
            f1.vy = (f1.vy / newSpeed) * s1;
          }
          f1.wanderAngle = Math.atan2(f1.vy, f1.vx);
        } else {
          // f2 pushes f1
          const pushForce = Math.max(0.3, s2 * 0.85);
          f1.vx -= nx * pushForce;
          f1.vy -= ny * pushForce;
          f1.currentSpeed = Math.hypot(f1.vx, f1.vy);
          if (f1.currentSpeed > f1.maxSpeed * 1.5) {
            f1.vx = (f1.vx / f1.currentSpeed) * f1.maxSpeed * 1.5;
            f1.vy = (f1.vy / f1.currentSpeed) * f1.maxSpeed * 1.5;
            f1.currentSpeed = f1.maxSpeed * 1.5;
          }
          f1.wanderAngle = Math.atan2(f1.vy, f1.vx);

          // f2 slides tangentially around f1
          const tx = -ny;
          const ty = nx;
          const dot = f2.vx * tx + f2.vy * ty;
          const tangentSign = dot >= 0 ? 1 : -1;
          f2.vx += tx * tangentSign * s2 * 0.35;
          f2.vy += ty * tangentSign * s2 * 0.35;
          const newSpeed = Math.hypot(f2.vx, f2.vy);
          if (newSpeed > 0) {
            f2.vx = (f2.vx / newSpeed) * s2;
            f2.vy = (f2.vy / newSpeed) * s2;
          }
          f2.wanderAngle = Math.atan2(f2.vy, f2.vx);
        }
      }
    }
  }
}

// Handles fishes eating food pellets
export function checkFeeding(fishes, foods) {
  for (let i = fishes.length - 1; i >= 0; i--) {
    const fish = fishes[i];

    // Only check feeding if the fish is not on eating cooldown
    if (fish.eatCooldown > 0) continue;

    for (let j = foods.length - 1; j >= 0; j--) {
      const food = foods[j];
      const dist = Math.hypot(fish.x - food.x, fish.y - food.y);

      // Check eating bounds
      if (dist < fish.radius + food.radius) {
        // Remove food pellet (only one per frame per fish to prevent instant stacked food swallow)
        foods.splice(j, 1);
        // Set eating cooldown (3 to 5 seconds at 60 FPS) to give other fish a chance!
        fish.eatCooldown = Math.floor(randomRange(180, 300));
        
        // Trigger snatch movement
        if (typeof fish.triggerSnatch === 'function') {
          fish.triggerSnatch();
        }
        break;
      }
    }
  }
}
