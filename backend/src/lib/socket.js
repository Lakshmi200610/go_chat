import { Server } from "socket.io";
import http from "http";
import express from "express";
import { env } from "./env.js";
import { socketAuth } from "../middleware/socket.auth.middleware.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [env.CLIENT_URL],
    credentials: true,
  },
});

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

const userSocketMap = {}; // {userId: socketId}

io.use(socketAuth);

io.on("connection", (socket) => {
  const userId = socket.user?._id?.toString() || socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    // Join personal room for smooth multi-device delivery
    socket.join(userId);
    userSocketMap[userId] = socket.id;
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  // --- Current go_chat typing logic enhanced with rooms ---
  socket.on("typing", (data) => {
    // Check if it's the old go_chat payload or the provided snippet payload
    if (data && data.receiverId !== undefined) {
      io.to(data.receiverId).emit("typing", { senderId: userId, isTyping: data.isTyping });
    } else if (typeof data === "string") {
      socket.in(data).emit("typing");
    }
  });

  // --- Snippet Functionality Added ---
  socket.on("setup", (userData) => {
    if (userData && userData._id) {
      socket.join(userData._id);
      socket.emit("connected");
    }
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;
    if (!chat || !chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });
  // -----------------------------------

  socket.on("disconnect", () => {
    if (userId && userId !== "undefined") {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

export { io, app, server };
