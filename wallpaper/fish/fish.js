// Fish Class — Realistic Top View with Sine-wave wiggling spine and fin tucking/flaring
import { randomRange, normalizeAngle } from "./utils.js";

export class Fish {
  constructor(x, y, vx, vy, radius, color = "#f0654e", name = "", visible = true, id = null, gender = null, breedingEnabled = true, isBred = false, isMature = true, birthTime = null, targetRadius = null, birthCity = null, birthCountryCode = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ax = 0;
    this.ay = 0;
    
    // Individuality factor for speed variance (some fish are naturally speedier than others)
    this.speedVariance = randomRange(0.85, 1.15);
    
    this.speedMultiplier = 1.0;
    this.radius = radius;
    this.targetRadius = targetRadius || radius;
    this.name = name || "";
    this.visible = visible !== false;
    this.id = id || 'fish_' + Math.random().toString(36).substr(2, 9);

    // Breeding state properties
    this.gender = gender || (Math.random() < 0.5 ? 'male' : 'female');
    this.breedingEnabled = breedingEnabled !== false;
    this.isBred = !!isBred;
    this.birthTime = birthTime || (this.isBred ? Date.now() : null);
    this.birthCity = birthCity || null;
    this.birthCountryCode = birthCountryCode || null;
    this.isMature = isMature !== false;
    
    // Evaluate initial maturity from birth timestamp
    if (this.isBred && !this.isMature && this.birthTime) {
      const elapsedDays = (Date.now() - this.birthTime) / (1000 * 60 * 60 * 24);
      this.radius = Math.min(this.targetRadius, 6 + elapsedDays * 1.0);
      if (this.radius >= this.targetRadius) {
        this.radius = this.targetRadius;
        this.isMature = true;
      }
    }
    
    this.breedingCooldown = 0;
    this.isBreeding = false;
    this.breedingPartner = null;
    this.breedingTimer = 0;

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
      this.targetSpeed = this.baseMaxSpeed * randomRange(0.3, 1.0); // Diverse initial cruise speeds
      this.currentSpeed = this.targetSpeed;
    } else {
      this.state = "prepping";
      this.stateTimer = Math.floor(randomRange(5, 25));
      this.targetSpeed = 0.0;
      this.currentSpeed = 0.0;
    }
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
    this.smoothAmpFactor = 0.04; // Lerps toward computed target each frame
    this.kickAmp = 0; // Bilateral launch kick amplitude
    this.kickPhase = 0; // Phase of the kick oscillation
    this.snatchTimer = 0; // Timer for snatching animation on eating food

    // Joint angles for fluid serpentine skeleton follow (3 tail segments + 4 fan joints)
    this.angle1 = this.drawAngle;
    this.angle2 = this.drawAngle;
    this.angle2b = this.drawAngle;
    this.angle3 = this.drawAngle + Math.PI; // Lobe joint 1
    this.angle4 = this.drawAngle + Math.PI; // Lobe joint 2
    this.angle5 = this.drawAngle + Math.PI; // Lobe joint 3
    this.angle6 = this.drawAngle + Math.PI; // Lobe joint 4 (tip)
    this.smoothTailDev = 0;
    this.tailWorldAngle = this.drawAngle + Math.PI;

    this.collisionCircles = {
      mouth: { x: this.x, y: this.y, r: this.radius * 0.3 },
      head: { x: this.x, y: this.y, r: this.radius * 0.58 },
      body: { x: this.x, y: this.y, r: this.radius * 0.75 },
      s1: { x: this.x, y: this.y, r: this.radius * 0.51 },
      s2: { x: this.x, y: this.y, r: this.radius * 0.39 },
      s3: { x: this.x, y: this.y, r: this.radius * 0.30 }
    };

