const { app, connectDB } = require("./app");
const PORT = process.env.PORT || 7999;

console.log(PORT);
app.listen(PORT, "0.0.0.0", (err) => {
  if (err) {
    console.error("Failed to bind:", err);
  } else {
    console.log(`Server listening on port ${PORT} (host 0.0.0.0)`);
    connectDB;
  }
});
