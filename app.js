require("dotenv").config();
const serverless = require("serverless-http");
const express = require("express");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const app = express();
const cors = require("cors");
const connectDB = require("./src/config/db.config");

// Import all models to ensure they are registered with Mongoose
require("./src/models");
// const {ajocron} = require('./src/cron-server')

// Initialize database connection
connectDB;

const { errorConverter, errorHandler } = require("./src/middleware/error");
const {
  authRoutes,
  adminRoutes,
  memberRoutes,
  webhookRoutes,
  reportingRoutes,
} = require("./src/routes");
const ApiError = require("./src/utils/ApiError");
const httpStatus = require("http-status");

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/api/v1/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/member", memberRoutes);
app.use("/api/v1/webhook", webhookRoutes);
app.use("/api/v1/reports", reportingRoutes);

app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

module.exports = { app };
