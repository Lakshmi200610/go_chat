import express from "express";
import {
  signup,
  login,
  logout,
  updateProfile,
  checkAuth,
  googleAuth,
  googleCallback,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.post("/signup", rateLimiter, signup);
router.post("/login", rateLimiter, login);
router.post("/logout", logout);

router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

router.put("/update-profile", protectRoute, updateProfile);
router.get("/check", protectRoute, checkAuth);

export default router;

