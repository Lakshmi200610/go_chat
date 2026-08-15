import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`CRITICAL ERROR: Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

export const env = {
  get PORT() {
    return process.env.PORT || 3000;
  },
  get MONGO_URI() {
    return process.env.MONGO_URI;
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || "development";
  },
  get JWT_SECRET() {
    return process.env.JWT_SECRET;
  },
  get CLOUDINARY_CLOUD_NAME() {
    return process.env.CLOUDINARY_CLOUD_NAME;
  },
  get CLOUDINARY_API_KEY() {
    return process.env.CLOUDINARY_API_KEY;
  },
  get CLOUDINARY_API_SECRET() {
    return process.env.CLOUDINARY_API_SECRET;
  },
  get RESEND_API_KEY() {
    return process.env.RESEND_API_KEY;
  },
  get EMAIL_FROM() {
    return process.env.EMAIL_FROM || "onboarding@resend.dev";
  },
  get EMAIL_FROM_NAME() {
    return process.env.EMAIL_FROM_NAME || "GoChat";
  },
  get ARCJET_KEY() {
    return process.env.ARCJET_KEY;
  },
  get ARCJET_ENV() {
    return process.env.ARCJET_ENV || "development";
  },
  get CLIENT_URL() {
    return process.env.CLIENT_URL || "http://localhost:5173";
  },
  get GOOGLE_CLIENT_ID() {
    return (process.env.GOOGLE_CLIENT_ID || "").trim();
  },
  get GOOGLE_CLIENT_SECRET() {
    return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  },
  get GOOGLE_REDIRECT_URI() {
    return (
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback"
    ).trim();
  },
};


