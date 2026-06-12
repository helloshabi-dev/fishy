// Physics functions — fish-to-fish collision resolution and feeding
import { randomRange, normalizeAngle } from './utils.js';
import { Ripple } from './ripple.js';

// Resolves fish-to-fish collisions: faster fish (the pusher) pushes the slower/stationary fish
// and slides smoothly around it rather than bouncing backward elastically.
export function resolveCollisions(fishes, allowBreeding = true) {
  for (let i = 0; i < fishes.length; i++) {
    for (let j = i + 1; j < fishes.length; j++) {
      const f1 = fishes[i];
      const f2 = fishes[j];

      if (f1.isBreeding || f2.isBreeding) {
        continue;
      }

      const dx = f2.x - f1.x;
      const dy = f2.y - f1.y;
      const distSq = dx * dx + dy * dy;
      const minDist = f1.radius + f2.radius;

      if (distSq < minDist * minDist) {
        // Check for breeding
        const isOppositeGender = (f1.gender === 'male' && f2.gender === 'female') || (f1.gender === 'female' && f2.gender === 'male');
        if (allowBreeding &&
            isOppositeGender &&
            f1.breedingEnabled &&
            f2.breedingEnabled &&
            f1.breedingCooldown <= 0 &&
            f2.breedingCooldown <= 0 &&
            f1.isMature &&
            f2.isMature) {
          
          f1.isBreeding = true;
          f2.isBreeding = true;
          f1.breedingPartner = f2;
          f2.breedingPartner = f1;
          f1.breedingTimer = 120; // 2 seconds (120 frames at 60fps)
          f2.breedingTimer = 120;
          f1.vx = 0;
          f1.vy = 0;
          f2.vx = 0;
          f2.vy = 0;
          f1.currentSpeed = 0;
          f2.currentSpeed = 0;
          continue;
        }

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

// Handles fishes eating food pellets and pushing them
export function checkFeeding(fishes, foods, ripples) {
  for (let i = fishes.length - 1; i >= 0; i--) {
    const fish = fishes[i];

    // Check collision circles (only if defined)
    if (!fish.collisionCircles) continue;

    for (let j = foods.length - 1; j >= 0; j--) {
      const food = foods[j];

      // 1. Mouth touch (Eating)
      // The mouth is located on the front of the head
      const head = fish.collisionCircles.head;
      const distToHead = Math.hypot(food.x - head.x, food.y - head.y);
      const isTouchingHead = distToHead < head.r + food.radius;

      if (isTouchingHead) {
        const dx = food.x - head.x;
        const dy = food.y - head.y;
        const angleToFood = Math.atan2(dy, dx);
        const angleDiff = Math.abs(normalizeAngle(angleToFood - fish.drawAngle));

        // Only allow eating if within a narrow front sector (approx 34 degrees = 0.6 rad)
        if (angleDiff < 0.6 && fish.eatCooldown <= 0) {
          foods.splice(j, 1);
          fish.eatCooldown = Math.floor(randomRange(180, 300));
          
          if (typeof fish.triggerSnatch === 'function') {
            fish.triggerSnatch();
          }

          if (ripples) {
            ripples.push(new Ripple(food.x, food.y));
          }
          break; // Eat only one food per frame
        }
      }

      // 2. Body / Side of Head touch (Pushing)
      let collided = false;
      let pushCircle = null;

      // If it touches any of the collision circles (head, body, or tail segments)
      const circlesToCheck = [
        fish.collisionCircles.head,
        fish.collisionCircles.body,
        fish.collisionCircles.s1,
        fish.collisionCircles.s2,
        fish.collisionCircles.s3
      ];

      for (const circle of circlesToCheck) {
        if (!circle) continue;
        const dist = Math.hypot(food.x - circle.x, food.y - circle.y);
        if (dist < circle.r + food.radius) {
          collided = true;
          pushCircle = circle;
          break;
        }
      }

      if (collided && pushCircle) {
        const dist = Math.hypot(food.x - pushCircle.x, food.y - pushCircle.y) || 0.1;
        const overlap = pushCircle.r + food.radius - dist;
        const nx = (food.x - pushCircle.x) / dist;
        const ny = (food.y - pushCircle.y) / dist;

        // Push food pellet out of collision overlap
        food.x += nx * overlap;
        food.y += ny * overlap;

        // Apply physical momentum transfer from fish movement
        if (food.vx === undefined) food.vx = 0;
        if (food.vy === undefined) food.vy = 0;

        const fishSpeed = Math.hypot(fish.vx, fish.vy);
        const pushForce = Math.max(0.6, fishSpeed * 1.1);
        food.vx += nx * pushForce;
        food.vy += ny * pushForce;

        // Cap maximum food velocity
        const foodSpeed = Math.hypot(food.vx, food.vy);
        if (foodSpeed > 6) {
          food.vx = (food.vx / foodSpeed) * 6;
          food.vy = (food.vy / foodSpeed) * 6;
        }

        // Spawn a rate-limited water ripple on push
        if (ripples) {
          if (!food.touchCooldown || food.touchCooldown <= 0) {
            ripples.push(new Ripple(food.x, food.y));
            food.touchCooldown = 25; // 25 frames debounce cooldown
          }
        }
      }
    }
  }
}
