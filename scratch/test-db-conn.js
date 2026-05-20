const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const net = require('net');
const host = 'ep-frosty-term-a1drulqa.ap-southeast-1.aws.neon.tech';
const port = 5432;

console.log(`Connecting to ${host}:${port}...`);
const socket = net.createConnection(port, host, () => {
    console.log('CONNECTED');
    socket.end();
});

socket.on('error', (err) => {
    console.error('CONNECTION FAILED:', err.message);
});

socket.setTimeout(5000, () => {
    console.error('CONNECTION TIMEOUT');
    socket.destroy();
});
