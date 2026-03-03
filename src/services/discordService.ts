import axios from 'axios';

export async function sendDiscordAlert(
  webhookUrl: string,
  websiteUrl: string,
  status: string,
  responseMs?: number,
  errorType?: string
) {
  const isDown = status === 'Down';
  
  const embed = {
    embeds: [{
      title: isDown ? '🚨 Website Down!' : '✅ Website Recovered!',
      description: `**${websiteUrl}** is now **${status}**`,
      color: isDown ? 0xFF0000 : 0x00FF00,
      fields: [
        { 
          name: '📊 Status', 
          value: isDown ? '🔴 DOWN' : '🟢 UP', 
          inline: true 
        },
        { 
          name: '⚡ Response Time', 
          value: responseMs ? `${responseMs}ms` : 'N/A', 
          inline: true 
        },
        { 
          name: '🕐 Time', 
          value: new Date().toUTCString(), 
          inline: false 
        },
        ...(isDown && errorType ? [{
          name: '🔍 Error Type',
          value: errorType,
          inline: false
        }] : [])
      ],
      footer: { 
        text: 'UpGuard Monitoring • Never miss downtime' 
      },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    await axios.post(webhookUrl, embed);
    // Discord alert sent
  } catch (error: any) {
    console.error('Discord webhook error:', error.message);
  }
}

export async function sendDiscordTestMessage(webhookUrl: string) {
  const embed = {
    embeds: [{
      title: '✅ UpGuard Connected!',
      description: 'Discord alerts are now configured. You will receive notifications when your websites go down or recover.',
      color: 0x5865F2,
      fields: [
        {
          name: '🛡️ UpGuard',
          value: 'Website Uptime Monitoring',
          inline: true
        }
      ],
      footer: { text: 'UpGuard Monitoring' },
      timestamp: new Date().toISOString()
    }]
  };
  
  try {
    await axios.post(webhookUrl, embed);
    return true;
  } catch (error) {
    return false;
  }
}
