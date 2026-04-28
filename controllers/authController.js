const User = require("../models/User");
const Report = require("../models/Report");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ALLOWED_PUROK_OPTIONS = ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6", "Purok 7"];

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, purokNumber, contactNumber, age, gender } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = name?.trim();
    const normalizedRole = role || "resident";
    const normalizedPurokNumber = purokNumber?.trim();
    const normalizedContactNumber = contactNumber?.trim();
    const normalizedGender = gender?.trim();
    const numericAge = Number(age);

    if (!normalizedName) {
      return res.status(400).json({ msg: "Full name is required" });
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ msg: "A valid email address is required" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters long" });
    }

    if (normalizedRole === "resident") {
      if (!ALLOWED_PUROK_OPTIONS.includes(normalizedPurokNumber)) {
        return res.status(400).json({ msg: "Please select a valid purok" });
      }

      if (!/^09\d{9}$/.test(normalizedContactNumber || "")) {
        return res.status(400).json({ msg: "Please enter a valid contact number" });
      }

      if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
        return res.status(400).json({ msg: "Age must be between 1 and 120" });
      }

      if (!normalizedGender) {
        return res.status(400).json({ msg: "Gender is required" });
      }
    }

    // check if user exists
    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ msg: "User already exists" });

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    user = new User({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
      purokNumber: normalizedPurokNumber,
      contactNumber: normalizedContactNumber,
      age: Number.isInteger(numericAge) ? numericAge : undefined,
      gender: normalizedGender,
    });

    await user.save();

    // create JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        purokNumber: user.purokNumber,
        contactNumber: user.contactNumber,
        age: user.age,
        gender: user.gender,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    // check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    // create JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        purokNumber: user.purokNumber,
        contactNumber: user.contactNumber,
        age: user.age,
        gender: user.gender,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    const nextName = String(req.body.name || req.body.fullName || "").trim();
    const nextContactNumber = String(req.body.contactNumber || req.body.mobile || "").trim();
    const nextPurokNumber = String(req.body.purokNumber || req.body.purok || "").trim();
    const nextGender = String(req.body.gender || "").trim();
    const nextAge = req.body.age === "" || req.body.age === undefined ? undefined : Number(req.body.age);

    if (!nextName) {
      return res.status(400).json({ msg: "Full name is required" });
    }

    currentUser.name = nextName;

    if (currentUser.role === "resident") {
      if (nextPurokNumber && !ALLOWED_PUROK_OPTIONS.includes(nextPurokNumber)) {
        return res.status(400).json({ msg: "Please select a valid purok" });
      }

      if (nextContactNumber && !/^09\d{9}$/.test(nextContactNumber)) {
        return res.status(400).json({ msg: "Please enter a valid contact number" });
      }

      if (nextAge !== undefined && (!Number.isInteger(nextAge) || nextAge < 1 || nextAge > 120)) {
        return res.status(400).json({ msg: "Age must be between 1 and 120" });
      }

      currentUser.purokNumber = nextPurokNumber || currentUser.purokNumber;
      currentUser.contactNumber = nextContactNumber;
      currentUser.age = nextAge;
      currentUser.gender = nextGender;
    }

    await currentUser.save();

    res.json({
      user: {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        purokNumber: currentUser.purokNumber,
        contactNumber: currentUser.contactNumber,
        age: currentUser.age,
        gender: currentUser.gender,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ADMIN: LIST RESIDENTS
exports.getResidents = async (_req, res) => {
  try {
    const residents = await User.find({ role: "resident" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    res.json(residents);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// ADMIN: GET RESIDENT DETAILS
exports.getResidentById = async (req, res) => {
  try {
    const resident = await User.findOne({
      _id: req.params.id,
      role: "resident",
    }).select("-password");

    if (!resident) {
      return res.status(404).json({ msg: "Resident not found" });
    }

    res.json(resident);
  } catch (err) {
    console.error(err.message);

    if (err.name === "CastError") {
      return res.status(404).json({ msg: "Resident not found" });
    }

    res.status(500).send("Server error");
  }
};

// ADMIN: DELETE RESIDENT
exports.deleteResident = async (req, res) => {
  try {
    const resident = await User.findOne({
      _id: req.params.id,
      role: "resident",
    });

    if (!resident) {
      return res.status(404).json({ msg: "Resident not found" });
    }

    const residentReports = await Report.find({ resident: resident._id }).select("_id");
    const residentReportIds = residentReports.map((report) => report._id);

    await Promise.all([
      Notification.deleteMany({
        $or: [
          { user: resident._id },
          ...(residentReportIds.length ? [{ report: { $in: residentReportIds } }] : []),
        ],
      }),
      Report.updateMany(
        { "comments.user": resident._id },
        {
          $pull: {
            comments: { user: resident._id },
          },
        }
      ),
      Report.deleteMany({ resident: resident._id }),
    ]);

    await resident.deleteOne();

    res.json({ msg: "Resident account deleted successfully" });
  } catch (err) {
    console.error(err.message);

    if (err.name === "CastError") {
      return res.status(404).json({ msg: "Resident not found" });
    }

    res.status(500).send("Server error");
  }
};
