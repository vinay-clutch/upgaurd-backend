#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    showHelp();
    return;
  }

  switch (command) {
    case 'status':
      await showStatus();
      break;
    case 'report':
      const siteIndex = args.indexOf('--site');
      if (siteIndex === -1 || !args[siteIndex + 1]) {
        console.error('❌ Error: Please specify a site URL using --site <url>');
        process.exit(1);
      }
      await generateReport(args[siteIndex + 1]);
      break;
    case 'test-alerts':
      runTestAlerts();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      showHelp();
  }
}

function showHelp() {
  console.log(`
🛡️  UpGuard CLI - Infrastructure Command Center
==============================================

Usage: 
  node cli.js <command> [options]

Commands:
  status                Displays the current status of all monitored websites.
  report --site <url>   Generates a downtime report for a specific website.
  test-alerts           Triggers the Alert Verification System.

Examples:
  node cli.js status
  node cli.js report --site https://google.com
  node cli.js test-alerts
  `);
}

async function showStatus() {
  console.log('\n📊 Current Infrastructure Status:');
  console.log('==================================');
  
  const sites = await prisma.website.findMany({
    include: {
      ticks: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (sites.length === 0) {
    console.log('No websites found in the database.');
    return;
  }

  const tableData = sites.map(site => {
    const lastTick = site.ticks[0];
    const status = lastTick ? lastTick.status : 'Unknown';
    const latency = lastTick ? `${lastTick.total_response_time_ms}ms` : 'N/A';
    const lastChecked = lastTick ? new Date(lastTick.createdAt).toLocaleTimeString() : 'Never';

    return {
      'Website URL': site.url,
      'Status': status === 'Up' ? '✅ UP' : '🚨 DOWN',
      'Latency': latency,
      'Last Checked': lastChecked
    };
  });

  console.table(tableData);
  console.log(`\nTotal Monitored: ${sites.length}\n`);
}

async function generateReport(url) {
  console.log(`\n📄 Generating Summary Report for: ${url}`);
  console.log('================================================');

  const site = await prisma.website.findFirst({
    where: { url: { contains: url } }, // Partial match for convenience
    include: {
      ticks: {
        orderBy: { createdAt: 'desc' },
        take: 100
      }
    }
  });

  if (!site) {
    console.error(`❌ Error: Website with URL containing "${url}" not found.`);
    return;
  }

  const ticks = site.ticks;
  const downTicks = ticks.filter(t => t.status === 'Down');
  const uptimePct = ticks.length > 0 ? (((ticks.length - downTicks.length) / ticks.length) * 100).toFixed(2) : 0;
  
  const avgLatency = ticks.length > 0 
    ? Math.round(ticks.reduce((sum, t) => sum + (t.total_response_time_ms || 0), 0) / ticks.length) 
    : 0;

  console.log(`\n🔗 Full URL: ${site.url}`);
  console.log(`📈 Uptime (Last 100 checks): ${uptimePct}%`);
  console.log(`⚡ Average Latency: ${avgLatency}ms`);
  console.log(`🚨 Recent Incidents: ${downTicks.length}`);
  
  if (downTicks.length > 0) {
    console.log('\nLast 5 Downtime Events:');
    downTicks.slice(0, 5).forEach(t => {
      console.log(`- ${new Date(t.createdAt).toLocaleString()} (Response: ${t.total_response_time_ms || 'N/A'}ms)`);
    });
  } else {
    console.log('\n✅ No recent downtime recorded.');
  }
  console.log('\nReport Generated Successfully.\n');
}

function runTestAlerts() {
  console.log('🚀 Triggering Alert Verification System...');
  try {
    // Run the npm script we created earlier
    execSync('npm run test-alerts', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to run alert verification.');
  }
}

main()
  .catch(e => {
    console.error('💥 CLI Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
