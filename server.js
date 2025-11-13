// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: "majority",
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

/* -------------------- Schemas -------------------- */
const donorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true, min: 18, max: 65 },
  bloodGroup: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  location: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const requestSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  unitsRequired: { type: Number, required: true, min: 1 },
  hospitalName: { type: String, required: true },
  hospitalAddress: { type: String, required: true },
  city: { type: String, required: true },
  requiredDate: { type: String, required: true },
  requesterPhone: { type: String, required: true },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});

const Donor = mongoose.model("Donor", donorSchema);
const BloodRequest = mongoose.model("BloodRequest", requestSchema);

/* -------------------- Admin Auth -------------------- */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_KEY) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token });
  }
  res.status(401).json({ message: "Invalid password" });
});

function verifyAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(403).json({ message: "Missing token" });
  try {
    const token = auth.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ message: "Invalid or expired token" });
  }
}

/* -------------------- Core Routes -------------------- */

// Donors
app.get("/api/donors", async (req, res) => {
  const donors = await Donor.find().sort({ createdAt: -1 });
  res.json(donors);
});

app.post("/api/donors", async (req, res) => {
  try {
    const { name, age, bloodGroup, phone, email, location } = req.body;
    if (!name || !age || !bloodGroup || !phone || !location)
      return res.status(400).json({ message: "Missing required fields" });

    if (age < 18 || age > 65)
      return res.status(400).json({ message: "Age must be between 18–65" });

    const donor = await Donor.create({ name, age, bloodGroup, phone, email, location });
    res.status(201).json({ message: "Donor registered", donor });
  } catch (err) {
    res.status(500).json({ message: "Error registering donor" });
  }
});

// Requests
app.get("/api/requests", async (req, res) => {
  const requests = await BloodRequest.find().sort({ createdAt: -1 });
  res.json(requests);
});

app.post("/api/requests", async (req, res) => {
  try {
    const data = req.body;
    const requiredFields = [
      "patientName","bloodGroup","unitsRequired",
      "hospitalName","hospitalAddress","city","requiredDate","requesterPhone"
    ];
    if (requiredFields.some((f) => !data[f]))
      return res.status(400).json({ message: "All fields required" });

    const request = await BloodRequest.create(data);

    // Find matching donors
    const matches = await Donor.find({
      bloodGroup: data.bloodGroup,
      location: { $regex: data.city, $options: "i" },
    }).limit(5);

    // Email alert
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: "🩸 New Blood Request",
        text: `${data.patientName} requested ${data.unitsRequired} unit(s) of ${data.bloodGroup} in ${data.city}.`,
      });
    }

    // SMS alert
    if (process.env.TWILIO_SID && process.env.TWILIO_AUTH) {
      const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
      await client.messages.create({
        body: `New ${data.bloodGroup} request: ${data.unitsRequired} unit(s) in ${data.city}.`,
        from: process.env.TWILIO_PHONE,
        to: process.env.ADMIN_PHONE,
      });
    }

    res.status(201).json({
      message: "Request submitted successfully",
      matchingDonors: matches.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error submitting request" });
  }
});

// Inventory
app.get("/api/inventory", async (req, res) => {
  const inventory = await Donor.aggregate([
    { $group: { _id: "$bloodGroup", count: { $sum: 1 } } },
  ]);
  const map = {};
  inventory.forEach((i) => (map[i._id] = i.count));
  res.json(map);
});

/* -------------------- Admin Routes -------------------- */
app.delete("/api/donors/:id", verifyAdmin, async (req, res) => {
  await Donor.findByIdAndDelete(req.params.id);
  res.json({ message: "Donor deleted" });
});

app.delete("/api/requests/:id", verifyAdmin, async (req, res) => {
  await BloodRequest.findByIdAndDelete(req.params.id);
  res.json({ message: "Request deleted" });
});

app.patch("/api/requests/:id/approve", verifyAdmin, async (req, res) => {
  const updated = await BloodRequest.findByIdAndUpdate(
    req.params.id,
    { status: "Approved" },
    { new: true }
  );
  res.json(updated);
});

/* -------------------- Misc -------------------- */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));
