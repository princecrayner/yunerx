// One-time cleanup: removes all marketplace-era leftovers of the old video feature.
//   node scripts/removeVideos.js            -> only COUNTS what would be deleted
//   node scripts/removeVideos.js --delete   -> really deletes it

require("dotenv").config();

const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

// Only the old video uploads. Stories, products and profile pictures use other folders.
const PREFIX = "yunerx/videos/";

const reallyDelete = process.argv.includes("--delete");

async function countCloudinaryVideos() {

    let total = 0;
    let cursor;

    do {

        const result = await cloudinary.api.resources({
            type: "upload",
            resource_type: "video",
            prefix: PREFIX,
            max_results: 500,
            next_cursor: cursor
        });

        total += result.resources.length;
        cursor = result.next_cursor;

    } while (cursor);

    return total;

}

async function deleteCloudinaryVideos() {

    for (let round = 1; round <= 50; round++) {

        const result = await cloudinary.api.delete_resources_by_prefix(PREFIX, {
            resource_type: "video",
            type: "upload"
        });

        const removed = Object.keys(result.deleted || {}).length;

        console.log("  round " + round + ": removed " + removed + " files");

        // done when nothing more was removed, or Cloudinary says nothing is left
        if (removed === 0 || !result.partial) {
            return;
        }

    }

}

async function main() {

    await mongoose.connect(process.env.MONGO_URI);

    const videos = mongoose.connection.db.collection("videos");
    const users = mongoose.connection.db.collection("users");

    const dbCount = await videos.countDocuments();
    const cloudCount = await countCloudinaryVideos();

    console.log("");
    console.log("Video records in the database : " + dbCount);
    console.log("Video files on Cloudinary     : " + cloudCount + "  (" + PREFIX + ")");
    console.log("");

    if (!reallyDelete) {
        console.log("Nothing was deleted. To delete all of it, run:");
        console.log("  node scripts/removeVideos.js --delete");
        return;
    }

    console.log("Deleting in 5 seconds... press Ctrl+C now to cancel.");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Deleting files from Cloudinary...");

    await deleteCloudinaryVideos();

    // removes the (now empty) folder; harmless if it can't
    await cloudinary.api.delete_folder("yunerx/videos").catch(() => {});

    const removedRecords = await videos.deleteMany({});

    // the old "videos" list that used to sit on every user
    const cleanedUsers = await users.updateMany({ videos: { $exists: true } }, { $unset: { videos: "" } });

    console.log("");
    console.log("Done. Removed " + removedRecords.deletedCount + " video records and tidied " + cleanedUsers.modifiedCount + " user records.");

}

main()
    .catch((error) => {
        console.error("Cleanup failed:", error.message || error);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
