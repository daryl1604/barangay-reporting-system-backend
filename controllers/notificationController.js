const Notification = require("../models/Notification");

// RESIDENT: Get my notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user.id
    }).sort({ createdAt: -1 }).lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    if (String(notification.user) !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    if (String(notification.user) !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    await notification.deleteOne();

    res.json({ msg: "Notification deleted successfully", notificationId: req.params.id });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
