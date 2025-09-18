import React, { useEffect, useRef } from 'react';
import q5 from 'q5';

// Canvas Background style extracted
const drawBackground = (p) => {
  p.background('#b4e4fdff');
  let innerRadius, outerRadius;
  
  if (p.width < 768) {
    innerRadius = p.width * 0.1;
    outerRadius = p.width * 1.6;
  } else if (p.width >= 768 && p.width <= 1024) {
    innerRadius = p.width * 0.1;
    outerRadius = p.width * 1.1;
  } else {
    innerRadius = p.width * 0.1;
    outerRadius = p.width * 0.6;
  }

  let gradient = p.drawingContext.createRadialGradient(
    p.width / 2, p.height / 2, innerRadius,
    p.width / 2, p.height / 2, outerRadius
  );
  gradient.addColorStop(0.1, 'rgba(230, 230, 230, 0.82)');
  gradient.addColorStop(0.35, 'rgba(211, 211, 211, 0.6)');
  gradient.addColorStop(0.7, 'rgba(197,197,197,0.3)');
  gradient.addColorStop(1, 'transparent');
  
  p.drawingContext.fillStyle = gradient;
  p.drawingContext.fillRect(0, 0, p.width, p.height);
};

// each option has different weight values for corresponding answers
const answerRewiring = {
  question1: { A: 0, B: 0.5, C: 1, D: 0.5 },
  question2: { C: 0, A: 0.5, B: 1, D: 0.5 },
  question3: { C: 0, A: 0.5, B: 1, D: 0.5 },
  question4: { A: 0, B: 0.5, C: 1, D: 0.5 },
  question5: { A: 0, B: 0.5, C: 1, D: 0.5 },
};

// Generate base-color theme
const interpolateColor = (weight) => {
  // coerce to [0,1]
  const safe = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0.5;
  const flippedWeight = 1 - safe;

  const colorStops = [
    { stop: 0.0,  color: { r: 245, g: 4,   b: 8 } },
    { stop: 0.46, color: { r: 241, g: 142, b: 4 } },
    { stop: 0.58, color: { r: 241, g: 233, b: 4 } },
    { stop: 0.75, color: { r: 186, g: 241, b: 4 } },
    { stop: 1.0,  color: { r: 3,   g: 235, b: 8 } },
  ];

  let lower = colorStops[0], upper = colorStops[colorStops.length - 1];
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (flippedWeight >= colorStops[i].stop && flippedWeight <= colorStops[i + 1].stop) {
      lower = colorStops[i]; upper = colorStops[i + 1]; break;
    }
  }
  const range = Math.max(upper.stop - lower.stop, 1e-6);
  const t = (flippedWeight - lower.stop) / range;

  const r = Math.round(lower.color.r + (upper.color.r - lower.color.r) * t);
  const g = Math.round(lower.color.g + (upper.color.g - lower.color.g) * t);
  const b = Math.round(lower.color.b + (upper.color.b - lower.color.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
};

const calculateFinalColor = (answers) => {
  const weights = [];

  Object.keys(answers).forEach((question) => {
    const ans = answers[question];
    const w = answerRewiring[question]?.[ans];
    // push only valid numbers; otherwise use neutral 0.5
    weights.push(typeof w === 'number' ? w : 0.5);
  });

  const avgWeight = weights.length
    ? weights.reduce((s, w) => s + w, 0) / weights.length
    : 0.5;

  return interpolateColor(avgWeight);
};

// Create accent colors from the color interpolation
const generateAccentColors = (baseColor) => {
  const [h, s, l] = rgbToHsl(baseColor);
  // Generate accent variations
  const accent1 = extractRGB(hslToRgb((h + 20) % 360, s, Math.min(l + 0.2, 1))); // Lighter
  const accent2 = extractRGB(hslToRgb((h - 20 + 360) % 360, s, Math.max(l - 0.2, 0))); // Darker
  const accent3 = extractRGB(hslToRgb(h, Math.min(s + 0.2, 1), l)); // More saturated

  return [accent1, accent2, accent3]; 
};
// Convert RGB to HSL
const rgbToHsl = (rgb) => {
  if (!rgb || typeof rgb !== "string" || !rgb.includes("rgb")) {
    console.error("Invalid RGB input in rgbToHsl:", rgb);
    return [0, 0, 0]; // Default to black or some fallback color
  }

  const [r, g, b] = rgb.match(/\d+/g).map(Number).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
};
// Convert HSL to RGB
const hslToRgb = (h, s, l) => {
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
};
// Applying hue shift for effects
const applyHueShift = (baseRGB, shiftAmount) => {
  if (!baseRGB || typeof baseRGB !== "object" || baseRGB.r === undefined) {
    console.warn("Invalid baseRGB input in applyHueShift:", baseRGB);
    return { r: 255, g: 0, b: 0 }; // Debug fallback (red)
  }

  const [h, s, l] = rgbToHsl(`rgb(${baseRGB.r}, ${baseRGB.g}, ${baseRGB.b})`);
  const dynamicHue = (h + Math.sin(performance.now() * 0.004) * shiftAmount) % 360;

  return extractRGB(hslToRgb(dynamicHue, s, l));
};
// Honestly, this is to make p.draw work with opacity value alongside accent colors
const extractRGB = (rgbString) => {
  // If already an object, return it directly
  if (typeof rgbString === "object" && rgbString !== null) {
    return rgbString; 
  }

  // Ensure it's a string before applying match()
  if (typeof rgbString !== "string") {
    console.error("Invalid input to extractRGB:", rgbString);
    return { r: 0, g: 0, b: 0 }; // Fallback to black
  }

  const [r, g, b] = rgbString.match(/\d+/g).map(Number);
  return { r, g, b };
};

// Color transitioning system 1
const parseRgb = (c) => {
  if (c && typeof c === 'object' && 'r' in c) return [c.r, c.g, c.b];
  if (typeof c === 'string') {
    const m = c.match(/\d+/g);
    if (m && m.length >= 3) return m.slice(0,3).map(Number);
  }
  return null;
};

const lerpColor = (color1, color2, t) => {
  const c1 = parseRgb(color1) ?? [150,150,150]; // neutral fallback
  const c2 = parseRgb(color2) ?? c1;
  const tt = Math.min(1, Math.max(0, t ?? 0)); // clamp
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * tt);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * tt);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * tt);
  return `rgb(${r}, ${g}, ${b})`;
};


