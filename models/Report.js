const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    name: String,
    mimeType: String,
    url: String,
    isImage: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    category: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    purok: {
      type: String,
      required: true
    },
    personInvolved: {
      type: String,
      trim: true
    },
    incidentDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending"
    },
    attachment: attachmentSchema,
    attachments: [attachmentSchema],

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        text: String,
        attachment: attachmentSchema,
        date: {
          type: Date,
          default: Date.now
        }
      }
    ]

  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
