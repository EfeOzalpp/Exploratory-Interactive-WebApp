### Butterfly Effect
Procedural web application built with React, Canvas, and Three.js.

<p>
  <img src="./screenshots+gifs/survey.gif" width="45%" />
  <img src="./screenshots+gifs/visualization.gif" width="45%" />
</p>

A weight-based questionnaire feeds continuous input into a deterministic 2D rendering system, whose output is reused as sprite textures in a Three.js scene visualizing both personalized and previous responses. 

Live at: https://butterflyeff3ct.online/

Notable implementations:
- Stores survey results together with user category (visitor, student, staff/faculty) in a Sanity.io schema and uses this data after completion for sorting and visualization.
- Uses a grid-based layout system for 2D canvas rendering to manage sprite placement and prevent overlap with other UI elements.
- Renders graphics as reusable off-screen sprite textures, including snapshotting particle-based visuals after a short simulation step.
- Maintains performance and scalability by limiting the number of render variants, reusing cached textures, preventing duplicate texture generation on first load, and preparing textures off-screen for smoother initial rendering.

#### Key code entry points: 

Weighted-survey: https://github.com/EfeOzalpp/butterfly-effect/tree/main/frontend/src/components/survey

2D canvas: https://github.com/EfeOzalpp/butterfly-effect/tree/main/frontend/src/canvas 

3D scene: https://github.com/EfeOzalpp/butterfly-effect/tree/main/frontend/src/components/dotGraph

<br />

Each step below corresponds to the screenshots shown from left to right.
<br />
Onboarding | Questionnaire | "Your city" button toggled state
<br />
<p>
  <img src="./screenshots+gifs/mobile1.png" width="15%" />
  <img src="./screenshots+gifs/mobile3.png" width="15%" />
  <img src="./screenshots+gifs/mobile4.png" width="15%" />
</p>

<br />

3D scene entered from "explore answers" or 3D scene entered through survey completion | 
<br />
Solo mode and dark mode toggled separately
<br />
<p>
  <img src="./screenshots+gifs/mobile5.png" width="15%" />
  <img src="./screenshots+gifs/mobile8.png" width="15%" />
  <img src="./screenshots+gifs/mobile9.png" width="15%" />
</p>

#### Tech used
- React 18
- Three.js / React Three Fiber  
- HTML Canvas  
- TypeScript  
- Sanity.io (CMS) 

