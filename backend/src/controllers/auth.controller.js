import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { env } from "../lib/env.js";
import { authService } from "../services/auth.service.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      authProvider: "local",
    });

    // Save first, then generate token (avoid setting cookie before DB confirms)
    await newUser.save();
    generateToken(newUser._id, res);

    // Send welcome email in the background — don't block the response
    sendWelcomeEmail(email, fullName).catch((err) => {
      console.error("Failed to send welcome email:", err.message);
    });

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    // Handle duplicate key error from MongoDB
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.password && user.googleId) {
      return res.status(400).json({
        message: "This account was registered using Google. Please sign in with Google.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error in login controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const googleAuth = (req, res) => {
  try {
    if (!env.GOOGLE_CLIENT_ID) {
      return res.redirect(
        `${env.CLIENT_URL}/login?error=${encodeURIComponent(
          "Google OAuth is not configured. Please add GOOGLE_CLIENT_ID to backend/.env"
        )}`
      );
    }
    const state = Math.random().toString(36).substring(7);
    const authUrl = authService.getGoogleAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error("Error in googleAuth controller:", error.message);
    res.redirect(`${env.CLIENT_URL}/login?error=google_auth_failed`);
  }
};

export const googleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    console.error("Google OAuth callback error or user cancellation:", error);
    return res.redirect(`${env.CLIENT_URL}/login?error=oauth_cancelled`);
  }

  try {
    const user = await authService.handleGoogleCallback(code);
    generateToken(user._id, res);
    res.redirect(`${env.CLIENT_URL}/?auth=google_success`);
  } catch (err) {
    console.error("Error in googleCallback controller:", err.message);
    res.redirect(
      `${env.CLIENT_URL}/login?error=${encodeURIComponent(err.message || "oauth_failed")}`
    );
  }
};

export const logout = (req, res) => {
  try {
    const isProduction = env.NODE_ENV === "production";
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    let uploadResponse;
    if (!env.CLOUDINARY_CLOUD_NAME) {
      console.log("[Cloudinary Mock] Uploading base64 image avatar");
      uploadResponse = { secure_url: profilePic };
    } else {
      uploadResponse = await cloudinary.uploader.upload(profilePic);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in update profile controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

