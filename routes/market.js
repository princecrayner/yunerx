const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const router = express.Router();

const cloudinary = require("../config/cloudinary");
const Product = require("../models/Product");
const market = require("../config/market");
const helpers = require("../utils/marketHelpers");
const User = require("../models/User");

const Favorite = require("../models/Favorite");
const Report = require("../models/Report");

const {
    CATEGORIES,
    CONDITIONS,
    MAX_IMAGES,
    MAX_IMAGE_MB,
    MAX_PRICE,
    MAX_ACTIVE_LISTINGS,
    REPORT_REASONS,
    MAX_REPORTS_PER_DAY
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

// Uploads every photo, or none: if one fails, the ones that went through are removed
async function uploadAll(files) {

    const settled = await Promise.allSettled(files.map(uploadImage));

    const uploaded = settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

    if (uploaded.length !== files.length) {
        await destroyImages(uploaded);
        return null;
    }

    return uploaded;

}

// Reads and checks the listing fields shared by "post" and "edit"
function readListing(body) {

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "");
    const location = String(body.location || "").trim();
    const negotiable = body.negotiable === "true" || body.negotiable === "on";

    const priceText = String(body.price || "").replace(/,/g, "").trim();
    const price = Math.round(Number(priceText) * 100) / 100;

    let condition = String(body.condition || "");

    if (title.length < 3 || title.length > 80) {
        return { error: "The title must be 3 to 80 characters." };
    }

    if (priceText === "" || !isFinite(price) || price < 0 || price > MAX_PRICE) {
        return { error: "Enter a valid price (use 0 if it is free)." };
    }

    if (!CATEGORIES.includes(category)) {
        return { error: "Choose a category." };
    }

    if (category === "Services") {
        condition = "";
    } else if (!CONDITIONS.includes(condition)) {
        return { error: "Choose the condition of the item." };
    }

    if (description.length > 1500) {
        return { error: "The description can be up to 1500 characters." };
    }

    if (location.length > 60) {
        return { error: "The meeting place can be up to 60 characters." };
    }

    return { data: { title, description, price, negotiable, category, condition, location } };

}


// =====================================================
// SELL: the form
// =====================================================

router.get("/sell", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=/sell");
    }

    res.render("sell", {
        product: null,
        categories: CATEGORIES,
        conditions: CONDITIONS,
        maxImages: MAX_IMAGES,
        currency: market.CURRENCY,
        ...helpers
    });

});


router.post("/sell", uploadPhotos, async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const userId = req.session.user._id;

        const { error, data } = readListing(req.body);

        if (error) {
            return res.status(400).json({ error });
        }

        const files = req.files || [];

        if (files.length < 1) {
            return res.status(400).json({ error: "Add at least one photo." });
        }

        const active = await Product.countDocuments({ sellerId: userId, status: "available" });

        if (active >= MAX_ACTIVE_LISTINGS) {
            return res.status(400).json({
                error: "You already have " + MAX_ACTIVE_LISTINGS + " items for sale. Mark some as sold or delete them first."
            });
        }

        const uploaded = await uploadAll(files);

        if (!uploaded) {
            return res.status(502).json({ error: "Could not upload your photos. Please try again." });
        }

        try {

            const product = await Product.create({ sellerId: userId, ...data, images: uploaded });

            return res.json({ success: true, id: product._id });

        } catch (saveError) {

            await destroyImages(uploaded);

            if (saveError.name === "ValidationError") {
                return res.status(400).json({ error: Object.values(saveError.errors)[0].message });
            }

            throw saveError;

        }

    } catch (error) {

        console.error("Sell error:", error);

        res.status(500).json({ error: "Something went wrong. Please try again." });

    }

});


