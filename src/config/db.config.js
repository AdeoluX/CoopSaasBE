// var mongoose = require('mongoose');
const mongoose = require("mongoose");
// const keys = require("../../keys");

mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    const mongo = await mongoose.connect(
      process.env.ENV === "production"
        ? `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.3yodljl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
        : process.env.MONGO_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        connectTimeoutMS: 10000, // Give up initial connection after 10s
      }
    );
    console.log("Database connection established successfully");
    return mongo;
  } catch (error) {
    // Log error without sensitive information
    console.error("Database connection failed:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    process.exit(1); // Exit with failure
  }
};

module.exports = connectDB();
