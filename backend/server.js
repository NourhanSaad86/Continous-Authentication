// server.js

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

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/examProctoring", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Violation Schema
const violationSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  examId: { type: String, required: true },
  filePath: { type: String, required: true }, // مسار الصورة
  timestamp: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ["faceMismatch", "absence"],
    default: "faceMismatch",
  },
});
const Violation = mongoose.model("Violation", violationSchema);

// استقبال الصورة وتخزينها كملف + حفظ المسار في قاعدة البيانات
app.post("/api/violation", async (req, res) => {
  const { studentId, examId, image, timestamp, type } = req.body;

  if (!studentId || !examId || !image || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // إزالة prefix من Base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // إنشاء مجلد exports/<studentId> لتخزين صورة كل طالب في مجلد منفصل
    const studentDir = path.join(__dirname, "exports", studentId);
    fs.mkdirSync(studentDir, { recursive: true });

    // اسم الملف
    const fileName = `violation_${Date.now()}.jpg`;
    const filePath = path.join(studentDir, fileName);

    // حفظ الصورة فعليًا
    fs.writeFileSync(filePath, base64Data, "base64");

    // حفظ البيانات في MongoDB
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

// عرض جميع المخالفات لطالب معين
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

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});



// // server.js

// const express = require("express");
// const cors = require("cors");
// const bodyParser = require("body-parser");
// const mongoose = require("mongoose");

// // إعداد الخادم
// const app = express();
// const PORT = 5000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // --- MongoDB Connection ---
// mongoose.connect("mongodb://localhost:27017/examProctoring", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });
// const db = mongoose.connection;
// db.on("error", console.error.bind(console, "MongoDB connection error:"));
// db.once("open", () => {
//   console.log("✅ Connected to MongoDB");
// });

// // --- Violation Schema & Model ---
// const violationSchema = new mongoose.Schema({
//   studentId: { type: String, required: true },
//   examId: { type: String, required: true },
//   image: { type: String, required: true }, // Base64 string
//   timestamp: { type: Date, default: Date.now },
// });
// const Violation = mongoose.model("Violation", violationSchema);

// // --- Endpoints ---

// // استقبال الصور عند الاختلاف
// app.post("/api/violation", async (req, res) => {
//   const { studentId, examId, image, timestamp } = req.body;

//   if (!studentId || !examId || !image || !timestamp) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   try {
//     const violation = new Violation({ studentId, examId, image, timestamp });
//     await violation.save();
//     console.log(`✅ Violation stored for student ${studentId} at ${timestamp}`);
//     res.status(200).json({ message: "Violation stored successfully" });
//   } catch (err) {
//     console.error("❌ Error saving violation:", err);
//     res.status(500).json({ error: "Failed to store violation" });
//   }
// });

// // جلب جميع المخالفات لطالب معين
// app.get("/api/violations/:studentId", async (req, res) => {
//   const { studentId } = req.params;

//   try {
//     const violations = await Violation.find({ studentId }).sort({ timestamp: -1 });
//     res.status(200).json(violations);
//   } catch (err) {
//     console.error("❌ Error fetching violations:", err);
//     res.status(500).json({ error: "Failed to fetch violations" });
//   }
// });

// // تشغيل الخادم
// app.listen(PORT, () => {
//   console.log(`✅ Backend server is running on http://localhost:${PORT}`);
// });