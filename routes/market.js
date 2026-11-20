const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const router = express.Router();

const cloudinary = require("../config/cloudinary");
const Product = require("../models/Product");
const market = require("../config/market");
const helpers = require("../utils/marketHelpers");

const {
    CATEGORIES,
    CONDITIONS,
    MAX_IMAGES,
    MAX_IMAGE_MB,
    MAX_PRICE,
    MAX_ACTIVE_LISTINGS
} = market;


// =====================================================
// PHOTO UPLOAD
// =====================================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_MB * 1024 * 1024,
        files: MAX_IMAGES
    },
    fileFilter: (req, file, cb) => {

        if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("ONLY_IMAGES"));
        }

    }
});

// Turns upload problems into a friendly message instead of a crash
function uploadPhotos(req, res, next) {

    upload.array("photos", MAX_IMAGES)(req, res, (error) => {

        if (!error) {
            return next();
        }

        let message = "Could not read the photos. Please try again.";

        if (error.code === "LIMIT_FILE_SIZE") {
            message = "Each photo must be under " + MAX_IMAGE_MB + " MB.";
        } else if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") {
            message = "You can add up to " + MAX_IMAGES + " photos.";
        } else if (error.message === "ONLY_IMAGES") {
            message = "Only JPG, PNG or WebP photos are allowed.";
        }

        res.status(400).json({ error: message });

    });

}

function uploadImage(file) {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "yunerx/products",
                resource_type: "image",
                transformation: [{ width: 1400, height: 1400, crop: "limit", quality: "auto" }]
            },
            (error, result) => {

                if (error) {
                    reject(error);
                } else {
                    resolve({ url: result.secure_url, publicId: result.public_id });
                }

            }
        );

        stream.end(file.buffer);

    });

}

async function destroyImages(images) {

    await Promise.all((images || []).map((image) =>
        cloudinary.uploader
            .destroy(image.publicId, { resource_type: "image" })
            .catch((error) => console.error("Image delete error:", error.message))
    ));

}


// =====================================================
// SELL: the form
// =====================================================

router.get("/sell", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=/sell");
    }

    res.render("sell", {
        categories: CATEGORIES,
        conditions: CONDITIONS,
        maxImages: MAX_IMAGES,
        currency: market.CURRENCY
    });

});


// =====================================================
// SELL: save the listing
// =====================================================

router.post("/sell", uploadPhotos, async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const userId = req.session.user._id;

        const title = String(req.body.title || "").trim();
        const description = String(req.body.description || "").trim();
        const category = String(req.body.category || "");
        const location = String(req.body.location || "").trim();
        const negotiable = req.body.negotiable === "true" || req.body.negotiable === "on";

        const priceText = String(req.body.price || "").replace(/,/g, "").trim();
        const price = Math.round(Number(priceText) * 100) / 100;

        let condition = String(req.body.condition || "");

        const files = req.files || [];

        // ----- checks (each one returns a message the form shows) -----

        if (title.length < 3 || title.length > 80) {
            return res.status(400).json({ error: "The title must be 3 to 80 characters." });
        }

        if (priceText === "" || !isFinite(price) || price < 0 || price > MAX_PRICE) {
            return res.status(400).json({ error: "Enter a valid price (use 0 if it is free)." });
        }

        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ error: "Choose a category." });
        }

        if (category === "Services") {
            condition = "";
        } else if (!CONDITIONS.includes(condition)) {
            return res.status(400).json({ error: "Choose the condition of the item." });
        }

        if (description.length > 1500) {
            return res.status(400).json({ error: "The description can be up to 1500 characters." });
        }

        if (location.length > 60) {
            return res.status(400).json({ error: "The meeting place can be up to 60 characters." });
        }

        if (files.length < 1) {
            return res.status(400).json({ error: "Add at least one photo." });
        }

        const active = await Product.countDocuments({ sellerId: userId, status: "available" });

        if (active >= MAX_ACTIVE_LISTINGS) {
            return res.status(400).json({
                error: "You already have " + MAX_ACTIVE_LISTINGS + " items for sale. Mark some as sold or delete them first."
            });
        }

        // ----- upload the photos; if any fail, remove the ones that went through -----

        const settled = await Promise.allSettled(files.map(uploadImage));

        const uploaded = settled
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value);

        if (uploaded.length !== files.length) {

            await destroyImages(uploaded);

            return res.status(502).json({ error: "Could not upload your photos. Please try again." });

        }

        // ----- save -----

        try {

            const product = await Product.create({
                sellerId: userId,
                title,
                description,
                price,
                negotiable,
                category,
                condition,
                location,
                images: uploaded
            });

            return res.json({ success: true, id: product._id });

        } catch (error) {

            await destroyImages(uploaded);

            if (error.name === "ValidationError") {
                return res.status(400).json({ error: Object.values(error.errors)[0].message });
            }

            throw error;

        }

    } catch (error) {

        console.error("Sell error:", error);

        res.status(500).json({ error: "Something went wrong. Please try again." });

    }

});


