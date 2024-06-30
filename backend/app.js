const express = require('express');
const { TimeoutError } = require('promise-timeout'); // Ensure promise-timeout is imported
const { analyzeAndTrade } = require('./bot'); // Replace with correct path to bot.js
const http = require('http'); // Ensure http module is imported
const timeout = require('connect-timeout');
const ccxt = require('ccxt');
const { SMA } = require('technicalindicators');

const app = express();
const port = 3000;
const server = http.createServer(app);

// Set a custom timeout value (in milliseconds)
server.setTimeout(60000);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Predefined list of currency pairs
const currencyPairs = [
    // Cryptocurrency pairs
    'BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'DOT/USD',
    'LTC/USD', 'LINK/USD', 'XLM/USD', 'USDT/USD', 'ETH/BTC',
    'XRP/BTC', 'ADA/BTC', 'DOT/BTC', 'LTC/BTC', 'LINK/BTC',
    'XLM/BTC', 'USDT/BTC',

    // Major fiat currency pairs
    'EUR/USD', 'USD/JPY', 'GBP/USD', 'AUD/USD', 'USD/CAD',
    'USD/CHF', 'EUR/JPY', 'EUR/GBP', 'EUR/AUD', 'EUR/CAD',
    'EUR/CHF', 'GBP/JPY', 'AUD/JPY', 'CAD/JPY', 'CHF/JPY',
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


// Configure Kraken API
const kraken = new ccxt.kraken({
    apiKey: 'Bl4hwEMQChNwcEEePYWhORkcHc7jKrTUeTMP42dpsEo6+vk2xTuxJS0q',
    secret: '1w8DCxt0FwICPzNMr4ymLGimki3ikMRBmJg5J/p1WNiDqXpdVO88HFjmQL7bwTyI+1b5Ln5IqKYWu8u+v4pD3A==',
});

// Pip values for various trading pairs
const pipValues = {
    'BTC/USD': 0.50,
    'ETH/USD': 0.05,
    'XRP/USD': 0.0001,
    'ADA/USD': 0.0001,
    'DOT/USD': 0.01,
    'LTC/USD': 0.01,
    'LINK/USD': 0.01,
    'XLM/USD': 0.0001,
    'USDT/USD': 0.0001,
    'ETH/BTC': 0.0001,
    'XRP/BTC': 0.0000001,
    'ADA/BTC': 0.0000001,
    'DOT/BTC': 0.00001,
    'LTC/BTC': 0.00001,
    'LINK/BTC': 0.00001,
    'XLM/BTC': 0.0000001,
    'USDT/BTC': 0.0000001,
    'EUR/USD': 0.0001,
    'USD/JPY': 0.01,
    'GBP/USD': 0.0001,
    'AUD/USD': 0.0001,
    'USD/CAD': 0.0001,
    'USD/CHF': 0.0001,
    'EUR/JPY': 0.01,
    'EUR/GBP': 0.0001,
    'EUR/AUD': 0.0001,
    'EUR/CAD': 0.0001,
    'EUR/CHF': 0.0001,
    'GBP/JPY': 0.01,
    'AUD/JPY': 0.01,
    'CAD/JPY': 0.01,
    'CHF/JPY': 0.01,
};

// Identify peaks and troughs in price data
function identifyPeaksAndTroughs(priceData) {
    let peaks = [];
    let troughs = [];

    for (let i = 1; i < priceData.length - 1; i++) {
        if (priceData[i] > priceData[i - 1] && priceData[i] > priceData[i + 1]) {
            peaks.push({ index: i, value: priceData[i] });
        } else if (priceData[i] < priceData[i - 1] && priceData[i] < priceData[i + 1]) {
            troughs.push({ index: i, value: priceData[i] });
        }
    }

    return { peaks, troughs };
}

// Identify impulsive waves
function identifyImpulsiveWaves(peaks, troughs) {
    if (peaks.length >= 3 && troughs.length >= 2) {
        return 5; // Found 5-wave pattern
    }
    return 0;
}

// Identify corrective waves
function identifyCorrectiveWaves(peaks, troughs) {
    if (peaks.length >= 2 && troughs.length >= 1) {
        return 3; // Found 3-wave pattern
    }
    return 0;
}

// Identify Elliott wave count
function identifyElliottWaveCount(priceData) {
    let { peaks, troughs } = identifyPeaksAndTroughs(priceData);
    let waveCount = identifyImpulsiveWaves(peaks, troughs);

    if (waveCount === 0) {
        waveCount = identifyCorrectiveWaves(peaks, troughs);
    }

    return waveCount;
}

// Calculate Fibonacci levels
function calculateFibonacciLevels(high, low) {
    const diff = high - low;
    return {
        0.236: low + diff * 0.236,
        0.382: low + diff * 0.382,
        0.5: low + diff * 0.5,
        0.618: low + diff * 0.618,
        0.786: low + diff * 0.786
    };
}

// Fetch support and resistance levels
async function fetchSupportResistance(pair, timeframe) {
    try {
        const ohlcv = await kraken.fetchOHLCV(pair, timeframe, undefined, 100);
        const highs = ohlcv.map(candle => candle[2]);
        const lows = ohlcv.map(candle => candle[3]);

        const support = Math.min(...lows);
        const resistance = Math.max(...highs);

        return { support, resistance };
    } catch (error) {
        console.error(`Error fetching support/resistance for ${pair} on ${timeframe} timeframe: ${error.message}`);
        throw error;
    }
}

// Calculate volatility
async function calculateVolatility(pair, timeframe) {
    try {
        const ohlcv = await kraken.fetchOHLCV(pair, timeframe, undefined, 100);
        const closes = ohlcv.map(candle => candle[4]);
        const averageClose = closes.reduce((sum, close) => sum + close, 0) / closes.length;

        const squaredDeviations = closes.map(close => Math.pow(close - averageClose, 2));
        const variance = squaredDeviations.reduce((sum, deviation) => sum + deviation, 0) / squaredDeviations.length;
        const volatility = Math.sqrt(variance);

        return volatility;
    } catch (error) {
        console.error(`Error calculating volatility for ${pair} on ${timeframe} timeframe: ${error.message}`);
        throw error;
    }
}

// Calculate dynamic levels for take profit and stop loss
async function calculateDynamicLevels(pair, currentPrice, action, pipsMoved = 50) {
    const pipValue = pipValues[pair];
    let takeProfit1, takeProfit2, takeProfit3, stopLoss;

    if (action === 'buy') {
        takeProfit1 = currentPrice + (pipsMoved * pipValue);
        takeProfit2 = currentPrice + (2 * pipsMoved * pipValue);
        takeProfit3 = currentPrice + (3 * pipsMoved * pipValue);
        stopLoss = currentPrice - (pipsMoved / 3 * pipValue); // Adjust stop loss based on winning ratio
    } else if (action === 'sell') {
        takeProfit1 = currentPrice - (pipsMoved * pipValue);
        takeProfit2 = currentPrice - (2 * pipsMoved * pipValue);
        takeProfit3 = currentPrice - (3 * pipsMoved * pipValue);
        stopLoss = currentPrice + (pipsMoved / 3 * pipValue); // Adjust stop loss based on winning ratio
    }

    console.debug(`TP and SL for ${pair}: takeProfit1=${takeProfit1}, takeProfit2=${takeProfit2}, takeProfit3=${takeProfit3}, stopLoss=${stopLoss}`);
    return { takeProfit1, takeProfit2, takeProfit3, stopLoss };
}


// Fetch OHLCV data with retries
async function fetchWithRetry(pair, timeframe, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await kraken.fetchOHLCV(pair, timeframe);
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed for ${pair} on ${timeframe} timeframe: ${error.message}`);
            if (i === retries - 1) throw error;
        }
    }
}

// Analyze a specific timeframe for a trading pair
async function analyzeTimeframe(pair, timeframe) {
    try {
        const ohlcv = await fetchWithRetry(pair, timeframe);
        const highs = ohlcv.map(candle => candle[2]);
        const lows = ohlcv.map(candle => candle[3]);
        const closes = ohlcv.map(candle => candle[4]);

        const recentHigh = Math.max(...highs);
        const recentLow = Math.min(...lows);
        const fibonacciLevels = calculateFibonacciLevels(recentHigh, recentLow);
        const waveCount = identifyElliottWaveCount(closes);
        const ma20 = SMA.calculate({ period: 20, values: closes });

        const ticker = await kraken.fetchTicker(pair);
        const currentPrice = ticker.last;

        const { support, resistance } = await fetchSupportResistance(pair, timeframe);
        const volatility = await calculateVolatility(pair, timeframe);

        // Threshold to determine proximity to support/resistance
        const threshold = volatility * 0.1;

        let action = 'hold';
        if (currentPrice > ma20[ma20.length - 1] && (currentPrice < resistance - threshold)) {
            action = 'buy';
        } else if (currentPrice < ma20[ma20.length - 1] && (currentPrice > support + threshold)) {
            action = 'sell';
        }

        if (waveCount === 5 && action === 'buy') {
            action = 'sell';
        } else if (waveCount === 3 && action === 'sell') {
            action = 'buy';
        }

        const { takeProfit1, takeProfit2, takeProfit3, stopLoss } = await calculateDynamicLevels(pair, currentPrice, action);

        return {
            pair: pair,
            timeframe: timeframe,
            action: action,
            currentPrice: currentPrice,
            ma20: ma20[ma20.length - 1],
            fibonacciLevels: fibonacciLevels,
            waveCount: waveCount,
            support: support,
            resistance: resistance,
            takeProfit1: takeProfit1,
            takeProfit2: takeProfit2,
            takeProfit3: takeProfit3,
            stopLoss: stopLoss
        };

    } catch (error) {
        console.error(`Error analyzing ${pair} on ${timeframe} timeframe: ${error.message}`);
        throw error;
    }
}

// Main function to analyze and trade
async function analyzeAndTrade(pair) {
    const timeframes = ['1m', '5m', '15m', '30m'];
    let finalAction = 'hold';
    let finalTakeProfit1, finalTakeProfit2, finalTakeProfit3, finalStopLoss;
    let bestEntryTime = 'now';

    while (finalAction === 'hold') {
        const analysisResults = {};

        for (const timeframe of timeframes) {
            try {
                const analysis = await analyzeTimeframe(pair, timeframe);
                console.debug(`Analysis for ${pair} on ${timeframe}:`, analysis);
                analysisResults[timeframe] = analysis.action;
                if (timeframe === '15m') {
                    finalTakeProfit1 = analysis.takeProfit1;
                    finalTakeProfit2 = analysis.takeProfit2;
                    finalTakeProfit3 = analysis.takeProfit3;
                    finalStopLoss = analysis.stopLoss;
                }
            } catch (error) {
                console.warn(`Skipping analysis for ${pair} on ${timeframe} timeframe due to error: ${error.message}`);
            }
        }

        console.debug(`Analysis results:`, analysisResults);
        finalAction = determineFinalAction(analysisResults);

        if (finalAction !== 'hold') {
            const ticker = await kraken.fetchTicker(pair);
            const currentPrice = ticker.last;
            const volume = ticker.baseVolume;

            console.info({
                pair: pair,
                timeframe: '15m',
                action: finalAction,
                currentPrice: currentPrice,
                volume: volume,
                takeProfit1: finalTakeProfit1,
                takeProfit2: finalTakeProfit2,
                takeProfit3: finalTakeProfit3,
                stopLoss: finalStopLoss,
                entryTime: bestEntryTime
            });

            return {
                pair: pair,
                timeframe: '30m',
                action: finalAction,
                currentPrice: currentPrice,
                takeProfit1: finalTakeProfit1,
                takeProfit2: finalTakeProfit2,
                takeProfit3: finalTakeProfit3,
                stopLoss: finalStopLoss,
                entryTime: bestEntryTime
            };
        } else {
            bestEntryTime = 'in 5 minutes';
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Determine the final action based on analysis results
function determineFinalAction(analysisResults) {
    const actions = Object.values(analysisResults);
    if (actions.length === 0) {
        return 'hold';
    }

    const actionCounts = actions.reduce((count, action) => {
        count[action] = (count[action] || 0) + 1;
        return count;
    }, {});

    const finalAction = Object.keys(actionCounts).reduce((a, b) => actionCounts[a] > actionCounts[b] ? a : b);

    return finalAction;
}



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

// Function to perform analysis and trading with timeout and retry
async function analyzeAndTradeWithTimeout(pair, timeout, maxRetries = 3) {
    const timeoutError = new TimeoutError('Analysis and trading took too long.');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(timeoutError), timeout));

    let analysisResult;
    let attempt = 1;

    while (attempt <= maxRetries) {
        try {
            analysisResult = await Promise.race([analyzeAndTrade(pair), timeoutPromise]);
            break; // Break out of the loop if analysis completes within timeout
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            attempt++;
            if (attempt <= maxRetries) {
                console.log(`Retrying attempt ${attempt}...`);
            } else {
                throw new Error(`Max retries (${maxRetries}) exceeded.`);
            }
        }
    }

    return analysisResult;
}

// Start the server
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
