//--------MENU------//

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");


// Open menu

if (menuBtn && sidebar && overlay) {

    menuBtn.addEventListener("click", () => {

        sidebar.classList.add("active");

        overlay.classList.add("active");

    });


    // close menu when clicking outside

    overlay.addEventListener("click", () => {

        sidebar.classList.remove("active");

        overlay.classList.remove("active");

    });

}



//-----SEARCH-----//

function searchSubjects() {

    let input =
        document.getElementById("searchInput").value.toLowerCase();

    let subjects =
        document.getElementsByClassName("subject");

    for (let i = 0; i < subjects.length; i++) {

        let text =
            subjects[i].innerText.toLowerCase();

        if (text.includes(input)) {

            subjects[i].style.display = "block";

        } else {

            subjects[i].style.display = "none";

        }

    }

}



//CONNECTING//

const profileButton =
    document.querySelector(".profile-btn");

if (profileButton) {

    profileButton.addEventListener("click", () => {

        window.location.href = "/profile";

    });

}


const chatsButton =
    document.querySelector(".chats");

if (chatsButton) {

    chatsButton.addEventListener("click", () => {

        window.location.href = "/chats";

    });

}


const videosButton =
    document.querySelector(".videos");

if (videosButton) {

    videosButton.addEventListener("click", () => {

        window.location.href = "/videos";

    });

}



// SPLASH SCREEN ONLY ON FIRST VISIT

const splash =
    document.getElementById("splash");

if (splash) {

    if (sessionStorage.getItem("splashShown")) {

        splash.style.display = "none";

    } else {

        sessionStorage.setItem(
            "splashShown",
            "true"
        );

    }

}



// =========================
// PDF UPLOAD
// =========================

const form =
    document.getElementById("uploadForm");


if (form) {

    form.addEventListener("submit", async (e) => {

        e.preventDefault();


        try {

            const formData =
                new FormData(form);


            const response =
                await fetch("/docs/upload", {

                    method: "POST",

                    body: formData

                });


            const result =
                await response.json();


            alert(result.message);


            if (response.ok) {

                form.reset();

            }

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            alert(
                "Unable to upload PDF."
            );

        }

    });

}



// =========================
// DOCUMENTS
// =========================

const docsContainer =
    document.getElementById("docsContainer");


let allDocuments = [];


if (docsContainer) {

    loadDocuments();

}



// =========================
// LOAD DOCUMENTS
// =========================

async function loadDocuments() {

    const loading =
        document.getElementById("docsLoading");


    if (loading) {

        loading.style.display = "flex";

    }


    try {

        const response =
            await fetch("/docs/api");


        if (!response.ok) {

            throw new Error(
                "Failed to load documents"
            );

        }


        const docs =
            await response.json();


        allDocuments = docs;


        displayDocuments(docs);


    } catch (error) {

        console.error(
            "Error loading documents:",
            error
        );


        if (docsContainer) {

            docsContainer.innerHTML = `

                <div class="no-documents">

                    <p>
                        Unable to load documents.
                        Please try again.
                    </p>

                </div>

            `;

        }


    } finally {

        if (loading) {

            loading.style.display = "none";

        }

    }

}



// =========================
// DISPLAY DOCUMENTS
// =========================

function displayDocuments(docs) {

    if (!docsContainer) {

        return;

    }


    docsContainer.innerHTML = "";


    if (docs.length === 0) {

        docsContainer.innerHTML = `

            <div class="no-documents">

                <p>
                    📂 No documents found.
                </p>

            </div>

        `;

        return;

    }


    docs.forEach(doc => {

        docsContainer.innerHTML += `

        <div class="document">

            <div class="document-info">

                <h3>
                    📄 ${doc.name}
                </h3>

                <p>

                    Uploaded:
                    ${new Date(
                        doc.uploadedAt
                    ).toLocaleDateString()}

                </p>

            </div>


            <div class="menu">

                <button
                    class="menuBtn"
                    type="button"
                >
                    ⋮
                </button>


                <div class="dropdown">

                    <a
                        href="${doc.pdfUrl}"
                        target="_blank"
                    >
                        👁 Open
                    </a>


                    <a
                        href="${doc.pdfUrl}"
                        download
                    >
                        ⬇ Download
                    </a>


                    <button
                        class="deleteBtn"
                        data-id="${doc._id}"
                        type="button"
                    >
                        🗑 Delete
                    </button>

                </div>

            </div>

        </div>

        `;

    });

}



// =========================
// SEARCH DOCUMENTS
// =========================

const searchInput =
    document.getElementById("searchInput");


const searchButton =
    document.getElementById("searchButton");


function searchDocuments() {

    if (!searchInput) {

        return;

    }


    const searchText =
        searchInput.value
            .trim()
            .toLowerCase();


    const filteredDocuments =
        allDocuments.filter(doc => {

            return doc.name
                .toLowerCase()
                .includes(searchText);

        });


    displayDocuments(
        filteredDocuments
    );

}


if (searchInput) {

    searchInput.addEventListener(
        "input",
        searchDocuments
    );

}


if (searchButton) {

    searchButton.addEventListener(
        "click",
        searchDocuments
    );

}



// =========================
// DELETE DOCUMENT
// =========================

document.addEventListener(
    "click",
    async (e) => {

        if (
            !e.target.classList.contains(
                "deleteBtn"
            )
        ) {

            return;

        }


        const id =
            e.target.dataset.id;


        const confirmed =
            confirm(
                "Are you sure you want to delete this document?"
            );


        if (!confirmed) {

            return;

        }


        try {

            const response =
                await fetch(
                    "/docs/" + id,
                    {
                        method: "DELETE"
                    }
                );


            const result =
                await response.json();


            alert(result.message);


            if (response.ok) {

                loadDocuments();

            }

        } catch (error) {

            console.error(
                "Delete error:",
                error
            );

            alert(
                "Unable to delete document."
            );

        }

    }
);




