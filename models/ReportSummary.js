const mongoose = require("mongoose");

const reportSummarySchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true
    },
    period: {
      type: String,
      enum: ["week", "month", "year"],
      default: "week"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportSummary", reportSummarySchema);
