import resend from "../lib/resend.js";
import { getWelcomeEmailTemplate } from "./emailTemplates.js";
import { env } from "../lib/env.js";

export const sendWelcomeEmail = async (email, fullName) => {
  if (!resend) {
    console.log(`[Resend Mock] Welcome email to ${email} (Name: ${fullName}) skipped: RESEND_API_KEY not configured.`);
    return;
  }

  try {
    const fromAddress = env.EMAIL_FROM;
    const fromName = env.EMAIL_FROM_NAME;
    
    await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: email,
      subject: "Welcome to GoChat!",
      html: getWelcomeEmailTemplate(fullName),
    });
    console.log(`Welcome email successfully sent to ${email}`);
  } catch (error) {
    console.error(`Error sending welcome email to ${email}:`, error);
  }
};
