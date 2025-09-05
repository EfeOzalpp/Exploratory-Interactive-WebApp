/* Top Bar */
const Logo = () => {
  return (
    <div className="logo-container">
      <div className="logo-divider">
        <img
          src={`${process.env.PUBLIC_URL}/Butterfly-habits-logo-tp.svg`}
          alt="Butterfly Habits Logo"
          className="logo-image"
        />
      </div>
    </div>
  );
};

export default Logo;
