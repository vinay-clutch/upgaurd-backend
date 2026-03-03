import app from './app';
import { createServer } from 'http';
import { initSocket } from './socket';

const httpServer = createServer(app);
initSocket(httpServer);

const PORT = Number(process.env.PORT);

if (!PORT) {
  throw new Error("PORT is not defined. Railway must provide a PORT environment variable.");
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
