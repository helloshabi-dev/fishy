// Ripple class for expanding click rings

export class Ripple {
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
