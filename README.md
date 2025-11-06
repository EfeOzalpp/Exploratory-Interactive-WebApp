# Participatory Climate App — 3D Interactive Survey Experience

<div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
  <div>
    <img src="./project_screenshots/1.png" style="width: 45%; min-width: 300px;" alt="Climate Inclusive App">
    <img src="./project_screenshots/4.png" style="width: 45%; min-width: 300px;" alt="Climate Inclusive App">
  </div>
  <div>
    <img src="./project_screenshots/2.png" style="width: 45%; min-width: 300px;" alt="Climate Inclusive App">
    <img src="./project_screenshots/3.png" style="width: 45%; min-width: 300px;" alt="Climate Inclusive App">
  </div>
</div>

**Participatory Climate App** is an interactive web application that visualizes survey results about climate change in a 3D environment.  
After completing a short climate survey, users receive personalized feedback represented through color-coded, world-anchored cards, and can explore other participants’ results in a live, orbitable 3D world.

---

## Features

- **Gamified Feedback Cards**  
  Personalized results with adaptive gradients, contextual tone, and motion-based feedback.

- **3D Visualization (Three.js & React Three Fiber)**  
  Explore participants’ responses in an interactive 3D environment with orbit, zoom, and dynamic node logic.

- **Custom 2D Canvas Engine**  
  A lightweight, hand-built rendering engine (not dependent on p5.js or PixiJS) for animated environmental shapes such as clouds, houses, and trees.

- **Responsive & Touch-Ready UI**  
  Supports pinch-zoom, drag, rotate, and smooth element transitions. Optimized for accessibility and motion comfort.

- **Dynamic Offset Anchoring System**  
  Keeps 2D DOM elements visually aligned with their 3D anchors, automatically managing edge cases like viewport clipping.

---

## Technical Highlights

### Bridging 3D Context with React DOM

The app integrates **Three.js (via React Three Fiber)** with **React DOM** through a custom anchoring system.  
Unlike `@react-three/drei`’s `Html` component, this approach introduces a dynamic offset system to preserve alignment and spatial consistency during camera motion.

```js
transform: translateX(var(--offset-px));
