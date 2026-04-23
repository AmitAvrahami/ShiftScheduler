import 'dotenv/config';
import { connectDB } from './config/db';
import app from './app';

const PORT = process.env.PORT ?? 5001;

async function start(): Promise<void> {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err: Error) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
