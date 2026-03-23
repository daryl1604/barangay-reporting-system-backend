const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    text: {
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

module.exports = mongoose.model("Announcement", announcementSchema);
