import { Resend } from "resend";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Load env from Backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const resend = new Resend(process.env.Mail_API);

async function testAlerts() {
  console.log("🚀 Starting Alert Verification System...");

  const testEmail = process.env.TEST_EMAIL || "vinayvinay0256@gmail.com"; // Default for testing if not set
  const testDiscordWebhook = process.env.TEST_DISCORD_WEBHOOK;

  console.log(`\n📧 Testing Email via Resend to: ${testEmail}`);
  try {
    if (!process.env.Mail_API) {
      throw new Error("Mail_API not found in .env");
    }

    const emailResponse = await resend.emails.send({
      from: "UpGuard <onboarding@resend.dev>",
      to: [testEmail],
      subject: "🧪 UpGuard: Alert Verification System",
      html: `
        <div style="font-family:sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3b82f6;">🧪 Connection Successful!</h2>
          <p>This is a dummy payload from the <strong>Alert Verification System</strong>.</p>
          <p>If you received this, your Email integration with Resend is working correctly.</p>
          <hr />
          <p style="font-size: 12px; color: #666;">UpGuard Monitoring System</p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("❌ Resend Error:", emailResponse.error);
    } else {
      console.log("✅ Email sent successfully! Check your inbox.");
    }
  } catch (err: any) {
    console.error("❌ Email Failed:", err.message);
  }

  console.log(`\n🤖 Testing Discord Webhook...`);
  try {
    if (!testDiscordWebhook) {
      console.warn("⚠️ TEST_DISCORD_WEBHOOK not found in .env. Skipping Discord test.");
    } else {
      const discordResponse = await axios.post(testDiscordWebhook, {
        embeds: [{
          title: "🧪 UpGuard: Alert Verification",
          description: "This is a dummy payload to verify the Discord Webhook connection.",
          color: 0x3b82f6,
          fields: [
            { name: "Status", value: "✅ INTEGRATION WORKING", inline: true },
            { name: "Environment", value: "Development", inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      });
      
      if (discordResponse.status === 204 || discordResponse.status === 200) {
        console.log("✅ Discord message sent successfully!");
      } else {
        console.error("❌ Discord returned unexpected status:", discordResponse.status);
      }
    }
  } catch (err: any) {
    if (err.response) {
      console.error("❌ Discord Webhook Invalid:", err.response.data);
    } else {
      console.error("❌ Discord Failed:", err.message);
    }
  }

  console.log("\n✨ Verification Complete.");
}

testAlerts().catch(err => {
  console.error("💥 Critical Failure in Verification System:", err);
});
