1. //--------MENU------//

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");


// Open menu
menuBtn.addEventListener("click", () => {
  sidebar.classList.add("active");
  overlay.classList.add("active");
});


// close menu when clicking outside
overlay.addEventListener("click", () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
});


2. //-----SEARCH-----//

function searchSubjects() {

    let input = document.getElementById("searchInput").value.toLowerCase();

    let subjects = document.getElementsByClassName("subject");

    for (let i = 0; i < subjects.length; i++) {

        let text = subjects[i].innerText.toLowerCase();

        if (text.includes(input)) {
            subjects[i].style.display = "block";
        } else {
            subjects[i].style.display = "none";
        }

    }

}


3. //-----SLIDER ACTIVE EFFECT-----//

const slides = document.querySelectorAll(".slide-img");

let current = 1;

setInterval(() => {

    slides.forEach(slide => {
        slide.classList.remove("active");
    });

    current++;

    if(current >= slides.length){
        current = 0;
    }

    slides[current].classList.add("active");

}, 3000);




4. //CONNECTING// 
document.querySelector(".profile-btn")
.addEventListener("click",()=>{
    window.location.href="/profile";
});

document.querySelector(".chats")
.addEventListener("click",()=>{
    window.location.href="/chats";
});

document.querySelector(".videos")
.addEventListener("click",()=>{
    window.location.href="/videos";
});




5. // SPLASH SCREEN ONLY ON FIRST VISIT

const splash = document.getElementById("splash");

if(sessionStorage.getItem("splashShown")){

    splash.style.display = "none";

}else{

    sessionStorage.setItem("splashShown", "true");

}



