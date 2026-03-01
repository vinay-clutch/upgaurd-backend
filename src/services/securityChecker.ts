import https from 'https';
import http from 'http';

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface SecurityReport {
  score: number;
  grade: string;
  headers: SecurityHeader[];
  passed: number;
  failed: number;
}

const SECURITY_HEADERS = [
  {
    name: 'Strict-Transport-Security',
    description: 'Forces HTTPS connections',
    severity: 'critical' as const
  },
  {
    name: 'Content-Security-Policy',
    description: 'Prevents XSS attacks',
    severity: 'critical' as const
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking',
    severity: 'high' as const
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME sniffing',
    severity: 'high' as const
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls referrer information',
    severity: 'medium' as const
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls browser features',
    severity: 'medium' as const
  },
  {
    name: 'X-XSS-Protection',
    description: 'XSS filter for older browsers',
    severity: 'low' as const
  }
];

export function checkSecurityHeaders(url: string): Promise<SecurityReport> {
  return new Promise((resolve) => {
    try {
      const isHttps = url.startsWith('https://');
      const module_ = isHttps ? https : http;
      const parsedUrl = new URL(url);
      
      const req = module_.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname || '/',
          method: 'HEAD', // HEAD is faster for headers
          timeout: 10000,
          rejectUnauthorized: false
        },
        (res) => {
          const responseHeaders = res.headers;
          const results: SecurityHeader[] = SECURITY_HEADERS.map(h => ({
            name: h.name,
            present: !!responseHeaders[h.name.toLowerCase()],
            value: responseHeaders[h.name.toLowerCase()] as string || undefined,
            description: h.description,
            severity: h.severity
          }));

          const passed = results.filter(r => r.present).length;
          const total = results.length;
          const score = Math.round((passed / total) * 100);
          
          const grade = score >= 90 ? 'A+' 
                      : score >= 80 ? 'A'
                      : score >= 70 ? 'B'
                      : score >= 60 ? 'C'
                      : score >= 50 ? 'D'
                      : 'F';

          resolve({ score, grade, headers: results, passed, failed: total - passed });
        }
      );

      req.on('error', () => {
        resolve({ 
          score: 0, 
          grade: 'F', 
          headers: SECURITY_HEADERS.map(h => ({
            ...h, present: false
          })), 
          passed: 0, 
          failed: SECURITY_HEADERS.length 
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ 
          score: 0, 
          grade: 'F', 
          headers: [], 
          passed: 0, 
          failed: SECURITY_HEADERS.length 
        });
      });
      req.end();
    } catch(e) {
      resolve({ 
        score: 0, 
        grade: 'F', 
        headers: [], 
        passed: 0, 
        failed: SECURITY_HEADERS.length 
      });
    }
  });
}
