const progress = document.querySelector(".scroll-progress");
const reveals = document.querySelectorAll(".reveal");
const orbitItems = document.querySelectorAll(".module-orbit span");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");
const canvas = document.querySelector("#hero-canvas");
const ctx = canvas?.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REVEAL_THRESHOLD = 0.14;
const ORBIT_INTERVAL_MS = 1700;
const MAX_DPR = 2;
const MIN_POINT_COUNT = 24;
const POINT_DENSITY_PX = 32;
const POINT_SPEED = 0.32;
const POINT_RADIUS_BASE = 1.2;
const POINT_RADIUS_STEP = 0.36;
const POINTER_RADIUS = 160;
const POINTER_REPEL = 0.002;
const LINK_DISTANCE = 138;
const LINK_ALPHA = 0.17;
const TARGET_FRAME_MS = 33;
const POINT_COLORS = ["#67e8f9", "#93f9b9", "#a78bfa"];

function updateProgress() {
  if (!progress) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
  progress.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: REVEAL_THRESHOLD }
  );

  reveals.forEach(item => observer.observe(item));
} else {
  reveals.forEach(item => item.classList.add("visible"));
}

function setMenuOpen(open) {
  siteHeader?.classList.toggle("menu-open", open);
  menuToggle?.setAttribute("aria-expanded", String(open));
}

menuToggle?.addEventListener("click", () => {
  setMenuOpen(!siteHeader?.classList.contains("menu-open"));
});

primaryNav?.addEventListener("click", event => {
  if (event.target instanceof Element && event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
});

let activeOrbitIndex = 0;

function setActiveOrbit(index) {
  if (!orbitItems.length) return;
  activeOrbitIndex = (index + orbitItems.length) % orbitItems.length;
  orbitItems.forEach((item, itemIndex) => {
    item.classList.toggle("active", itemIndex === activeOrbitIndex);
  });
}

setActiveOrbit(0);

if (!reducedMotion && orbitItems.length) {
  window.setInterval(() => {
    setActiveOrbit(activeOrbitIndex + 1);
  }, ORBIT_INTERVAL_MS);
}

let width = 0;
let height = 0;
let pixelRatio = 1;
let points = [];
const pointer = { x: 0, y: 0, active: false };
let animationFrame = 0;
let lastDrawTime = 0;

function pointSeed(index) {
  const value = Math.sin((index + 1) * 91.7) * 10000;
  return value - Math.floor(value);
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const hero = canvas.closest(".hero");
  const rect = hero?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const nextWidth = Math.max(1, Math.round(window.innerWidth));
  const nextHeight = Math.max(1, Math.round(rect.height));

  if (
    nextWidth === width &&
    nextHeight === height &&
    dpr === pixelRatio &&
    canvas.width &&
    canvas.height
  ) {
    return;
  }

  width = nextWidth;
  height = nextHeight;
  pixelRatio = dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  points = Array.from(
    { length: Math.max(MIN_POINT_COUNT, Math.floor(width / POINT_DENSITY_PX)) },
    (_, index) => ({
      x: pointSeed(index) * width,
      y: pointSeed(index + 101) * height,
      vx: (pointSeed(index + 203) - 0.5) * POINT_SPEED,
      vy: (pointSeed(index + 307) - 0.5) * POINT_SPEED,
      r: POINT_RADIUS_BASE + (index % 5) * POINT_RADIUS_STEP
    })
  );
}

function drawNetwork(timestamp = 0) {
  if (!canvas || !ctx) return;
  if (document.hidden) return;

  if (!reducedMotion && timestamp && timestamp - lastDrawTime < TARGET_FRAME_MS) {
    animationFrame = requestAnimationFrame(drawNetwork);
    return;
  }

  lastDrawTime = timestamp;
  ctx.clearRect(0, 0, width, height);

  points.forEach(point => {
    point.x += point.vx;
    point.y += point.vy;

    if (point.x < 0 || point.x > width) point.vx *= -1;
    if (point.y < 0 || point.y > height) point.vy *= -1;

    if (pointer.active) {
      const dx = pointer.x - point.x;
      const dy = pointer.y - point.y;
      const distance = Math.hypot(dx, dy);
      if (distance < POINTER_RADIUS) {
        point.x -= dx * POINTER_REPEL;
        point.y -= dy * POINTER_REPEL;
      }
    }
  });

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < LINK_DISTANCE) {
        ctx.strokeStyle = `rgba(103, 232, 249, ${LINK_ALPHA * (1 - distance / LINK_DISTANCE)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  points.forEach((point, index) => {
    ctx.fillStyle =
      index % 7 === 0 ? POINT_COLORS[2] : index % 5 === 0 ? POINT_COLORS[1] : POINT_COLORS[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!reducedMotion) {
    animationFrame = requestAnimationFrame(drawNetwork);
  }
}

function scheduleCanvasResize() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  animationFrame = requestAnimationFrame(() => {
    resizeCanvas();
    drawNetwork();
  });
}

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", scheduleCanvasResize);
window.visualViewport?.addEventListener("resize", scheduleCanvasResize);
window.addEventListener("pointermove", event => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !reducedMotion) {
    scheduleCanvasResize();
  }
});

updateProgress();
resizeCanvas();
drawNetwork();
window.addEventListener("load", scheduleCanvasResize, { once: true });
