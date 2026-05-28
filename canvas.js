var canvas = document.querySelector("canvas");
console.log(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var c = canvas.getContext("2d");

var mouse = {
  x: undefined,
  y: undefined,
};

function randomIntFromRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function randomColor() {
  return `rgb(${randomIntFromRange(0, 255)}, ${randomIntFromRange(0, 255)}, ${randomIntFromRange(0, 255)})`;
}

// floaters

// function init() {
//   circleArray = [];

//   for (let i = 0; i < 100; i++) {
//     var radius = Math.random() * 3 + 1;
//     var x = Math.random() * (window.innerWidth - radius * 2) + radius;
//     var dx = (Math.random() - 0.5) * velocityMultiplier;
//     var y = Math.random() * (window.innerHeight - radius * 2) + radius;
//     var dy = (Math.random() - 0.5) * velocityMultiplier;
//     circleArray.push(new Circle(x, y, dx, dy, radius));
//   }
// }

window.addEventListener("mousemove", function (event) {
  mouse.x = event.x;
  mouse.y = event.y;
});

window.addEventListener("resize", function () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  init();
});

// var maxRadius = 40;
// var velocityMultiplier = 3;

// var colorArray = ["#A2FAA3", "#92C9B1", "#4F759B", "#5D5179", "#571F4E"];

// var circleArray = [];

// for (let i = 0; i < 100; i++) {
//   var radius = Math.random() * 3 + 1;
//   var x = Math.random() * (window.innerWidth - radius * 2) + radius;
//   var dx = (Math.random() - 0.5) * velocityMultiplier;
//   var y = Math.random() * (window.innerHeight - radius * 2) + radius;
//   var dy = (Math.random() - 0.5) * velocityMultiplier;
//   circleArray.push(new Circle(x, y, dx, dy, radius));
// }

// function Circle(x, y, dx, dy, radius) {
//   this.x = x;
//   this.y = y;
//   this.dx = dx;
//   this.dy = dy;
//   this.radius = radius;
//   this.minRadius = radius;
//   this.color = colorArray[Math.floor(Math.random() * colorArray.length)];

//   this.draw = function () {
//     c.beginPath();
//     c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
//     c.fillStyle = this.color;
//     c.fill();
//   };

//   this.update = function () {
//     if (this.x + this.radius > innerWidth || this.x - this.radius < 0) {
//       this.dx = -this.dx;
//     }
//     this.x += this.dx;

//     if (this.y + this.radius > innerHeight || this.y - this.radius < 0) {
//       this.dy = -this.dy;
//     }
//     this.y += this.dy;

//     if (
//       mouse.x - this.x < 50 &&
//       mouse.x - this.x > -50 &&
//       mouse.y - this.y < 50 &&
//       mouse.y - this.y > -50
//     ) {
//       if (this.radius < maxRadius) {
//         this.radius += 1;
//       }
//     } else if (this.radius > this.minRadius) {
//       this.radius -= 1;
//     }

//     this.draw();
//   };
// }

// function animate() {
//   requestAnimationFrame(animate);

//   c.clearRect(0, 0, canvas.width, canvas.height);

//   for (let i = 0; i < circleArray.length; i++) {
//     circleArray[i].update();
//   }
// }

// animate();

// cool text mouse
// function animate() {
//   requestAnimationFrame(animate);
//   c.fillText("Hello World", mouse.x, mouse.y);
// }

// animate();

// gravity balls

// var gravity = 1;
// var friction = 0.9;

// function Ball(x, y, dx, dy, radius, color) {
//   this.x = x;
//   this.y = y;
//   this.dx = dx;
//   this.dy = dy;
//   this.radius = radius;
//   this.color = color;

//   this.draw = function () {
//     c.beginPath();
//     c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
//     c.fillStyle = this.color;
//     c.fill();
//     c.stroke();
//     c.closePath();
//   };

//   this.update = function () {
//     if (this.y + this.radius + this.dy > innerHeight) {
//       this.dy = -this.dy * friction;
//     } else {
//       this.dy += gravity;
//     }

//     if (
//       this.x + this.radius + this.dx > canvas.width - this.radius * 2 ||
//       this.x + this.radius + this.dx < 0 + this.radius * 2
//     ) {
//       this.dx = -this.dx * friction;
//     }

//     this.x += this.dx;
//     this.y += this.dy;
//     this.draw();
//   };
// }

// var ball;
// var ballArray = [];

// function init() {
//   ballArray = [];

//   for (let i = 0; i < 100; i++) {
//     var radius = Math.random() * (window.innerHeight / 20);
//     ballArray.push(
//       new Ball(
//         randomIntFromRange(0 + radius, window.innerWidth - radius),
//         Math.random() * window.innerHeight - radius,
//         randomIntFromRange(-2, 2),
//         randomIntFromRange(-2, 2),
//         radius,
//         colorArray[Math.floor(Math.random() * colorArray.length)],
//       ),
//     );
//   }
// }

// function animate() {
//   requestAnimationFrame(animate);
//   c.clearRect(0, 0, canvas.width, canvas.height);

//   for (let i = 0; i < ballArray.length; i++) {
//     ballArray[i].update();
//     circleArray[i].update();
//   }
// }

// collision detection
function Ball(x, y, dx, dy, radius, color) {
  this.x = x;
  this.y = y;
  this.dx = dx;
  this.dy = dy;
  this.radius = radius;
  this.color = color;

  this.draw = function () {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    c.fillStyle = this.color;
    c.fill();
    c.stroke();
    c.closePath();
  };

  this.update = function () {
    this.x = mouse.x;
    this.y = mouse.y;
    this.draw();
  };
}

function getDistance(x1, y1, x2, y2) {
  let xDistance = x2 - x1;
  let yDistance = y2 - y1;

  return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}

function getIsColliding(x1, y1, x2, y2, radius1, radius2) {
  let xDistance = x2 - x1;
  let yDistance = y2 - y1;
  return Math.pow(xDistance, 2) + Math.pow(yDistance, 2) < Math.pow(radius1 + radius2, 2);
}

let circle1;
let circle2;

function init() {
  circle1 = new Ball(500, 500, 5, 5, 30, "black");
  circle2 = new Ball(300, 300, 5, 5, 30, "red");
}

function animate() {
  requestAnimationFrame(animate);
  c.clearRect(0, 0, canvas.width, canvas.height);

  circle1.draw();
  circle2.update();
  // if (getDistance(circle1.x, circle1.y, circle2.x, circle2.y) < circle1.radius + circle2.radius) {
  //   circle1.color = "red";
  // } else {
  //   circle1.color = "black";
  // };

  if (getIsColliding(circle1.x, circle1.y, circle2.x, circle2.y, circle1.radius, circle2.radius)) {
    circle1.color = "red";
  } else {
    circle1.color = "black";
  };
}

init();
animate();
