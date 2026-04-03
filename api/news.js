// Vercel serverless function — proxies NewsAPI requests
// Keeps the API key server-side and avoids CORS restrictions

export default async function handler(req, res) {
  const API_KEY = process.env.NEWSAPI_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'NEWSAPI_KEY not configured' });
  }

  const queries = ['Microsoft', 'Xbox', 'Azure'];
  const allArticles = [];

  try {
    for (const q of queries) {
      const url = `https://newsapi.org/v2/everything?qInTitle=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=4&apiKey=${API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`NewsAPI HTTP ${response.status}`);
      const data = await response.json();
      if (data.status !== 'ok') throw new Error(data.message || 'API error');
      allArticles.push(...(data.articles || []));
    }

    // De-dupe by title, sort by date, take top 8
    const seen = new Set();
    const unique = allArticles
      .filter(a => {
        if (seen.has(a.title)) return false;
        seen.add(a.title);
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 8);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ status: 'ok', articles: unique });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
