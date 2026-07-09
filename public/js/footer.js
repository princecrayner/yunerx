document.querySelector(".profile-btn")
.addEventListener("click", () => {

    window.location.href = "/profile";

});

document.querySelector(".chats")
.addEventListener("click", () => {

    window.location.href = "/chats";

});

document.querySelector(".videos")
.addEventListener("click", () => {

    window.location.href = "/videos";

});



document.querySelector(".groups")
.addEventListener("click", () => {

    window.location.href = "/groups";

});

document.querySelector(".docs")
.addEventListener("click", () => {

    window.location.href = "/docs";

});

// ===== UPLOAD BUTTON =====

const uploadBtn = document.querySelector(".upload-btn");

if (uploadBtn) {

    uploadBtn.addEventListener("click", () => {

        window.location.href = "/uploadvideo";

    });

}