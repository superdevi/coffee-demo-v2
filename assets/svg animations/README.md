# Latte Art Pour Animation — Integration Guide

## Overview

SVG latte art that reveals layer-by-layer from a stem point, with liquid displacement that settles into crisp final paths. Designed to plug into a **hold-to-pour** interaction where the player controls the pour progress.

---

## Architecture

```
┌─────────────────────────────────────┐
│  SVG Container (overflow: hidden)   │
│                                     │
│  ┌─ Per-path radial MASK ─────────┐ │
│  │  Expands from stem point       │ │
│  │  Controls WHAT is visible      │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ Per-group displacement FILTER ┐ │
│  │  feTurbulence → feDisplacement │ │
│  │  → feGaussianBlur              │ │
│  │  Controls HOW it looks         │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ CSS opacity fadeIn ───────────┐ │
│  │  Simple opacity 0→1           │ │
│  │  Controls WHEN it appears      │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Three independent systems per path

| System | What it does | SVG element | Animatable property |
|--------|-------------|-------------|-------------------|
| **Mask** | Radial reveal from stem outward | `<radialGradient>` inside `<mask>` | `r` (radius) |
| **Filter** | Liquid distortion → crisp settle | `feDisplacementMap` + `feGaussianBlur` | `scale`, `stdDeviation` |
| **Opacity** | Fade in | CSS `animation` | `opacity` |

---

## Layer Groups (outer → inner)

9 groups, each containing 1–3 SVG paths. Paths within a group animate **simultaneously** for left-right symmetry.

| Group | Color class | Path IDs | Role |
|-------|-----------|----------|------|
| 0 | cls-2 `#a58cb7` | P15 | Outermost ring |
| 1 | cls-6 `#6b1e7d` | P13, P10 | Outer petals |
| 2 | cls-3 `#3a66a7` | P9, P6 | Blue band |
| 3 | cls-1 `#41a13f` | P4, P7 | Green band |
| 4 | cls-9 `#2daa8f` | P11, P12, P8 | Teal accents |
| 5 | cls-5 `#ca5d92` | P5 | Pink petal |
| 6 | cls-4 `#92b542` | P1, P3, P14 | Lime details |
| 7 | cls-7 `#d1b916` | P2 | Yellow center |
| 8 | cls-8 `#ba1f3a` | P0 | Heart (top) |

**Z-order**: Group 0 is first in DOM (renders behind), Group 8 last (renders on top).

---

## Key Parameters

### Displacement (liquid wobble)

```
baseFrequency: 0.0015    // Wave size. Lower = bigger smoother waves
numOctaves: 1             // Noise layers. 1 = smoothest, 3 = more organic detail
scale: 180                // Distortion intensity. 0 = crisp, 200+ = unrecognizable blob
seed: 1                   // Same across all = global coherent motion
```

### Blur (edge smoothing)

```
stdDeviation: 1.5 → 0    // Smooths displacement artifacts, settles to crisp
```

### Mask (reveal shape)

```
Stem point: center-bottom of design (computed from getBBox union)
Radius: 0 → maxDist * 1.2 per path
Gradient: white 0–80%, fade to black at 100% (soft leading edge)
```

### Timing (speed ramp)

```
Groups 0–1:  0.8s stagger  (slow intro)
Groups 2–6:  0.4s stagger  (fast cascade)
Groups 7–8:  1.0s stagger  (slow payoff)
```

---

## Game Integration: Hold-to-Pour

The current animation uses time-based SVG `<animate>` elements. For a hold-to-pour game, replace time-based animation with **progress-driven** control.

### Approach: Replace `begin` delays with JS-driven progress

```javascript
// Instead of:
animate.setAttribute("begin", "2.4s");  // auto-plays at 2.4s

// Use a progress value 0→1 controlled by hold input:
function updatePour(progress) {
  // progress: 0 = empty, 1 = fully poured
  
  // For each layer group, calculate its reveal threshold
  var thresholds = [0, 0.08, 0.16, 0.24, 0.35, 0.46, 0.57, 0.72, 0.88];
  
  for (var g = 0; g < 9; g++) {
    var groupProgress = Math.max(0, Math.min(1,
      (progress - thresholds[g]) / (1 - thresholds[g])
    ));
    
    // Set mask radius directly
    gradient.setAttribute("r", String(groupProgress * targetRadius));
    
    // Set displacement scale (inverse of progress)
    displacement.setAttribute("scale", String(180 * (1 - groupProgress)));
    
    // Set blur
    blur.setAttribute("stdDeviation", String(1.5 * (1 - groupProgress)));
    
    // Set opacity
    path.style.opacity = groupProgress > 0 ? Math.min(1, groupProgress * 3) : 0;
  }
}
```

### Key changes for game mode

1. **Remove all `<animate>` elements** — no auto-play
2. **Remove CSS `animation` properties** — control opacity directly
3. **Add touch/mouse listeners**:
   ```javascript
   var pouring = false, progress = 0;
   canvas.addEventListener("pointerdown", () => pouring = true);
   canvas.addEventListener("pointerup", () => pouring = false);
   
   function tick() {
     if (pouring && progress < 1) progress += 0.008;
     updatePour(progress);
     requestAnimationFrame(tick);
   }
   tick();
   ```

4. **Pour speed curve** — use easing on the increment for satisfying feel:
   ```javascript
   // Slow start, fast middle, slow finish
   var speed = 0.003 + 0.012 * Math.sin(progress * Math.PI);
   if (pouring) progress = Math.min(1, progress + speed);
   ```

5. **Drip back** — if player releases, pour slowly reverses:
   ```javascript
   if (!pouring && progress > 0) progress = Math.max(0, progress - 0.002);
   ```

### Performance notes

- `feTurbulence` is computed once per render — at 180 scale with 1 octave it's lightweight
- `feDisplacementMap` is the main cost — 9 filters (one per group) is manageable
- For mobile, consider reducing to 5–6 groups by merging middle layers
- The `feGaussianBlur` can be dropped once displacement scale drops below ~30 (artifacts become imperceptible)
- `requestAnimationFrame` at 60fps with direct attribute manipulation is smooth

### Preserving aesthetics in game context

- Keep `overflow: hidden` on the container — displacement must not leak
- Keep `seed: 1` global — all layers move as one liquid body
- Keep the radial mask origin at stem point — the reveal always grows from the pour contact
- The soft gradient edge on the mask (80%→100% fade) is what makes the reveal feel liquid vs mechanical — don't remove it
- Layer z-order is load-bearing — outer behind, inner on top, heart last

---

## File Structure

```
latte_art_animation.txt   — Complete standalone HTML (copy to .html to run)
README.md                 — This file
latteart_final_v2.svg     — Source SVG with color-coded layers
```
