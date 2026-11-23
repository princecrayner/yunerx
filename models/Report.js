const mongoose = require("mongoose");
const { REPORT_REASONS } = require("../config/market");

const ReportSchema = new mongoose.Schema({

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // kept so you can see who is being reported even after the listing is deleted
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    reason: { type: String, required: true, enum: REPORT_REASONS },

    details: { type: String, default: "", trim: true, maxlength: 300 },

    status: { type: String, enum: ["open", "reviewed"], default: "open" },

    createdAt: { type: Date, default: Date.now }

});

// one report per person per listing
ReportSchema.index({ productId: 1, reporterId: 1 }, { unique: true });

ReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Report", ReportSchema);
