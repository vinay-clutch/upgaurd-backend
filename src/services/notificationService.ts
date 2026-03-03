import { Resend } from "resend";

// Use env variable instead of hardcoded key
const resend = new Resend(process.env.Mail_API);

export const notificationService = {
  async sendEmail(to: string, subject: string, html: string) {
    try {
      const response = await resend.emails.send({
        from: "noreply@upgaurd.com",
        to,
        subject,
        html,
      });

      if (response.error) {
        console.error("Email send error:", response.error);
        return { success: false, error: response.error };
      }

      console.log("✅ Email sent successfully:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("❌ Failed to send email:", error);
      return { success: false, error };
    }
  },

  async sendWelcomeEmail(email: string, name: string) {
    const html = `
      <h1>Welcome to Upguard, ${name}!</h1>
      <p>Your account has been successfully created.</p>
      <p>Start monitoring your systems now!</p>
    `;

    return this.sendEmail(email, "Welcome to Upguard", html);
  },

  async sendAlertEmail(email: string, alertMessage: string) {
    const html = `
      <h2>⚠️ Security Alert</h2>
      <p>${alertMessage}</p>
      <p>Please check your dashboard for more details.</p>
    `;

    return this.sendEmail(email, "Upguard Security Alert", html);
  },
};
