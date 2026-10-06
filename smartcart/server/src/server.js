require('dotenv').config();

const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

(async () => {
  if (!process.env.JWT_SECRET) {
    console.error('Missing JWT_SECRET. Copy .env.example to .env and set it.');
    process.exit(1);
  }
  try {
    await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartcart');
    app.listen(PORT, () => console.log(`SmartCart API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
