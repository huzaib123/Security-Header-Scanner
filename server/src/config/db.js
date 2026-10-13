import mongoose from 'mongoose';
import env from './env.js';

// Treat query filters as literal values so a body like { "$gt": "" }
// can never turn into a query operator (NoSQL injection).
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

export async function connectDB(uri = env.mongoUri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
