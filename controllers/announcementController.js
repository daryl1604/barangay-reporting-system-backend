const Announcement = require("../models/Announcement");

exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    const period = ["week", "month", "year"].includes(req.body.period) ? req.body.period : "week";

    if (!text) {
      return res.status(400).json({ msg: "Announcement text is required" });
    }

    const announcement = await Announcement.create({
      text,
      period,
      createdBy: req.user.id
    });

    const populatedAnnouncement = await Announcement.findById(announcement._id).populate("createdBy", "name");

    res.status(201).json(populatedAnnouncement);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