// =====================================================
// PRODUCT PAGE
// =====================================================

router.get("/product/:id", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=/product/" + encodeURIComponent(req.params.id));
    }

    try {

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send("Product not found.");
        }

        const product = await Product.findById(req.params.id)
            .populate("sellerId", "username profileImage")
            .lean();

        // no product, or the seller's account no longer exists
        if (!product || !product.sellerId) {
            return res.status(404).send("Product not found.");
        }

        const seller = product.sellerId;

        const isOwner = String(seller._id) === String(req.session.user._id);

        if (!isOwner) {
            Product.updateOne({ _id: product._id }, { $inc: { views: 1 } }).catch(() => {});
        }

        const [moreFromSeller, similar] = await Promise.all([

            Product.find({
                sellerId: seller._id,
                status: "available",
                _id: { $ne: product._id }
            }).sort({ createdAt: -1 }).limit(6).lean(),

            Product.find({
                category: product.category,
                status: "available",
                sellerId: { $ne: seller._id },
                _id: { $ne: product._id }
            }).sort({ createdAt: -1 }).limit(6).lean()

        ]);

        res.render("product", {
            product,
            seller,
            isOwner,
            moreFromSeller,
            similar,
            ...helpers
        });

    } catch (error) {

        console.error("Product page error:", error);

        res.status(500).send("Unable to load this product.");

    }

});


// =====================================================
// OWNER ACTIONS: mark as sold / available, delete
// =====================================================

router.post("/product/:id/status", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const id = req.params.id;
        const status = String(req.body.status || "");

        if (!mongoose.isValidObjectId(id) || !["available", "sold"].includes(status)) {
            return res.status(400).json({ error: "Invalid request." });
        }

        const userId = req.session.user._id;

        if (status === "available") {

            const active = await Product.countDocuments({
                sellerId: userId,
                status: "available",
                _id: { $ne: id }
            });

            if (active >= MAX_ACTIVE_LISTINGS) {
                return res.status(400).json({
                    error: "You already have " + MAX_ACTIVE_LISTINGS + " items for sale."
                });
            }

        }

        // only the seller's own listing can match
        const product = await Product.findOneAndUpdate(
            { _id: id, sellerId: userId },
            { status },
            { new: true }
        ).lean();

        if (!product) {
            return res.status(404).json({ error: "Listing not found." });
        }

        res.json({ success: true, status: product.status });

    } catch (error) {

        console.error("Product status error:", error);

        res.status(500).json({ error: "Something went wrong." });

    }

});


router.post("/product/:id/delete", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const id = req.params.id;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "Invalid request." });
        }

        const product = await Product.findOne({ _id: id, sellerId: req.session.user._id });

        if (!product) {
            return res.status(404).json({ error: "Listing not found." });
        }

        await destroyImages(product.images);

        await product.deleteOne();

        res.json({ success: true });

    } catch (error) {

        console.error("Product delete error:", error);

        res.status(500).json({ error: "Something went wrong." });

    }

});


// =====================================================
// MARKET: browse, search, filter (infinite scroll)
// =====================================================

const PAGE_SIZE = 20;