// Computes average behavior score (0–1) from survey answers
const computeBehaviorScore = (answers) => {
  let total = 0, count = 0;
  Object.keys(answers).forEach((q) => {
    const w = answerRewiring[q]?.[answers[q]];
    total += (typeof w === 'number' ? w : 0.5);
    count++;
  });
  return count ? total / count : 0.5;
};

// Opacity bump toggle behavior (now varied smoothly between min/max)
const applyOpacityToggle = (baseOpacity, speed = 1, minOpacity = 75, maxOpacity = 200, interval = 1200, ease = 0.08) => {
  const tick = Math.floor(performance.now() / interval);

  // Persist state across calls
  if (!applyOpacityToggle.state) {
    applyOpacityToggle.state = {
      lastTick: tick,
      current: (minOpacity + maxOpacity) / 2,
      target: minOpacity + Math.random() * (maxOpacity - minOpacity),
    };
  }

  const st = applyOpacityToggle.state;

  // Pick a new random target every tick
  if (st.lastTick !== tick) {
    st.lastTick = tick;
    st.target = minOpacity + Math.random() * (maxOpacity - minOpacity);
  }

  // Ease current toward target
  st.current += (st.target - st.current) * ease;

  return st.current; // Use as opacity value
};

// Apply scale random behavior effect
const applySquareWaveScale = ( /*baseScale = 1,*/ minScale = 1, maxScale = 1.35, interval = 1200) => {
  const timeFactor = Math.floor(performance.now() / interval); 
  // Generate a new random scale only when timeFactor changes (prevents flickering)
  if (applySquareWaveScale.lastTimeFactor !== timeFactor) {
    applySquareWaveScale.lastTimeFactor = timeFactor;
    applySquareWaveScale.lastRandomScale = Math.random() * (maxScale - minScale) + minScale;
  }
  return applySquareWaveScale.lastRandomScale; // Return the stored random value
};
// random offset behavior effect
const applySquareWaveOffset = (maxOffset = 6, interval = 1200) => {
  const timeFactor = Math.floor(performance.now() / interval);
  // Generate a new random offset only when timeFactor changes (prevents flickering)
  if (applySquareWaveOffset.lastTimeFactor !== timeFactor) {
    applySquareWaveOffset.lastTimeFactor = timeFactor;
    applySquareWaveOffset.lastOffset = {
      x: (Math.random() * 2 - 1) * maxOffset, // Random value between -maxOffset and +maxOffset
      y: (Math.random() * 2 - 1) * maxOffset
    };
  }
  return applySquareWaveOffset.lastOffset; // Return the stored offset
};

