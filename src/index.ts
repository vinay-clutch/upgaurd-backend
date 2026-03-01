import app from './app';
import { createServer } from 'http';
import { initSocket } from './socket';

const httpServer = createServer(app);
initSocket(httpServer);

const PORT = process.env.PORT || 3005;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
