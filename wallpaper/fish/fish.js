// Fish Class — Realistic Top View with Sine-wave wiggling spine and fin tucking/flaring
import { randomRange, normalizeAngle } from './utils.js';

export class Fish {
  constructor(x, y, vx, vy, radius, color = "#f0654e") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ax = 0;
    this.ay = 0;
    this.radius = radius;

    this.baseMaxSpeed = randomRange(0.4, 2.2); // Extremely wide speed spectrum for strong individual personality!

    // Movement states - each fish gets a random initial state and timer for individuality
    // Koi are highly active; we make them spawn in active swimming states most of the time
    const initRoll = Math.random();
    if (initRoll < 0.15) {
      this.state = "idle";
      this.stateTimer = Math.floor(randomRange(20, 120)); // Highly randomized initial timer offset to guarantee immediate desynchronization!
      this.targetSpeed = this.baseMaxSpeed * randomRange(0.08, 0.32); // Diverse slow starting glides
      this.currentSpeed = this.targetSpeed;
    } else if (initRoll < 0.85) {
      this.state = "swimming";
      this.stateTimer = Math.floor(randomRange(30, 300)); // Varied initial cruise durations
      this.targetSpeed = this.baseMaxSpeed * randomRange(0.4, 1.45); // Diverse initial cruise speeds
      this.currentSpeed = this.targetSpeed;
    } else {
      this.state = "prepping";
      this.stateTimer = Math.floor(randomRange(5, 25));
      this.targetSpeed = 0.0;
      this.currentSpeed = 0.0;
    }
    this.maxSpeed = this.baseMaxSpeed;
    this.wanderAngle = randomRange(0, Math.PI * 2);

    // Dynamic fin and spine wiggling state
    this.finAngle = 0.05; // current pectoral fin angle (flared/spread out at spawn)
    this.prevAngle = Math.atan2(this.vy, this.vx);
    this.drawAngle = this.prevAngle; // Smooth drawing angle tracking to prevent snaps
    this.wiggleCycle = randomRange(0, 100);
    this.driftTimer = randomRange(0, 100); // float timing for idle state
    this.smoothTurnRate = 0;
    this.reactionTimer = 0;
    this.currentTarget = null;
    this.eatCooldown = 0;
    this.currentFlare = 0.18;
    this.smoothAmpFactor = 0.04; // Smoothed amplitude — lerps toward computed target each frame to prevent abrupt wiggle snaps
    this.kickAmp = 0;   // Bilateral launch kick amplitude (decaying burst at start of movement)
    this.kickPhase = 0; // Phase of the kick oscillation

    // Joint angles for fluid serpentine skeleton follow (2 tail segments + 4 fan joints)
    this.angle1 = this.drawAngle;
    this.angle2 = this.drawAngle;
    this.angle3 = this.drawAngle; // Lobe joint 1
    this.angle4 = this.drawAngle; // Lobe joint 2
    this.angle5 = this.drawAngle; // Lobe joint 3
    this.angle6 = this.drawAngle; // Lobe joint 4 (tip)
    this.smoothTailDev = 0; // kept for backward compat, unused
    this.tailWorldAngle = this.drawAngle; // World-space geometric angle of the tail tip (including wiggle)

