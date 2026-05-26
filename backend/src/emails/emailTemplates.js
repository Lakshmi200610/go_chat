export const getWelcomeEmailTemplate = (fullName) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4f46e5; text-align: center;">Welcome to GoChat, ${fullName}!</h2>
      <p>We are thrilled to have you join our real-time messaging community.</p>
      <p>Here are a few things you can do right now:</p>
      <ul style="line-height: 1.6;">
        <li>Set up your custom avatar in the profile settings.</li>
        <li>Connect with online users instantly.</li>
        <li>Toggle cool alert and typing sounds.</li>
      </ul>
      <p>If you have any questions, feel free to reply to this email.</p>
      <br />
      <p>Best regards,<br />The GoChat Team</p>
    </div>
  `;
};
