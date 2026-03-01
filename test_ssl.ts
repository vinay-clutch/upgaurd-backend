import { checkSSL } from './src/services/sslChecker';

async function test() {
  const host = 'nytimes.com';
  console.log('Testing SSL for:', host);
  try {
    const result = await checkSSL(host);
    console.log('SSL RESULT:', result);
  } catch(e: any) {
    console.error('SSL TEST CRASH:', e.message);
  }
}

test();
