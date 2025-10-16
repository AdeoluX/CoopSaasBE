require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const idx = await db.collection("cooperatives").indexes();
  console.log(JSON.stringify(idx, null, 2));
  await mongoose.disconnect();
})();
