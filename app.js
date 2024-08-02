const express = require('express');
const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const os = require('os'); 
const fetch = require('node-fetch'); // Add this if not already added
const session = require('express-session'); // Add this line
const { firestore } = require('./firebaseconfig'); // Import Firebase configuration

require("dotenv").config();

const app = express();
const port = process.env.PORT;

let generatedSuggestion = null; // Global variable to store the generated suggestion

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'keys.json');

// Read the credentials JSON string from the environment variable
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (credentialsJson) {
  // Parse the JSON string
  const credentials = JSON.parse(credentialsJson);

  // Define a temporary file path
  const tempFilePath = path.join(os.tmpdir(), 'google-credentials.json');

  // Write the credentials to the temporary file
  fs.writeFileSync(tempFilePath, JSON.stringify(credentials));

  // Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the temporary file path
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;
} else {
  console.error('Environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON is not set.');
  process.exit(1);
}

const vertexAI = new VertexAI({ project: process.env.PROJECT, location: 'us-central1' });
const model = 'gemini-1.5-pro-001';

const generativeModel = vertexAI.preview.getGenerativeModel({
  model: model,
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 1,
    topP: 0.95,
  },
  safetySettings: [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
  ],
  systemInstruction: {
    parts: [{ text: `AI assistant should provide suggestions for crop based on various input parameters like temperature, humidity, rainfall, NPK, pH, soil type, and the contents of the file. The suggestions should cover 1) soilAndSeeds: soil preparation, seed selection, seed treatment, 2) cropPlan: sowing time, spacing, nutrient management, 3) pestManagement: integrated pest management, biological control, chemical control, disease control, 4) waterIrrigationManagement: irrigation schedule, water conservation, 5) storageAfterYield: drying, storage conditions, milling, 6) riskMitigation: weather monitoring, insurance, crop diversification. Give in JSON format` }]
  },
});

async function sendMessage(message) {
  try {
    const chat = generativeModel.startChat({});
    const streamResult = await chat.sendMessageStream([{ text: message }]);

    const response = await streamResult.response;
    let aiReply = '';

    if (response.candidates && response.candidates.length > 0) {
      aiReply = response.candidates[0].content.parts[0].text.trim();
    }

    aiReply = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();

    return aiReply;
  } catch (err) {
    console.error('Error generating content:', err.message);
    throw err;
  }
}

