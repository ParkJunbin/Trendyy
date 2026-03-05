const express = require("express");
const analyzeRoute = require("./routes/analyze");

const app = express();

app.use("/analyze", analyzeRoute);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});