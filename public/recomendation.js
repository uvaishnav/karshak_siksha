document.addEventListener("DOMContentLoaded", async function() {
    const tempVal = document.getElementById("temperature");
    const humidityVal = document.getElementById("humidity");
    const rainfallVal = document.getElementById("rainfall");

    const recomend1 = document.getElementById("crop1");
    const expenditure1 = document.getElementById("expenditure1");
    const income1 = document.getElementById("income1");
    const yeild1 = document.getElementById("yield1");

    const recomend2 = document.getElementById("crop2");
    const expenditure2 = document.getElementById("expenditure2");
    const income2 = document.getElementById("income2");
    const yeild2 = document.getElementById("yield2");

    const nitrogen = document.getElementById("nitrogen");
    const phosphorous = document.getElementById("phosphorous");
    const potassium = document.getElementById("potassium");
    const ph = document.getElementById("ph");

    const CropContainer1 = document.getElementById("crop-details1")
    const CropContainer2 = document.getElementById("crop-details2")

    const firstCrop = document.getElementById("firstCrop");
    const secondCrop = document.getElementById("secondCrop");

    const recomendation = JSON.parse(sessionStorage.getItem("recommendation"));
    const datac = JSON.parse(sessionStorage.getItem("datac"));
    const yieldCrop1 = sessionStorage.getItem("yieldCrop1");
    const yieldCrop2 = sessionStorage.getItem("yieldCrop2");
    const landSize = sessionStorage.getItem("landSize");

    handleAnimations();

    console.log(recomendation);
    console.log(datac);
    console.log(yieldCrop1);
    console.log(yieldCrop2);

    recomend1.textContent = recomendation['first_crop'];
    recomend2.textContent = recomendation['second_crop'];

    CropContainer1.style.backgroundImage = `url('./static/${recomendation['first_crop']}.jpeg')`;
    CropContainer2.style.backgroundImage = `url('./static/${recomendation['second_crop']}.jpeg')`;


    yeild1.textContent = parseFloat((yieldCrop1)*1000).toFixed(2)+"kg";
    yeild2.textContent = parseFloat((yieldCrop2)*1000).toFixed(2)+"kg";

    nitrogen.textContent = parseFloat(datac['N']).toFixed(2);
    potassium.textContent = parseFloat(datac['K']).toFixed(2);
    phosphorous.textContent = parseFloat(datac['P']).toFixed(2);
    ph.textContent = parseFloat(datac['ph']).toFixed(2);
    
    tempVal.textContent = parseFloat(datac['temperature']).toFixed(2) + "°C";
    humidityVal.textContent = parseFloat(datac['humidity']).toFixed(2) + "%";
    rainfallVal.textContent = parseFloat(datac['rainfall']).toFixed(2) + "mm";

    const loadingOverlay = document.getElementById("loading-overlay");

    const showLoadingOverlay = () => {
        loadingOverlay.style.display = 'flex';
    };

    const hideLoadingOverlay = () => {
        loadingOverlay.style.display = 'none';
    };

    async function fetchCropCostData(crop_name) {
        try {
            const response = await fetch(`/cropCost/${encodeURIComponent(crop_name)}`);
            console.log(response.status);

            if (response.ok) {
                const data = await response.json();
                console.log(data);
                return data[0];
            } else {
                throw new Error(`Failed to fetch data for crop: ${crop_name}`);
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    const dataObj1 = await fetchCropCostData(recomendation['first_crop']);
    const dataObj2 = await fetchCropCostData(recomendation['second_crop']);

    console.log(dataObj1);
    console.log(dataObj2);

    function calculateFarmerProfit(costPerHectare,yieldPerHectare, acres,marketCostPerKg,) {
        // Constants
        const hectaresPerAcre = 0.404686; // 1 acre = 0.404686 hectares
        const kgPerTonne = 1000; 
    
        // Convert acres to hectares
        const hectares = acres * hectaresPerAcre;
    
        // Calculate total cost
        const totalCost = costPerHectare * hectares;
    
        // Calculate total yield in kg
        const totalYieldTonne = yieldPerHectare * hectares;
        const totalYieldKg = (totalYieldTonne) * kgPerTonne; // Cause yeild per Tonne is for one year
    
        // Calculate total revenue
        const totalRevenue = totalYieldKg * marketCostPerKg;
    
        // Calculate profit
        const profit = totalRevenue - totalCost;
    
        return {
            totalCost: totalCost.toFixed(2),
            totalRevenue: totalRevenue.toFixed(2),
            profit: profit.toFixed(2)
        };
    }

    if (dataObj1 && dataObj2) {
        const cropProfits1 = calculateFarmerProfit(
            dataObj1.cropcost,
            yieldCrop1,
            landSize,
            dataObj1.cropreturn
        );

        const cropProfits2 = calculateFarmerProfit(
            dataObj2.cropcost,
            yieldCrop2,
            landSize,
            dataObj2.cropreturn
        );

        expenditure1.textContent = "₹"+cropProfits1.totalCost;
        income1.textContent = "₹"+cropProfits1.profit;

        expenditure2.textContent = "₹"+cropProfits2.totalCost;
        income2.textContent = "₹"+cropProfits2.profit;
    } else {
        console.error('Failed to calculate profits due to missing crop cost data.');
    }

    // Function to handle animations
    function handleAnimations() {
        // Add animation class to top section
        const topSection = document.querySelector(".recomend-top-section");
        console.log("Top section:", topSection);
        if (topSection) {
            topSection.classList.add("animate-scroll-left-to-right");
        }

        // Add animation class to bottom section
        const bottomSection = document.querySelector(".recomend-bottom-section");
        console.log("Bottom section:", bottomSection);
        if (bottomSection) {
            bottomSection.classList.add("animate-scroll-right-to-left");
        }

        // Add animation class to recommendation section cards
        const recommendationCards = document.querySelectorAll(".recommendation-section .crop-details");
        console.log("Recommendation cards:", recommendationCards);
        recommendationCards.forEach(card => {
            card.classList.add("animate-pop-up-from-bottom");
        });
    }

    const get_suggestions = async (crop_name) => {
        const datac = JSON.parse(sessionStorage.getItem("datac"));
        const llmload = {
            crop_name: crop_name,
            temperature: parseFloat(datac['temperature']).toFixed(2),
            humidity: parseFloat(datac['humidity']),
            rainfall: parseFloat(datac['rainfall']),
            n: parseFloat(datac['N']).toFixed(2),
            p: parseFloat(datac['P']).toFixed(2),
            k: parseFloat(datac['K']).toFixed(2),
            ph: parseFloat(datac['ph']).toFixed(2)
        };

        try {
            const response = await fetch('/generate-suggestion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(llmload)
            });

            if (!response.ok) {
                throw new Error('Failed to fetch suggestions');
            }

            const result = await response.json();
            console.log('Fetched suggestions:', result);
            const suggestionsData = result.suggestion;
            sessionStorage.setItem("suggestions", JSON.stringify(suggestionsData));
            window.location.href = '/suggestions.html';
        } catch (error) {
            console.error(error);
        }
    };

    firstCrop.addEventListener("click", async () => {
        const recommendation = JSON.parse(sessionStorage.getItem("recommendation"));
        const crop_name = recommendation['first_crop'];
        showLoadingOverlay();
        await get_suggestions(crop_name);
        hideLoadingOverlay();
    });

    secondCrop.addEventListener("click", async () => {
        const recommendation = JSON.parse(sessionStorage.getItem("recommendation"));
        const crop_name = recommendation['second_crop'];
        showLoadingOverlay();
        await get_suggestions(crop_name);
        hideLoadingOverlay();
    });
});
