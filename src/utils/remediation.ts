export interface SmartFix {
  title: string;
  analysis: string;
  script: string;
  language: string;
}

export const REMEDIATION_DATABASE: Record<string, SmartFix> = {
  "500": {
    title: "Internal Server Error",
    analysis: "The server encountered an unhandled exception or a crash in the application logic.",
    script: "try {\n  // Wrap your main handler\n  await runLogic();\n} catch (err) {\n  console.error('AI Catch:', err.message);\n  res.status(500).json({ error: 'Layer-7 failure detected' });\n}",
    language: "javascript"
  },
  "502": {
    title: "Bad Gateway / Proxy Failure",
    analysis: "The upstream application is down or the proxy (Nginx/Railway) cannot reach the backend port.",
    script: "# Check your proxy config\nproxy_pass http://localhost:8080;\nproxy_connect_timeout 30s;\nproxy_read_timeout 60s;",
    language: "nginx"
  },
  "503": {
    title: "Service Unavailable",
    analysis: "The server is overloaded or undergoing maintenance, causing dropped connections.",
    script: "// Implement Circuit Breaker pattern\nconst breaker = new CircuitBreaker(apiCall, options);\nbreaker.fire().then(console.log).handle(fallback);",
    language: "javascript"
  },
  "404": {
    title: "Resource Not Found",
    analysis: "The requested URL was not found on the server. This could be a broken link or a routing configuration issue.",
    script: "// Check your React Router / Server Routing\napp.get('*', (req, res) => {\n  res.sendFile(path.join(__dirname, 'index.html'));\n});",
    language: "javascript"
  },
  "ETIMEDOUT": {
    title: "Network Timeout",
    analysis: "The server took too long to respond, possibly due to slow DB queries or high I/O wait.",
    script: "// Optimize database index\nCREATE INDEX idx_website_id ON \"Check\"(\"websiteId\");\n// Or set client timeout\naxios.get(url, { timeout: 5000 });",
    language: "sql"
  },
  "ECONNREFUSED": {
    title: "Connection Refused",
    analysis: "The target server is not listening on the specified port. It might be crashed or firewall-blocked.",
    script: "# Check if process is running\nps aux | grep node\n# Open firewall port (Ubuntu)\nsudo ufw allow 8080/tcp",
    language: "bash"
  },
  "HSTS_MISSING": {
    title: "Strict-Transport-Security Missing",
    analysis: "The site is vulnerable to protocol downgrade attacks. HTTPS enforcement is missing in headers.",
    script: "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    language: "http"
  },
  "CSP_MISSING": {
    title: "Content Security Policy Missing",
    analysis: "The application lacks a policy to prevent Cross-Site Scripting (XSS) and data injection.",
    script: "Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';",
    language: "http"
  },
  "X_FRAME_MISSING": {
    title: "X-Frame-Options Missing",
    analysis: "The site can be embedded in an iframe elsewhere, making it vulnerable to clickjacking.",
    script: "X-Frame-Options: SAMEORIGIN",
    language: "http"
  }
};

export const getSmartRemediation = (error: string): SmartFix | null => {
  return REMEDIATION_DATABASE[error] || null;
};
