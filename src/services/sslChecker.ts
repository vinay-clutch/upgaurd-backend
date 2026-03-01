import tls from 'tls';

export interface SSLInfo {
  valid: boolean;
  daysUntilExpiry: number;
  expiryDate: string;
  issuer: string;
  error?: string;
}

export function checkSSL(hostname: string): Promise<SSLInfo> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect({
        host: hostname,
        port: 443,
        servername: hostname, // SNI is critical
        timeout: 10000,
        rejectUnauthorized: false
      }, () => {
        const cert = socket.getPeerCertificate();
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          resolve({
            valid: false,
            daysUntilExpiry: 0,
            expiryDate: 'N/A',
            issuer: 'N/A',
            error: 'No certificate found'
          });
          return;
        }

        const expiryDate = new Date(cert.valid_to);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        const info: SSLInfo = {
          valid: daysUntilExpiry > 0,
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
          expiryDate: expiryDate.toLocaleDateString(),
          issuer: typeof cert.issuer === 'object' ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : 'Unknown'
        };

        socket.destroy();
        resolve(info);
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          valid: false,
          daysUntilExpiry: 0,
          expiryDate: 'N/A',
          issuer: 'N/A',
          error: err.message
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          valid: false,
          daysUntilExpiry: 0,
          expiryDate: 'N/A',
          issuer: 'N/A',
          error: 'Connection timed out'
        });
      });

    } catch (err: any) {
      resolve({
        valid: false,
        daysUntilExpiry: 0,
        expiryDate: 'N/A',
        issuer: 'N/A',
        error: err.message
      });
    }
  });
}
