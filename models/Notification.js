const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      default: ""
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: "general"
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      default: null
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
