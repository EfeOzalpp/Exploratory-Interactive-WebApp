const SimpleComponent = () => {
  return (
    <div>
      <div className="text-divider">
        <h1 className="title-divider">The Idea</h1>

        <p className="info-divider">
          Sure, governments can set rules to reduce our climate impact. But let’s be real, change doesn’t come from policies or protests alone. That’s not enough to shift the weight of what gets funded or prioritized.
          <br /><br />
          What actually tips the scale is us: the way we spend our attention, the habits we stick with, the choices we make together. At <span style={{ color: "#0ba100ff", fontWeight: "600" }}>MassArt</span>, every department has its own story, its own way of showing how change can start close to home. When we connect those stories, the small decisions add up. They become a loop of motivation that keeps growing. And every piece of data we share is proof that you’re not doing this alone, you’re part of something bigger.
        </p>
      </div>

      <div className="main-graph-divider">
        <div className="divider">
          <div className="dot dot-red"></div>
          <div className="dot-text">
            <h3>Red</h3>
            <p>Start by looking <u>inwards</u>, any habit that lowkey brings you down, probably weights on our natural environment.</p>
          </div>
        </div>

        <div className="divider">
          <div className="dot dot-yellow"></div>
          <div className="dot-text">
            <h3>Yellow</h3>
            <p>Old habits die hard. It's a common response in this era with so much dependency on industry.</p>
          </div>
        </div>

        <div className="divider">
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
