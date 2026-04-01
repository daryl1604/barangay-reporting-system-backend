const mongoose = require("mongoose");

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
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending"
    },

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        text: String,
        attachment: {
          name: String,
          mimeType: String,
          url: String,
          isImage: {
            type: Boolean,
            default: false
          }
        },
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
