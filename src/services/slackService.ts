import axios from 'axios';

export async function sendSlackAlert(
  webhookUrl: string,
  websiteUrl: string,
  status: string,
  responseMs?: number,
  errorType?: string
) {
  const isDown = status === 'Down';
  
  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: isDown ? "🚨 Website Down Alert" : "✅ Website Recovered",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Website:*\n${websiteUrl}`
          },
          {
            type: "mrkdwn",
            text: `*Status:*\n${isDown ? '🔴 DOWN' : '🟢 UP'}`
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toUTCString()}`
          },
          {
            type: "mrkdwn",
            text: `*Response:*\n${responseMs ? responseMs + 'ms' : 'N/A'}`
          }
        ]
      },
      ...(isDown && errorType ? [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Type:* ${errorType}`
        }
      }] : []),
      {
        type: "divider"
      },
      {
        type: "context",
        elements: [{
          type: "mrkdwn",
          text: "Sent by *UpGuard Monitoring*"
        }]
      }
    ]
  };

  try {
    await axios.post(webhookUrl, message);
    // Slack alert sent
  } catch (error: any) {
    console.error('Slack webhook error:', error.message);
  }
}

export async function sendSlackTestMessage(webhookUrl: string) {
  try {
    await axios.post(webhookUrl, {
      text: "✅ *UpGuard* is now connected! You will receive alerts here when your websites go down."
    });
    return true;
  } catch {
    return false;
  }
}
