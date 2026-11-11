import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';

const PORT = process.env.PORT || 5000;
const { server } = createApp();

server.listen(PORT, () => {
  console.log(`[FleetOS] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});

