const express = require('express');
const { TimeoutError } = require('promise-timeout'); // Import TimeoutError if not already imported
const { analyzeAndTrade } = require('./bot'); // Replace with correct path to bot.js

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Predefined list of currency pairs
const currencyPairs = [
    // Cryptocurrency pairs
    'BTC/USD',
    'ETH/USD',
    'XRP/USD',
    'ADA/USD',
    'DOT/USD',
    'LTC/USD',
    'LINK/USD',
    'XLM/USD',
    'USDT/USD',
    'ETH/BTC',
    'XRP/BTC',
    'ADA/BTC',
    'DOT/BTC',
    'LTC/BTC',
    'LINK/BTC',
    'XLM/BTC',
    'USDT/BTC',
    
    // Major fiat currency pairs
    'EUR/USD',
    'USD/JPY',
    'GBP/USD',
    'AUD/USD',
    'USD/CAD',
    'USD/CHF',
    'EUR/JPY',
    'EUR/GBP',
    'EUR/AUD',
    'EUR/CAD',
    'EUR/CHF',
    'GBP/JPY',
    'AUD/JPY',
    'CAD/JPY',
    'CHF/JPY',
];

// Serve HTML form for trading pair input
app.get('/', (req, res) => {
    const pairOptions = currencyPairs.map(pair => `<option value="${pair}">${pair}</option>`).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>The Analyst Scalper</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .container {
                    background-color: #fff;
                    padding: 20px 40px;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    width: 100%;
                    max-width: 400px;
                }
                h1 {
                    color: #333;
                    margin-bottom: 20px;
                }
                label {
                    font-size: 18px;
                    color: #666;
                }
                select {
                    width: 100%;
                    padding: 10px;
                    margin-top: 10px;
                    margin-bottom: 20px;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                    font-size: 16px;
                }
                button {
                    background-color: #3498db;
                    color: #fff;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    font-size: 16px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #2980b9;
                }
                .loading-spinner {
                    display: none;
                    border: 8px solid #f3f3f3;
                    border-top: 8px solid #3498db;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 2s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>The Analyst Scalper</h1>
                <form id="tradingForm" action="/analyze" method="post">
                    <label for="pair">Select Trading Pair:</label><br>
                    <select id="pair" name="pair" required>
                        ${pairOptions}
                    </select><br><br>
                    <button type="submit">Submit</button>
                </form>
                <div class="loading-spinner" id="loadingSpinner"></div>
            </div>
            <script>
                document.getElementById('tradingForm').addEventListener('submit', function(event) {
                    document.getElementById('loadingSpinner').style.display = 'block';
                });
            </script>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

const runtime = 'nodejs';

// Handle POST request to analyze trading pair
app.post('/analyze', async (req, res) => {
    const pair = req.body.pair.toUpperCase(); // Get trading pair from form input

    try {
        // Perform analysis and trading with a timeout of 60 seconds
        const analysisResult = await analyzeAndTradeWithTimeout(pair, 60000); // 60000 milliseconds = 60 seconds

        // Log the analysisResult to see its structure and values
        console.log('Analysis Result:', analysisResult);

        // Ensure analysisResult is defined and contains expected properties
        if (!analysisResult || !analysisResult.action || !analysisResult.currentPrice || !analysisResult.takeProfit1 || !analysisResult.takeProfit2 || !analysisResult.takeProfit3 || !analysisResult.stopLoss) {
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
                        margin: 0;
                        padding: 20px;
                        background-color: #f4f4f4;
                    }
                    .navbar {
                        background-color: #333;
                        overflow: hidden;
                        margin-bottom: 20px;
                    }
                    .navbar a {
                        float: left;
                        display: block;
                        color: #f2f2f2;
                        text-align: center;
                        padding: 14px 20px;
                        text-decoration: none;
                    }
                    .navbar a:hover {
                        background-color: #ddd;
                        color: black;
                    }
                    .container {
                        background-color: #fff;
                        padding: 20px 40px;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        width: 100%;
                        max-width: 600px;
                        margin: 20px auto;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .analysis-item {
                        margin-bottom: 10px;
                        font-size: 18px;
                        color: #555;
                    }
                    .analysis-item strong {
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <div class="navbar">
                    <a href="/">Home</a>
                </div>
                <div class="container">
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
                        <strong>Take Profit 1:</strong> ${analysisResult.takeProfit1}
                    </div>
                    <div class="analysis-item">
                        <strong>Take Profit 2:</strong> ${analysisResult.takeProfit2}
                    </div>
                    <div class="analysis-item">
                        <strong>Take Profit 3:</strong> ${analysisResult.takeProfit3}
                    </div>
                    <div class="analysis-item">
                        <strong>Stop Loss:</strong> ${analysisResult.stopLoss}
                    </div>
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

// Function to perform analysis and trading with timeout
async function analyzeAndTradeWithTimeout(pair, timeout) {
    try {
        const timeoutError = new TimeoutError('Analysis and trading took too long.');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(timeoutError), timeout));
        const analysisPromise = analyzeAndTrade(pair); // Assuming analyzeAndTrade returns a promise

        // Race between the analysis promise and the timeout promise
        const result = await Promise.race([analysisPromise, timeoutPromise]);
        return result;
    } catch (error) {
        throw error; // Re-throw any errors caught during the process
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