// The edit form is the Sell form, filled in with the listing
router.get("/product/:id/edit", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=" + encodeURIComponent(req.originalUrl));
    }

    try {

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send("Listing not found.");
        }

        // only the seller's own listing can match
        const product = await Product.findOne({
            _id: req.params.id,
            sellerId: req.session.user._id
        }).lean();

        if (!product) {
            return res.status(404).send("Listing not found.");
        }

        res.render("sell", {
            product,
            categories: CATEGORIES,
            conditions: CONDITIONS,
            maxImages: MAX_IMAGES,
            currency: market.CURRENCY,
            ...helpers
        });

    } catch (error) {

        console.error("Edit page error:", error);

        res.status(500).send("Unable to load this listing.");

    }

});


router.post("/product/:id/edit", uploadPhotos, async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid request." });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            sellerId: req.session.user._id
        });

        if (!product) {
            return res.status(404).json({ error: "Listing not found." });
        }

        const { error, data } = readListing(req.body);

        if (error) {
            return res.status(400).json({ error });
        }

        // which of the existing photos the seller kept, in the order shown on screen
        let keepIds = [];

        try {
            keepIds = JSON.parse(req.body.keep || "[]");
        } catch (e) {}

        if (!Array.isArray(keepIds)) {
            keepIds = [];
        }

        const kept = keepIds
            .map((publicId) => product.images.find((image) => image.publicId === publicId))
            .filter(Boolean);

        const files = req.files || [];

        if (kept.length + files.length < 1) {
            return res.status(400).json({ error: "Add at least one photo." });
        }

        if (kept.length + files.length > MAX_IMAGES) {
            return res.status(400).json({ error: "You can have up to " + MAX_IMAGES + " photos." });
        }

        const uploaded = files.length ? await uploadAll(files) : [];

        if (!uploaded) {
            return res.status(502).json({ error: "Could not upload your photos. Please try again." });
        }

        const removed = product.images.filter(
            (image) => !kept.some((keptImage) => keptImage.publicId === image.publicId)
        );

        product.set({
            ...data,
            images: [
                ...kept.map((image) => ({ url: image.url, publicId: image.publicId })),
                ...uploaded
            ]
        });

        try {

            await product.save();

        } catch (saveError) {

            await destroyImages(uploaded);

            if (saveError.name === "ValidationError") {
                return res.status(400).json({ error: Object.values(saveError.errors)[0].message });
            }

            throw saveError;

        }

        // the old photos are removed only now that the changes are saved
        await destroyImages(removed);

        res.json({ success: true, id: product._id });

    } catch (error) {

        console.error("Edit error:", error);

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

                const isSaved = isOwner
            ? false
            : !!(await Favorite.exists({ userId: req.session.user._id, productId: product._id }));

        res.render("product", {
            product,
            seller,
            isOwner,
            isSaved,
            moreFromSeller,
            similar,
            reportReasons: REPORT_REASONS,
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
        
        await Favorite.deleteMany({ productId: product._id });

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


// =====================================================
// PUBLIC SELLER PAGE
// =====================================================

router.get("/user/:username", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=" + encodeURIComponent(req.originalUrl));
    }

    try {

        // only the public fields: never the email, phone or password
        const seller = await User.findOne({ username: req.params.username })
            .select("username profileImage")
            .lean();

        if (!seller) {
            return res.status(404).send("User not found.");
        }

        // your own page has the management buttons
        if (String(seller._id) === String(req.session.user._id)) {
            return res.redirect("/profile");
        }

        const [forSale, sold, soldCount] = await Promise.all([

            Product.find({ sellerId: seller._id, status: "available" })
                .sort({ createdAt: -1 })
                .lean(),

            Product.find({ sellerId: seller._id, status: "sold" })
                .sort({ updatedAt: -1 })
                .limit(24)
                .lean(),

            Product.countDocuments({ sellerId: seller._id, status: "sold" })

        ]);

        res.render("publicprofile", {
            seller,
            memberSince: seller._id.getTimestamp(),
            forSale,
            sold,
            soldCount,
            ...helpers
        });

    } catch (error) {

        console.error("Seller page error:", error);

        res.status(500).send("Unable to load this seller.");

    }

});


// =====================================================
// SAVED ITEMS
// =====================================================

// The ids of everything you saved (the hearts on every page use this)
router.get("/saved/ids", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const rows = await Favorite.find({ userId: req.session.user._id })
            .select("productId")
            .limit(1000)
            .lean();

        res.set("Cache-Control", "no-store");

        res.json({ ids: rows.map((row) => String(row.productId)) });

    } catch (error) {

        console.error("Saved ids error:", error);

        res.status(500).json({ error: "Something went wrong." });

    }

});

