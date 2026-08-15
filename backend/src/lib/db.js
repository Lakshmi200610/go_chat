import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (env.NODE_ENV === "development" && env.MONGO_URI !== "mongodb://127.0.0.1:27017/go_chat") {
      try {
        console.log("Attempting fallback connection to local MongoDB (mongodb://127.0.0.1:27017/go_chat)...");
        const fallbackConn = await mongoose.connect("mongodb://127.0.0.1:27017/go_chat");
        console.log(`MongoDB Connected (Local Fallback): ${fallbackConn.connection.host}`);
        return;
      } catch (fallbackErr) {
        console.error(`Local fallback also failed: ${fallbackErr.message}`);
      }
    }
  }
};

