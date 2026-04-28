const Report = require("../models/Report");
const Notification = require("../models/Notification");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

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

function sanitizeFileName(fileName = "attachment") {
  return String(fileName)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "attachment";
}

async function persistAttachment(attachment, folderName = "comment-attachments") {
  if (!attachment?.url) {
    return undefined;
  }

  const isDataUrl = /^data:/i.test(attachment.url);

  if (!isDataUrl) {
    return {
      name: String(attachment.name || "Attachment").trim(),
      mimeType: String(attachment.mimeType || "").trim(),
      url: String(attachment.url).trim(),
      isImage: Boolean(attachment.isImage),
    };
  }

  const matches = attachment.url.match(/^data:([^;]+);base64,(.+)$/);

  if (!matches) {
    throw new Error("Invalid attachment payload");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split("/")[1] || "bin";
  const uploadsDir = path.join(__dirname, "..", "uploads", folderName);

  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const safeName = sanitizeFileName(attachment.name);
  const fileName = `${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.${extension}`;
  const absoluteFilePath = path.join(uploadsDir, fileName);

  await fs.promises.writeFile(absoluteFilePath, Buffer.from(base64Data, "base64"));

  return {
    name: String(attachment.name || fileName).trim(),
    mimeType,
    url: `/uploads/${folderName}/${fileName}`,
    isImage: mimeType.startsWith("image/"),
  };
}

function buildReportListQuery(filter = {}) {
  return Report.find(filter)
    .select("resident category description location purok status createdAt updatedAt")
    .populate("resident", "name email")
    .sort({ createdAt: -1 })
    .lean();
}

// RESIDENT: Create Report
exports.createReport = async (req, res) => {
  try {
    const { category, description, location, purok, personInvolved, date, attachment, attachments } = req.body;
    const attachmentPayloads = Array.isArray(attachments)
      ? attachments
      : attachment
        ? [attachment]
        : [];
    const persistedAttachments = (
      await Promise.all(attachmentPayloads.map((item) => persistAttachment(item, "report-attachments")))
    ).filter(Boolean);

    const report = new Report({
      resident: req.user.id,
      category,
      description,
      location,
      purok,
      personInvolved,
      incidentDate: date ? new Date(date) : undefined,
      attachment: persistedAttachments[0],
      attachments: persistedAttachments
    });

    await report.save();

    try {
      const admins = await User.find({ role: "admin" }).select("_id");

      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((admin) => ({
            user: admin._id,
            report: report._id,
            title: "New resident report",
            type: "new_report",
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
      .populate("resident", "name email")
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

    const reports = await buildReportListQuery(filter);

    res.json(reports);

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Get report details
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("resident", "name email")
      .populate("comments.user", "name")
      .lean();

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    res.json(report);
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
      report: report._id,
      title: "Report status updated",
      type: "status_update",
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
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    await Promise.all([
      Report.findByIdAndDelete(req.params.id),
      Notification.deleteMany({
        $or: [
          { report: report._id },
          {
            message: `A new ${report.category} report was submitted in ${report.purok || "an unspecified purok"}.`
          }
        ]
      })
    ]);

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

    const nextText = String(req.body.text || "").trim();
    const nextAttachment = req.body.attachment;
    const isResident = req.user.role === "resident";
    const isAdmin = req.user.role === "admin";

    if (isResident && String(report.resident) !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    if (!isResident && !isAdmin) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    if (!nextText && !nextAttachment?.url) {
      return res.status(400).json({ msg: "Comment text or attachment is required" });
    }

    let attachment;

    if (nextAttachment?.url) {
      attachment = await persistAttachment(nextAttachment, "comment-attachments");
    }

    const comment = {
      user: req.user.id,
      text: nextText,
      attachment,
    };

    report.comments.push(comment);

    await report.save();
    await report.populate("comments.user", "name");

    if (isAdmin) {
      await Notification.create({
        user: report.resident,
        report: report._id,
        title: "Admin comment added",
        type: "admin_alert",
        message: "Admin added a comment to your report"
      });
    } else {
      const admins = await User.find({ role: "admin" }).select("_id");

      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((admin) => ({
            user: admin._id,
            report: report._id,
            title: "Resident comment added",
            type: "resident_comment",
            message: "A resident added a comment to a report"
          }))
        );
      }
    }

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

// ADMIN: Resident-specific report summary
exports.getResidentReportSummary = async (req, res) => {
  try {
    const residentId = req.params.residentId;

    const [totalReports, pending, inProgress, resolved] = await Promise.all([
      Report.countDocuments({ resident: residentId }),
      Report.countDocuments({ resident: residentId, status: "pending" }),
      Report.countDocuments({ resident: residentId, status: "in_progress" }),
      Report.countDocuments({ resident: residentId, status: "resolved" }),
    ]);

    res.json({
      totalReports,
      pending,
      inProgress,
      resolved,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Edit Comment
exports.updateComment = async (req, res) => {
  try {
    const nextText = String(req.body.text || "").trim();

    if (!nextText) {
      return res.status(400).json({ msg: "Comment text is required" });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    const comment = report.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ msg: "Comment not found" });
    }

    comment.text = nextText;
    comment.date = new Date();
    report.markModified("comments");

    await report.save();
    await report.populate("comments.user", "name");

    res.json(report.comments);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADMIN: Delete Comment
exports.deleteComment = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ msg: "Report not found" });
    }

    const comment = report.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ msg: "Comment not found" });
    }

    report.comments.pull({ _id: req.params.commentId });
    report.markModified("comments");

    await report.save();
    await report.populate("comments.user", "name");

    res.json(report.comments);
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
