// Select canvas and get context
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

// Apply styles programmatically to guarantee full-screen layout without scrollbars
canvas.style.display = "block";
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#ffffff"; // Minimalist white background

// Set canvas to full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Handle window resizing smoothly
window.addEventListener("resize", function () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  init();
});

// Helper for generating random numbers in a range
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Mouse tracking state
const mouse = {
  x: undefined,
  y: undefined
};

let mouseLastX = undefined;
let mouseLastY = undefined;
let mouseIdleFrames = 0;

window.addEventListener("mousemove", function (event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

// Clear mouse when cursor leaves the window
window.addEventListener("mouseout", function () {
  mouse.x = undefined;
  mouse.y = undefined;
});

// Active systems
let fishes = [];
let foods = [];
let ripples = [];

const fishCount = 6;
const fishRadius = 24; // Base size for fishes

// Ripple class for expanding click rings
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 80;
    this.alpha = 1.0;
    this.speed = 1.8;
  }

  update() {
    this.radius += this.speed;
    this.alpha = Math.max(0, 1.0 - this.radius / this.maxRadius);
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha * 0.85})`; // Classic white expanding ripple
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }
}

// Click listener: Drops food and triggers water ripple wave
window.addEventListener("click", function (event) {
  // Spawn ripple
  ripples.push(new Ripple(event.clientX, event.clientY));

  // Spawn food pellet that floats gently in place (no shrinking, fading, or Z depth sinking)
  foods.push({
    x: event.clientX,
    y: event.clientY,
    radius: 4.5,
    color: "#8b4513", // Solid flat SaddleBrown color pellet (Abowman style)
    floatTimer: randomRange(0, 100)
  });
});

// Fish Class definition (Realistic Top View with Sine-wave wiggling spine and fin tucking/flaring)
class Fish {
  constructor(x, y, vx, vy, radius) {
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
    this.color1 = "#f0654e";     // Solid Coral Orange
    this.color2 = "#f0654e";
    this.tailColor = "#f0654e";
    this.finColor = "#f0654e";
  }

  // Draw the fish from top down with spine wiggles and dynamic fins
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

    // Dynamic body curve amplitude factor based on movement state to control wiggling
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
    // Amplitude sequence: tail (largest) → mid-body (medium) → head (smaller but visible)
    // The head is pushed around by the wave but course-corrects via drawAngle steering.

    // Calculate 3 interconnected tail segment positions along spine using joint angles
    const localA1 = this.angle1 - this.drawAngle;
    const localA2 = this.angle2 - this.drawAngle;
    const localA3 = this.angle3 - this.drawAngle;

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
    // Normalize to [-π, π] so it lives in the same space as angle3.
    let _tw = this.drawAngle + tailAngle;
    while (_tw < -Math.PI) _tw += Math.PI * 2;
    while (_tw > Math.PI) _tw -= Math.PI * 2;
    this.tailWorldAngle = _tw;

    // Pectoral Fin Flare angle
    // Draw fins underneath so body overlaps them slightly, matching the overlapping layers in image!
    // Since fins are drawn under the body, we draw them first!

    // Pectoral Fin steering dynamics: Rapid, organic out-of-phase flutter when turning to steer actively
    const finFlutter = Math.sin(this.wiggleCycle * 4.6) * 0.65 * turnRatio; // Energetic steering flutter

    // Attach fins organically to the broad body block (Interpolate local Y-sway at fin attachment point)
    const finYOffset = headY * 0.65 + y1 * 0.35;

    // 1. Draw Pectoral Fin 1 (Right Fin)
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

    // 2. Draw Pectoral Fin 2 (Left Fin)
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

    // 3. Draw Body - broad, square curved rectangle that joins head and tail
    // Width at head joint is the diameter of head (2 * headR)
    // Width at tail joint is r1 * 2
    ctx.beginPath();
    ctx.moveTo(headX, headY - headR); // Top-left of head cap (swayed)
    
    // Symmetrical midpoint along body length for perfect square block curves
    const controlX = (headX + x1) * 0.5;
    
    // Right body curve to wiggling tail segment 1 (Control points bulged outwards to 1.12 * headR for square shoulders)
    ctx.quadraticCurveTo(controlX, headY - headR * 1.12, x1, y1 - r1);
    // Across the tail joint
    ctx.lineTo(x1, y1 + r1);
    // Left body curve back to head cap
    ctx.quadraticCurveTo(controlX, headY + headR * 1.12, headX, headY + headR);
    ctx.closePath();
    ctx.fillStyle = this.color1;
    ctx.fill();

    // 4. Draw Circle Head - swayed head center overlapping the body perfectly as a solid circle
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.color1;
    ctx.fill();

    // 5. Draw 2 Interconnected Tail Segments (tapered body-like connector with rounded joints)
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

    // Connector 1-2 (Tapered tail part)
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

    // Segment 2 circle is omitted to let the tail fan's starting cap render directly on top with zero double-transparency ghosting!

    // 6. Draw Tail Fan (3-segmented lobes)
    // Tail fan flares wide when idle and narrows to a streamlined profile when swimming
    const flare = this.currentFlare;
    
    const fanL = this.radius * 1.35; // Base length of ovals
    const fanW = this.radius * 0.55; // Wider lobes

    // Sub-segment dimensions for 5-segmented lobes — smooth taper from base to tip
    const subL1 = fanL * 0.16; // Segment A — short rigid base
    const subW1 = fanW * 0.50;
    const subL2 = fanL * 0.19;
    const subW2 = fanW * 0.70;
    const subL3 = fanL * 0.22;
    const subW3 = fanW * 0.92;
    const subL4 = fanL * 0.22;
    const subW4 = fanW * 1.15;
    const subL5 = fanL * 0.28;
    const subW5 = fanW * 1.45; // Wide flaring tip

    // Helper to draw a tapered fan segment connecting x=0 to x=L
    const drawTaperedSegment = (L, wStart, wEnd) => {
      // Draw tapered connector polygon
      ctx.beginPath();
      ctx.moveTo(0, -wStart / 2);
      ctx.lineTo(L, -wEnd / 2);
      ctx.lineTo(L, wEnd / 2);
      ctx.lineTo(0, wStart / 2);
      ctx.closePath();
      ctx.fillStyle = this.tailColor;
      ctx.fill();

      // Draw rounded circle cap at the end of the segment to keep joint rounded
      ctx.beginPath();
      ctx.arc(L, 0, wEnd / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.tailColor;
      ctx.fill();
    };

    // Helper to draw the terminal fan segment with a squarer flat trailing edge and slightly rounded corners
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

    // Helper to draw a 5-segmented, tapered fan lobe with 4 progressive joints.
    // Each joint bends by the angular lag between consecutive chain angles — pure follow-through.
    const drawLobe = (baseAngle) => {
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(baseAngle);

      const w0 = r2 * 1.8;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const half = Math.PI / 2;

      // Local angle differences: how much each chain link lags behind the previous.
      // Wrapped to [-π, π] before amplification to prevent 2π jump glitches.
      let _j1 = this.angle3 - this.tailWorldAngle;
      while (_j1 < -Math.PI) _j1 += Math.PI * 2;
      while (_j1 > Math.PI) _j1 -= Math.PI * 2;
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

    ctx.restore();
  }

  // Steering force calculations toward target coordinate
  update() {
    // Decrement eat cooldown
    if (this.eatCooldown > 0) {
      this.eatCooldown--;
    }

    // ========== STATE MACHINE ==========
    // States: idle -> prepping -> swimming/swimming_lunge -> idle (loop)
    
    // Spontaneous random acceleration bursts while cruising to make the school look organic and alive
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
          // Keep swimming, pick a new elegant cruise/glide speed (no pause)
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 450)); // Extremely wide variation in cruise durations
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.4, 1.55); // Wide-spectrum cruising speeds
        } else if (roll < 0.92) {
          // Quick biological wind-up / tension for a sudden burst or acceleration
          this.state = "prepping";
          this.stateTimer = Math.floor(randomRange(6, 18)); // Shorter prepping time
          this.targetSpeed = 0.0;
        } else {
          // Brief rest / glide
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 150)); // Very variable rest times
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.08, 0.35); // Super soft resting glide speeds
        }
      } else if (this.state === "swimming_lunge") {
        if (roll < 0.85) {
          // Flow back into normal swimming cruise immediately (keep momentum!)
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 350));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.4, 1.4); // Recover to diverse speeds
        } else {
          // Brief rest after lunge
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 120));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.08, 0.35);
        }
      } else if (this.state === "idle") {
        if (roll < 0.90) {
          // Smoothly start swimming/cruising immediately
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 350));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.5, 1.5);
        } else {
          // Prep for a sudden acceleration burst
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

    // Invalidate stale food targets that have been eaten by other fish
    if (this.currentTarget && this.currentTarget !== "mouse") {
      if (!foods.includes(this.currentTarget)) {
        this.currentTarget = null;
      }
    }

    // ========== TARGET ACQUISITION ==========
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

    const mouseActive = (mouse.x !== undefined && mouse.y !== undefined);
    const mouseDist = mouseActive ? Math.hypot(mouse.x - this.x, mouse.y - this.y) : Infinity;
    const mouseMoving = (mouseActive && mouseIdleFrames < 120);

    const hasValidFood = (nearestFood !== null);
    const hasValidMouse = (mouseActive && mouseDist < 250 && mouseMoving);

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

    if (this.reactionTimer > 0) {
      this.reactionTimer--;
    }

    const isTargetAcquired = (this.currentTarget !== null && this.reactionTimer <= 0);

    if (isTargetAcquired) {
      if (this.state !== "prepping" && this.state !== "swimming_lunge") {
        this.state = "prepping";
        this.stateTimer = Math.floor(randomRange(10, 18));
        this.targetSpeed = 0.0;
      }
    }

    // ========== TARGET SPEED SETTING ==========
    if (this.state === "prepping") {
      this.targetSpeed = 0.0;
    } else if (this.state === "swimming_lunge") {
      if (hasValidFood) {
        this.targetSpeed = this.baseMaxSpeed * 1.8;
      } else if (hasValidMouse) {
        this.targetSpeed = this.baseMaxSpeed * 1.5;
      }
    }

    // ========== SMOOTH ACCELERATION ==========
    const speedDiff = this.targetSpeed - this.currentSpeed;
    const accelRate = (speedDiff < 0) ? 0.03 : ((hasValidFood || mouseDist < 250) ? 0.1 : 0.07);
    this.currentSpeed += speedDiff * accelRate;

    // ========== STEERING & ANGLE CALCULATIONS ==========
    let targetAngle = this.drawAngle;

    if (this.state === "prepping") {
      let tx, ty;
      if (this.currentTarget === "mouse") {
        tx = mouse.x;
        ty = mouse.y;
      } else if (this.currentTarget) {
        tx = this.currentTarget.x;
        ty = this.currentTarget.y;
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
        tx = mouse.x;
        ty = mouse.y;
      } else {
        tx = this.currentTarget.x;
        ty = this.currentTarget.y;
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
    let avoidX = 0;
    let avoidY = 0;
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
      let steerCos = Math.cos(targetAngle) * (1 - blend) + Math.cos(avoidAngle) * blend;
      let steerSin = Math.sin(targetAngle) * (1 - blend) + Math.sin(avoidAngle) * blend;
      targetAngle = Math.atan2(steerSin, steerCos);
      this.wanderAngle = targetAngle; // Keep wander heading aligned with avoidance
    }

    // ========== ROTATE DRAW ANGLE SMOOTHLY ==========
    let diff = targetAngle - this.drawAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    let maxTurn = 0.035;
    if (this.state === "prepping") {
      maxTurn = 0.06;
    } else if (this.state === "swimming_lunge") {
      maxTurn = 0.085;
    } else if (this.state === "swimming") {
      maxTurn = 0.048;
    }

    // Proportional steering control (P-controller) scales turn speed down when diff is small
    // to align target headings smoothly and completely prevent micro-shaking and overshoot oscillations!
    const targetTurn = diff * 0.15;
    const clampedBodyDiff = Math.max(-maxTurn, Math.min(maxTurn, targetTurn));
    this.drawAngle += clampedBodyDiff;
    this.prevAngle = this.drawAngle;

    // Smooth turn rate indicator
    const rawTurn = Math.abs(clampedBodyDiff);
    this.smoothTurnRate = (this.smoothTurnRate || 0) * 0.82 + rawTurn * 0.18;

    // ========== VELOCITY DETERMINED BY BODY HEADING ==========
    // Since fish cannot swim backwards, velocity is smoothly blended towards the desired heading and speed,
    // which allows physical impulses from collisions to resolve naturally and seamlessly.
    const desiredVx = this.currentSpeed > 0.01 ? Math.cos(this.drawAngle) * this.currentSpeed : 0;
    const desiredVy = this.currentSpeed > 0.01 ? Math.sin(this.drawAngle) * this.currentSpeed : 0;

    // Smoothly blend physical velocity towards desired swimming velocity (13% blend rate — softer than 18% to prevent snappy positional jumps)
    this.vx += (desiredVx - this.vx) * 0.13;
    this.vy += (desiredVy - this.vy) * 0.13;

    // Move fish
    this.x += this.vx;
    this.y += this.vy;

    // Joint angle lag updates for smooth serpentine skeleton follow (2 tail segments + 2 fan segments)
    let diff1 = this.drawAngle - this.angle1;
    while (diff1 < -Math.PI) diff1 += Math.PI * 2;
    while (diff1 > Math.PI) diff1 -= Math.PI * 2;
    this.angle1 += diff1 * 0.35; // Rigid base attached to body (prevents broken tail look)

    let diff2 = this.angle1 - this.angle2;
    while (diff2 < -Math.PI) diff2 += Math.PI * 2;
    while (diff2 > Math.PI) diff2 -= Math.PI * 2;
    this.angle2 += diff2 * 0.12; // Fluid lag for tail tip

    // angle3 follows the actual world-space tail tip direction (includes wiggle Y-offsets)
    // — this is the root of the fan's kinematic chain.
    let diff3 = this.tailWorldAngle - this.angle3;
    while (diff3 < -Math.PI) diff3 += Math.PI * 2;
    while (diff3 > Math.PI) diff3 -= Math.PI * 2;
    this.angle3 += diff3 * 0.30; // Fan root: responsive but not rigid

    let diff4 = this.angle3 - this.angle4;
    while (diff4 < -Math.PI) diff4 += Math.PI * 2;
    while (diff4 > Math.PI) diff4 -= Math.PI * 2;
    this.angle4 += diff4 * 0.18; // Lobe joint 2

    let diff5 = this.angle4 - this.angle5;
    while (diff5 < -Math.PI) diff5 += Math.PI * 2;
    while (diff5 > Math.PI) diff5 -= Math.PI * 2;
    this.angle5 += diff5 * 0.14; // Lobe joint 3

    let diff6 = this.angle5 - this.angle6;
    while (diff6 < -Math.PI) diff6 += Math.PI * 2;
    while (diff6 > Math.PI) diff6 -= Math.PI * 2;
    this.angle6 += diff6 * 0.10; // Lobe joint 4 — tip trails most

    // Wiggle cycle frequency: fast burst at start of movement (high accelSpeedDiff), decays to cruise rate as fish reaches speed
    const accelSpeedDiff = Math.max(0, this.targetSpeed - this.currentSpeed);
    const freqIncrement = Math.min(0.20, this.currentSpeed * 0.035 + accelSpeedDiff * 0.18 + 0.008);
    this.wiggleCycle += freqIncrement;

    // Bilateral kick: advance phase quickly and decay amplitude each frame
    this.kickPhase += 0.28;            // One full L-R cycle in ~22 frames
    this.kickAmp   *= 0.94;            // Fades to ~5% after ~50 frames
    if (this.kickAmp < 0.005) this.kickAmp = 0; // Clean cutoff

    // ========== PECTORAL FIN ANGLE ==========
    const speedRatio = Math.min(1.0, this.currentSpeed / this.baseMaxSpeed);
    const turnRatio = Math.min(1.0, this.smoothTurnRate / 0.025); // Lower divisor makes fin flapping extremely active on turns
    
    let desiredFinAngle = 0.05; // Default: fully flared
    
    if (this.currentSpeed <= 0.08) {
      desiredFinAngle = 0.05;
    } else if (speedDiff > 0.01) {
      desiredFinAngle = 0.95; // Snap pin
    } else if (speedDiff < -0.01) {
      desiredFinAngle = 0.05; // Flare braking
    } else {
      desiredFinAngle = 0.1 + speedRatio * 0.6;
    }

    if (this.currentSpeed > 0.08 && speedDiff <= 0.01 && turnRatio > 0.05) {
      desiredFinAngle = desiredFinAngle * (1.0 - turnRatio) + 0.0 * turnRatio;
    }

    const finRate = (speedDiff > 0.01) ? 0.35 : 0.1;
    this.finAngle += (desiredFinAngle - this.finAngle) * finRate;

    // ========== STATE-BASED TAIL FAN FLARING ==========
    const targetFlare = (this.state === "idle") ? 1.0 : 0.72;
    this.currentFlare += (targetFlare - this.currentFlare) * 0.1;

    // Emergency position reset if they somehow become NaN
    if (isNaN(this.x) || isNaN(this.y)) {
      this.x = randomRange(this.radius, canvas.width - this.radius);
      this.y = randomRange(this.radius, canvas.height - this.radius);
    }

    // Boundary Collisions - bounce off window edges with radius offset
    // Since we now have smart boundary steering, this acts as a robust physical fallback
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.wanderAngle = 0;
      this.drawAngle = 0; // Prevent wall jitter by instantly aligning heading!
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.wanderAngle = Math.PI;
      this.drawAngle = Math.PI; // Prevent wall jitter by instantly aligning heading!
      this.vx = -Math.abs(this.vx);
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.wanderAngle = Math.PI / 2;
      this.drawAngle = Math.PI / 2; // Prevent wall jitter by instantly aligning heading!
      this.vy = Math.abs(this.vy);
    } else if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      this.wanderAngle = -Math.PI / 2;
      this.drawAngle = -Math.PI / 2; // Prevent wall jitter by instantly aligning heading!
      this.vy = -Math.abs(this.vy);
    }
  }
}

// Resolves fish-to-fish collisions: faster fish (the pusher) pushes the slower/stationary fish
// and slides smoothly around it rather than bouncing backward elastically.
function resolveCollisions() {
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
        const shiftX1 = -nx * overlap * (1 - ratio);
        const shiftY1 = -ny * overlap * (1 - ratio);
        const shiftX2 = nx * overlap * ratio;
        const shiftY2 = ny * overlap * ratio;

        f1.x += shiftX1;
        f1.y += shiftY1;
        f2.x += shiftX2;
        f2.y += shiftY2;



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
function checkFeeding() {
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
        break;
      }
    }
  }
}

// Spawns fishes randomly with no initial overlapping
function init() {
  fishes = [];
  foods = [];
  ripples = [];

  const maxAttempts = 150;

  for (let i = 0; i < fishCount; i++) {
    let x, y, vx, vy;
    let overlapping = true;
    let attempts = 0;

    vx = randomRange(-0.8, 0.8);
    vy = randomRange(-0.8, 0.8);
    if (Math.abs(vx) < 0.15) vx = vx < 0 ? -0.4 : 0.4;
    if (Math.abs(vy) < 0.15) vy = vy < 0 ? -0.4 : 0.4;

    while (overlapping && attempts < maxAttempts) {
      overlapping = false;
      x = randomRange(fishRadius, canvas.width - fishRadius);
      y = randomRange(fishRadius, canvas.height - fishRadius);

      for (let j = 0; j < fishes.length; j++) {
        const other = fishes[j];
        const dist = Math.hypot(x - other.x, y - other.y);
        if (dist < fishRadius + other.radius + 15) {
          overlapping = true;
          break;
        }
      }
      attempts++;
    }

    fishes.push(new Fish(x, y, vx, vy, fishRadius));
  }
}

// Main Animation Loop
function animate() {
  requestAnimationFrame(animate);

  // Update mouse stationary idle frames
  if (mouse.x === mouseLastX && mouse.y === mouseLastY) {
    if (mouse.x !== undefined) {
      mouseIdleFrames++;
    }
  } else {
    mouseIdleFrames = 0;
    mouseLastX = mouse.x;
    mouseLastY = mouse.y;
  }

  // 1. Draw solid minimalist white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Update and draw water ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].draw(ctx);
    if (ripples[i].alpha <= 0) {
      ripples.splice(i, 1);
    }
  }

  // 3. Update and draw floating food pellets
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    
    // Slow circular float drift
    food.floatTimer += 0.035;
    const drawX = food.x + Math.sin(food.floatTimer) * 2.5;
    const drawY = food.y + Math.cos(food.floatTimer) * 2.5;

    // Draw solid flat pellet (no glow, no fading, no shrinking)
    ctx.save();
    ctx.beginPath();
    ctx.arc(drawX, drawY, food.radius, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.fill();
    ctx.restore();
  }

  // 4. Resolve physics & feeding
  resolveCollisions();
  checkFeeding();

  // 5. Update & draw fishes
  for (let i = 0; i < fishes.length; i++) {
    fishes[i].update();
    fishes[i].draw(ctx);
  }
}

// Run simulation
init();
animate();
