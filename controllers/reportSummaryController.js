const ReportSummary = require("../models/ReportSummary");

exports.getReportSummaries = async (req, res) => {
  try {
    const summaries = await ReportSummary.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.createReportSummary = async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();
    const period = ["week", "month", "year"].includes(req.body.period) ? req.body.period : "week";

    if (!content) {
      return res.status(400).json({ msg: "Report summary content is required" });
    }

    const summary = await ReportSummary.create({
      content,
      period,
      createdBy: req.user.id
    });

    const populatedSummary = await ReportSummary.findById(summary._id).populate("createdBy", "name");

    res.status(201).json(populatedSummary);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
