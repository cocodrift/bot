const express = require('express');
const { analyzeAndTrade } = require('./bot'); // Replace with correct path to bot.js

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML form for trading pair input
app.get('/', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Trading Analysis</title>
        </head>
        <body>
            <h1>Trading Analysis</h1>
            <form action="/analyze" method="post">
                <label for="pair">Enter Trading Pair (e.g., BTC/USD):</label><br>
                <input type="text" id="pair" name="pair" required><br><br>
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Handle POST request to analyze trading pair
// Handle POST request to analyze trading pair
app.post('/analyze', async (req, res) => {
    const pair = req.body.pair.toUpperCase(); // Get trading pair from form input
    try {
        const analysisResult = await analyzeAndTrade(pair);
        
        // Log the analysisResult to see its structure and values
        console.log('Analysis Result:', analysisResult);

        // Ensure analysisResult is defined and contains expected properties
        if (!analysisResult || !analysisResult.action || !analysisResult.currentPrice || !analysisResult.takeProfit || !analysisResult.stopLoss) {
            throw new Error('Invalid analysis result format.');
        }

        // Generate HTML response with dynamic data
        const analysisHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Trading Analysis Results</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                    }
                    h1 {
                        margin-bottom: 10px;
                    }
                    .analysis-item {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <h1>Trading Analysis Results for ${pair}</h1>
                <div class="analysis-item">
                    <strong>Pair:</strong> ${pair}
                </div>
                <div class="analysis-item">
                    <strong>Action:</strong> ${analysisResult.action}
                </div>
                <div class="analysis-item">
                    <strong>Current Price:</strong> ${analysisResult.currentPrice}
                </div>
                <div class="analysis-item">
                    <strong>Take Profit:</strong> ${analysisResult.takeProfit}
                </div>
                <div class="analysis-item">
                    <strong>Stop Loss:</strong> ${analysisResult.stopLoss}
                </div>
            </body>
            </html>
        `;
        res.send(analysisHtml);
    } catch (error) {
        console.error('Error analyzing and trading:', error.message);
        res.status(500).send('Error analyzing and trading.');
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
