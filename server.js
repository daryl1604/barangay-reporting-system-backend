const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/report");
const notificationRoutes = require("./routes/notification");
const announcementRoutes = require("./routes/announcement");
const reportSummaryRoutes = require("./routes/reportSummary");


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reports/summaries", reportSummaryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcements", announcementRoutes);

connectDB();

app.get("/", (req, res) => {
    res.send("Barangay Reporting API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
