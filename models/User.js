const mongoose = require("mongoose");

async function cascadeResidentRecords(userId) {
  const Report = mongoose.model("Report");
  const Notification = mongoose.model("Notification");

  const residentReports = await Report.find({ resident: userId }).select("_id");
  const residentReportIds = residentReports.map((report) => report._id);

  await Promise.all([
    Notification.deleteMany({
      $or: [
        { user: userId },
        ...(residentReportIds.length ? [{ report: { $in: residentReportIds } }] : []),
      ],
    }),
    Report.updateMany(
      { "comments.user": userId },
      {
        $pull: {
          comments: { user: userId },
        },
      }
    ),
    Report.deleteMany({ resident: userId }),
  ]);
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    purokNumber: {
      type: String,
      trim: true
    },
    contactNumber: {
      type: String,
      trim: true
    },
    age: {
      type: Number
    },
    gender: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["resident", "admin"],
      default: "resident"
    }
  },
  { timestamps: true }
);

userSchema.pre("deleteOne", { document: true, query: false }, async function () {
  if (this.role === "resident") {
    await cascadeResidentRecords(this._id);
  }
});

userSchema.pre("findOneAndDelete", { document: false, query: true }, async function () {
  const resident = await this.model.findOne(this.getFilter()).select("_id role");

  if (resident?.role === "resident") {
    await cascadeResidentRecords(resident._id);
  }
});

module.exports = mongoose.model("User", userSchema);
