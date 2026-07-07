const cloudinary = require("cloudinary").v2;

console.log("CLOUD_NAME:", process.env.CLOUD_NAME);
console.log("CLOUD_API_KEY:", process.env.CLOUD_API_KEY ? "FOUND" : "MISSING");
console.log("CLOUD_API_SECRET:", process.env.CLOUD_API_SECRET ? "FOUND" : "MISSING");

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

module.exports = cloudinary;
