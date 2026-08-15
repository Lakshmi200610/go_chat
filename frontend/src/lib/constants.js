/**
 * Centralized backend URL configuration.
 * In production (Vercel), uses VITE_BACKEND_URL (e.g. https://go-chat-backend.onrender.com).
 * In local development, falls back to http://localhost:3000.
 */
export const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL || "").trim() ||
  (import.meta.env.MODE === "development" ? "http://localhost:3000" : "");
