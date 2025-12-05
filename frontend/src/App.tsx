import { useEffect, useRef, useState } from "react";
import { EventsOn } from "../wailsjs/runtime/runtime";

/**
 * Canvas-based finite grid viewer with:
 * - drag to pan
 * - inertia / momentum
 * - edge-based auto-move
 * - gaps between tiles
 * - fade-in images
 * - hover highlight
 * - soft clamping/resistance at world edges
 *
 * NO ZOOM (per your instruction)
 */

const GRID_ROWS = 10;
const GRID_COLS = 30;
const TILE_SIZE = 200;
const GAP = 120;
const EDGE_ZONE = 120; // px from edges -> triggers auto-scroll
const EDGE_SPEED = 3; // px/frame auto-scroll strength
const FRICTION = 0.92; // per-frame velocity decay
const VELOCITY_LERP = 0.8; // how strongly drag velocity replaces stored velocity
const OVERSCROLL_ALLOWANCE = 0.25; // fraction of viewport allowed as soft overscroll

export default function App() {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [onKeyPress, setOnKeyPress] = useState(true);

  useEffect(() => {
    EventsOn("spotlight:show", () => {
      const el = spotlightRef.current;
      if (!el) return;
      el.classList.remove("spotlight-hide");
      el.classList.add("spotlight-drop");
    });

    EventsOn("spotlight:hide", () => {
      const el = spotlightRef.current;
      if (!el) return;
      el.classList.remove("spotlight-drop");
      el.classList.add("spotlight-hide");
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // world size including gaps
    const tileStep = TILE_SIZE + GAP;
    const worldWidth = GRID_COLS * tileStep - GAP;
    const worldHeight = GRID_ROWS * tileStep - GAP;

    const dropAnim = {
      t: 0, // 0 → 1
      active: true,
    };

    // persistent mutable state used inside animation loop (refs in prior code)
    const state = {
      offsetX: 0, // current camera offset (world pixels scrolled from left)
      offsetY: 0,
      velX: 0, // current velocity applied each frame
      velY: 0,
      mouseX: 0,
      mouseY: 0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      loadedCount: 0,
      totalTiles: GRID_ROWS * GRID_COLS,
      // per-image alpha for fade-in
      alphas: new Array(GRID_ROWS * GRID_COLS).fill(0),
      // per-image loaded flags
      loaded: new Array(GRID_ROWS * GRID_COLS).fill(false),
      hoverScale: new Array(GRID_ROWS * GRID_COLS).fill(1),
    };

    // resize helper and limits
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // clamp offsets if needed
      const maxX = Math.max(0, worldWidth - canvas.width);
      const maxY = Math.max(0, worldHeight - canvas.height);

      state.offsetX = Math.max(0, Math.min(state.offsetX, maxX));
      state.offsetY = Math.max(0, Math.min(state.offsetY, maxY));
    };
    resize();

    // prepare images (picsum) — keep order deterministic
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < state.totalTiles; i++) {
      const img = new Image();
      // use seed-like url so images are stable
      img.crossOrigin = "anonymous";
      img.src = `https://picsum.photos/seed/p-${i}/${TILE_SIZE}`;
      ((idx) => {
        img.onload = () => {
          state.loaded[idx] = true;
          state.loadedCount++;
          // kick alpha to near-visible to start fade-in
          state.alphas[idx] = 0.01;
        };
        img.onerror = () => {
          // mark as loaded to avoid blocking
          state.loaded[idx] = true;
          state.loadedCount++;
          state.alphas[idx] = 1;
        };
      })(i);

      images.push(img);
    }

    // Helpers for clamping with soft resistance
    const getMaxX = () => Math.max(0, worldWidth - canvas.width);
    const getMaxY = () => Math.max(0, worldHeight - canvas.height);

    // Convert mouse position -> possibly update edge scrolling
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouseX = e.clientX - rect.left;
      state.mouseY = e.clientY - rect.top;

      if (state.isDragging) {
        const dx = e.clientX - state.lastMouseX;
        const dy = e.clientY - state.lastMouseY;

        // apply immediate offset change
        state.offsetX -= dx; // note: subtract because dragging moves world opposite of pointer
        state.offsetY -= dy;

        // update stored velocity (lerp to smooth sudden jumps)
        state.velX = state.velX * (1 - VELOCITY_LERP) + -dx * VELOCITY_LERP;
        state.velY = state.velY * (1 - VELOCITY_LERP) + -dy * VELOCITY_LERP;

        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      state.isDragging = true;
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      // zero edge-driven velocity so drag feels direct
      // but keep vel as starting momentum when released
    };

    const onMouseUp = () => {
      state.isDragging = false;
      // velocity already set from last move — inertia continues
    };

    const onMouseLeave = () => {
      state.isDragging = false;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", resize);

    // Touch support (basic)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      state.isDragging = true;
      state.lastMouseX = t.clientX;
      state.lastMouseY = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!state.isDragging || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - state.lastMouseX;
      const dy = t.clientY - state.lastMouseY;
      state.offsetX -= dx;
      state.offsetY -= dy;
      state.velX = -dx;
      state.velY = -dy;
      state.lastMouseX = t.clientX;
      state.lastMouseY = t.clientY;
      // update mouse position for hover logic
      const rect = canvas.getBoundingClientRect();
      state.mouseX = t.clientX - rect.left;
      state.mouseY = t.clientY - rect.top;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      state.isDragging = false;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    // animation loop
    let raf = 0;

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function overshootScale(t: number) {
      // matches your CSS: scale(0.98 → ~1.02 → 1)
      if (t < 0.6) {
        return 0.98 + (1.02 - 0.98) * (t / 0.6);
      }
      // 60–100%: 1.02 → 1.0
      return 1.02 - 0.02 * ((t - 0.6) / 0.4);
    }

    function dropTranslate(t: number) {
      // your spotlight anim: -40px → 0
      return -40 * (1 - easeOutCubic(t));
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // EDGE auto-scroll (only when not dragging)
      if (!state.isDragging) {
        // left / right
        if (state.mouseX < EDGE_ZONE) {
          state.velX -= EDGE_SPEED * (1 - state.mouseX / EDGE_ZONE);
        } else if (state.mouseX > w - EDGE_ZONE) {
          state.velX += EDGE_SPEED * (1 - (w - state.mouseX) / EDGE_ZONE);
        }
        // up / down
        if (state.mouseY < EDGE_ZONE) {
          state.velY -= EDGE_SPEED * (1 - state.mouseY / EDGE_ZONE);
        } else if (state.mouseY > h - EDGE_ZONE) {
          state.velY += EDGE_SPEED * (1 - (h - state.mouseY) / EDGE_ZONE);
        }
      }

      // apply inertia when not dragging
      if (!state.isDragging) {
        state.offsetX += state.velX;
        state.offsetY += state.velY;

        // apply friction
        state.velX *= FRICTION;
        state.velY *= FRICTION;
      } else {
        // when dragging we already updated offset in mousemove; apply light friction to velocity
        state.velX *= 0.98;
        state.velY *= 0.98;
      }

      // Soft clamp / resistance to world bounds
      const maxX = getMaxX();
      const maxY = getMaxY();

      // allow some overscroll
      const xMinAllowed = -w * OVERSCROLL_ALLOWANCE;
      const xMaxAllowed = maxX + w * OVERSCROLL_ALLOWANCE;
      const yMinAllowed = -h * OVERSCROLL_ALLOWANCE;
      const yMaxAllowed = maxY + h * OVERSCROLL_ALLOWANCE;

      // Apply soft resistance if beyond allowed
      if (state.offsetX < xMinAllowed) {
        // push back gently + damp velocity
        const diff = xMinAllowed - state.offsetX;
        state.offsetX += diff * 0.15;
        state.velX *= 0.6;
      } else if (state.offsetX > xMaxAllowed) {
        const diff = state.offsetX - xMaxAllowed;
        state.offsetX -= diff * 0.15;
        state.velX *= 0.6;
      }

      if (state.offsetY < yMinAllowed) {
        const diff = yMinAllowed - state.offsetY;
        state.offsetY += diff * 0.15;
        state.velY *= 0.6;
      } else if (state.offsetY > yMaxAllowed) {
        const diff = state.offsetY - yMaxAllowed;
        state.offsetY -= diff * 0.15;
        state.velY *= 0.6;
      }

      // When velocity is nearly zero and offset is beyond true bounds, gently snap back to bounds
      if (Math.abs(state.velX) < 0.5) {
        if (state.offsetX < 0) state.offsetX += (0 - state.offsetX) * 0.12;
        if (state.offsetX > maxX)
          state.offsetX += (maxX - state.offsetX) * 0.12;
      }
      if (Math.abs(state.velY) < 0.5) {
        if (state.offsetY < 0) state.offsetY += (0 - state.offsetY) * 0.12;
        if (state.offsetY > maxY)
          state.offsetY += (maxY - state.offsetY) * 0.12;
      }

      // clear canvas
      ctx.clearRect(0, 0, w, h);

      // ---- CANVAS DROP-IN ANIMATION ----
      let alpha = 1;
      let scale = 1;
      let translateY = 0;

      if (dropAnim.active) {
        dropAnim.t += 0.045; // speed — adjust for faster/slower

        if (dropAnim.t >= 1) {
          dropAnim.t = 1;
          dropAnim.active = false;
        }

        const t = dropAnim.t;
        alpha = easeOutCubic(t); // fade in
        scale = overshootScale(t); // scale overshoot
        translateY = dropTranslate(t); // vertical slide
      }

      // Apply transform to the entire world
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, translateY);
      ctx.scale(scale, scale);

      // draw tiles (only those visible +/- one tile margin)
      const startCol = Math.max(
        0,
        Math.floor((state.offsetX - tileStep) / tileStep)
      );
      const endCol = Math.min(
        GRID_COLS - 1,
        Math.ceil((state.offsetX + w + tileStep) / tileStep)
      );
      const startRow = Math.max(
        0,
        Math.floor((state.offsetY - tileStep) / tileStep)
      );
      const endRow = Math.min(
        GRID_ROWS - 1,
        Math.ceil((state.offsetY + h + tileStep) / tileStep)
      );

      // draw tiles row by row
      let idx = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++, idx++) {
          // skip completely offscreen tiles for perf
          if (c < startCol || c > endCol || r < startRow || r > endRow)
            continue;

          const img = images[idx];
          const x = c * tileStep - state.offsetX;
          const y = r * tileStep - state.offsetY;

          // draw background frame / gap
          ctx.save();
          // rounded rect clip
          const radius = 8;
          ctx.beginPath();
          roundRectPath(ctx, x, y, TILE_SIZE, TILE_SIZE, radius);
          ctx.closePath();
          ctx.clip();

          // fade-in alpha
          if (state.loaded[idx]) {
            // increment alpha until 1
            state.alphas[idx] = Math.min(1, state.alphas[idx] + 0.06);
          }

          const alpha = state.loaded[idx] ? state.alphas[idx] : 0.0;

          ctx.globalAlpha = 1;
          ctx.restore();

          // draw subtle tile border
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 1;
          roundRectStroke(ctx, x, y, TILE_SIZE, TILE_SIZE, 8);

          // if hovered, draw highlight (outline + slight scale illusion)
          const worldMouseX = state.offsetX + state.mouseX;
          const worldMouseY = state.offsetY + state.mouseY;
          const hoveredCol = Math.floor(worldMouseX / tileStep);
          const hoveredRow = Math.floor(worldMouseY / tileStep);
          const isHovered = hoveredCol === c && hoveredRow === r;

          // smoothing
          const targetScale = isHovered ? 1.28 : 1;
          state.hoverScale[idx] = lerp(
            state.hoverScale[idx],
            targetScale,
            0.18
          );

          // DRAW WITH SCALE
          ctx.save();
          ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.scale(state.hoverScale[idx], state.hoverScale[idx]);
          ctx.translate(-(x + TILE_SIZE / 2), -(y + TILE_SIZE / 2));

          // ---------------- IMAGE CLIP & DRAW ----------------
          ctx.save();
          ctx.beginPath();
          roundRectPath(ctx, x, y, TILE_SIZE, TILE_SIZE, 10);
          ctx.clip();

          if (state.loaded[idx]) {
            ctx.globalAlpha = alpha;

            const iw = img.width;
            const ih = img.height;
            const scale = Math.min(TILE_SIZE / iw, TILE_SIZE / ih);
            const dw = iw * scale;
            const dh = ih * scale;

            const dx = x + (TILE_SIZE - dw) / 2;
            const dy = y + (TILE_SIZE - dh) / 2;

            ctx.drawImage(img, dx, dy, dw, dh);
          } else {
            // placeholder fill
            ctx.fillStyle = `rgba(60,60,60,${0.6})`;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }

          ctx.restore(); // end clip

          // apply scale transform around tile center
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 1;
          roundRectStroke(ctx, x, y, TILE_SIZE, TILE_SIZE, 10);

          // Draw hover outline AFTER scaling
          if (isHovered) {
            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            roundRectStroke(
              ctx,
              x - 2,
              y - 2,
              TILE_SIZE + 4,
              TILE_SIZE + 4,
              12
            );
            ctx.restore();
          }

          ctx.restore(); // END SCALE WRAP
        }
      }

      ctx.restore(); // END OF CANVAS DROP-IN TRANSFORM

      // Optional small HUD: show fps-ish or loaded count
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(
        `Loaded: ${state.loadedCount}/${state.totalTiles}`,
        12,
        canvas.height - 12
      );

      raf = requestAnimationFrame(draw);
    };

    // small helpers for rounded rect drawing
    function roundRectPath(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function roundRectStroke(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      ctx.beginPath();
      roundRectPath(ctx, x, y, w, h, r);
      ctx.stroke();
    }

    // start loop
    raf = requestAnimationFrame(draw);

    // Clean up
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("touchstart", onTouchStart as any);
      canvas.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onOverlayClick(e: MouseEvent) {
      if ((e.target as HTMLElement).id === "overlay") {
        setOnKeyPress(false); // <-- HIDE spotlight + overlay
      }
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setOnKeyPress(false); // <-- HIDE spotlight + overlay
      }
    });

    document.addEventListener("click", onOverlayClick);

    return () => document.removeEventListener("click", onOverlayClick);
  }, []);

  useEffect(() => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";

    function handle(e: KeyboardEvent) {
      if (alphabet.includes(e.key.toLowerCase())) {
        setOnKeyPress(true); // <-- SHOW spotlight + overlay
        document.getElementById("spotlight-container")?.focus();
      }
    }

    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  return (
    <div id="app" className="w-full h-full">
      {onKeyPress && (
        <>
          <div
            id="spotlight-container"
            ref={spotlightRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            className="pointer-events-auto animate-in ease-in transition-all text-white font-sans font-medium duration-200 absolute left-1/3 mx-auto mt-20
                w-[600px] rounded-xl bg-white/10 backdrop-blur-xl shadow-2xl p-6 z-50"
          >

          </div>

          <div
            id="overlay"
            className="absolute inset-0 z-[40] animate-in fade-in duration-200 fade-out duration-200 bg-black/40 backdrop-blur-sm pointer-events-auto"
          />
        </>
      )}

      <div id="canvas" className="w-screen h-screen relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
}
