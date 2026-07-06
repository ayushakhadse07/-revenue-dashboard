import serverless from 'serverless-http';
import app from '../../backend/server.cjs';

export const handler = serverless(app);
