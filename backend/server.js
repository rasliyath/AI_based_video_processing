const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { exec } = require("child_process");
require("dotenv").config();

const app = express();

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static assets (thumbnails, trailers, uploads)
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/trailers', express.static(path.join(__dirname, 'trailers')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Disable buffering for streaming responses
app.disable('x-powered-by');

// Routes
app.use("/api/videos", require("./routes/videoRoutes"));
app.use('/api/qoe', require("./routes/qoe"));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
