require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri =
    process.env.ENV === "production"
      ? process.env.MONGO_URI
      : process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Ensure models are registered and indexes defined
  require("../src/models");

  const db = mongoose.connection.db;
  const collection = db.collection("cooperatives");
  try {
    console.log("Dropping index kyc_details.rc_1 if exists...");
    await collection.dropIndex("kyc_details.rc_1");
    console.log("Dropped.");
  } catch (e) {
    if (e.codeName === "IndexNotFound") {
      console.log("Index not found, continuing...");
    } else {
      console.error("Error dropping index:", e.message);
    }
  }

  // Drop old phone index too if it exists (non-sparse)
  try {
    console.log(
      "Dropping index contact_details.phone_1 if exists (non-sparse)..."
    );
    await collection.dropIndex("contact_details.phone_1");
    console.log("Dropped phone index.");
  } catch (e) {
    if (e.codeName === "IndexNotFound") {
      console.log("Phone index not found, continuing...");
    } else {
      console.error("Error dropping phone index:", e.message);
    }
  }

  // Do not sync all indexes to avoid conflicts in other collections here.
  console.log(
    "RC index dropped. Restart the server to let Mongoose build schema indexes."
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