app.post('/generate-suggestion', async (req, res) => {
  try {
    const {crop_name,temperature,humidity,rainfall,n,p,k,ph} = req.body;
    const soilType = 'laterite'

    const cropContent = fs.readFileSync(path.join(__dirname, `crops/${crop_name}.txt`), 'utf-8');

    const prompt = `${crop_name} crop details: Temperature: ${temperature}, Humidity: ${humidity}, Rainfall: ${rainfall},Nitrogen: ${n},Potassium : ${k}, Phosphorous :${p}, pH: ${ph}, Soil Type: ${soilType}. txt content: ${cropContent}. Provide suggestions covering 1) soilAndSeeds: soil preparation, seed selection, seed treatment, 2) cropPlan: sowing time, spacing, nutrient management, 3) pestManagement: integrated pest management, biological control, chemical control, disease control, 4) waterIrrigationManagement: irrigation schedule, water conservation, 5) storageAfterYield: drying, storage conditions, milling, 6) riskMitigation: weather monitoring, insurance, crop diversification in JSON format keep cropSuggestions as main key example "cropSuggestions": {
      "soilAndSeeds": {`;

    const suggestion = await sendMessage(prompt);
    console.log(suggestion);
    
    let parsedSuggestion;
    try {
      parsedSuggestion = JSON.parse(suggestion);
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
      return res.status(500).json({ error: 'Failed to parse suggestion as JSON' });
    }

    generatedSuggestion = parsedSuggestion; // Store the parsed suggestion
    res.json({ suggestion: parsedSuggestion });
  } catch (err) {
    console.error('Error generating suggestion:', err);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

app.post('/get-crop-recommendation', async (req, res) => {
  const token = process.env.STOKEN; 
  const url = `https://ipinfo.io/json?token=${token}`;

  try {
    const regionResponse = await fetch(url);
    const regionData = await regionResponse.json();
    const stateName = regionData.region.toUpperCase();
    // const stateName = 'ANDHRA PRADESH'

    console.log(stateName);
    
    const stateData = await getSoilData(stateName);
    console.log(stateData)
    const { Avg_Nitrogen, Avg_Phosphorous, Avg_Potassium, pH } = stateData[0];

    console.log(Avg_Nitrogen, Avg_Phosphorous, Avg_Potassium, pH);

    const { landSize, latitude, longitude } = req.body;

    console.log(landSize, latitude, longitude);
   
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 3);
    const start = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const end = endDate.toISOString().split('T')[0].replace(/-/g, '');
    const weatherUrl = `https://power.larc.nasa.gov/api/projection/daily/point?start=${start}&end=${end}&latitude=${latitude}&longitude=${longitude}&community=ag&parameters=QV2M,T2M,PRECTOTCORR&format=json&header=true&time-standard=utc&model=ensemble&scenario=ssp126`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();
    console.log(weatherData);
    const temperatureData = weatherData.properties.parameter.T2M;
    const humidityData = weatherData.properties.parameter.QV2M;
    const rainfallData = weatherData.properties.parameter.PRECTOTCORR;
    const avgTemperature = Object.values(temperatureData).reduce((a, b) => a + b, 0) / Object.values(temperatureData).length;
    const avgHumidity = Object.values(humidityData).reduce((a, b) => a + b, 0) / Object.values(humidityData).length;
    const totalRainfall = Object.values(rainfallData).reduce((a, b) => a + b, 0);
    console.log(avgTemperature, avgHumidity, totalRainfall);
    const payload = {
      N: Avg_Nitrogen,
      P: Avg_Phosphorous,
      K: Avg_Potassium,
      temperature: avgTemperature,
      humidity: avgHumidity,
      ph: pH,
      rainfall: totalRainfall
    };
    console.log(payload);
    datac = JSON.stringify(payload);
    console.log(datac);
    const recommendationResponse = await fetch('https://karshaka-ml-models.onrender.com/recomendCrop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: datac
    });

    const recommendation = await recommendationResponse.json();

    console.log(recommendation);

    // Function to get yield of each crop recommended
    const getYield = async (ydata) => {
      const urly = 'https://karshaka-ml-models.onrender.com/predictYeild';
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ydata) // Convert ydata to a JSON string
      };

      try {
        const yieldPrediction = await fetch(urly, options);
        if (!yieldPrediction.ok) {
          throw new Error(`HTTP error! status: ${yieldPrediction.status}`);
        }
        const prediction = await yieldPrediction.json();
        console.log(prediction)
        return prediction['prediction'];
      } catch (error) {
        console.error('Error fetching yield prediction:', error);
        return null; // Return null or handle the error as needed
      }
    };

    const crop1 = recommendation['first_crop']
    const payload1 = {
      Crop: crop1,
      Avg_Nitrogen: Avg_Nitrogen,
      Avg_Phosphorous: Avg_Phosphorous,
      Avg_Potassium: Avg_Potassium,
      pH: pH,
      temperature: avgTemperature,
      humidity: avgHumidity,
      rainfall: totalRainfall
    }

    const crop2 = recommendation['second_crop']

    const payload2 = {
      Crop: crop2,
      Avg_Nitrogen: Avg_Nitrogen,
      Avg_Phosphorous: Avg_Phosphorous,
      Avg_Potassium: Avg_Potassium,
      pH: pH,
      temperature: avgTemperature,
      humidity: avgHumidity,
      rainfall: totalRainfall
    }

    const yieldCrop1 = await getYield(payload1)
    const yieldCrop2 = await getYield(payload2)

    console.log(yieldCrop1)

    res.json({
      recommendation,
      payload,
      yieldCrop1,
      yieldCrop2,
      landSize
    });
  } catch (error) {
    console.error('Error processing recommendation:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.use(session({
  secret: 'your-secret-key', // Change this to a secure secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/suggestions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'suggestions.html'));
});

// Endpoint to get data by document ID
app.get('/data/:id', async (req, res) => {
  const docId = req.params.id;

  try {
    const doc = await firestore.collection('statesData').doc(docId).get();

    if (!doc.exists) {
      return res.status(404).send('Data not found');
    }

    res.json(doc.data());
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to get data by state name
const getSoilData = async (state_name) =>{
  const stateName = state_name
  try {
    const snapshot = await firestore.collection('statesData')
                                    .where('State', '==', stateName)
                                    .get();

    if (snapshot.empty) {
      return NaN;
    }

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// app.get('/state/:name', async (req, res) => {
//   const stateName = req.params.name;

//   try {
//     const snapshot = await firestore.collection('statesData')
//                                     .where('State', '==', stateName)
//                                     .get();

//     if (snapshot.empty) {
//       return res.status(404).send('State not found');
//     }

//     const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//     res.json(data);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).send('Internal Server Error');
//   }
// });

// Endpoint to get all data
app.get('/data', async (req, res) => {
  try {
    const snapshot = await firestore.collection('statesData').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/cropCost/:cropName', async (req, res) => {
  const cropName = req.params.cropName;

  try {
    const snapshot = await firestore.collection('cropCost')
                                    .where('cropname', '==', cropName)
                                    .get();

    if (snapshot.empty) {
      return res.status(404).send('Crop not found');
    }

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error('Error fetching crop cost data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
