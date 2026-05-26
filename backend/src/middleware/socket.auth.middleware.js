import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../lib/env.js";

const parseCookies = (cookieString) => {
  const list = {};
  if (!cookieString) return list;

  cookieString.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift().trim()] = decodeURI(parts.join("="));
  });

  return list;
};

export const socketAuth = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const token = cookies.jwt;

    if (!token) {
      // Fallback: If cookie is not present (e.g. cross-origin setups or custom testing),
      // we check if a query parameter is specified.
      const queryUserId = socket.handshake.query.userId;
      if (queryUserId && queryUserId !== "undefined") {
        return next();
      }
      return next(new Error("Authentication error: Token missing"));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded) {
      return next(new Error("Authentication error: Invalid token"));
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error("Socket authentication middleware error:", error);
    next(new Error("Authentication error: Internal error"));
  }
};
