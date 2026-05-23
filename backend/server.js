const express = require('express');
const cors = require('cors');

const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const taskRoutes      = require('./routes/tasks');
const timelogRoutes   = require('./routes/timelogs');
const reportRoutes    = require('./routes/reports');
const equipmentRoutes = require('./routes/equipment');
const operatorRoutes  = require('./routes/operators');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/timelogs',  timelogRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/operators', operatorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'הנתיב לא נמצא' });
});

const db = require('./database');

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

// Initialize database and start server
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });

