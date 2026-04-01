const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT & attach user to req
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        return res.status(401).json({ msg: "Not authorized" });
      }
      next();
    } catch (err) {
      console.error(err);
      return res.status(401).json({ msg: "Not authorized" });
    }
  }

  if (!token) {
    return res.status(401).json({ msg: "Not authorized, no token" });
  }
};

// Role-based access
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: `Role (${req.user.role}) not allowed to access this route` });
    }
    next();
  };
};

module.exports = { protect, authorize };
