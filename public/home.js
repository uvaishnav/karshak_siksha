// home.js

document.addEventListener("DOMContentLoaded", function() {
    const homeBottomContainer = document.getElementById("home-bottom-container");
    const homeTopContainer = document.getElementById("home-top-container");
    const mainHeading = document.getElementById("main-heading");
    const homeMainContainer = document.getElementById("home-main-container");
    const topHomeHeading = document.querySelector(".top-home-heading");
    const productDesc = document.getElementById("product-desc");

    const text = topHomeHeading.innerText;
    topHomeHeading.innerHTML = text.split(' ').map(word => `<span>${word}</span>`).join(' ');

    const spans = topHomeHeading.querySelectorAll('span');
    let delay = 0;

    spans.forEach(span => {
        setTimeout(() => {
            span.style.opacity = 1;
        }, delay);
        delay += 100;
    });

    setTimeout(function() {
        homeTopContainer.style.height = "28vh";
        homeBottomContainer.style.display = "flex";
        mainHeading.classList.add("transition-color");
        homeMainContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        topHomeHeading.style.margin = 0;
        productDesc.style.display = "block";
    }, 2000);

    function typeEffect() {
        const productSpans = document.querySelectorAll('.product-desc .type-effect');
        let typeDelay = 0;
        
        productSpans.forEach((span, index) => {
            setTimeout(() => {
                span.style.width = span.scrollWidth + 'px'; // Typing effect
                span.style.opacity = 1;
            }, typeDelay);

            setTimeout(() => {
                span.style.opacity = 0;
                span.style.width = '0'; // Reset for next appearance
            }, typeDelay + 1500); // Adjust duration for visibility

            typeDelay += 2000; // Adjust delay for each span typing effect
        });

        // Loop the effect
        setTimeout(typeEffect, typeDelay);
    }

    // Start the typing effect after initial delay
    setTimeout(typeEffect, 1000);

    setTimeout(function() {
        homeBottomContainer.style.opacity = "1";
    }, 2200);
});

async function getLocationAndSubmit() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const landSize = document.getElementById("land-size").value;
            const loadingOverlay = document.getElementById("loadingOverlay");
            const loadingText = document.getElementById("loadingText");

            // Show the loading overlay
            loadingOverlay.style.display = 'flex';

            const messages = [
                'Getting your location info....',
                'Getting soil conditions based on your location....',
                'Forecasting weather conditions in your area for next season.....',
                'Extracting best Crop recommendations for you.....',
                'Estimating Cost....',
                'Predicting Yield you can make.......'
            ];

            // Display messages one after the other
            messages.forEach((message, index) => {
                setTimeout(() => {
                    loadingText.innerHTML = `<span>${message}</span>`;
                    // Fade in effect
                    loadingText.querySelector('span').style.opacity = 1;
                }, index * 1000); // Change messages every seconds
            });

            try {
                const response = await fetch('./get-crop-recommendation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ landSize, latitude, longitude })
                });

                if (response.ok) {
                    const data = await response.json();
                    sessionStorage.setItem("recommendation", JSON.stringify(data.recommendation));
                    sessionStorage.setItem("datac", JSON.stringify(data.payload));
                    sessionStorage.setItem("yieldCrop1", data.yieldCrop1);
                    sessionStorage.setItem("yieldCrop2", data.yieldCrop2);
                    sessionStorage.setItem("landSize", data.landSize);
                    
                    // Redirect to the recommendation page
                    loadingOverlay.style.display = 'none';
                    window.location.href = '/recomendation.html';
                } else {
                    console.error('Error in response:', response.statusText);
                    loadingOverlay.style.display = 'none'; // Hide the overlay on error
                }
            } catch (error) {
                console.error('Error fetching recommendation:', error);
                loadingOverlay.style.display = 'none'; // Hide the overlay on error
            }
        }, error => {
            console.error('Error getting location:', error);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}
