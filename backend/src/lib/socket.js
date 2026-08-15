import { Server } from "socket.io";
import http from "http";
import express from "express";
import { env } from "./env.js";
import { socketAuth } from "../middleware/socket.auth.middleware.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [env.CLIENT_URL];
      if (env.NODE_ENV === "development") {
        allowedOrigins.push(
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3000",
          "http://127.0.0.1:3000"
        );
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
});

// Map<userId, Set<socketId>> for multi-tab and multi-device connection tracking
const userSockets = new Map();

export const getReceiverSocketId = (receiverId) => {
  const sockets = userSockets.get(receiverId?.toString());
  if (sockets && sockets.size > 0) {
    return Array.from(sockets)[0];
  }
  return null;
};

export const isUserOnline = (userId) => {
  return userSockets.has(userId?.toString()) && userSockets.get(userId.toString()).size > 0;
};

export const getOnlineUserIds = () => {
  return Array.from(userSockets.keys());
};

io.use(socketAuth);

io.on("connection", (socket) => {
  const userId = socket.user?._id?.toString() || socket.handshake.query?.userId;

  if (userId && userId !== "undefined") {
    // Join user's personal room for direct multi-device delivery
    socket.join(userId);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Broadcast updated active presence list
    io.emit("getOnlineUsers", getOnlineUserIds());
  }

  // --- Real-time Typing Handlers ---
  socket.on("typing", (data) => {
    if (!userId) return;
    if (data && data.receiverId) {
      io.to(data.receiverId.toString()).emit("typing", {
        senderId: userId,
        isTyping: data.isTyping !== undefined ? data.isTyping : true,
      });
    } else if (data && data.conversationId) {
      socket.to(data.conversationId.toString()).emit("typing", {
        senderId: userId,
        conversationId: data.conversationId,
        isTyping: data.isTyping !== undefined ? data.isTyping : true,
      });
    }
  });

  socket.on("stop typing", (data) => {
    if (!userId) return;
    const target = typeof data === "string" ? data : data?.receiverId || data?.conversationId;
    if (target) {
      io.to(target.toString()).emit("typing", { senderId: userId, isTyping: false });
      socket.to(target.toString()).emit("stop typing", { senderId: userId });
    }
  });

  // --- Conversation Room Handlers ---
  socket.on("join chat", (roomId) => {
    if (roomId) {
      socket.join(roomId.toString());
    }
  });

  socket.on("joinConversation", (roomId) => {
    if (roomId) {
      socket.join(roomId.toString());
    }
  });

  socket.on("leave chat", (roomId) => {
    if (roomId) {
      socket.leave(roomId.toString());
    }
  });

  socket.on("leaveConversation", (roomId) => {
    if (roomId) {
      socket.leave(roomId.toString());
    }
  });

  // --- Message Read Receipt Event ---
  socket.on("markAsRead", async (data) => {
    const conversationId = typeof data === "string" ? data : data?.conversationId;
    if (conversationId && userId) {
      try {
        const { messageService } = await import("../services/message.service.js");
        await messageService.markMessagesAsRead(conversationId, userId);
      } catch (err) {
        console.error("Error marking messages as read via socket:", err.message);
      }
    }
  });

  socket.on("disconnect", () => {
    if (userId && userSockets.has(userId)) {
      const sockets = userSockets.get(userId);
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        userSockets.delete(userId);
        // Only broadcast offline when all tabs/devices for this user have disconnected
        io.emit("getOnlineUsers", getOnlineUserIds());
      }
    }
  });
});

export { io, app, server };


