const ccxt = require('ccxt');
const { SMA } = require('technicalindicators');

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

module.exports = {
    analyzeAndTrade
};