    // Initialize custom color parts
    this.updateColor(color);
  }

  get radius() {
    return this._radius;
  }

  set radius(val) {
    this._radius = val;
    this.updateSpeedRange();
  }

  updateSpeedRange(multiplier = this.speedMultiplier || 1.0) {
    this.speedMultiplier = multiplier;
    // Dynamic base speed based on size (radius).
    // Smaller fish swim slower, while larger fish swim faster.
    this.baseMaxSpeed = (0.6 + 0.35 * Math.sqrt(this._radius || 12)) * (this.speedVariance || 1.0) * this.speedMultiplier;
    this.maxSpeed = this.baseMaxSpeed;
  }

  updateColor(color) {
    if (typeof color === 'object' && color !== null) {
      this.colorParts = {
        head: color.head || '#f0654e',
        body: color.body || '#f0654e',
        s1: color.s1 || '#f0654e',
        s2: color.s2 || '#f0654e',
        leftFin: color.leftFin || '#f0654e',
        rightFin: color.rightFin || '#f0654e',
        tailLeft: Array.isArray(color.tailLeft) ? [...color.tailLeft] : Array(5).fill(color.tailLeft || color.tail || '#f0654e'),
        tailCenter: Array.isArray(color.tailCenter) ? [...color.tailCenter] : Array(5).fill(color.tailCenter || color.tail || '#f0654e'),
        tailRight: Array.isArray(color.tailRight) ? [...color.tailRight] : Array(5).fill(color.tailRight || color.tail || '#f0654e')
      };
    } else {
      this.colorParts = {
        head: color,
        body: color,
        s1: color,
        s2: color,
        leftFin: color,
        rightFin: color,
        tailLeft: Array(5).fill(color),
        tailCenter: Array(5).fill(color),
        tailRight: Array(5).fill(color)
      };
    }
    this.color1 = this.colorParts.body;
    this.color2 = this.colorParts.body;
    this.tailColor = this.colorParts.tailCenter[0];
    this.finColor = this.colorParts.leftFin;
    this._thumbnailUrl = null; // Invalidate cached thumbnail
  }

  // ============================================================
  // DRAW — top-down view with spine wiggles and dynamic fins
  // ============================================================

  draw(ctx, isSettingsOpen = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Face direction of movement smoothly using drawAngle
    ctx.rotate(this.drawAngle);

    // Apply semi-transparent drawing style to match the overlapping vector art aesthetic exactly
    ctx.globalAlpha = 0.82;

    // Speed Ratio to control tail wiggle speed and amplitude
    const speedRatio = Math.min(1.0, this.currentSpeed / this.baseMaxSpeed);
    const turnRatio = Math.min(1.0, this.smoothTurnRate / 0.025); // Lower divisor makes fin flapping extremely active on turns
    // Turning fish glide — suppress tail wiggle proportional to turn sharpness
    const turnSuppression = Math.max(0.05, 1.0 - turnRatio);

    // Dynamic body curve amplitude factor based on movement state
    let targetAmpFactor = 0.04;
    if (this.state === "swimming" || this.state === "swimming_lunge") {
      const speedDiff = Math.max(0, this.targetSpeed - this.currentSpeed);
      // speedDiff * 2.8 creates a strong initial butt-wiggle burst that naturally
      // dampens to a subtle cruise sway as the fish reaches target speed.
      targetAmpFactor =
        Math.min(1.6, 0.05 + speedRatio * 0.22 + speedDiff * 2.8) *
        turnSuppression;
    } else if (this.state === "prepping") {
      targetAmpFactor = 0.15 * turnSuppression; // Dynamic tail tension loading during wind-up prepping
    } else {
      // idle: relaxed breathing/water drift
      targetAmpFactor = 0.04;
    }

    // Smooth ampFactor: ramps up quickly at start of burst, decays slowly for a natural fade
    const ampLerpRate = targetAmpFactor > this.smoothAmpFactor ? 0.12 : 0.06;
    this.smoothAmpFactor +=
      (targetAmpFactor - this.smoothAmpFactor) * ampLerpRate;
    const ampFactor = this.smoothAmpFactor;

    // Head size & coordinates
    const headR = this.radius * 0.58; // Very bold head circle radius to match the muscular Koi profile
    const headX = this.radius * 0.4; // Center of head circle
    // Traveling wave: originates at the TAIL (leads phase), propagates forward through body to head (lags).
    // Phase sequence: tail tip (+0.4) → mid-body (-0.3) → head (-1.2)

    // Calculate 4 interconnected tail segment positions along spine using joint angles
    // Incorporate the wiggle directly into the joint angles to prevent tail stretching!
    // Kick propagates through the whole spine (C-bend) with amplitude tapering toward the head
    const kickSpeedFactor = Math.min(
      1.0,
      this.currentSpeed / Math.max(0.01, this.baseMaxSpeed * 0.2),
    );
    const kickVisual =
      Math.sin(this.kickPhase) *
      this.kickAmp *
      kickSpeedFactor *
      turnSuppression;
    const wAngle1 =
      this.angle1 +
      Math.sin(this.wiggleCycle - 0.3) * (0.18 * ampFactor) +
      kickVisual * 0.22;
    const wAngle2 =
      this.angle2 +
      Math.sin(this.wiggleCycle + 0.1) * (0.38 * ampFactor) +
      kickVisual * 0.38;
    const wAngle2b =
      this.angle2b +
      Math.sin(this.wiggleCycle + 0.5) * (0.45 * ampFactor) +
      kickVisual * 0.55;

    const localA1 = wAngle1 - this.drawAngle;
    const localA2 = wAngle2 - this.drawAngle;
    const localA2b = wAngle2b - this.drawAngle;

    const x1 = -this.radius * 0.6 * Math.cos(localA1);
    const y1 = -this.radius * 0.6 * Math.sin(localA1);

    const x2 = x1 - this.radius * 0.38 * Math.cos(localA2);
    const y2 = y1 - this.radius * 0.38 * Math.sin(localA2);

    const x3 = x2 - this.radius * 0.28 * Math.cos(localA2b);
    const y3 = y2 - this.radius * 0.28 * Math.sin(localA2b);

    // Head lags behind the body wave — dragged by spine, also picks up a small kick sway
    const headY =
      Math.sin(this.wiggleCycle - 1.2) * (this.radius * 0.22 * ampFactor) +
      kickVisual * this.radius * 0.07;

    // Radii of the three tail segments (tapering down very robustly to maintain block width)
    const r1 = headR * 0.88; // Broad muscular trunk base
    const r2 = headR * 0.68; // Mid-tail width
    const r3 = headR * 0.52; // Substantial, broad tail tip

    // Calculate angle of tail fan based on segment 3 relative to segment 2
    const tailAngle = Math.atan2(y3 - y2, x3 - x2);

    // Store the true world-space geometric angle of the tail tip so update() can
    // use it as the root of the fan's kinematic chain next frame.
    this.tailWorldAngle = normalizeAngle(this.drawAngle + tailAngle);

    // Pectoral Fin — attach organically to the broad body block
    const finFlutter =
      Math.sin(this.wiggleCycle * 3.8) * (0.42 * speedRatio + 0.48 * turnRatio); // Active flapping while moving + steering flutter
    const finYOffset = headY * 0.65 + y1 * 0.35;

    // Draw layers (fins underneath, then body, then tail fan on top)
    this._drawFins(ctx, finYOffset, finFlutter, headR);
    this._drawBody(
      ctx,
      headX,
      headY,
      headR,
      x1,
      y1,
      r1,
      x2,
      y2,
      r2,
      x3,
      y3,
      r3,
    );
    this._drawTailFan(ctx, x3, y3, tailAngle, r3);

    // Update collision circles in world coordinates
    const cosA = Math.cos(this.drawAngle);
    const sinA = Math.sin(this.drawAngle);

    const headWorldX = this.x + (headX * cosA - headY * sinA);
    const headWorldY = this.y + (headX * sinA + headY * cosA);

    const mouthLocalX = headX + headR * 0.7;
    const mouthLocalY = headY;
    const mouthWorldX = this.x + (mouthLocalX * cosA - mouthLocalY * sinA);
    const mouthWorldY = this.y + (mouthLocalX * sinA + mouthLocalY * cosA);
    const mouthRadius = headR * 0.55;

    const s1WorldX = this.x + (x1 * cosA - y1 * sinA);
    const s1WorldY = this.y + (x1 * sinA + y1 * cosA);

    const s2WorldX = this.x + (x2 * cosA - y2 * sinA);
    const s2WorldY = this.y + (x2 * sinA + y2 * cosA);

    const s3WorldX = this.x + (x3 * cosA - y3 * sinA);
    const s3WorldY = this.y + (x3 * sinA + y3 * cosA);

    this.collisionCircles = {
      mouth: { x: mouthWorldX, y: mouthWorldY, r: mouthRadius },
      head: { x: headWorldX, y: headWorldY, r: headR },
      body: { x: this.x, y: this.y, r: this.radius * 0.75 },
      s1: { x: s1WorldX, y: s1WorldY, r: r1 },
      s2: { x: s2WorldX, y: s2WorldY, r: r2 },
      s3: { x: s3WorldX, y: s3WorldY, r: r3 }
    };

    ctx.restore();

    if (isSettingsOpen) {
      this._drawSettingsBadge(ctx);
    }
  }

  _drawSettingsBadge(ctx) {
    ctx.save();
    
    // Center it above the fish
    const yOffset = -this.radius - 18;
    ctx.translate(this.x, this.y + yOffset);
    
    // Choose gender symbol and color
    const genderSymbol = this.gender === 'male' ? '♂' : '♀';
    const genderColor = this.gender === 'male' ? '#60a5fa' : '#f472b6';
    
    // Breeding indicator
    const breedingSymbol = this.breedingEnabled ? '💖' : '🖤';
    
    // Text contents
    const nameStr = this.name ? this.name : 'Fish';
    const text = `${nameStr} (${genderSymbol}) ${breedingSymbol}`;
    
    // Measure text
    ctx.font = '500 11px "Outfit", sans-serif';
    const textWidth = ctx.measureText(text).width;
    
    // Capsule dimensions
    const padX = 8;
    const padY = 4;
    const rectW = textWidth + padX * 2;
    const rectH = 18;
    const rectX = -rectW / 2;
    const rectY = -rectH / 2;
    
    // Draw capsule background (glassmorphic dark theme)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    
    // Rounded rectangle path
    const r = 9; // fully rounded corners
    ctx.beginPath();
    ctx.moveTo(rectX + r, rectY);
    ctx.lineTo(rectX + rectW - r, rectY);
    ctx.arcTo(rectX + rectW, rectY, rectX + rectW, rectY + rectH, r);
    ctx.lineTo(rectX + rectW, rectY + rectH - r);
    ctx.arcTo(rectX + rectW, rectY + rectH, rectX, rectY + rectH, r);
    ctx.lineTo(rectX + r, rectY + rectH);
    ctx.arcTo(rectX, rectY + rectH, rectX, rectY, r);
    ctx.lineTo(rectX, rectY + r);
    ctx.arcTo(rectX, rectY, rectX + rectW, rectY, r);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    // Draw Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const nameWidth = ctx.measureText(nameStr + ' ').width;
    const genderWidth = ctx.measureText(' (' + genderSymbol + ')').width;
    const startX = -textWidth / 2;
    
    ctx.fillStyle = '#f1f5f9'; // main text color
    ctx.fillText(nameStr, startX, 0);
    
    ctx.fillStyle = '#cbd5e1'; // muted text for bracket
    ctx.fillText(' (', startX + nameWidth, 0);
    
    ctx.fillStyle = genderColor; // gender symbol color
    ctx.fillText(genderSymbol, startX + nameWidth + ctx.measureText(' (').width, 0);
    
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(') ', startX + nameWidth + ctx.measureText(' (').width + ctx.measureText(genderSymbol).width, 0);
    
    // Draw heart
    ctx.fillText(breedingSymbol, startX + nameWidth + genderWidth, 0);
    
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
    ctx.quadraticCurveTo(
      this.radius * 0.1,
      -this.radius * 0.45,
      -this.radius * 0.3,
      -this.radius * 0.45,
    );
    ctx.quadraticCurveTo(
      -this.radius * 0.4,
      -this.radius * 0.2,
      -this.radius * 0.2,
      0,
    );
    ctx.closePath();
    ctx.fillStyle = this.colorParts.rightFin;
    ctx.fill();
    ctx.restore();

    // 2. Left Fin
    ctx.save();
    ctx.translate(this.radius * 0.05, finYOffset + headR * 1.02); // Positioned wide and back on the broad shoulders
    ctx.rotate(this.finAngle + finFlutter);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      this.radius * 0.1,
      this.radius * 0.45,
      -this.radius * 0.3,
      this.radius * 0.45,
    );
    ctx.quadraticCurveTo(
      -this.radius * 0.4,
      -this.radius * 0.2,
      -this.radius * 0.2,
      0,
    );
    ctx.closePath();
    ctx.fillStyle = this.colorParts.leftFin;
    ctx.fill();
    ctx.restore();
  }

  // Draws the main body block, head circle, and tapered tail connectors
  _drawBody(ctx, headX, headY, headR, x1, y1, r1, x2, y2, r2, x3, y3, r3) {
    // 3. Body — broad, square curved rectangle joining head and tail
    ctx.beginPath();
    ctx.moveTo(headX, headY - headR);
    const controlX = (headX + x1) * 0.5; // Symmetrical midpoint for square block curves
    ctx.quadraticCurveTo(controlX, headY - headR * 1.12, x1, y1 - r1);
    ctx.lineTo(x1, y1 + r1);
    ctx.quadraticCurveTo(controlX, headY + headR * 1.12, headX, headY + headR);
    ctx.closePath();
    ctx.fillStyle = this.colorParts.body;
    ctx.fill();

    // 4. Circle Head — swayed head center overlapping the body perfectly
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.colorParts.head;
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
    ctx.fillStyle = this.colorParts.s1;
    ctx.fill();

    // Joint overlap circle for Segment 1
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    ctx.fillStyle = this.colorParts.s1;
    ctx.fill();

    // 6. Tapered tail connector between segment 2 and segment 3
    const angle23 = Math.atan2(y3 - y2, x3 - x2);
    const perp23 = angle23 + Math.PI / 2;

    const x2_top_c2 = x2 + Math.cos(perp23) * r2;
    const y2_top_c2 = y2 + Math.sin(perp23) * r2;
    const x2_bot_c2 = x2 - Math.cos(perp23) * r2;
    const y2_bot_c2 = y2 - Math.sin(perp23) * r2;
    const x3_top = x3 + Math.cos(perp23) * r3;
    const y3_top = y3 + Math.sin(perp23) * r3;
    const x3_bot = x3 - Math.cos(perp23) * r3;
    const y3_bot = y3 - Math.sin(perp23) * r3;

    ctx.beginPath();
    ctx.moveTo(x2_top_c2, y2_top_c2);
    ctx.lineTo(x3_top, y3_top);
    ctx.lineTo(x3_bot, y3_bot);
    ctx.lineTo(x2_bot_c2, y2_bot_c2);
    ctx.closePath();
    ctx.fillStyle = this.colorParts.s2;
    ctx.fill();

    // Joint overlap circle for Segment 2
    ctx.beginPath();
    ctx.arc(x2, y2, r2, 0, Math.PI * 2);
    ctx.fillStyle = this.colorParts.s2;
    ctx.fill();

    // Segment 3 circle is omitted to let the tail fan's starting cap render directly on top
    // with zero double-transparency ghosting!
  }

  // Draws the 3-lobe tail fan with 5-segment kinematic chain per lobe
  _drawTailFan(ctx, x3, y3, tailAngle, r3) {
    const flare = this.currentFlare;

    const fanL = this.radius * 1.35; // Base length of ovals
    const fanW = this.radius * 0.55; // Wider lobes

    // Sub-segment dimensions for 5-segmented lobes — smooth taper from base to tip
    const subL1 = fanL * 0.16;
    const subW1 = fanW * 0.5; // Segment A — short rigid base
    const subL2 = fanL * 0.19;
    const subW2 = fanW * 0.7;
    const subL3 = fanL * 0.22;
    const subW3 = fanW * 0.92;
    const subL4 = fanL * 0.22;
    const subW4 = fanW * 1.15;
    const subL5 = fanL * 0.28;
    const subW5 = fanW * 1.45; // Wide flaring tip

    // Helper: tapered connector polygon + rounded cap at the end
    const drawTaperedSegment = (L, wStart, wEnd, color) => {
      ctx.beginPath();
      ctx.moveTo(0, -wStart / 2);
      ctx.lineTo(L, -wEnd / 2);
      ctx.lineTo(L, wEnd / 2);
      ctx.lineTo(0, wStart / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(L, 0, wEnd / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Helper: terminal segment with a squarer flat trailing edge and slightly rounded corners
    const drawSquareEndSegment = (L, wStart, wEnd, color) => {
      const cornerR = wEnd * 0.18; // 18% corner rounding (beautifully soft, squarer blade corners!)
      ctx.beginPath();
      ctx.moveTo(0, -wStart / 2);
      ctx.lineTo(L - cornerR, -wEnd / 2);
      ctx.quadraticCurveTo(L, -wEnd / 2, L, -wEnd / 2 + cornerR);
      ctx.lineTo(L, wEnd / 2 - cornerR);
      ctx.quadraticCurveTo(L, wEnd / 2, L - cornerR, wEnd / 2);
      ctx.lineTo(0, wStart / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Helper: draws a single 5-segment lobe. Each joint bends by the angular lag
    // between consecutive chain angles — pure follow-through kinematics.
    const drawLobe = (baseAngle, lobeColors) => {
      ctx.save();
      ctx.translate(x3, y3);
      ctx.rotate(baseAngle);

      const w0 = r3 * 2.0;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const half = Math.PI / 2;

      // Local angle differences
      let _j1 = this.angle3 - this.tailWorldAngle;
      _j1 = normalizeAngle(_j1);
      const j1 = clamp(_j1 * 2.0, -half, half);
      const j2 = clamp((this.angle4 - this.angle3) * 2.5, -half, half);
      const j3 = clamp((this.angle5 - this.angle4) * 3.0, -half, half);
      const j4 = clamp((this.angle6 - this.angle5) * 3.5, -half, half);

      // Starting cap
      ctx.beginPath();
      ctx.arc(0, 0, w0 / 2, 0, Math.PI * 2);
      ctx.fillStyle = lobeColors[0];
      ctx.fill();

      drawTaperedSegment(subL1, w0, subW1, lobeColors[0]);
      ctx.translate(subL1 * 0.85, 0);
      ctx.rotate(j1);

      drawTaperedSegment(subL2, subW1, subW2, lobeColors[1]);
      ctx.translate(subL2 * 0.85, 0);
      ctx.rotate(j2);

      drawTaperedSegment(subL3, subW2, subW3, lobeColors[2]);
      ctx.translate(subL3 * 0.85, 0);
      ctx.rotate(j3);

      drawTaperedSegment(subL4, subW3, subW4, lobeColors[3]);
      ctx.translate(subL4 * 0.85, 0);
      ctx.rotate(j4);

      drawSquareEndSegment(subL5, subW4, subW5, lobeColors[4]);

      ctx.restore();
    };

    // Fan lobes follow the tail geometry — no independent sine drive
    drawLobe(tailAngle - flare, this.colorParts.tailLeft);
    drawLobe(tailAngle, this.colorParts.tailCenter);
    drawLobe(tailAngle + flare, this.colorParts.tailRight);
  }

  triggerSnatch() {
    this.snatchTimer = 20; // 20 frames of snatching motion
    // Sudden forward velocity surge
    const surgeSpeed = this.baseMaxSpeed * 3.5;
    this.currentSpeed = surgeSpeed;
    this.vx = Math.cos(this.drawAngle) * surgeSpeed;
    this.vy = Math.sin(this.drawAngle) * surgeSpeed;
    // Set a quick tail lunge kick
    this.kickAmp = 2.0;
    this.kickPhase = 0;
  }

  // ============================================================
  // UPDATE — called every frame; drives the full fish simulation
  // ============================================================

  _updateBreedingDance() {
    if (!this.breedingPartner) {
      this.isBreeding = false;
      return;
    }
    
    const midX = (this.x + this.breedingPartner.x) * 0.5;
    const midY = (this.y + this.breedingPartner.y) * 0.5;
    
    // Calculate current angle relative to midpoint
    let angle = Math.atan2(this.y - midY, this.x - midX);
    
    // Increment angle to rotate around the center
    angle += 0.04;
    
    // Target position on the circle
    const dist = Math.max(20, this.radius * 1.5);
    const tx = midX + Math.cos(angle) * dist;
    const ty = midY + Math.sin(angle) * dist;
    
    // Move towards target position smoothly
    const dx = tx - this.x;
    const dy = ty - this.y;
    this.vx += (dx * 0.1 - this.vx) * 0.1;
    this.vy += (dy * 0.1 - this.vy) * 0.1;
    this.currentSpeed = Math.hypot(this.vx, this.vy);
    
    // Set drawAngle tangent to the circle
    const tangentAngle = angle + Math.PI / 2;
    this.drawAngle += normalizeAngle(tangentAngle - this.drawAngle) * 0.1;
    
    // Tick down timer
    this.breedingTimer--;
  }

  _school(fishes) {
    let sepX = 0, sepY = 0;
    let alignX = 0, alignY = 0;
    let cohX = 0, cohY = 0;
    let neighborsCount = 0;

    const perceptionRadius = 250;
    const separationRadius = 70;

    for (let i = 0; i < fishes.length; i++) {
      const other = fishes[i];
      if (other === this || other.visible === false || other.isBreeding) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < perceptionRadius) {
        // Separation
        if (dist < separationRadius && dist > 0) {
          sepX -= dx / dist;
          sepY -= dy / dist;
        }

        // Alignment
        alignX += Math.cos(other.drawAngle);
        alignY += Math.sin(other.drawAngle);

        // Cohesion
        cohX += other.x;
        cohY += other.y;

        neighborsCount++;
      }
    }

    if (neighborsCount > 0) {
      // Average alignment
      alignX /= neighborsCount;
      alignY /= neighborsCount;

      // Average cohesion
      cohX = (cohX / neighborsCount) - this.x;
      cohY = (cohY / neighborsCount) - this.y;

      // Normalize alignment
      const alignDist = Math.hypot(alignX, alignY);
      if (alignDist > 0) {
        alignX /= alignDist;
        alignY /= alignDist;
      }

      // Normalize cohesion
      const cohDist = Math.hypot(cohX, cohY);
      if (cohDist > 0) {
        cohX /= cohDist;
        cohY /= cohDist;
      }

      // Normalize separation
      const sepDist = Math.hypot(sepX, sepY);
      if (sepDist > 0) {
        sepX /= sepDist;
        sepY /= sepDist;
      }

      return { sepX, sepY, alignX, alignY, cohX, cohY, hasSchool: true };
    }

    return { sepX: 0, sepY: 0, alignX: 0, alignY: 0, cohX: 0, cohY: 0, hasSchool: false };
  }

  update(canvas, foods, mouse, mouseIdleFrames, fishes = [], schoolingSettings = {}) {
    if (this.eatCooldown > 0) this.eatCooldown--;
    if (this.snatchTimer > 0) this.snatchTimer--;
    if (this.breedingCooldown > 0) this.breedingCooldown--;

    if (!this.isMature) {
      if (this.isBred && this.birthTime) {
        const elapsedDays = (Date.now() - this.birthTime) / (1000 * 60 * 60 * 24);
        this.radius = Math.min(this.targetRadius, 6 + elapsedDays * 1.0);
      } else {
        this.radius += 0.02;
      }
      if (this.radius >= this.targetRadius) {
        this.radius = this.targetRadius;
        this.isMature = true;
      }
    }

    if (this.isBreeding) {
      this._updateBreedingDance();
      this._moveAndPhysics(canvas);
      this._updateJointsAndFins(0);
      return;
    }

    // ① State machine — handles transitions between idle/prepping/swimming/lunge
    this._tickStateMachine();

    // ② Find the nearest food pellet and check mouse proximity
    const { hasValidFood, hasValidMouse, mouseDist } = this._acquireTarget(
      foods,
      mouse,
      mouseIdleFrames,
    );

    // ③ If a target is locked in, interrupt current state into a prepping lunge
    const isTargetAcquired =
      this.currentTarget !== null && this.reactionTimer <= 0;
    if (
      isTargetAcquired &&
      this.state !== "prepping" &&
      this.state !== "swimming_lunge"
    ) {
      this.state = "prepping";
      this.stateTimer = Math.floor(randomRange(10, 18));
      this.targetSpeed = 0.0;
    }

    // ④ Adjust target speed based on current state and active target type
    this._applyTargetSpeed(hasValidFood, hasValidMouse);

    // ⑤ Smoothly accelerate toward target speed
    const speedDiff = this.targetSpeed - this.currentSpeed;
    const accelRate =
      speedDiff < 0 ? 0.025 : hasValidFood || mouseDist < 250 ? 0.07 : 0.05;
    this.currentSpeed += speedDiff * accelRate;

    // ⑥ Steer toward target / wander + boundary avoidance
    this._steer(canvas, mouse, fishes, schoolingSettings);

    // ⑦ Advance position and bounce off walls
    this._moveAndPhysics(canvas);

    // ⑧ Update tail joints, wiggle cycle, fins and tail fan flare
    this._updateJointsAndFins(speedDiff);
  }

  // Handles all state transitions (idle ↔ prepping ↔ swimming ↔ swimming_lunge)
  _tickStateMachine() {
    // Spontaneous random acceleration bursts while cruising to keep the school organic
    if (this.state === "swimming") {
      if (Math.random() < 0.005) {
        // 0.5% chance per frame (about once every 3.3 seconds)
        this.state = "swimming_lunge";
        this.stateTimer = Math.floor(randomRange(35, 70)); // Elegant burst duration
        this.targetSpeed = this.baseMaxSpeed * randomRange(1.1, 1.6); // Gentle spontaneous bursts
        this.wanderAngle += randomRange(-Math.PI / 2, Math.PI / 2); // Shift heading during lunges
      }
    }

    this.stateTimer--;
    if (this.stateTimer <= 0) {
      const roll = Math.random();

      if (this.state === "swimming") {
        if (roll < 0.75) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 240)); // Longer durations for steadier cruising
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.35, 1.1); // Cruising speed variety
          this.wanderAngle += randomRange(-Math.PI / 2, Math.PI / 2); // Moderate random turning on cruise segments
        } else if (roll < 0.9) {
          this.state = "prepping";
          this.stateTimer = Math.floor(randomRange(6, 18));
          this.targetSpeed = 0.0;
        } else {
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 80)); // Balanced rest duration
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.06, 0.25);
        }
      } else if (this.state === "swimming_lunge") {
        if (roll < 0.85) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 200));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.35, 1.0);
          this.wanderAngle += randomRange(-Math.PI / 3, Math.PI / 3);
        } else {
          this.state = "idle";
          this.stateTimer = Math.floor(randomRange(20, 80));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.06, 0.25);
        }
      } else if (this.state === "idle") {
        if (roll < 0.85) {
          this.state = "swimming";
          this.stateTimer = Math.floor(randomRange(80, 240));
          this.targetSpeed = this.baseMaxSpeed * randomRange(0.35, 1.1);
          this.wanderAngle += randomRange(-Math.PI / 2, Math.PI / 2);
          // Fire the bilateral launch kick when starting to swim from idle
          this.kickAmp = 1.8;
          this.kickPhase = 0;
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
          this.targetSpeed = this.baseMaxSpeed * 1.6; // Lunge towards target
        } else {
          // 50% chance of a lunge kick, 50% chance of standard cruising
          if (Math.random() < 0.5) {
            this.state = "swimming_lunge";
            this.stateTimer = Math.floor(randomRange(30, 70));
            this.targetSpeed = this.baseMaxSpeed * 1.4; // Spontaneous lunge sprint
            this.wanderAngle += randomRange(-Math.PI / 2, Math.PI / 2);
          } else {
            this.state = "swimming";
            this.stateTimer = Math.floor(randomRange(80, 220));
            this.targetSpeed = this.baseMaxSpeed * 1.0;
            this.wanderAngle += randomRange(-Math.PI / 3, Math.PI / 3);
          }
        }
        this.prevAngle = this.drawAngle;
        // Fire the bilateral launch kick — rapid L-R sweep before settling into sine wave
        this.kickAmp = 1.8;
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
    const mouseDist = mouseActive
      ? Math.hypot(mouse.x - this.x, mouse.y - this.y)
      : Infinity;
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
        this.targetSpeed = this.baseMaxSpeed * 1.3;
      } else if (hasValidMouse) {
        this.targetSpeed = this.baseMaxSpeed * 1.1;
      }
    }
  }

  // Computes target heading, blends in boundary avoidance, and rotates drawAngle smoothly
  _steer(canvas, mouse, fishes = [], schoolingSettings = {}) {
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
        if (dist > 25) {
          // Stop micro-shaking by avoiding aggressive target re-orientation when close
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
        if (dist > 25) {
          // Stop micro-shaking by avoiding aggressive target re-orientation when close
          targetAngle = Math.atan2(dy, dx);
        } else {
          targetAngle = this.drawAngle;
        }
      }
    } else if (this.state === "swimming") {
      // Periodic random angled turns while swimming
      if (Math.random() < 0.006) {
        // 0.6% chance per frame (about once every 2.7 seconds)
        this.wanderAngle += randomRange(-Math.PI / 4, Math.PI / 4); // Sudden angled turn!
      }
      this.wanderAngle += randomRange(-0.015, 0.015); // Majestic continuous drift

      if (schoolingSettings.schoolingEnabled && fishes.length > 1) {
        const school = this._school(fishes);
        if (school.hasSchool) {
          const wanderX = Math.cos(this.wanderAngle);
          const wanderY = Math.sin(this.wanderAngle);

          // Combined steering vector
          const wWander = 0.5;
          const wSeparation = schoolingSettings.schoolingSeparation !== undefined ? schoolingSettings.schoolingSeparation : 1.2;
          const wAlignment = schoolingSettings.schoolingAlignment !== undefined ? schoolingSettings.schoolingAlignment : 1.0;
          const wCohesion = schoolingSettings.schoolingCohesion !== undefined ? schoolingSettings.schoolingCohesion : 0.8;

          const steerX = wanderX * wWander + 
                        school.sepX * wSeparation + 
                        school.alignX * wAlignment + 
                        school.cohX * wCohesion;
          const steerY = wanderY * wWander + 
                        school.sepY * wSeparation + 
                        school.alignY * wAlignment + 
                        school.cohY * wCohesion;

          targetAngle = Math.atan2(steerY, steerX);
          
          // Gently rotate wanderAngle towards targetAngle to ensure smooth continuity
          this.wanderAngle += normalizeAngle(targetAngle - this.wanderAngle) * 0.05;
        } else {
          targetAngle = this.wanderAngle;
        }
      } else {
        targetAngle = this.wanderAngle;
      }
    } else {
      // idle: random drift
      if (Math.random() < 0.004) {
        this.wanderAngle += randomRange(-Math.PI / 6, Math.PI / 6);
      }
      this.wanderAngle += randomRange(-0.006, 0.006); // Gentle continuous idle drift
      targetAngle = this.wanderAngle;
    }

    // ========== BOUNDARY AVOIDANCE STEERING ==========
    const margin = 120;
    let avoidX = 0,
      avoidY = 0;

    let tx, ty;
    if (this.currentTarget === "mouse") {
      tx = mouse.x;
      ty = mouse.y;
    } else if (this.currentTarget) {
      tx = this.currentTarget.x;
      ty = this.currentTarget.y;
    }

    if (this.x < margin) {
      let force = (margin - this.x) / margin;
      if (tx !== undefined && tx < this.x) {
        const targetDist = tx - this.radius;
        const fishDist = margin - this.radius;
        force *= Math.max(0, Math.min(1, targetDist / fishDist));
      }
      avoidX += force;
    } else if (this.x > canvas.width - margin) {
      let force = (this.x - (canvas.width - margin)) / margin;
      if (tx !== undefined && tx > this.x) {
        const targetDist = canvas.width - this.radius - tx;
        const fishDist = margin - this.radius;
        force *= Math.max(0, Math.min(1, targetDist / fishDist));
      }
      avoidX -= force;
    }

    if (this.y < margin) {
      let force = (margin - this.y) / margin;
      if (ty !== undefined && ty < this.y) {
        const targetDist = ty - this.radius;
        const fishDist = margin - this.radius;
        force *= Math.max(0, Math.min(1, targetDist / fishDist));
      }
      avoidY += force;
    } else if (this.y > canvas.height - margin) {
      let force = (this.y - (canvas.height - margin)) / margin;
      if (ty !== undefined && ty > this.y) {
        const targetDist = canvas.height - this.radius - ty;
        const fishDist = margin - this.radius;
        force *= Math.max(0, Math.min(1, targetDist / fishDist));
      }
      avoidY -= force;
    }

    const avoidMag = Math.hypot(avoidX, avoidY);
    if (avoidMag > 0.01) {
      const avoidAngle = Math.atan2(avoidY, avoidX);
      const blend = Math.min(0.85, avoidMag);
      const steerCos =
        Math.cos(targetAngle) * (1 - blend) + Math.cos(avoidAngle) * blend;
      const steerSin =
        Math.sin(targetAngle) * (1 - blend) + Math.sin(avoidAngle) * blend;
      targetAngle = Math.atan2(steerSin, steerCos);
      this.wanderAngle = targetAngle; // Keep wander heading aligned with avoidance
    }

    // ========== ROTATE DRAW ANGLE SMOOTHLY ==========
    // Proportional steering control (P-controller) scales turn speed down when diff is small
    // to align target headings smoothly and completely prevent micro-shaking and overshoot oscillations!
    let diff = normalizeAngle(targetAngle - this.drawAngle);

    let maxTurn = 0.035;
    if (this.state === "prepping") maxTurn = 0.06;
    else if (this.state === "swimming_lunge") maxTurn = 0.085;
    else if (this.state === "swimming") maxTurn = 0.048;

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
    // Cruising propulsion pulse: speed dips at tail extremes, surges at centerline crossings.
    const sweepPhase = Math.sin(this.wiggleCycle + 0.5);
    const pulseDepth = Math.min(0.25, this.smoothAmpFactor * 0.85);
    const speedPulse = 1.0 - pulseDepth * Math.abs(sweepPhase);

    const desiredVx =
      this.currentSpeed > 0.01
        ? Math.cos(this.drawAngle) * this.currentSpeed * speedPulse
        : 0;
    const desiredVy =
      this.currentSpeed > 0.01
        ? Math.sin(this.drawAngle) * this.currentSpeed * speedPulse
        : 0;

    this.vx += (desiredVx - this.vx) * 0.13;
    this.vy += (desiredVy - this.vy) * 0.13;

    // Kick impulse: applied directly to velocity so each tail beat translates to movement
    if (this.kickAmp > 0.05) {
      const kickPulse = 1.0 - Math.abs(Math.sin(this.kickPhase));
      const kickImpulse = this.kickAmp * this.baseMaxSpeed * kickPulse * 0.14;
      this.vx += Math.cos(this.drawAngle) * kickImpulse;
      this.vy += Math.sin(this.drawAngle) * kickImpulse;
    }

    // Cruising wiggle propulsion: small direct impulse at each centerline crossing
    const cruisePulse = Math.max(0, 1.0 - Math.abs(sweepPhase));
    const cruiseImpulse =
      this.smoothAmpFactor * this.currentSpeed * cruisePulse * 0.18;
    this.vx += Math.cos(this.drawAngle) * cruiseImpulse;
    this.vy += Math.sin(this.drawAngle) * cruiseImpulse;

    const maxV = this.baseMaxSpeed * 3.0;
    const vMag = Math.hypot(this.vx, this.vy);
    if (vMag > maxV) {
      this.vx = (this.vx / vMag) * maxV;
      this.vy = (this.vy / vMag) * maxV;
    }

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
      if (!this.currentTarget) {
        this.wanderAngle = 0;
        this.drawAngle = 0; // Prevent wall jitter by instantly aligning heading!
      }
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      if (!this.currentTarget) {
        this.wanderAngle = Math.PI;
        this.drawAngle = Math.PI;
      }
      this.vx = -Math.abs(this.vx);
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      if (!this.currentTarget) {
        this.wanderAngle = Math.PI / 2;
        this.drawAngle = Math.PI / 2;
      }
      this.vy = Math.abs(this.vy);
    } else if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      if (!this.currentTarget) {
        this.wanderAngle = -Math.PI / 2;
        this.drawAngle = -Math.PI / 2;
      }
      this.vy = -Math.abs(this.vy);
    }
  }

  // Updates tail joint lag, wiggle cycle, bilateral kick, pectoral fin angle, and tail fan flare
  _updateJointsAndFins(speedDiff) {
    // Joint angle lag updates for smooth serpentine skeleton follow.
    this.angle1 += normalizeAngle(this.drawAngle - this.angle1) * 0.55; // Rigid base attached to body
    this.angle2 += normalizeAngle(this.angle1 - this.angle2) * 0.2; // Mid-tail segment lag
    this.angle2b += normalizeAngle(this.angle2 - this.angle2b) * 0.12; // Tail tip segment lag
    this.angle3 += normalizeAngle(this.tailWorldAngle - this.angle3) * 0.3; // Fan root: responsive but not rigid
    this.angle4 += normalizeAngle(this.angle3 - this.angle4) * 0.18; // Lobe joint 2
    this.angle5 += normalizeAngle(this.angle4 - this.angle5) * 0.14; // Lobe joint 3
    this.angle6 += normalizeAngle(this.angle5 - this.angle6) * 0.1; // Lobe joint 4 — tip trails most

    // Wiggle cycle frequency: fast burst at start of movement (high accelSpeedDiff),
    // decays to cruise rate as fish reaches speed
    let freqIncrement;
    if (this.snatchTimer > 0) {
      // Extra rapid tail beat during the snatch
      freqIncrement = 0.45;
      this.kickAmp = Math.max(this.kickAmp, 2.0 * (this.snatchTimer / 20));
    } else {
      const accelSpeedDiff = Math.max(0, this.targetSpeed - this.currentSpeed);
      freqIncrement = Math.min(
        0.2,
        this.currentSpeed * 0.035 + accelSpeedDiff * 0.18 + 0.008,
      );
    }
    this.wiggleCycle += freqIncrement;

    // Bilateral kick: advance phase quickly and decay amplitude each frame
    this.kickPhase += 0.42; // Rapid, energetic starting flicks
    this.kickAmp *= 0.975; // Slower decay to allow multiple following snaps
    if (this.kickAmp < 0.05) this.kickAmp = 0; // Clean cutoff

    // ========== PECTORAL FIN ANGLE ==========
    const speedRatio = Math.min(1.0, this.currentSpeed / this.baseMaxSpeed);
    const turnRatio = Math.min(1.0, this.smoothTurnRate / 0.025); // Lower divisor makes fin flapping extremely active on turns

    let desiredFinAngle = 0.05; // Default: fully flared
    if (this.currentSpeed <= 0.08) {
      desiredFinAngle = 0.05;
    } else if (speedDiff > 0.35 || this.snatchTimer > 0) {
      desiredFinAngle = 0.95; // Snap pin ONLY during sudden intense start of movement
    } else if (speedDiff < -0.05) {
      desiredFinAngle = 0.05; // Flare for braking
    } else {
      desiredFinAngle = 0.15 + speedRatio * 0.25; // Cruise flap: moderate flare to allow flapping visibility
    }

    if (this.currentSpeed > 0.08 && speedDiff <= 0.01 && turnRatio > 0.05) {
      desiredFinAngle = desiredFinAngle * (1.0 - turnRatio) + 0.0 * turnRatio;
    }

    const finRate = speedDiff > 0.35 || this.snatchTimer > 0 ? 0.35 : 0.08;
    this.finAngle += (desiredFinAngle - this.finAngle) * finRate;

    // ========== TAIL FAN FLARE ==========
    const targetFlare = this.state === "idle" ? 1.0 : 0.72;
    this.currentFlare += (targetFlare - this.currentFlare) * 0.1;
  }
}
