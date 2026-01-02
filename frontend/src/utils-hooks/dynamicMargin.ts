import { useEffect } from "react";

export const useDynamicMargin = (): void => {
  useEffect(() => {
    const calculateMargin = (): void => {
      const minHeight = 200;
      const maxHeight = 2000;
      const minMargin = 68;
      const maxMargin = -146;

      const currentHeight = window.innerHeight;

      // Normalize height to range [0,1]
      const normalizedHeight = Math.min(
        Math.max((currentHeight - minHeight) / (maxHeight - minHeight), 0),
        1
      );

      // Interpolate value
      const newMargin = minMargin + (maxMargin - minMargin) * normalizedHeight;

      // Apply the CSS variable only to the specified selectors
      const elements = document.querySelectorAll(
        ".z-index-respective .survey-section-wrapper .survey-section, " +
        ".z-index-respective .survey-section-wrapper2 .survey-section"
      );

      elements.forEach((el) => {
        (el as HTMLElement).style.setProperty("--dynamic-margin", `${newMargin}px`);
      });
    };

    // Initial calculation
    calculateMargin();

    // Update on resize
    window.addEventListener("resize", calculateMargin);
    window.addEventListener("load", calculateMargin);
    return () => {
      window.removeEventListener("resize", calculateMargin);
      window.removeEventListener("load", calculateMargin);
    };
  }, []);
};
