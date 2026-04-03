// Vercel serverless function — proxies Alpha Vantage stock requests
// Keeps the API key server-side

export default async function handler(req, res) {
  const API_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'ALPHA_VANTAGE_KEY not configured' });
  }

  try {
    // Fetch quote
    const quoteRes = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${API_KEY}`
    );
    if (!quoteRes.ok) throw new Error(`HTTP ${quoteRes.status}`);
    const quoteData = await quoteRes.json();

    if (quoteData['Note'] || quoteData['Information']) {
      return res.status(429).json({ error: quoteData['Note'] || quoteData['Information'] });
    }

    // Fetch intraday for sparkline
    let intraday = null;
    try {
      const intradayRes = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=MSFT&interval=5min&outputsize=compact&apikey=${API_KEY}`
      );
      if (intradayRes.ok) {
        const intradayData = await intradayRes.json();
        const ts = intradayData['Time Series (5min)'];
        if (ts) {
          const keys = Object.keys(ts).sort();
          intraday = keys.slice(-30).map(k => parseFloat(ts[k]['4. close']));
        }
      }
    } catch (_) { /* sparkline is optional */ }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=120');
    return res.status(200).json({ quote: quoteData['Global Quote'], intraday });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
