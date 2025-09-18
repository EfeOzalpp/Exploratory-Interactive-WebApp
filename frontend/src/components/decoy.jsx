// src/components/Decoy.jsx
import React, { memo } from "react";

// Drop-in replacement that renders nothing.
// Accepts any props so call sites don't break.
const Decoy = memo(function Decoy(/* props */) {
  return null;
});

export default Decoy;
