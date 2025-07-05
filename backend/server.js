const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

mongoose.connect("mongodb://localhost:27017/examProctoring", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

const violationSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  examId: { type: String, required: true },
  filePath: { type: String, required: true }, 
  timestamp: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ["faceMismatch", "absence"],
    default: "faceMismatch",
  },
});
const Violation = mongoose.model("Violation", violationSchema);

app.post("/api/violation", async (req, res) => {
  const { studentId, examId, image, timestamp, type } = req.body;

  if (!studentId || !examId || !image || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const studentDir = path.join(__dirname, "exports", studentId);
    fs.mkdirSync(studentDir, { recursive: true });

    const fileName = `violation_${Date.now()}.jpg`;
    const filePath = path.join(studentDir, fileName);

    fs.writeFileSync(filePath, base64Data, "base64");

    const violation = new Violation({
      studentId,
      examId,
      filePath,
      timestamp,
      type: type || "faceMismatch",
    });
    await violation.save();

    console.log(`Violation saved for student ${studentId} at ${filePath}`);
    res.status(200).json({ message: "Violation saved successfully" });
  } catch (err) {
    console.error("Error saving violation:", err);
    res.status(500).json({ error: "Failed to save violation" });
  }
});

app.get("/api/violations/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    const violations = await Violation.find({ studentId }).sort({ timestamp: -1 });
    res.status(200).json(violations);
  } catch (err) {
    console.error("Error fetching violations:", err);
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});



