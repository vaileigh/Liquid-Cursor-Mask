const canvas = document.getElementById("maskCanvas");
const context = canvas.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskContext = maskCanvas.getContext("2d");

const image = new Image();
image.src = "./space.jpg";

const pointer = {
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.5,
  targetX: window.innerWidth * 0.5,
  targetY: window.innerHeight * 0.5,
  lastX: window.innerWidth * 0.5,
  lastY: window.innerHeight * 0.5,
  active: false
};

const trail = [];

const config = {
  radius: 34,
  lerp: 0.18,
  spacing: 8,
  blur: 17,
  life: 22,
  minScale: 0.62,
  maxStretch: 2.8,
  maskScale: 0.35,
  maxPixelRatio: 1.5
};

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, config.maxPixelRatio);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  maskCanvas.width = Math.max(1, Math.round(window.innerWidth * config.maskScale));
  maskCanvas.height = Math.max(1, Math.round(window.innerHeight * config.maskScale));
  maskContext.setTransform(1, 0, 0, 1, 0, 0);
  maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  drawFrame();
}

function getCoverDimensions() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const imageRatio = image.width / image.height;
  const viewportRatio = viewportWidth / viewportHeight;

  let drawWidth = viewportWidth;
  let drawHeight = viewportHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (viewportRatio > imageRatio) {
    drawHeight = viewportWidth / imageRatio;
    offsetY = (viewportHeight - drawHeight) * 0.5;
  } else {
    drawWidth = viewportHeight * imageRatio;
    offsetX = (viewportWidth - drawWidth) * 0.5;
  }

  return { drawWidth, drawHeight, offsetX, offsetY };
}

function addTrailPoint(x, y, velocityX, velocityY, force = 0) {
  const speed = Math.hypot(velocityX, velocityY);
  const stretch = 1 + Math.min(speed / 28, 1) * (config.maxStretch - 1);
  const scale = 1 - Math.min(force, 1) * (1 - config.minScale);

  trail.push({
    x,
    y,
    angle: Math.atan2(velocityY, velocityX || 0.0001),
    stretch,
    scale,
    life: config.life
  });

  if (trail.length > 60) {
    trail.splice(0, trail.length - 60);
  }
}

function updateTrail() {
  const deltaX = pointer.x - pointer.lastX;
  const deltaY = pointer.y - pointer.lastY;
  const distance = Math.hypot(deltaX, deltaY);

  if (pointer.active && distance > 0.1) {
    const steps = Math.max(1, Math.ceil(distance / config.spacing));

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const x = pointer.lastX + deltaX * progress;
      const y = pointer.lastY + deltaY * progress;
      addTrailPoint(x, y, deltaX, deltaY, 1 - progress);
    }
  }

  pointer.lastX = pointer.x;
  pointer.lastY = pointer.y;

  for (let index = trail.length - 1; index >= 0; index -= 1) {
    trail[index].life -= 1;

    if (trail[index].life <= 0) {
      trail.splice(index, 1);
    }
  }
}

function drawTrail() {
  if (trail.length === 0) {
    return;
  }

  const scale = config.maskScale;
  const scaledRadius = config.radius * scale;

  maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskContext.save();
  maskContext.fillStyle = "#000";
  maskContext.shadowColor = "#000";
  maskContext.shadowBlur = config.blur;

  for (const point of trail) {
    const alpha = point.life / config.life;
    const radius = scaledRadius * point.scale * alpha;

    maskContext.save();
    maskContext.globalAlpha = alpha;
    maskContext.translate(point.x * scale, point.y * scale);
    maskContext.rotate(point.angle);
    maskContext.scale(point.stretch, 1 / Math.max(point.stretch * 0.92, 1));
    maskContext.beginPath();
    maskContext.arc(0, 0, Math.max(radius, 2), 0, Math.PI * 2);
    maskContext.fill();
    maskContext.restore();
  }

  maskContext.restore();

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.imageSmoothingEnabled = true;
  context.drawImage(maskCanvas, 0, 0, window.innerWidth, window.innerHeight);
  context.restore();
}

function drawFrame() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (!image.complete || !image.naturalWidth) {
    return;
  }

  const { drawWidth, drawHeight, offsetX, offsetY } = getCoverDimensions();
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  updateTrail();
  drawTrail();
}

function animate() {
  pointer.x += (pointer.targetX - pointer.x) * config.lerp;
  pointer.y += (pointer.targetY - pointer.y) * config.lerp;

  drawFrame();
  requestAnimationFrame(animate);
}

window.addEventListener("pointermove", (event) => {
  pointer.targetX = event.clientX;
  pointer.targetY = event.clientY;
  pointer.active = true;
});

window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

window.addEventListener("resize", resizeCanvas);

image.addEventListener("load", () => {
  resizeCanvas();
  animate();
});