const SORTS = {
    new:  { createdAt: -1, _id: -1 },
    low:  { price: 1, createdAt: -1, _id: -1 },
    high: { price: -1, createdAt: -1, _id: -1 }
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePrice(value) {

    const text = String(value == null ? "" : value).replace(/,/g, "").trim();

    if (text === "" || !isFinite(Number(text)) || Number(text) < 0) {
        return null;
    }

    return Math.min(Number(text), MAX_PRICE);

}

// Reads ?q= &category= &condition= &sort= &min= &max= &page= safely
function parseFilters(query) {

    const category = String(query.category || "");
    const condition = String(query.condition || "");
    const sort = String(query.sort || "");

    let min = parsePrice(query.min);
    let max = parsePrice(query.max);

    if (min !== null && max !== null && min > max) {
        [min, max] = [max, min];
    }

    return {
        q: String(query.q || "").trim().slice(0, 60),
        category: CATEGORIES.includes(category) ? category : "",
        condition: CONDITIONS.includes(condition) ? condition : "",
        sort: ["new", "low", "high"].includes(sort) ? sort : "new",
        min,
        max,
        page: Math.min(Math.max(parseInt(query.page, 10) || 1, 1), 200)
    };

}

function buildFilter(f) {

    const filter = { status: "available" };

    if (f.category) filter.category = f.category;
    if (f.condition) filter.condition = f.condition;

    if (f.min !== null || f.max !== null) {

        filter.price = {};

        if (f.min !== null) filter.price.$gte = f.min;
        if (f.max !== null) filter.price.$lte = f.max;

    }

    // Every word must appear somewhere (title, description, meeting place or category)
    const words = f.q.split(/\s+/).filter(Boolean).slice(0, 5);

    if (words.length) {

        filter.$and = words.map((word) => {

            const rx = new RegExp(escapeRegex(word), "i");

            return { $or: [{ title: rx }, { description: rx }, { location: rx }, { category: rx }] };

        });

    }

    return filter;

}

// One extra row is fetched, only to learn whether there is another page
function findPage(filter, sort, page) {

    return Product.find(filter)
        .sort(SORTS[sort])
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE + 1)
        .lean();

}

// What the page needs to put the current filters back into its controls
function viewFilters(f) {

    return {
        q: f.q,
        category: f.category,
        condition: f.condition,
        sort: f.sort,
        min: f.min === null ? "" : String(f.min),
        max: f.max === null ? "" : String(f.max)
    };

}


// The Market page (first 20 items are rendered straight into the page)
router.get("/market", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=" + encodeURIComponent(req.originalUrl));
    }

    try {

        const f = parseFilters(req.query);
        const filter = buildFilter(f);

        const [rows, total] = await Promise.all([
            findPage(filter, f.sort, 1),
            Product.countDocuments(filter)
        ]);

        res.render("market", {
            products: rows.slice(0, PAGE_SIZE),
            hasMore: rows.length > PAGE_SIZE,
            total,
            filters: viewFilters(f),
            categories: CATEGORIES,
            conditions: CONDITIONS,
            currency: market.CURRENCY,
            ...helpers
        });

    } catch (error) {

        console.error("Market page error:", error);

        res.status(500).send("Unable to load the market.");

    }

});


// More items, as ready-made card HTML (used by search, filters and infinite scroll)
router.get("/market/feed", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const f = parseFilters(req.query);
        const filter = buildFilter(f);

        const rows = await findPage(filter, f.sort, f.page);

        const products = rows.slice(0, PAGE_SIZE);
        const hasMore = rows.length > PAGE_SIZE;

        // the total is only needed when a new search starts
        const total = f.page === 1 ? await Product.countDocuments(filter) : undefined;

        res.set("Cache-Control", "no-store");

        res.render("partials/product-cards", { products, ...helpers }, (error, html) => {

            if (error) {

                console.error("Market feed render error:", error);

                return res.status(500).json({ error: "Unable to load items." });

            }

            res.json({ html, hasMore, total });

        });

    } catch (error) {

        console.error("Market feed error:", error);

        res.status(500).json({ error: "Unable to load items." });

    }

});

module.exports = router;
