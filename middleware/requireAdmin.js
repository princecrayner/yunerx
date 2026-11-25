const User = require("../models/User");

module.exports = async function requireAdmin(req, res, next) {

    try {

        // Pages get a redirect or a plain message; buttons that call fetch get JSON
        const isPage = req.method === "GET";

        if (!req.session.user) {

            if (isPage) {
                return res.redirect("/login?redirect=" + encodeURIComponent(req.originalUrl));
            }

            return res.status(401).json({ loginRequired: true, message: "Please log in." });

        }

        const user = await User.findById(req.session.user._id).select("isAdmin").lean();

        if (!user || user.isAdmin !== true) {

            if (isPage) {
                return res.status(403).send("Admins only.");
            }

            return res.status(403).json({ message: "Admins only." });

        }

        next();

    } catch (error) {

        console.error("Admin check error:", error);

        res.status(500).send("Unable to verify admin access.");

    }

};
