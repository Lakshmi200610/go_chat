import jwt from "jsonwebtoken";
import { env } from "./env.js";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProduction = env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });

  return token;
};

