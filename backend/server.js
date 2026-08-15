import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import lobbyRoutes from './routes/lobbyRoutes.js';
import userRoutes from './routes/userRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import getCorsOrigin from './config/corsConfig.js';
import initSocket from './socket/index.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true
}));

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);

app.get('/', (req, res) => {
  res.send('Food Finder API is running!');
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Express no longer creates the HTTP server itself: Socket.IO needs to hook the
// same one so live chat shares this port instead of opening a second listener.
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
