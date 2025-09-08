import React, { useRef, useEffect, useState, Suspense } from "react";

// lazy-load the wrapper
const Lottie = React.lazy(() =>
  import(/* webpackChunkName: "lottie-react" */ "lottie-react")
);

const LottieOption = ({ onClick, selected }) => {
  const lottieRef = useRef(null);
  const [animationData, setAnimationData] = useState(null);

  // lazy-load the JSON too
  useEffect(() => {
    let alive = true;
    import(
      /* webpackChunkName:"lottie-radio" */ "./radio-button.json"
    ).then((mod) => {
      if (alive) setAnimationData(mod.default || mod);
    });
    return () => {
      alive = false;
    };
  }, []);

  // sync selection → animation state
  useEffect(() => {
    if (!lottieRef.current) return;
    lottieRef.current.setSpeed(2);
    if (selected) {
      lottieRef.current.setDirection(1);
      lottieRef.current.playSegments([0, 15], true);
    } else {
      lottieRef.current.setDirection(-1);
      lottieRef.current.playSegments([2, 0], true);
    }
  }, [selected]);

  const handleMouseEnter = () => {
    if (lottieRef.current && !selected) {
      lottieRef.current.setSpeed(2);
      lottieRef.current.setDirection(1);
      lottieRef.current.playSegments([0, 8], true);
    }
  };

  const handleMouseLeave = () => {
    if (lottieRef.current && !selected) {
      lottieRef.current.stop();
    }
  };

  return (
    <div
      className="radio-button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Suspense fallback={<div className="lottie-skeleton" />}>
        {animationData && (
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={false}
            autoplay={false}
          />
        )}
      </Suspense>
    </div>
  );
};

export default LottieOption;
