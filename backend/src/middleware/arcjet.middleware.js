import aj from "../lib/arcjet.js";

export const rateLimiter = async (req, res, next) => {
  if (!aj) {
    return next();
  }

  try {
    const decision = await aj.protect(req, { requested: 1 });
    
    if (decision.isDenied()) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    
    next();
  } catch (error) {
    console.error("Arcjet protection error:", error);
    next();
  }
};
