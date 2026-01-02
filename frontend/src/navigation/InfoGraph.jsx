const SimpleComponent = () => {
  return (
    <div>
      <div className="text-divider">
        <h1 className="title-divider">The Idea</h1>

        <p className="info-divider">
          Sure, governments can set rules to reduce our climate impact. But let’s be real, change doesn’t come from policies or protests alone. That’s not enough to shift the weight of what gets funded or prioritized.
          <br /><br />
          What actually tips the scale is us: the sticky habits we own. Whether we are out there in the <span style={{ color: "#002775ff", fontWeight: "600" }}>City</span> or at <span style={{ color: "#087500ff", fontWeight: "600" }}>MassArt</span>, we all have our own story, habits and tendencies. When we connect those stories, the small decisions add up. They become a loop of motivation that keeps growing. Every response shared is proof that your choices and necessities aren't negligible, you're part of something bigger.
        </p>
      </div>

      <div className="main-graph-divider">
        <div className="divider red">
          <div className="dot dot-red"></div>
          <div className="dot-text">
            <h3>Red</h3>
            <p>Start by looking <u>inwards</u>, any habit that lowkey brings you down, probably weights on our natural environment.</p>
          </div>
        </div>

        <div className="divider yellow">
          <div className="dot dot-yellow"></div>
          <div className="dot-text">
            <h3>Yellow</h3>
            <p>Old habits die hard. It's a common response in this era with so much dependency on industry.</p>
          </div>
        </div>

        <div className="divider green">
          <div className="dot dot-green"></div>
          <div className="dot-text">
            <h3>Green</h3>
            <p>You're a natural, if more people act as you do, we can hope to see a cleaner, abundant future.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleComponent;
