const ccxt = require('ccxt');

const kraken = new ccxt.kraken({
    apiKey: 'Bl4hwEMQChNwcEEePYWhORkcHc7jKrTUeTMP42dpsEo6+vk2xTuxJS0q',
    secret: '1w8DCxt0FwICPzNMr4ymLGimki3ikMRBmJg5J/p1WNiDqXpdVO88HFjmQL7bwTyI+1b5Ln5IqKYWu8u+v4pD3A==',
});

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

function identifyElliottWaveCount(priceData) {
    return Math.floor(Math.random() * 5) + 1;
}

async function fetchSupportResistance(pair, timeframe) {
    try {
        const ohlcv = await kraken.fetchOHLCV(pair, timeframe, undefined, 100);
        const highs = ohlcv.map(candle => candle[2]);
        const lows = ohlcv.map(candle => candle[3]);

        const support = Math.min(...lows);
        const resistance = Math.max(...highs);

        return { support, resistance };
    } catch (error) {
        console.error(`Error fetching support/resistance for ${pair} on ${timeframe} timeframe:`, error.message);
        throw error;
    }
}

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
        console.error(`Error calculating volatility for ${pair} on ${timeframe} timeframe:`, error.message);
        throw error;
    }
}

async function calculateDynamicLevels(currentPrice, volatility, support, resistance, action) {
    const atrMultiplier = 2;
    const atr = volatility * atrMultiplier;

    let takeProfit, stopLoss;

    if (action === 'buy') {
        takeProfit = currentPrice + atr;
        stopLoss = currentPrice - atr;
        if (takeProfit > resistance) {
            takeProfit = resistance - (atr * 0.5);
        }
        if (stopLoss < support) {
            stopLoss = support + (atr * 0.5);
        }
    } else if (action === 'sell') {
        takeProfit = currentPrice - atr;
        stopLoss = currentPrice + atr;
        if (takeProfit < support) {
            takeProfit = support + (atr * 0.5);
        }
        if (stopLoss > resistance) {
            stopLoss = resistance - (atr * 0.5);
        }
    }

    return { takeProfit, stopLoss };
}

async function fetchWithRetry(pair, timeframe, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await kraken.fetchOHLCV(pair, timeframe, undefined, 20);
        } catch (error) {
            console.error(`Attempt ${i + 1} failed for ${pair} on ${timeframe} timeframe:`, error.message);
            if (i === retries - 1) throw error;
        }
    }
}

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
        const ma20 = closes.reduce((sum, close) => sum + close, 0) / closes.length;

        const ticker = await kraken.fetchTicker(pair);
        const currentPrice = ticker.last;

        const { support, resistance } = await fetchSupportResistance(pair, timeframe);
        const volatility = await calculateVolatility(pair, timeframe);

        // Threshold to determine proximity to support/resistance
        const threshold = volatility * 0.1;

        let action = 'hold';
        if (currentPrice > ma20 && (currentPrice < resistance - threshold)) {
            action = 'buy';
        } else if (currentPrice < ma20 && (currentPrice > support + threshold)) {
            action = 'sell';
        }

        if (waveCount === 5 && action === 'buy') {
            action = 'hold';
        } else if (waveCount === 3 && action === 'sell') {
            action = 'hold';
        }

        const { takeProfit, stopLoss } = await calculateDynamicLevels(currentPrice, volatility, support, resistance, action);

        return {
            pair: pair,
            timeframe: timeframe,
            action: action,
            currentPrice: currentPrice,
            ma20: ma20,
            fibonacciLevels: fibonacciLevels,
            waveCount: waveCount,
            support: support,
            resistance: resistance,
            takeProfit: takeProfit,
            stopLoss: stopLoss
        };

    } catch (error) {
        console.error(`Error analyzing ${pair} on ${timeframe} timeframe:`, error.message);
        throw error;
    }
}

async function analyzeAndTrade(pair) {
    const timeframes = ['1m', '5m', '15m', '30m'];
    let finalAction = 'hold';
    let finalTakeProfit, finalStopLoss;
    let bestEntryTime = 'now';

    while (finalAction === 'hold') {
        const analysisResults = {};

        for (const timeframe of timeframes) {
            try {
                const analysis = await analyzeTimeframe(pair, timeframe);
                console.log(analysis);
                analysisResults[timeframe] = analysis.action;
                if (timeframe === '15m') {
                    finalTakeProfit = analysis.takeProfit;
                    finalStopLoss = analysis.stopLoss;
                }
            } catch (error) {
                console.error(`Skipping analysis for ${pair} on ${timeframe} timeframe due to error:`, error.message);
            }
        }

        finalAction = determineFinalAction(analysisResults);

        if (finalAction !== 'hold') {
            const ticker = await kraken.fetchTicker(pair);
            const currentPrice = ticker.last;
            const volume = ticker.baseVolume;

            console.log({
                pair: pair,
                timeframe: '15m',
                action: finalAction,
                currentPrice: currentPrice,
                volume: volume,
                takeProfit: finalTakeProfit,
                stopLoss: finalStopLoss,
                entryTime: bestEntryTime
            });
            return {  // Ensure correct properties are returned
                pair: pair,
                timeframe: '15m',
                action: finalAction,
                currentPrice: currentPrice,
                takeProfit: finalTakeProfit,
                stopLoss: finalStopLoss,
                entryTime: bestEntryTime
            };
        } else {
            // Wait for 5 minutes and recheck conditions
            bestEntryTime = 'in 5 minutes';
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}


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
