import React, { useRef, useEffect } from "react";
import Lottie from "lottie-react";
import animationData from "./radio-button.json";

const LottieOption = ({ onClick, selected }) => {
  const lottieRef = useRef();

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(2); // Set playback speed to 2x

      if (selected) {
        lottieRef.current.setDirection(1); // Forward direction
        lottieRef.current.playSegments([0, 15], true); // Play to the selected state
      } else {
        lottieRef.current.setDirection(-1); // Reverse direction
        lottieRef.current.playSegments([2, 0], true); // Return to unselected state
      }
    }
  }, [selected]);

  const handleMouseEnter = () => {
    if (lottieRef.current && !selected) {
      lottieRef.current.setSpeed(2); // 🔥 Apply speed for hover animation
      lottieRef.current.setDirection(1); // Forward direction
      lottieRef.current.playSegments([0, 8], true); // Play a short hover segment
    }
  };

  const handleMouseLeave = () => {
    if (lottieRef.current && !selected) {
      lottieRef.current.stop(); // Stop hover animation when mouse leaves
    }
  };

  const handleClick = () => {
    onClick(); // Trigger the parent's click handler
  };

  return (
    <div
      className="radio-button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={false}
        autoplay={false} // Start paused
      />
    </div>
  );
};

export default LottieOption;
