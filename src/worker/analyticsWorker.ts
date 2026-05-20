import prisma from "../lib/db";
import { AIMLService } from "../services/aimlService";

async function runAnalytics() {
  console.log(`[AIML Analytics Worker] Starting analysis cycle at ${new Date().toISOString()}`);

  try {
    const websites = await prisma.website.findMany();

    for (const website of websites) {
      console.log(`[AIML] Analyzing website: ${website.url}`);

      // 1. Fetch recent ticks for latency and error analysis
      const recentTicks = await prisma.website_tick.findMany({
        where: { website_id: website.id },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      if (recentTicks.length < 10) continue;

      const latencies = recentTicks
        .map(t => t.total_response_time_ms || 0)
        .filter(l => l > 0)
        .reverse(); // Chronological

      const errorCount = recentTicks.filter(t => t.status === "Down" || t.status_code! >= 400).length;
      const errorRate = errorCount / recentTicks.length;
      
      const currentLatency = latencies[latencies.length - 1] || 0;

      // 2. Statistical Anomaly Detection (Dual Z-Score and IQR)
      const isStatAnomaly = AIMLService.detectAnomalyDual(latencies.slice(0, -1), currentLatency);

      // 3. Isolation Forest Multi-Dimensional Anomaly Detection
      const uptimeFraction = 1 - errorRate;
      const isIsolationForestAnomaly = AIMLService.evaluateIsolationForest(currentLatency, errorRate, uptimeFraction);

      if (isStatAnomaly || isIsolationForestAnomaly) {
        console.log(`[AIML] Anomaly detected for ${website.url}! Z-Score/IQR: ${isStatAnomaly}, Isolation Forest: ${isIsolationForestAnomaly}`);
        
        // Ensure we don't spam anomaly records
        const recentAnomaly = await prisma.anomalyEvent.findFirst({
          where: { websiteId: website.id, detectedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }
        });

        if (!recentAnomaly) {
          await prisma.anomalyEvent.create({
            data: {
              websiteId: website.id,
              metricType: isIsolationForestAnomaly ? "multi_dimensional_isolation_forest" : "response_time_stat",
              actualValue: currentLatency,
              expectedValue: latencies.reduce((a, b) => a + b, 0) / latencies.length, // simple mean expected
              deviation: Math.abs(currentLatency - (latencies.reduce((a, b) => a + b, 0) / latencies.length)),
              anomalyScore: isIsolationForestAnomaly ? 0.8 : 0.6,
              severity: isIsolationForestAnomaly ? "high" : "medium"
            }
          });
        }
      }

      // 4. ARIMA Capacity Forecasting
      const forecast = AIMLService.forecastSaturation(latencies, 3000);
      if (forecast.predictedValue > 0) {
        console.log(`[AIML] Capacity forecast for ${website.url}: Predicted latency ${forecast.predictedValue}ms, days to saturation: ${forecast.daysToSaturation}`);
        
        // Update or create forecast record
        const existingForecast = await prisma.capacityForecast.findFirst({
          where: { websiteId: website.id, metricType: "response_time" }
        });

        if (existingForecast) {
          await prisma.capacityForecast.update({
            where: { id: existingForecast.id },
            data: {
              currentValue: currentLatency,
              predictedValue: forecast.predictedValue,
              daysToSaturation: forecast.daysToSaturation,
              confidence: 0.85
            }
          });
        } else {
          await prisma.capacityForecast.create({
            data: {
              websiteId: website.id,
              metricType: "response_time",
              currentValue: currentLatency,
              predictedValue: forecast.predictedValue,
              daysToSaturation: forecast.daysToSaturation,
              confidence: 0.85
            }
          });
        }
      }
    }

    // 5. K-Means Incident Correlation (find multiple down ticks happening simultaneously)
    const recentDownTicks = await prisma.website_tick.findMany({
      where: { status: "Down", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      include: { website: true }
    });

    const clusters = AIMLService.correlateIncidents(recentDownTicks.map(t => ({
      ...t, timestamp: t.createdAt 
    })));

    for (const cluster of clusters) {
      const siteIds = [...new Set(cluster.incidents.map((i: any) => i.website_id))];
      if (siteIds.length > 1) {
        console.log(`[AIML] Incident Correlation found: ${siteIds.length} websites went down simultaneously. Probable shared upstream failure.`);
        // Record in IncidentCluster
        const clusterKey = cluster.time.toString();
        const existingCluster = await prisma.incidentCluster.findUnique({ where: { clusterKey } });
        if (!existingCluster) {
          await prisma.incidentCluster.create({
            data: {
              clusterKey,
              incidentIds: cluster.incidents.map((i: any) => i.id),
              affectedSites: siteIds.length,
              errorPattern: "Simultaneous Downtime - Probable CDN/DNS/Network Failure",
              rootCause: "Shared Upstream Infrastructure",
              firstSeen: new Date(cluster.time),
              lastSeen: new Date(cluster.time)
            }
          });
        }
      }
    }

  } catch (err) {
    console.error("[AIML Analytics Worker] Error:", err);
  }
  
  console.log(`[AIML Analytics Worker] Cycle completed.`);
}

// Run every 5 minutes
setInterval(runAnalytics, 5 * 60 * 1000);
runAnalytics();
