import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import router from './routes/index';
import { errorHandler } from './middleware/errorMiddleware';

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', router);
app.use(errorHandler);

export default app;
