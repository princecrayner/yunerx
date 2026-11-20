const mongoose = require("mongoose");
const { CATEGORIES, CONDITIONS } = require("../config/market");

const ImageSchema = new mongoose.Schema({

    url: { type: String, required: true },

    // kept so the photo can be deleted from Cloudinary with the listing
    publicId: { type: String, required: true }

}, { _id: false });

const ProductSchema = new mongoose.Schema({

    // the seller's permanent id: renaming an account can never detach a listing
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },

    description: { type: String, default: "", trim: true, maxlength: 1500 },

    price: { type: Number, required: true, min: 0 },

    negotiable: { type: Boolean, default: false },

    category: { type: String, required: true, enum: CATEGORIES },

    // empty for Services
    condition: { type: String, default: "", enum: [...CONDITIONS, ""] },

    // where to meet on campus, for example "Hall 3 gate"
    location: { type: String, default: "", trim: true, maxlength: 60 },

    images: [ImageSchema],

    status: { type: String, enum: ["available", "sold"], default: "available" },

    views: { type: Number, default: 0 }

}, { timestamps: true });

ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ category: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Product", ProductSchema);
