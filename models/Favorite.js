const mongoose = require("mongoose");

const FavoriteSchema = new mongoose.Schema({

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    createdAt: { type: Date, default: Date.now }

});

// one heart per person per item, enforced by the database
FavoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });

// used to clean up when a listing is deleted
FavoriteSchema.index({ productId: 1 });

module.exports = mongoose.model("Favorite", FavoriteSchema);
