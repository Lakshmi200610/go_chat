import User from "../models/User.js";
import { env } from "../lib/env.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";

class AuthService {
  /**
   * Generates Google OAuth 2.0 authorization URL.
   */
  getGoogleAuthUrl(state = "") {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new Error("Google OAuth is not configured. Missing GOOGLE_CLIENT_ID.");
    }

    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "select_account",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid",
      ].join(" "),
      state,
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchanges authorization code with Google for tokens and resolves the user in MongoDB.
   */
  async handleGoogleCallback(code) {
    if (!code) {
      throw new Error("Authorization code missing from Google callback");
    }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials are not configured on the server");
    }

    // 1. Exchange authorization code for tokens with Google
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token exchange error:", tokenData);
      throw new Error(tokenData.error_description || "Failed to exchange Google authorization code");
    }

    // 2. Fetch user identity profile from Google UserInfo endpoint
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userinfoResponse.json();

    if (!userinfoResponse.ok || !googleUser.email) {
      console.error("Google UserInfo fetch error:", googleUser);
      throw new Error("Failed to retrieve user profile from Google");
    }

    const { sub: googleId, email, name, picture } = googleUser;
    const normalizedEmail = email.toLowerCase().trim();

    // 3. User Deduplication & Account Linking Logic
    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }],
    });

    if (user) {
      let isUpdated = false;

      // Link Google ID to existing email account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        isUpdated = true;
      }

      // Update avatar if user has none
      if (!user.profilePic && picture) {
        user.profilePic = picture;
        isUpdated = true;
      }

      if (isUpdated) {
        await user.save();
      }
    } else {
      // 4. Create new user account via Google
      user = new User({
        fullName: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId,
        profilePic: picture || "",
        authProvider: "google",
      });

      await user.save();

      // Trigger non-blocking welcome email
      sendWelcomeEmail(normalizedEmail, user.fullName).catch((err) => {
        console.error("Failed to send welcome email for Google user:", err.message);
      });
    }

    return user;
  }
}

export const authService = new AuthService();
