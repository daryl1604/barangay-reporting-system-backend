const Report = require("../models/Report");
const Notification = require("../models/Notification");
const User = require("../models/User");

function getPeriodStart(period) {
  const now = new Date();

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const dayIndex = now.getDay();
  const diffToMonday = (dayIndex + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
}

function shiftPeriod(startDate, period, direction) {
  const nextDate = new Date(startDate);

  if (period === "month") {
    nextDate.setMonth(nextDate.getMonth() + direction);
    return nextDate;
  }

  nextDate.setDate(nextDate.getDate() + direction * 7);
  return nextDate;
}

function buildPeriodFilter(startDate, period) {
  return {
    $gte: startDate,
    $lt: shiftPeriod(startDate, period, 1)
  };
}

function buildStatusSummary(reports) {
  return {
    pending: reports.filter((report) => report.status === "pending").length,
    ongoing: reports.filter((report) => report.status === "in_progress").length,
    resolved: reports.filter((report) => report.status === "resolved").length
  };
}

function buildCountMap(reports, keyName) {
  return Object.entries(
    reports.reduce((result, report) => {
      const key = report[keyName] || "Unspecified";
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {})
  ).map(([label, value]) => ({ label, value }));
}

function getTopItem(items) {
  if (items.length === 0) {
    return null;
  }

  return [...items].sort((leftItem, rightItem) => rightItem.value - leftItem.value)[0];
}

function getYearStart(yearOffset = 0) {
  const now = new Date();
  return new Date(now.getFullYear() + yearOffset, 0, 1);
}

function buildYearlyTimeline(reports, yearStart) {
  const timeline = Array.from({ length: 12 }, (_, index) => ({
    label: new Date(yearStart.getFullYear(), index, 1).toLocaleString("en-US", { month: "short" }),
    value: 0
  }));

  reports.forEach((report) => {
    const createdAt = new Date(report.createdAt);

    if (Number.isNaN(createdAt.getTime()) || createdAt.getFullYear() !== yearStart.getFullYear()) {
      return;
    }

    timeline[createdAt.getMonth()].value += 1;
  });

  return timeline;
}

// RESIDENT: Create Report
exports.createReport = async (req, res) => {
  try {
    const { category, description, location, purok, personInvolved } = req.body;

    const report = new Report({
      resident: req.user.id,
      category,
      description,
      location,
      purok,
      personInvolved
    });

    await report.save();

    try {
      const admins = await User.find({ role: "admin" }).select("_id");

      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((admin) => ({
            user: admin._id,
            message: `A new ${category} report was submitted in ${purok || "an unspecified purok"}.`
          }))
        );
      }
    } catch (notificationError) {
      console.error("Admin notification creation failed:", notificationError.message);
    }

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// RESIDENT: Get My Reports
exports.getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ resident: req.user.id })
      .populate("comments.user", "name")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// ADMIN: Get All Reports
exports.getAllReports = async (req, res) => {
  try {
    const { status, category, purok, startDate, endDate } = req.query;

    let filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (purok) filter.purok = purok;

    // Date filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const reports = await Report.find(filter)
      .populate("resident", "name email")
      .sort({ createdAt: -1 });

    res.json(reports);

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// ADMIN: Update Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    report.status = status;
    await report.save();

    // Create notification for resident
    await Notification.create({
      user: report.resident,
      message: `Your report status has been updated to ${status}`
    });

    res.json(report);

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Delete Report
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    res.json({ msg: "Report deleted successfully", reportId: req.params.id });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// ADMIN: Add Comment
exports.addComment = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    const comment = {
      user: req.user.id,
      text: req.body.text
    };

    report.comments.push(comment);

    await report.save();

    // Notify resident
    await Notification.create({
      user: report.resident,
      message: "Admin added a comment to your report"
    });

    res.json(report.comments);

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// ADMIN: Analytics by Purok
exports.getPurokAnalytics = async (req, res) => {
  try {
    const analytics = await Report.aggregate([
      {
        $group: {
          _id: "$purok",
          totalReports: { $sum: 1 }
        }
      },
      {
        $sort: { totalReports: -1 }
      }
    ]);

    res.json(analytics);

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};


// ADMIN: Dashboard Summary
exports.getDashboardSummary = async (req, res) => {
  try {

    const totalReports = await Report.countDocuments();

    const pending = await Report.countDocuments({
      status: "pending"
    });

    const inProgress = await Report.countDocuments({
      status: "in_progress"
    });

    const resolved = await Report.countDocuments({
      status: "resolved"
    });

    res.json({
      totalReports,
      pending,
      inProgress,
      resolved
    });

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Analytics summary by period
exports.getAnalyticsPeriodSummary = async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const currentStart = getPeriodStart(period);
    const previousStart = shiftPeriod(currentStart, period, -1);

    const [currentReports, previousReports] = await Promise.all([
      Report.find({ createdAt: buildPeriodFilter(currentStart, period) }).select("status category purok createdAt"),
      Report.find({ createdAt: buildPeriodFilter(previousStart, period) }).select("status category purok createdAt")
    ]);

    res.json({
      period,
      current: {
        total: currentReports.length,
        ...buildStatusSummary(currentReports)
      },
      previous: {
        total: previousReports.length,
        ...buildStatusSummary(previousReports)
      }
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Analytics trends by period
exports.getAnalyticsTrends = async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const currentStart = getPeriodStart(period);
    const currentReports = await Report.find({
      createdAt: buildPeriodFilter(currentStart, period)
    }).select("status category purok createdAt");

    const categoryCounts = buildCountMap(currentReports, "category");
    const purokCounts = buildCountMap(currentReports, "purok");

    res.json({
      period,
      total: currentReports.length,
      statusSummary: buildStatusSummary(currentReports),
      topCategory: getTopItem(categoryCounts),
      topPurok: getTopItem(purokCounts),
      categoryCounts,
      purokCounts
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Yearly analytics
exports.getYearlyAnalytics = async (req, res) => {
  try {
    const currentStart = getYearStart(0);
    const nextYearStart = getYearStart(1);
    const previousStart = getYearStart(-1);

    const [currentReports, previousReports] = await Promise.all([
      Report.find({
        createdAt: {
          $gte: currentStart,
          $lt: nextYearStart
        }
      }).select("status category purok createdAt"),
      Report.find({
        createdAt: {
          $gte: previousStart,
          $lt: currentStart
        }
      }).select("status category purok createdAt")
    ]);

    const categoryCounts = buildCountMap(currentReports, "category");
    const purokCounts = buildCountMap(currentReports, "purok");

    res.json({
      period: "year",
      current: {
        total: currentReports.length,
        ...buildStatusSummary(currentReports)
      },
      previous: {
        total: previousReports.length,
        ...buildStatusSummary(previousReports)
      },
      statusSummary: buildStatusSummary(currentReports),
      topCategory: getTopItem(categoryCounts),
      topPurok: getTopItem(purokCounts),
      categoryCounts,
      purokCounts,
      timeline: buildYearlyTimeline(currentReports, currentStart)
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
