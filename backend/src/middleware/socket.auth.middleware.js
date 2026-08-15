import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../lib/env.js";

const parseCookies = (cookieString) => {
  const list = {};
  if (!cookieString) return list;

  cookieString.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURI(parts.join("="));
    }
  });

  return list;
};


export const socketAuth = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    let token = cookies.jwt || socket.handshake.auth?.token;

    // Support Bearer auth in handshake headers
    if (!token && socket.handshake.headers.authorization) {
      const parts = socket.handshake.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      // In development fallback, if query has token or if userId is passed, verify token
      const queryToken = socket.handshake.query.token;
      if (queryToken) {
        token = queryToken;
      } else if (env.NODE_ENV === "development" && socket.handshake.query.userId) {
        // Fallback for dev convenience if cookies are cross-domain, but check DB user
        const devUser = await User.findById(socket.handshake.query.userId).select("-password");
        if (devUser) {
          socket.user = devUser;
          return next();
        }
      }
      return next(new Error("Authentication error: Token missing"));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return next(new Error("Authentication error: Invalid token"));
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error("Socket authentication middleware error:", error.message);
    next(new Error("Authentication error: Unauthorized"));
  }
};

