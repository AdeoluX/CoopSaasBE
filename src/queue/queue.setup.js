// File: queueConfig.js
const Bull = require("bull");
const mongoose = require("mongoose");

// Define a Mongoose schema for processed records (adjust fields as needed)
const RecordSchema = new mongoose.Schema({
  cooperativeId: { type: String, required: true },
  name: String,
  email: String,
  phone: String,
  address: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
  processedAt: { type: Date, default: Date.now },
});
const Record = mongoose.model("Record", RecordSchema);

// Create a Bull queue
const cooperativeQueue = new Bull("cooperativeQueue", {
  redis: {
    host: "127.0.0.1",
    port: 6379, // Adjust to your Redis config
  },
});

// Worker to process the queue and store in MongoDB
cooperativeQueue.process(async (job) => {
  const { cooperative, jsonArray } = job.data;
  try {
    console.log("Processing cooperative details for:", cooperative.name);
    // Process each CSV record and save to MongoDB
    for (const record of jsonArray) {
      console.log("Processing record:", record);
      // Combine cooperative data and CSV record, adjust fields as needed
      const newRecord = new Record({
        cooperativeId: cooperative._id,
        name: record.name || cooperative.name,
        email: record.email || cooperative.email,
        phone: record.phone || cooperative.phone,
        address: record.address || cooperative.address,
        city: record.city || cooperative.city,
        state: record.state || cooperative.state,
        country: record.country || cooperative.country,
        postalCode: record.postalCode || cooperative.postalCode,
      });
      await newRecord.save(); // Save to MongoDB
      console.log("Saved record to MongoDB:", newRecord);
    }
    console.log("Completed processing for cooperative:", cooperative.name);
  } catch (error) {
    console.error("Error processing cooperative details:", error);
    throw error; // Bull will handle retries
  }
});

// Error handling for the queue
cooperativeQueue.on("failed", (job, err) => {
  console.error(
    `Job ${job.id} for cooperative ${job.data.cooperative.name} failed with error: ${err.message}`
  );
});

cooperativeQueue.on("completed", (job) => {
  console.log(
    `Job ${job.id} for cooperative ${job.data.cooperative.name} completed successfully`
  );
});

// Export the queue
module.exports = {
  cooperativeQueue,
};
