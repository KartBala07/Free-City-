import { BUILDINGS, COLORS, calendar } from "./simulation.js";
export class Renderer {
  constructor(canvas, view, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.view = view;
    this.onSelect = onSelect;
    this.hits = [];
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => {
      drag = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4)
        drag.moved = true;
      if (drag.moved) {
        if (e.shiftKey) {
          view.panX += dx;
          view.panY += dy;
        } else view.angle += dx * 0.007;
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (drag && !drag.moved) {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left,
          y = e.clientY - r.top;
        const hit = this.hits
          .filter((h) => Math.hypot(h.x - x, h.y - y) < 15)
          .sort(
            (a, b) =>
              Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
          )[0];
        if (hit) this.onSelect(hit.id);
      }
      drag = null;
    });
    canvas.addEventListener("pointercancel", () => (drag = null));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        view.zoom = Math.max(
          0.3,
          Math.min(3, view.zoom * Math.exp(-e.deltaY * 0.001)),
        );
      },
      { passive: false },
    );
  }
  project(x, z, y = 0) {
    const v = this.view,
      c = Math.cos(v.angle),
      s = Math.sin(v.angle),
      rx = x * c - z * s,
      rz = x * s + z * c;
    return {
      x: this.w * 0.52 + v.panX + rx * this.scale,
      y: this.h * 0.49 + v.panY + rz * this.scale * 0.52 - y * this.scale,
      depth: rz,
    };
  }
  polygon(points, fill, stroke) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.stroke();
    }
  }
  box(b) {
    const { x, z, w, d, h, color } = b,
      p = (a, b, y) => this.project(a, b, y);
    const base = [
      p(x - w / 2, z - d / 2, 0),
      p(x + w / 2, z - d / 2, 0),
      p(x + w / 2, z + d / 2, 0),
      p(x - w / 2, z + d / 2, 0),
    ];
    const top = [
      p(x - w / 2, z - d / 2, h),
      p(x + w / 2, z - d / 2, h),
      p(x + w / 2, z + d / 2, h),
      p(x - w / 2, z + d / 2, h),
    ];
    const sides = [0, 1, 2, 3].sort(
      (a, b) =>
        base[a].depth +
        base[(a + 1) % 4].depth -
        (base[b].depth + base[(b + 1) % 4].depth),
    );
    for (const i of sides) {
      const j = (i + 1) % 4;
      this.polygon([base[i], base[j], top[j], top[i]], color, "#ffffff12");
      this.polygon(
        [base[i], base[j], top[j], top[i]],
        i % 2 ? "#0003" : "#0005",
      );
    }
    this.polygon(top, color, "#c9ded044");
  }
  draw(s) {
    const c = this.ctx,
      r = this.canvas.getBoundingClientRect(),
      dpr = Math.min(2, devicePixelRatio || 1);
    if (
      this.canvas.width !== Math.round(r.width * dpr) ||
      this.canvas.height !== Math.round(r.height * dpr)
    ) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    this.w = r.width;
    this.h = r.height;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(this.w / 74, this.h / 54) * this.view.zoom;
    const hour = calendar(s.minutes).hour,
      night = hour < 6 || hour >= 19;
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, night ? "#15252d" : "#344e4e");
    g.addColorStop(1, night ? "#14232a" : "#243c37");
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    const p = (x, z) => this.project(x, z);
    this.polygon(
      [p(-31, -29), p(31, -29), p(31, 29), p(-31, 29)],
      night ? "#2a403c" : "#52705b",
      "#739681",
    );
    for (let x = -30; x <= 30; x += 4) {
      c.beginPath();
      let a = p(x, -29),
        b = p(x, 29);
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.strokeStyle = "#a9c4a509";
      c.stroke();
    }
    for (const z of [-13, 5, 17])
      this.polygon(
        [p(-30, z - 1), p(30, z - 1), p(30, z + 1), p(-30, z + 1)],
        "#91a18e44",
      );
    for (const x of [-17, -5, 5, 17])
      this.polygon(
        [p(x - 1, -28), p(x + 1, -28), p(x + 1, 28), p(x - 1, 28)],
        "#91a18e44",
      );
    const objects = BUILDINGS.map((b) => ({
      type: "building",
      b,
      depth: p(b.x, b.z).depth,
    }));
    for (let i = 0; i < 24; i++) {
      const x = -28 + (i % 8) * 8,
        z = i < 8 ? 25 : i < 16 ? -26 : 22;
      objects.push({ type: "tree", x, z, depth: p(x, z).depth });
    }
    this.hits = [];
    for (const a of s.citizens)
      if (a.health > 0)
        objects.push({ type: "person", a, depth: p(a.x, a.z).depth });
    objects.sort((a, b) => a.depth - b.depth);
    for (const o of objects) {
      if (o.type === "building") {
        this.box(o.b);
        if (o.b.name !== "Residences") {
          const q = this.project(o.b.x, o.b.z, o.b.h + 1);
          c.font = "8px system-ui";
          c.textAlign = "center";
          c.fillStyle = "#d0dfc7b0";
          c.fillText(o.b.name.toUpperCase(), q.x, q.y);
        }
      } else if (o.type === "tree") {
        const q = p(o.x, o.z),
          size = this.scale * 0.65;
        c.fillStyle = "#293f2f";
        c.fillRect(q.x - 1, q.y - size, 2, size);
        c.beginPath();
        c.ellipse(q.x, q.y - size * 1.4, size, size * 1.2, 0, 0, Math.PI * 2);
        c.fillStyle = "#3b6949";
        c.fill();
      } else {
        const a = o.a,
          q = p(a.x, a.z),
          size = Math.max(2, this.scale * 0.25);
        c.fillStyle = "#11251f66";
        c.beginPath();
        c.ellipse(q.x + 2, q.y + 1, size * 1.6, size * 0.7, 0, 0, Math.PI * 2);
        c.fill();
        if (a.id === this.view.selected) {
          c.strokeStyle = "#b4f9d4";
          c.lineWidth = 1.5;
          c.beginPath();
          c.ellipse(q.x, q.y, size * 2.8, size * 1.4, 0, 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = COLORS[a.faction];
        c.fillRect(q.x - size * 0.65, q.y - size * 2, size * 1.3, size * 2);
        c.beginPath();
        c.arc(q.x, q.y - size * 2.7, size * 0.7, 0, Math.PI * 2);
        c.fill();
        this.hits.push({ id: a.id, x: q.x, y: q.y - size });
        if (a.id === this.view.selected) {
          c.font = "10px system-ui";
          c.textAlign = "center";
          c.fillStyle = "#e4ffec";
          c.fillText(a.name, q.x, q.y - size * 4.5);
        }
      }
    }
    if (night) {
      c.fillStyle = "#08193244";
      c.fillRect(0, 0, this.w, this.h);
    }
    if (s.weather === "Rain") {
      c.strokeStyle = "#c1dede44";
      c.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const x = (i * 131 + s.ticks * 3) % this.w,
          y = (i * 77 + s.ticks * 5) % this.h;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 3, y + 9);
        c.stroke();
      }
    }
  }
}