/* const applySquareWaveScale = (baseScale = 1, minScale = 1, maxScale = 1.7, speed = 0.02) => {
  const timeFactor = performance.now() * speed;
  const scaleVariation = (Math.sin(timeFactor) + 1) / 2; // Normalize sine wave between 0 and 1
  return minScale + scaleVariation * (maxScale - minScale); // Map to scale range
};*/


const Canvas = ({ answers }) => {
  const shapesRef = useRef([]); 
  const colorsRef = useRef([]); 
  const canvasRef = useRef(null);
  const transitionDuration = 20; // Transition speed in frames
  const colorTransitionRef = useRef(0); // Transition progress
  const previousColorRef = useRef('rgb(150, 150, 150)'); // Start from neutral color

  const elementsVisibilityRef = useRef({
    tree1Visible: false,
    tree2Visible: false,
    tree3Visible: false,
    tree4Visible: false,
    tree5Visible: false,
    cloud1Visible: false,
    cloud2Visible: false,
    cloud3Visible: false,
    cloud4Visible: false,
    cloud5Visible: false,
  });

  useEffect(() => {
    const behaviorScore = computeBehaviorScore(answers);
    const newColor = calculateFinalColor(answers);

    if (Object.keys(answers).length === 0) {
      shapesRef.current = ['neutral-land'];
      colorsRef.current = [newColor];
    } else {
      let shape;
      if (behaviorScore < 0.2) shape = 'lush-environment';
      else if (behaviorScore < 0.4) shape = 'fewer-trees';
      else if (behaviorScore < 0.6) shape = 'chimneys';
      else if (behaviorScore < 0.8) shape = 'acid-rain';
      else shape = 'fireworld';

      previousColorRef.current = colorsRef.current[0] || newColor;
      colorTransitionRef.current = 0;
      shapesRef.current = [shape];
      colorsRef.current = [newColor];
    }

    // Update elements visibility persistently
    const newVisibility = {
      tree1Visible: false,
      tree2Visible: false,
      tree3Visible: false,
      tree4Visible: false,
      tree5Visible: false,
      cloud1Visible: false,
      cloud2Visible: false,
      cloud3Visible: false,
      cloud4Visible: false,
      cloud5Visible: false,
    };

    if (shapesRef.current[0] === 'neutral-land') {
      Object.assign(newVisibility, {
        tree1Visible: true,
        tree2Visible: true,
        tree3Visible: true,
        tree4Visible: true,
        tree5Visible: true,
        cloud1Visible: true,
        cloud2Visible: true,
        cloud3Visible: true,
        cloud4Visible: true,
        cloud5Visible: true,
      });
    } else if (shapesRef.current[0] === 'lush-environment') {
      Object.assign(newVisibility, {
        tree1Visible: true,
        tree2Visible: true,
        tree3Visible: true,
        tree4Visible: true,
        tree5Visible: true,
        cloud1Visible: true,
        cloud2Visible: true,
        cloud3Visible: true,
        cloud4Visible: true,
        cloud5Visible: true,
      });
    } else if (shapesRef.current[0] === 'fewer-trees') {
      Object.assign(newVisibility, {
        tree1Visible: true,
        tree2Visible: true,
        tree3Visible: true,
        tree4Visible: true,
        tree5Visible: true,
        cloud1Visible: true,
        cloud2Visible: true,
        cloud3Visible: true,
        cloud4Visible: false,
        cloud5Visible: true,
      });
    } else if (shapesRef.current[0] === 'chimneys') {
      Object.assign(newVisibility, {
        tree1Visible: true,
        tree2Visible: true,
        tree3Visible: true,
        tree4Visible: false,
        tree5Visible: true,
        cloud1Visible: true,
        cloud2Visible: false,
        cloud3Visible: true,
        cloud4Visible: false,
        cloud5Visible: true,
      });
    } else if (shapesRef.current[0] === 'acid-rain') {
      Object.assign(newVisibility, {
        tree1Visible: true,
        tree2Visible: false,
        tree3Visible: true,
        tree4Visible: false,
        tree5Visible: true,
        cloud1Visible: false,
        cloud2Visible: false,
        cloud3Visible: true,
        cloud4Visible: false,
        cloud5Visible: true,
      });
    } else if (shapesRef.current[0] === 'fireworld') {
      Object.assign(newVisibility, {
        tree1Visible: false,
        tree2Visible: false,
        tree3Visible: true,
        tree4Visible: false,
        tree5Visible: true,
        cloud1Visible: false,
        cloud2Visible: false,
        cloud3Visible: false,
        cloud4Visible: false,
        cloud5Visible: false,
      });
    }

    elementsVisibilityRef.current = newVisibility; // Update persistently
  }, [answers]);

useEffect(() => {
const sketch = (p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);
    p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = () => {
    drawBackground(p);
  
    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const size = Math.min(p.width, p.height) / 6;
  
    if (colorsRef.current.length === 0) return;
  
    if (colorTransitionRef.current < 1) {
      colorTransitionRef.current += 1 / transitionDuration;
    }
    if (colorTransitionRef.current >= 1) {
      previousColorRef.current = colorsRef.current[0];
    }

// Step 1: Lerp base blended color first (smooth transition)
const blendedColor = lerpColor(previousColorRef.current, colorsRef.current[0], colorTransitionRef.current);

// Step 2: Extract RGB values AFTER lerping
const blendedRGB = extractRGB(blendedColor);

// Step 3: Generate accent colors AFTER blendedColor is initialized
const [accent1, accent2, accent3] = generateAccentColors(blendedColor);

// Step 4: Apply oscillation to keep flickering effects
const oscillatingBlended = applyHueShift(blendedRGB, 10);

// Step 5: Apply oscillation FIRST to base accent colors
const oscillatingAccent1 = applyHueShift(extractRGB(lerpColor(blendedColor, accent1, colorTransitionRef.current)), 5);
const oscillatingAccent2 = applyHueShift(extractRGB(lerpColor(blendedColor, accent2, colorTransitionRef.current)), 10);
const oscillatingAccent3 = applyHueShift(extractRGB(lerpColor(blendedColor, accent3, colorTransitionRef.current)), 5);

// Step 6: Mix-Match Colors (Swap R/G/B randomly AFTER oscillation)
const mixedAccent1 = { 
  r: oscillatingAccent2.r, 
  g: oscillatingAccent3.g, 
  b: oscillatingAccent1.b 
};

const mixedAccent2 = { 
  r: oscillatingAccent3.r, 
  g: oscillatingAccent1.g, 
  b: oscillatingAccent2.b 
};

const mixedAccent3 = { 
  r: oscillatingAccent1.r, 
  g: oscillatingAccent2.g, 
  b: oscillatingAccent3.b 
};

// Step 7: Now LERP the mixed colors instead (to maintain smooth transitions)
const accent1Lerp = lerpColor(blendedColor, `rgb(${mixedAccent1.r}, ${mixedAccent1.g}, ${mixedAccent1.b})`, colorTransitionRef.current);
const accent2Lerp = lerpColor(blendedColor, `rgb(${mixedAccent2.r}, ${mixedAccent2.g}, ${mixedAccent2.b})`, colorTransitionRef.current);
const accent3Lerp = lerpColor(blendedColor, `rgb(${mixedAccent3.r}, ${mixedAccent3.g}, ${mixedAccent3.b})`, colorTransitionRef.current);

// Step 8: Extract RGB values AFTER lerping (final result)
const accent1RGB = extractRGB(accent1Lerp);
const accent2RGB = extractRGB(accent2Lerp);
const accent3RGB = extractRGB(accent3Lerp);

// Opacity toggle bumpy behavior
const opacityValue = applyOpacityToggle(255, 1, 75, 200);
p.noStroke();

shapesRef.current.forEach((shape) => {
p.push();
p.translate(centerX, centerY);

    /* Example full shape 
        p.push();
        const { x: offsetX, y: offsetY } = applySquareWaveOffset();
        p.translate(offsetX, offsetY);

        const topFlameScale = applySquareWaveScale(); // Only top flame will scale
        p.scale(topFlameScale);
      
        // Apply fill and draw the triangle
        p.fill(oscillatingBlended.r, oscillatingBlended.g, oscillatingBlended.b, opacityValue);
        p.triangle(-size / 3, size / 3, size / 3, size / 3, 0, -size / 3);
        
        p.pop();*/
    
    // example use: p.fill(getTransitioningColor(blendedColor, 'rgb(50, 50, 50)', colorTransitionRef.current)); for non-weight transition
    // example use with opacity toggle and blended: p.fill(oscillatingBlended.r, oscillatingBlended.g, oscillatingBlended.b, opacityValue);
    // Without opacity toggle but blended: p.fill(oscillatingBlended.r, oscillatingBlended.g, oscillatingBlended.b);

    // Scale example: const topFlameScale = applySquareWaveScale(); // Only top flame will scale
    // p.scale(topFlameScale);
    
    // example use offset (comes before opacity): const { x: offsetX, y: offsetY } = applySquareWaveOffset();
    // p.translate(offsetX, offsetY);

      // Define scaling factors based on viewport width
      
const widthScale = p.width < 1024 ? 0.5 : 1;
const widthScale2 = p.width < 1024 ? 1.15 : 1;
const widthScale3 = p.width < 1024 ? 2.2 : 1;
const heightScale = p.width < 1024 ? -0.15 : 1;
const heightScale2 = p.width < 1024 ? -0.3 : 1;
const heightScale3 = p.width < 1024 ? -0.45 : 1;
const heightOffset = p.width < 1024 ? p.height * -0.47 : 0;
  
const treeHeightFactor = 0.75; 

const elementsVisibility = elementsVisibilityRef.current;

if (elementsVisibility.cloud1Visible) {
  // Cloud 1
  p.push();
  p.translate(p.width * 0.1 * widthScale3, p.height * -0.4 * heightScale3 + heightOffset);
  const { x: offsetX1, y: offsetY1 } = applySquareWaveOffset();
  p.translate(offsetX1, offsetY1);
  const cloudBaseSize1 = size * 1.1;
  const scale1 = applySquareWaveScale();
  p.scale(scale1);
  p.fill(oscillatingBlended.r, oscillatingBlended.g, oscillatingBlended.b, opacityValue);
  p.rect(-cloudBaseSize1 / 3, -cloudBaseSize1 / 3, cloudBaseSize1 / 3 * 2, cloudBaseSize1 / 3 * 2);
  p.pop();
}

if (elementsVisibility.cloud2Visible) {
// Cloud 2
p.push();
p.translate(p.width * 0.05 * widthScale3, p.height * -0.3 * heightScale3 + heightOffset);
const { x: offsetX2, y: offsetY2 } = applySquareWaveOffset();
p.translate(offsetX2, offsetY2);
const cloudBaseSize2 = size * 1;
const scale2 = applySquareWaveScale();
p.scale(scale2);
p.fill(oscillatingAccent1.r, oscillatingAccent1.g, oscillatingAccent1.b, opacityValue);
p.rect(-cloudBaseSize2 / 2, -cloudBaseSize2 / 2, cloudBaseSize2, cloudBaseSize2);
p.pop();
}

if (elementsVisibility.cloud3Visible) {
    // Cloud 3
    p.push();
    p.translate(p.width * 0.01 * widthScale3, p.height * -0.2 * heightScale3 + heightOffset);
    const { x: offsetX3, y: offsetY3 } = applySquareWaveOffset();
    p.translate(offsetX3, offsetY3);
    const cloudBaseSize3 = size * 1;
    const scale3 = applySquareWaveScale();
    p.scale(scale3);
    p.fill(mixedAccent2.r, mixedAccent2.g, mixedAccent2.b, opacityValue);
    p.rect(-cloudBaseSize3 / 4, -cloudBaseSize3 / 4, cloudBaseSize3 / 2, cloudBaseSize3 / 2);
    p.pop();
}

if (elementsVisibility.cloud4Visible) {
// Cloud 4
p.push();
p.translate(p.width * -0.04 * widthScale3, p.height * -0.36 * heightScale3 + heightOffset);
const { x: offsetX4, y: offsetY4 } = applySquareWaveOffset();
p.translate(offsetX4, offsetY4);
const cloudBaseSize4 = size * 1.1;
const scale4 = applySquareWaveScale();
p.scale(scale4);
p.fill(oscillatingAccent3.r, oscillatingAccent2.g, oscillatingAccent1.b, opacityValue);
p.rect(-cloudBaseSize4 / 3, -cloudBaseSize4 / 3, cloudBaseSize4 * 0.75, cloudBaseSize4 * 0.75);
p.pop();
}

if (elementsVisibility.cloud5Visible) {
    // Cloud 5
    p.push();
    p.translate(p.width * -0.1 * widthScale3, p.height * -0.32 * heightScale3 + heightOffset);
    const { x: offsetX5, y: offsetY5 } = applySquareWaveOffset();
    p.translate(offsetX5, offsetY5);
    const cloudBaseSize5 = size * 0.6;
    const scale5 = applySquareWaveScale();
    p.scale(scale5);
    p.fill(oscillatingBlended.r, oscillatingBlended.g, oscillatingBlended.b, opacityValue);
    p.rect(-cloudBaseSize5 / 3, -cloudBaseSize5 / 3, cloudBaseSize5 * 1.2, cloudBaseSize5 * 1.2);
    p.pop();
}

if (elementsVisibility.tree1Visible) {
// Tree 1   
p.push();
p.translate(p.width * -0.4 * widthScale, p.height * 0.2 * heightScale2);
const treeBaseSize1 = size * 1.1; //Smaller tree        
const verticalSpacing1 = treeBaseSize1 * 0.55;

// Draw shadow
p.fill(oscillatingAccent1.r, oscillatingAccent2.g, oscillatingAccent3.b, 100);
const shadowWidth = treeBaseSize1 * 0.8; // Shadow width
const shadowHeight = treeBaseSize1 * 0.2; // More compressed for natural look
p.ellipse(0, treeBaseSize1 / 2 + verticalSpacing1 * 0.2, shadowWidth, shadowHeight);

p.fill(oscillatingAccent1.r, oscillatingAccent2.g, oscillatingAccent3.b);
p.triangle(-treeBaseSize1 / 2, treeBaseSize1 / 2, treeBaseSize1 / 2, treeBaseSize1 / 2, 0, -treeBaseSize1 / 2);
p.fill(mixedAccent1.r, oscillatingAccent1.g, oscillatingAccent1.b);
p.triangle(-treeBaseSize1 / 2 * treeHeightFactor, treeBaseSize1 / 2 - verticalSpacing1, treeBaseSize1 / 2 * treeHeightFactor, treeBaseSize1 / 2 - verticalSpacing1, 0, -treeBaseSize1 / 2 * treeHeightFactor - verticalSpacing1);
p.fill(oscillatingAccent2.r, mixedAccent1.g, mixedAccent3.b);
p.triangle(-treeBaseSize1 / 2 * treeHeightFactor * 0.8, treeBaseSize1 / 2 - 2 * verticalSpacing1, treeBaseSize1 / 2 * treeHeightFactor * 0.8, treeBaseSize1 / 2 - 2 * verticalSpacing1, 0, -treeBaseSize1 / 2 * treeHeightFactor * 0.8 - 2 * verticalSpacing1);
p.pop();
}

if (elementsVisibility.tree2Visible) {
    // Tree 2 (Large)
    p.push();
    p.translate(p.width * 0.4 * widthScale, p.height * 0.2 * heightScale2);
    const treeBaseSize2 = size * 1.1; // Smaller tree
    const verticalSpacing2 = treeBaseSize2 * 0.62;

    // Draw shadow
    p.fill(oscillatingAccent1.r, oscillatingAccent2.g, oscillatingAccent3.b, 90);
    const shadowWidth2 = treeBaseSize2 * 0.8; // Shadow width
    const shadowHeight2 = treeBaseSize2 * 0.2; // More compressed for natural look
    p.ellipse(0, treeBaseSize2 / 2 + verticalSpacing2 * 0.2, shadowWidth2, shadowHeight2);

    p.fill(oscillatingAccent2.r, mixedAccent3.g, oscillatingAccent1.b);
    p.triangle(-treeBaseSize2 / 2, treeBaseSize2 / 2, treeBaseSize2 / 2, treeBaseSize2 / 2, 0, -treeBaseSize2 / 2);
    p.fill(mixedAccent2.r, oscillatingAccent1.g, oscillatingAccent1.b);
    p.triangle(-treeBaseSize2 / 2 * treeHeightFactor, treeBaseSize2 / 2 - verticalSpacing2, treeBaseSize2 / 2 * treeHeightFactor, treeBaseSize2 / 2 - verticalSpacing2, 0, -treeBaseSize2 / 2 * treeHeightFactor - verticalSpacing2);
    p.fill(oscillatingAccent2.r, mixedAccent1.g, mixedAccent3.b);
    p.triangle(-treeBaseSize2 / 2 * treeHeightFactor * 0.8, treeBaseSize2 / 2 - 2 * verticalSpacing2, treeBaseSize2 / 2 * treeHeightFactor * 0.8, treeBaseSize2 / 2 - 2 * verticalSpacing2, 0, -treeBaseSize2 / 2 * treeHeightFactor * 0.8 - 2 * verticalSpacing2);
    p.pop();
}

if (elementsVisibility.tree3Visible) {
// Tree 3 (Medium)
p.push();
p.translate(p.width * -0.2 * widthScale, p.height * 0.1 * heightScale2);
const treeBaseSize3 = size * 0.9; // Default size
const verticalSpacing3 = treeBaseSize3 * 0.42;

// Draw shadow
p.fill(oscillatingAccent1.r, oscillatingAccent2.g, oscillatingAccent3.b, 70);
const shadowWidth3 = treeBaseSize3 * 0.8; // Shadow width
const shadowHeight3 = treeBaseSize3 * 0.2; // More compressed for natural look
p.ellipse(0, treeBaseSize3 / 1.87 + verticalSpacing3 * 0.2, shadowWidth3, shadowHeight3);

p.fill(mixedAccent1.r, mixedAccent3.g, mixedAccent2.b);
p.triangle(-treeBaseSize3 / 2, treeBaseSize3 / 2, treeBaseSize3 / 2, treeBaseSize3 / 2, 0, -treeBaseSize3 / 2);
p.fill(oscillatingAccent2.r, oscillatingAccent2.g, oscillatingAccent1.b);
p.triangle(-treeBaseSize3 / 2 * treeHeightFactor, treeBaseSize3 / 2 - verticalSpacing3, treeBaseSize3 / 2 * treeHeightFactor, treeBaseSize3 / 2 - verticalSpacing3, 0, -treeBaseSize3 / 2 * treeHeightFactor - verticalSpacing3);
p.fill(oscillatingAccent1.r, mixedAccent2.g, mixedAccent1.b);
p.triangle(-treeBaseSize3 / 2 * treeHeightFactor * 0.8, treeBaseSize3 / 2 - 2 * verticalSpacing3, treeBaseSize3 / 2 * treeHeightFactor * 0.8, treeBaseSize3 / 2 - 2 * verticalSpacing3, 0, -treeBaseSize3 / 2 * treeHeightFactor * 0.8 - 2 * verticalSpacing3);
p.pop();
}

if (elementsVisibility.tree4Visible) {
    // Tree 4 (Large)
    p.push();
    p.translate(p.width * -0.3 * widthScale2, p.height * 0.2 * heightScale);
    const treeBaseSize4 = size * 2; // Slightly larger
    const verticalSpacing4 = treeBaseSize4 * 0.42;

    // Draw shadow
    p.fill(oscillatingAccent1.r, oscillatingAccent2.g, oscillatingAccent2.b, 120);
    const shadowWidth4 = treeBaseSize4 * 0.8; // Shadow width
    const shadowHeight4 = treeBaseSize4 * 0.2; // More compressed for natural look
    p.ellipse(0, treeBaseSize4 / 1.9 + verticalSpacing4 * 0.2, shadowWidth4, shadowHeight4);

    p.fill(oscillatingAccent1.r, mixedAccent3.g, mixedAccent1.b);
    p.triangle(-treeBaseSize4 / 2, treeBaseSize4 / 2, treeBaseSize4 / 2, treeBaseSize4 / 2, 0, -treeBaseSize4 / 2);
    p.fill(mixedAccent2.r, oscillatingAccent3.g, oscillatingAccent3.b);
    p.triangle(-treeBaseSize4 / 2 * treeHeightFactor, treeBaseSize4 / 2 - verticalSpacing4, treeBaseSize4 / 2 * treeHeightFactor, treeBaseSize4 / 2 - verticalSpacing4, 0, -treeBaseSize4 / 2 * treeHeightFactor - verticalSpacing4);
    p.fill(oscillatingAccent3.r, mixedAccent2.g, mixedAccent1.b);
    p.triangle(-treeBaseSize4 / 2 * treeHeightFactor * 0.8, treeBaseSize4 / 2 - 2 * verticalSpacing4, treeBaseSize4 / 2 * treeHeightFactor * 0.8, treeBaseSize4 / 2 - 2 * verticalSpacing4, 0, -treeBaseSize4 / 2 * treeHeightFactor * 0.8 - 2 * verticalSpacing4);
    p.pop();
}

if (elementsVisibility.tree5Visible) {
// Tree 5 (Large)
p.push();
p.translate(p.width * 0.3 * widthScale2, p.height * 0.2 * heightScale);
const treeBaseSize5 = size * 2.4; // Larger tree
const verticalSpacing5 = treeBaseSize5 * 0.48;

// Draw shadow
p.fill(mixedAccent3.r, oscillatingAccent2.g, oscillatingAccent2.b, 145);
const shadowWidth5 = treeBaseSize5 * 0.8; // Shadow width
const shadowHeight5 = treeBaseSize5 * 0.2; // More compressed for natural look
p.ellipse(0, treeBaseSize5 / 1.95 + verticalSpacing5 * 0.2, shadowWidth5, shadowHeight5);

p.fill(oscillatingAccent3.r, mixedAccent3.g, mixedAccent2.b);
p.triangle(-treeBaseSize5 / 2, treeBaseSize5 / 2, treeBaseSize5 / 2, treeBaseSize5 / 2, 0, -treeBaseSize5 / 2);
p.fill(oscillatingAccent1.r, mixedAccent2.g, mixedAccent2.b);
p.triangle(-treeBaseSize5 / 2 * treeHeightFactor, treeBaseSize5 / 2 - verticalSpacing5, treeBaseSize5 / 2 * treeHeightFactor, treeBaseSize5 / 2 - verticalSpacing5, 0, -treeBaseSize5 / 2 * treeHeightFactor - verticalSpacing5);
p.fill(mixedAccent1.r, oscillatingAccent1.g, oscillatingAccent1.b);
p.triangle(-treeBaseSize5 / 2 * treeHeightFactor * 0.8, treeBaseSize5 / 2 - 2 * verticalSpacing5, treeBaseSize5 / 2 * treeHeightFactor * 0.8, treeBaseSize5 / 2 - 2 * verticalSpacing5, 0, -treeBaseSize5 / 2 * treeHeightFactor * 0.8 - 2 * verticalSpacing5);
p.pop();
}

/* if (shapesRef.current.includes('neutral-land')) {
  const centerX = p.width / 2;
  const centerY = p.height / 2;

  // Adjust this value if needed
  const adjustedCenterY = centerY + 100;

  const lakeWidth = p.width * 0.2; // 40% of the width
  const lakeHeight = p.height * 0.1; // 10% of the height

  const opacityValue = applyOpacityToggle(255, 1, 100); // Ensure opacity range is correct

  // Lake color (blue)
  p.fill(0, 128, 255, 255);

  // Render the lake
  p.ellipse(centerX, adjustedCenterY, lakeWidth, lakeHeight);
  console.log("CenterX:", centerX, "CenterY:", centerY, "AdjustedCenterY:", adjustedCenterY);
} */
});
};
};

  const q5Instance = new q5(sketch, canvasRef.current);
  return () => q5Instance.remove();
}, []); 

  return (
    <div
      className="q5Canvas"
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
    />
  );
};

export default Canvas;