    // Bioluminescent marine color theme - Now solid Coral Koi (matching the uploaded image)
    this.color1 = color;
    this.color2 = color;
    this.tailColor = color;
    this.finColor = color;
  }

  updateColor(color) {
    this.color1 = color;
    this.color2 = color;
    this.tailColor = color;
    this.finColor = color;
  }

  // ============================================================
  // DRAW — top-down view with spine wiggles and dynamic fins
  // ============================================================

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Face direction of movement smoothly using drawAngle
    ctx.rotate(this.drawAngle);

    // Apply semi-transparent drawing style to match the overlapping vector art aesthetic exactly
    ctx.globalAlpha = 0.82;

    // Speed Ratio to control tail wiggle speed and amplitude
    const speedRatio = Math.min(1.0, this.currentSpeed / this.baseMaxSpeed);
    const turnRatio = Math.min(1.0, this.smoothTurnRate / 0.025); // Lower divisor makes fin flapping extremely active on turns

    // Dynamic body curve amplitude factor based on movement state
    let targetAmpFactor = 0.04;
    if (this.state === "swimming" || this.state === "swimming_lunge") {
      const speedDiff = Math.max(0, this.targetSpeed - this.currentSpeed);
      // speedDiff * 2.8 creates a strong initial butt-wiggle burst that naturally
      // dampens to a subtle cruise sway as the fish reaches target speed.
      targetAmpFactor = Math.min(1.6, 0.05 + speedRatio * 0.22 + speedDiff * 2.8);
    } else if (this.state === "prepping") {
      targetAmpFactor = 0.15; // Dynamic tail tension loading during wind-up prepping
    } else {
      // idle: relaxed breathing/water drift
      targetAmpFactor = 0.04;
    }

    // Smooth ampFactor: ramps up quickly at start of burst, decays slowly for a natural fade
    const ampLerpRate = targetAmpFactor > this.smoothAmpFactor ? 0.12 : 0.06;
    this.smoothAmpFactor += (targetAmpFactor - this.smoothAmpFactor) * ampLerpRate;
    const ampFactor = this.smoothAmpFactor;

    // Head size & coordinates
    const headR = this.radius * 0.58; // Very bold head circle radius to match the muscular Koi profile
    const headX = this.radius * 0.40; // Center of head circle
    // Traveling wave: originates at the TAIL (leads phase), propagates forward through body to head (lags).
    // Phase sequence: tail tip (+0.4) → mid-body (-0.3) → head (-1.2)

    // Calculate 3 interconnected tail segment positions along spine using joint angles
    const localA1 = this.angle1 - this.drawAngle;
    const localA2 = this.angle2 - this.drawAngle;

    const x1 = -this.radius * 0.85 * Math.cos(localA1);
    const y1 = -this.radius * 0.85 * Math.sin(localA1)
             + Math.sin(this.wiggleCycle - 0.3) * (this.radius * 0.19 * ampFactor); // Mid-body: follows tail wave

    const x2 = x1 - this.radius * 0.52 * Math.cos(localA2);
    const y2 = y1 - this.radius * 0.52 * Math.sin(localA2)
             + Math.sin(this.wiggleCycle + 0.4) * (this.radius * 0.30 * ampFactor)  // Normal sine wave
             + Math.sin(this.kickPhase) * (this.radius * 0.38 * this.kickAmp);      // Bilateral launch kick (decays)

    // Head lags behind the body wave — it's dragged by the spine but steers back on course
    const headY = Math.sin(this.wiggleCycle - 1.2) * (this.radius * 0.22 * ampFactor);

    // Radii of the two tail segments (tapering down very robustly to maintain block width)
    const r1 = headR * 0.88; // Broad muscular trunk base
    const r2 = headR * 0.62; // Substantial, broad tail tip

    // Calculate angle of tail fan based on segment 2 relative to segment 1
    const tailAngle = Math.atan2(y2 - y1, x2 - x1);

    // Store the true world-space geometric angle of the tail tip so update() can
    // use it as the root of the fan's kinematic chain next frame.
    this.tailWorldAngle = normalizeAngle(this.drawAngle + tailAngle);

    // Pectoral Fin — attach organically to the broad body block
    const finFlutter = Math.sin(this.wiggleCycle * 4.6) * 0.65 * turnRatio; // Energetic steering flutter
    const finYOffset = headY * 0.65 + y1 * 0.35;

    // Draw layers (fins underneath, then body, then tail fan on top)
    this._drawFins(ctx, finYOffset, finFlutter, headR);
    this._drawBody(ctx, headX, headY, headR, x1, y1, r1, x2, y2, r2);
    this._drawTailFan(ctx, x2, y2, tailAngle, r2);

    ctx.restore();
  }

  // Draws the two pectoral fins underneath the body
  _drawFins(ctx, finYOffset, finFlutter, headR) {
    // 1. Right Fin
    ctx.save();
    ctx.translate(this.radius * 0.05, finYOffset - headR * 1.02); // Positioned wide and back on the broad shoulders
    ctx.rotate(-(this.finAngle + finFlutter));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(this.radius * 0.1, -this.radius * 0.45, -this.radius * 0.3, -this.radius * 0.45);
    ctx.quadraticCurveTo(-this.radius * 0.4, -this.radius * 0.2, -this.radius * 0.2, 0);
    ctx.closePath();
    ctx.fillStyle = this.finColor;
    ctx.fill();
    ctx.restore();

    // 2. Left Fin
    ctx.save();
    ctx.translate(this.radius * 0.05, finYOffset + headR * 1.02); // Positioned wide and back on the broad shoulders
    ctx.rotate(this.finAngle + finFlutter);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(this.radius * 0.1, this.radius * 0.45, -this.radius * 0.3, this.radius * 0.45);
    ctx.quadraticCurveTo(-this.radius * 0.4, this.radius * 0.2, -this.radius * 0.2, 0);
    ctx.closePath();
    ctx.fillStyle = this.finColor;
    ctx.fill();
    ctx.restore();
  }

  // Draws the main body block, head circle, and tapered tail connector
  _drawBody(ctx, headX, headY, headR, x1, y1, r1, x2, y2, r2) {
    // 3. Body — broad, square curved rectangle joining head and tail
    ctx.beginPath();
    ctx.moveTo(headX, headY - headR);
    const controlX = (headX + x1) * 0.5; // Symmetrical midpoint for square block curves
    ctx.quadraticCurveTo(controlX, headY - headR * 1.12, x1, y1 - r1);
    ctx.lineTo(x1, y1 + r1);
    ctx.quadraticCurveTo(controlX, headY + headR * 1.12, headX, headY + headR);
    ctx.closePath();
    ctx.fillStyle = this.color1;
    ctx.fill();

    // 4. Circle Head — swayed head center overlapping the body perfectly
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.color1;
    ctx.fill();

    // 5. Tapered tail connector between segment 1 and segment 2
    const angle12 = Math.atan2(y2 - y1, x2 - x1);
    const perp12 = angle12 + Math.PI / 2;

    const x1_top = x1 + Math.cos(perp12) * r1;
    const y1_top = y1 + Math.sin(perp12) * r1;
    const x1_bot = x1 - Math.cos(perp12) * r1;
    const y1_bot = y1 - Math.sin(perp12) * r1;
    const x2_top = x2 + Math.cos(perp12) * r2;
    const y2_top = y2 + Math.sin(perp12) * r2;
    const x2_bot = x2 - Math.cos(perp12) * r2;
    const y2_bot = y2 - Math.sin(perp12) * r2;

    ctx.beginPath();
    ctx.moveTo(x1_top, y1_top);
    ctx.lineTo(x2_top, y2_top);
    ctx.lineTo(x2_bot, y2_bot);
    ctx.lineTo(x1_bot, y1_bot);
    ctx.closePath();
    ctx.fillStyle = this.color1;
    ctx.fill();

    // Joint overlap circle for Segment 1
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    ctx.fillStyle = this.color1;
    ctx.fill();

    // Segment 2 circle is omitted to let the tail fan's starting cap render directly on top
    // with zero double-transparency ghosting!
  }

  // Draws the 3-lobe tail fan with 5-segment kinematic chain per lobe
  _drawTailFan(ctx, x2, y2, tailAngle, r2) {
    const flare = this.currentFlare;

    const fanL = this.radius * 1.35; // Base length of ovals
    const fanW = this.radius * 0.55; // Wider lobes

    // Sub-segment dimensions for 5-segmented lobes — smooth taper from base to tip
    const subL1 = fanL * 0.16; const subW1 = fanW * 0.50; // Segment A — short rigid base
    const subL2 = fanL * 0.19; const subW2 = fanW * 0.70;
    const subL3 = fanL * 0.22; const subW3 = fanW * 0.92;
    const subL4 = fanL * 0.22; const subW4 = fanW * 1.15;
    const subL5 = fanL * 0.28; const subW5 = fanW * 1.45; // Wide flaring tip

    // Helper: tapered connector polygon + rounded cap at the end
    const drawTaperedSegment = (L, wStart, wEnd) => {
      ctx.beginPath();
      ctx.moveTo(0, -wStart / 2);
      ctx.lineTo(L, -wEnd / 2);
      ctx.lineTo(L, wEnd / 2);
      ctx.lineTo(0, wStart / 2);
      ctx.closePath();
      ctx.fillStyle = this.tailColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(L, 0, wEnd / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.tailColor;
      ctx.fill();
    };

    // Helper: terminal segment with a squarer flat trailing edge and slightly rounded corners
    const drawSquareEndSegment = (L, wStart, wEnd) => {
      const cornerR = wEnd * 0.18; // 18% corner rounding (beautifully soft, squarer blade corners!)
      ctx.beginPath();
      ctx.moveTo(0, -wStart / 2);
      ctx.lineTo(L - cornerR, -wEnd / 2);
      ctx.quadraticCurveTo(L, -wEnd / 2, L, -wEnd / 2 + cornerR);
      ctx.lineTo(L, wEnd / 2 - cornerR);
      ctx.quadraticCurveTo(L, wEnd / 2, L - cornerR, wEnd / 2);
      ctx.lineTo(0, wStart / 2);
      ctx.closePath();
      ctx.fillStyle = this.tailColor;
      ctx.fill();
    };

    // Helper: draws a single 5-segment lobe. Each joint bends by the angular lag
    // between consecutive chain angles — pure follow-through kinematics.
    const drawLobe = (baseAngle) => {
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(baseAngle);

      const w0 = r2 * 1.8;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const half = Math.PI / 2;

      // Local angle differences: how much each chain link lags behind the previous.
      // j1 is wrapped to [-π, π] before amplification to prevent 2π jump glitches.
      let _j1 = this.angle3 - this.tailWorldAngle;
      _j1 = normalizeAngle(_j1);
      const j1 = clamp(_j1 * 2.0, -half, half);
      const j2 = clamp((this.angle4 - this.angle3) * 2.5, -half, half);
      const j3 = clamp((this.angle5 - this.angle4) * 3.0, -half, half);
      const j4 = clamp((this.angle6 - this.angle5) * 3.5, -half, half);

      // Starting cap
      ctx.beginPath();
      ctx.arc(0, 0, w0 / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.tailColor;
      ctx.fill();

      drawTaperedSegment(subL1, w0, subW1);
      ctx.translate(subL1 * 0.85, 0);
      ctx.rotate(j1);

      drawTaperedSegment(subL2, subW1, subW2);
      ctx.translate(subL2 * 0.85, 0);
      ctx.rotate(j2);

      drawTaperedSegment(subL3, subW2, subW3);
      ctx.translate(subL3 * 0.85, 0);
      ctx.rotate(j3);

      drawTaperedSegment(subL4, subW3, subW4);
      ctx.translate(subL4 * 0.85, 0);
      ctx.rotate(j4);

      drawSquareEndSegment(subL5, subW4, subW5);

      ctx.restore();
    };

    // Fan lobes follow the tail geometry — no independent sine drive
    drawLobe(tailAngle - flare);
    drawLobe(tailAngle);
    drawLobe(tailAngle + flare);
  }

  // ============================================================
  // UPDATE — called every frame; drives the full fish simulation
  // ============================================================

  update(canvas, foods, mouse, mouseIdleFrames) {
    if (this.eatCooldown > 0) this.eatCooldown--;

    // ① State machine — handles transitions between idle/prepping/swimming/lunge
    this._tickStateMachine();

    // ② Find the nearest food pellet and check mouse proximity
    const { hasValidFood, hasValidMouse, mouseDist } = this._acquireTarget(foods, mouse, mouseIdleFrames);

    // ③ If a target is locked in, interrupt current state into a prepping lunge
    const isTargetAcquired = this.currentTarget !== null && this.reactionTimer <= 0;
    if (isTargetAcquired && this.state !== "prepping" && this.state !== "swimming_lunge") {
      this.state = "prepping";
      this.stateTimer = Math.floor(randomRange(10, 18));
      this.targetSpeed = 0.0;
    }

    // ④ Adjust target speed based on current state and active target type
    this._applyTargetSpeed(hasValidFood, hasValidMouse);

    // ⑤ Smoothly accelerate toward target speed
    const speedDiff = this.targetSpeed - this.currentSpeed;
    const accelRate = speedDiff < 0 ? 0.03 : (hasValidFood || mouseDist < 250 ? 0.1 : 0.07);
    this.currentSpeed += speedDiff * accelRate;

    // ⑥ Steer toward target / wander + boundary avoidance
    this._steer(canvas, mouse);

    // ⑦ Advance position and bounce off walls
    this._moveAndPhysics(canvas);

    // ⑧ Update tail joints, wiggle cycle, fins and tail fan flare
    this._updateJointsAndFins(speedDiff);
  }

  // Handles all state transitions (idle ↔ prepping ↔ swimming ↔ swimming_lunge)
  _tickStateMachine() {
    // Spontaneous random acceleration bursts while cruising to keep the school organic
    if (this.state === "swimming") {
      if (Math.random() < 0.0035) { // ~0.35% chance per frame (~once every 5 seconds per fish)
        this.state = "swimming_lunge";
        this.stateTimer = Math.floor(randomRange(40, 80)); // Energetic burst duration
        this.targetSpeed = this.baseMaxSpeed * randomRange(1.6, 2.7); // Highly energetic spontaneous lunge bursts!
      }
    }

    this.stateTimer--;
    if (this.stateTimer <= 0) {
      const roll = Math.random();

      if (this.state === "swimming") {
        if (roll < 0.80) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 450)); // Extremely wide variation in cruise durations
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.4, 1.55); // Wide-spectrum cruising speeds
        } else if (roll < 0.92) {
          this.state = "prepping";
          this.stateTimer = Math.floor(randomRange(6, 18));
          this.targetSpeed = 0.0;
        } else {
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 150)); // Very variable rest times
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.08, 0.35); // Super soft resting glide speeds
        }
      } else if (this.state === "swimming_lunge") {
        if (roll < 0.85) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 350));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.4, 1.4); // Recover to diverse speeds
        } else {
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 120));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.08, 0.35);
        }
      } else if (this.state === "idle") {
        if (roll < 0.90) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 350));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.5, 1.5);
        } else {
          this.state = "prepping";
          this.stateTimer = Math.floor(randomRange(8, 20));
          this.targetSpeed = 0.0;
        }
      } else if (this.state === "prepping") {
        // Prepping wind-up complete: initiate active acceleration
        if (this.currentTarget) {
          this.state = "swimming_lunge";
          this.stateTimer = Math.floor(randomRange(50, 100));
          this.targetSpeed = this.baseMaxSpeed * 2.5; // Intense speed lunge towards target!
        } else {
          // 50% chance of a high-speed lunge kick, 50% chance of standard cruising
          if (Math.random() < 0.5) {
            this.state = "swimming_lunge";
            this.stateTimer = Math.floor(randomRange(40, 90));
            this.targetSpeed = this.baseMaxSpeed * 2.0; // Spontaneous lunge sprint!
          } else {
            this.state = "swimming";
            this.stateTimer = Math.floor(randomRange(80, 300));
            this.targetSpeed = this.baseMaxSpeed * 1.35;
          }
        }
        this.prevAngle = this.drawAngle;
        // Fire the bilateral launch kick — rapid L-R sweep before settling into sine wave
        this.kickAmp = 1.2;
        this.kickPhase = 0;
      }
    }
  }

  // Finds the nearest food / active mouse cursor and locks on as the current target
  _acquireTarget(foods, mouse, mouseIdleFrames) {
    // Invalidate stale food targets that have been eaten by other fish
    if (this.currentTarget && this.currentTarget !== "mouse") {
      if (!foods.includes(this.currentTarget)) {
        this.currentTarget = null;
      }
    }

    // Find nearest food pellet
    let nearestFood = null;
    let minDist = Infinity;
    if (this.eatCooldown <= 0) {
      for (let i = 0; i < foods.length; i++) {
        const dist = Math.hypot(foods[i].x - this.x, foods[i].y - this.y);
        if (dist < minDist) {
          minDist = dist;
          nearestFood = foods[i];
        }
      }
    }

    const mouseActive = mouse.x !== undefined && mouse.y !== undefined;
    const mouseDist = mouseActive ? Math.hypot(mouse.x - this.x, mouse.y - this.y) : Infinity;
    const mouseMoving = mouseActive && mouseIdleFrames < 120;

    const hasValidFood = nearestFood !== null;
    const hasValidMouse = mouseActive && mouseDist < 250 && mouseMoving;

    if (hasValidFood || hasValidMouse) {
      const potentialTarget = hasValidFood ? nearestFood : "mouse";
      if (this.currentTarget === null) {
        this.currentTarget = potentialTarget;
        this.reactionTimer = Math.floor(randomRange(15, 40));
      }
    } else {
      this.currentTarget = null;
      this.reactionTimer = 0;
    }

    if (this.reactionTimer > 0) this.reactionTimer--;

    return { nearestFood, hasValidFood, hasValidMouse, mouseDist };
  }

  // Overrides target speed when actively chasing food or mouse
  _applyTargetSpeed(hasValidFood, hasValidMouse) {
    if (this.state === "prepping") {
      this.targetSpeed = 0.0;
    } else if (this.state === "swimming_lunge") {
      if (hasValidFood) {
        this.targetSpeed = this.baseMaxSpeed * 1.8;
      } else if (hasValidMouse) {
        this.targetSpeed = this.baseMaxSpeed * 1.5;
      }
    }
  }

  // Computes target heading, blends in boundary avoidance, and rotates drawAngle smoothly
  _steer(canvas, mouse) {
    let targetAngle = this.drawAngle;

    if (this.state === "prepping") {
      let tx, ty;
      if (this.currentTarget === "mouse") {
        tx = mouse.x; ty = mouse.y;
      } else if (this.currentTarget) {
        tx = this.currentTarget.x; ty = this.currentTarget.y;
      }
      if (tx !== undefined && ty !== undefined) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 25) { // Stop micro-shaking by avoiding aggressive target re-orientation when close
          targetAngle = Math.atan2(dy, dx);
        } else {
          targetAngle = this.drawAngle;
        }
      } else {
        targetAngle = this.wanderAngle;
      }
    } else if (this.state === "swimming_lunge" && this.currentTarget) {
      let tx, ty;
      if (this.currentTarget === "mouse") {
        tx = mouse.x; ty = mouse.y;
      } else {
        tx = this.currentTarget.x; ty = this.currentTarget.y;
      }
      if (tx !== undefined && ty !== undefined) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 25) { // Stop micro-shaking by avoiding aggressive target re-orientation when close
          targetAngle = Math.atan2(dy, dx);
        } else {
          targetAngle = this.drawAngle;
        }
      }
    } else if (this.state === "swimming") {
      this.wanderAngle += randomRange(-0.008, 0.008); // Majestic long-curve cruising path
      targetAngle = this.wanderAngle;
    } else {
      // idle: very slow, gentle direction drift
      this.wanderAngle += randomRange(-0.002, 0.002);
      targetAngle = this.wanderAngle;
    }

    // ========== BOUNDARY AVOIDANCE STEERING ==========
    const margin = 120;
    let avoidX = 0, avoidY = 0;
    if (this.x < margin) {
      avoidX += (margin - this.x) / margin;
    } else if (this.x > canvas.width - margin) {
      avoidX -= (this.x - (canvas.width - margin)) / margin;
    }
    if (this.y < margin) {
      avoidY += (margin - this.y) / margin;
    } else if (this.y > canvas.height - margin) {
      avoidY -= (this.y - (canvas.height - margin)) / margin;
    }

    const avoidMag = Math.hypot(avoidX, avoidY);
    if (avoidMag > 0.01) {
      const avoidAngle = Math.atan2(avoidY, avoidX);
      const blend = Math.min(0.85, avoidMag);
      const steerCos = Math.cos(targetAngle) * (1 - blend) + Math.cos(avoidAngle) * blend;
      const steerSin = Math.sin(targetAngle) * (1 - blend) + Math.sin(avoidAngle) * blend;
      targetAngle = Math.atan2(steerSin, steerCos);
      this.wanderAngle = targetAngle; // Keep wander heading aligned with avoidance
    }

    // ========== ROTATE DRAW ANGLE SMOOTHLY ==========
    // Proportional steering control (P-controller) scales turn speed down when diff is small
    // to align target headings smoothly and completely prevent micro-shaking and overshoot oscillations!
    let diff = normalizeAngle(targetAngle - this.drawAngle);

    let maxTurn = 0.035;
    if (this.state === "prepping")         maxTurn = 0.06;
    else if (this.state === "swimming_lunge") maxTurn = 0.085;
    else if (this.state === "swimming")    maxTurn = 0.048;

    const targetTurn = diff * 0.15;
    const clampedBodyDiff = Math.max(-maxTurn, Math.min(maxTurn, targetTurn));
    this.drawAngle += clampedBodyDiff;
    this.prevAngle = this.drawAngle;

    // Smooth turn rate indicator (used by fin flutter in draw())
    const rawTurn = Math.abs(clampedBodyDiff);
    this.smoothTurnRate = (this.smoothTurnRate || 0) * 0.82 + rawTurn * 0.18;
  }

  // Blends velocity toward heading, advances position, and bounces off canvas edges
  _moveAndPhysics(canvas) {
    // Since fish cannot swim backwards, velocity is smoothly blended towards the desired heading
    // and speed, which allows physical impulses from collisions to resolve naturally.
    const desiredVx = this.currentSpeed > 0.01 ? Math.cos(this.drawAngle) * this.currentSpeed : 0;
    const desiredVy = this.currentSpeed > 0.01 ? Math.sin(this.drawAngle) * this.currentSpeed : 0;

    // Smoothly blend physical velocity towards desired swimming velocity
    // (13% blend rate — softer than 18% to prevent snappy positional jumps)
    this.vx += (desiredVx - this.vx) * 0.13;
    this.vy += (desiredVy - this.vy) * 0.13;

    this.x += this.vx;
    this.y += this.vy;

    // Emergency position reset if they somehow become NaN
    if (isNaN(this.x) || isNaN(this.y)) {
      this.x = randomRange(this.radius, canvas.width - this.radius);
      this.y = randomRange(this.radius, canvas.height - this.radius);
    }

    // Boundary Collisions — bounce off window edges with radius offset.
    // Since we have smart boundary steering, this acts as a robust physical fallback.
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.wanderAngle = 0;
      this.drawAngle = 0; // Prevent wall jitter by instantly aligning heading!
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.wanderAngle = Math.PI;
      this.drawAngle = Math.PI;
      this.vx = -Math.abs(this.vx);
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.wanderAngle = Math.PI / 2;
      this.drawAngle = Math.PI / 2;
      this.vy = Math.abs(this.vy);
    } else if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      this.wanderAngle = -Math.PI / 2;
      this.drawAngle = -Math.PI / 2;
      this.vy = -Math.abs(this.vy);
    }
  }

  // Updates tail joint lag, wiggle cycle, bilateral kick, pectoral fin angle, and tail fan flare
  _updateJointsAndFins(speedDiff) {
    // Joint angle lag updates for smooth serpentine skeleton follow.
    // normalizeAngle replaces the repeated while-loop pairs from the original code.
    this.angle1 += normalizeAngle(this.drawAngle - this.angle1) * 0.35;      // Rigid base attached to body
    this.angle2 += normalizeAngle(this.angle1 - this.angle2) * 0.12;         // Fluid lag for tail tip
    this.angle3 += normalizeAngle(this.tailWorldAngle - this.angle3) * 0.30; // Fan root: responsive but not rigid
    this.angle4 += normalizeAngle(this.angle3 - this.angle4) * 0.18;         // Lobe joint 2
    this.angle5 += normalizeAngle(this.angle4 - this.angle5) * 0.14;         // Lobe joint 3
    this.angle6 += normalizeAngle(this.angle5 - this.angle6) * 0.10;         // Lobe joint 4 — tip trails most

    // Wiggle cycle frequency: fast burst at start of movement (high accelSpeedDiff),
    // decays to cruise rate as fish reaches speed
    const accelSpeedDiff = Math.max(0, this.targetSpeed - this.currentSpeed);
    const freqIncrement = Math.min(0.20, this.currentSpeed * 0.035 + accelSpeedDiff * 0.18 + 0.008);
    this.wiggleCycle += freqIncrement;

    // Bilateral kick: advance phase quickly and decay amplitude each frame
    this.kickPhase += 0.28;   // One full L-R cycle in ~22 frames
    this.kickAmp   *= 0.94;   // Fades to ~5% after ~50 frames
    if (this.kickAmp < 0.005) this.kickAmp = 0; // Clean cutoff

    // ========== PECTORAL FIN ANGLE ==========
    const speedRatio = Math.min(1.0, this.currentSpeed / this.baseMaxSpeed);
    const turnRatio  = Math.min(1.0, this.smoothTurnRate / 0.025); // Lower divisor makes fin flapping extremely active on turns

    let desiredFinAngle = 0.05; // Default: fully flared
    if (this.currentSpeed <= 0.08) {
      desiredFinAngle = 0.05;
    } else if (speedDiff > 0.01) {
      desiredFinAngle = 0.95; // Snap pin during acceleration
    } else if (speedDiff < -0.01) {
      desiredFinAngle = 0.05; // Flare for braking
    } else {
      desiredFinAngle = 0.1 + speedRatio * 0.6;
    }

    if (this.currentSpeed > 0.08 && speedDiff <= 0.01 && turnRatio > 0.05) {
      desiredFinAngle = desiredFinAngle * (1.0 - turnRatio) + 0.0 * turnRatio;
    }

    const finRate = speedDiff > 0.01 ? 0.35 : 0.1;
    this.finAngle += (desiredFinAngle - this.finAngle) * finRate;

    // ========== TAIL FAN FLARE ==========
    const targetFlare = this.state === "idle" ? 1.0 : 0.72;
    this.currentFlare += (targetFlare - this.currentFlare) * 0.1;
  }
}
