const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');
const authRoutes = require('./routes/authRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const errorHandler = require("./middleware/errorHandler")
const requestLogger = require('./middleware/requestLogger');
const questionRoutes = require('./routes/questionRoutes');
const userResponseRoutes = require('./routes/userResponseRoutes');
const aiProcessingRoutes = require('./routes/aiProcessingRoutes');

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS setup
const allowedOrigins = [
  "https://aspiro-azure.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // if you want to allow cookies/auth headers
}));

// Body parser
app.use(express.json());
// Request logger
app.use(requestLogger);

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/user-response', userResponseRoutes);
app.use('/api/ai-processing', aiProcessingRoutes);

// Error handler
app.use(errorHandler);

// Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
