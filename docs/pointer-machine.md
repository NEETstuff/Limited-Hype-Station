# Pointer Machine

View-only control layer for `/` (generative art). The seed, plate, stripe bits,
and `#meta` are frozen by `FIELD-CONTRACT.md`. This machine only drives the
view transform on top of cached plates. Compute and keys are brought by the
operator or agent, never this host.

## Terms

- **Down point:** the client coordinates of the active `pointerdown`.
- **Total movement:** distance in CSS px from the down point to the current pointer position.
- **Threshold:** 6 CSS px from the down point. At or below threshold: click-candidate. Above: drag.
- **Identity:** `yaw = pitch = px = py = 0`. Composites to the current plate.
- **Star-center:** the center of the node circle in the upper band.
- **Hottest bishop cell:** the visited cell with the highest visit count.
- **Door:** one unlabeled target pointing to `/desk.html`.

## States

- `idle` — identity view, scanline on the 25s period.
- `pending` — pointer down, movement still within threshold, no mode committed.
- `dragging-orbit` — drag committed to orbit (clamped yaw/pitch + small parallax).
- `scrubbing-scan` — drag committed to scrub (vertical move sets `scanY`).
- `click-candidate` — released within threshold; resolves to door navigation or back to `idle`.

## Events

`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`.

## Rules

- **Orbit clamps:** yaw ±12deg, pitch ±8deg. Parallax stays a few CSS px.
- **Release:** ease 400ms back to identity (not park), so a quiet tab matches golden idle.
- **Scrub:** vertical move sets `scanY`; on release, resume the 25s period from that Y.
- **Door:** if total movement < 6px and the release target is star-center OR the hottest bishop cell, navigate to `/desk.html`. Otherwise return to `idle`.
- **Touch:** `touch-action: none` on the canvas and `#door` so pointer events own the gesture.
- **Reduced motion:** ignore orbit, parallax, and scrub; door only. View stays locked at identity with the scanline at mid-height.

## State table

| State | Event | Condition | Next state |
|---|---|---|---|
| `idle` | `pointerdown` | — | `pending` |
| `pending` | `pointermove` | total movement < 6px | `pending` |
| `pending` | `pointermove` | total movement ≥ 6px, orbit gesture | `dragging-orbit` |
| `pending` | `pointermove` | total movement ≥ 6px, vertical scrub gesture | `scrubbing-scan` |
| `pending` | `pointerup` | total movement < 6px on star-center or hottest cell | `click-candidate` → navigate `/desk.html` |
| `pending` | `pointerup` | total movement < 6px elsewhere | `idle` |
| `pending` | `pointercancel` / `lostpointercapture` | — | `idle` |
| `dragging-orbit` | `pointermove` | — | `dragging-orbit` (clamped) |
| `dragging-orbit` | `pointerup` | — | `idle` (ease 400ms to identity) |
| `dragging-orbit` | `pointercancel` / `lostpointercapture` | — | `idle` (ease 400ms to identity) |
| `scrubbing-scan` | `pointermove` | — | `scrubbing-scan` (set `scanY`) |
| `scrubbing-scan` | `pointerup` | — | `idle` (resume 25s period from that Y) |
| `scrubbing-scan` | `pointercancel` / `lostpointercapture` | — | `idle` (resume 25s period from that Y) |
| `click-candidate` | resolve | door target | navigate `/desk.html` |
| `click-candidate` | resolve | not a door target | `idle` |
| any | reduced-motion active | — | orbit/parallax/scrub ignored; door only |