// Save or un-save one item. The request says which state is wanted, so a repeat tap can't flip it back.
router.post("/product/:id/save", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const id = req.params.id;
        const userId = req.session.user._id;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "Invalid request." });
        }

        const wanted = req.body.saved === true || req.body.saved === "true";

        if (wanted) {

            const product = await Product.findById(id).select("sellerId").lean();

            if (!product) {
                return res.status(404).json({ error: "This item no longer exists." });
            }

            if (String(product.sellerId) === String(userId)) {
                return res.status(400).json({ error: "This is your own item." });
            }

            try {

                await Favorite.updateOne(
                    { userId, productId: id },
                    { $setOnInsert: { createdAt: new Date() } },
                    { upsert: true }
                );

            } catch (error) {

                // two taps at the same moment: it is already saved
                if (error.code !== 11000) {
                    throw error;
                }

            }

        } else {

            await Favorite.deleteOne({ userId, productId: id });

        }

        res.json({ success: true, saved: wanted });

    } catch (error) {

        console.error("Save error:", error);

        res.status(500).json({ error: "Could not save this item." });

    }

});

router.get("/saved", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=/saved");
    }

    try {

        const favorites = await Favorite.find({ userId: req.session.user._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const rows = await Product.find({ _id: { $in: favorites.map((f) => f.productId) } }).lean();

        const byId = new Map(rows.map((product) => [String(product._id), product]));

        // newest saved first; items that were deleted are skipped
        const items = favorites
            .map((favorite) => byId.get(String(favorite.productId)))
            .filter(Boolean);

        res.render("saved", { items, ...helpers });

    } catch (error) {

        console.error("Saved page error:", error);

        res.status(500).send("Unable to load your saved items.");

    }

});


// =====================================================
// REPORT A LISTING
// =====================================================

router.post("/product/:id/report", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const id = req.params.id;
        const userId = req.session.user._id;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "Invalid request." });
        }

        const reason = String(req.body.reason || "");
        const details = String(req.body.details || "").trim().slice(0, 300);

        if (!REPORT_REASONS.includes(reason)) {
            return res.status(400).json({ error: "Choose a reason." });
        }

        const product = await Product.findById(id).select("sellerId").lean();

        if (!product) {
            return res.status(404).json({ error: "This listing no longer exists." });
        }

        if (String(product.sellerId) === String(userId)) {
            return res.status(400).json({ error: "You cannot report your own listing." });
        }

        // the same person reporting the same listing twice is simply accepted again
        if (await Report.exists({ productId: id, reporterId: userId })) {
            return res.json({ success: true, already: true });
        }

        const today = await Report.countDocuments({
            reporterId: userId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (today >= MAX_REPORTS_PER_DAY) {
            return res.status(429).json({ error: "You have sent a lot of reports today. Please try again tomorrow." });
        }

        try {

            await Report.create({
                productId: id,
                reporterId: userId,
                sellerId: product.sellerId,
                reason,
                details
            });

        } catch (error) {

            if (error.code !== 11000) {
                throw error;
            }

        }

        res.json({ success: true });

    } catch (error) {

        console.error("Report error:", error);

        res.status(500).json({ error: "Could not send your report." });

    }

});

module.exports = router;
