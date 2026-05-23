// Vercel Serverless Function — /api/news
// Agrega notícias relevantes de mineração e siderurgia via RSS público.
// Não requer chave de API.

const FEEDS = [
  { name: 'Mining.com',    url: 'https://www.mining.com/feed/',          tag: 'mining' },
  { name: 'Mining Weekly', url: 'https://www.miningweekly.com/page/mining-rss', tag: 'mining' },
  { name: 'SteelOrbis',    url: 'https://www.steelorbis.com/rss/news.aspx', tag: 'steel' },
];

// Keywords que filtram notícias relevantes ao contexto Molycop.
const RELEVANT = [
  'copper','cobre','iron ore','minério','rebar','steel','grinding','mill',
  'bhp','codelco','anglo','teck','antofagasta','freeport','vale','newmont',
  'glencore','rio tinto','mmg','barrick','agnico','escondida','collahuasi',
  'magotteaux','elecmetal','aia','sino grinding','san fang',
  'china','tariff','cbam','sulphuric','iran','hormuz',
];

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, '')).trim();
}

function parseRss(xml, feedName) {
  const items = [];
  // captura blocos <item>...</item>
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const block of blocks) {
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link  = (block.match(/<link>([\s\S]*?)<\/link>/)   || [])[1] || '';
    const date  = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const desc  = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    items.push({
      source: feedName,
      title: stripTags(title),
      link: stripTags(link),
      date,
      summary: stripTags(desc).slice(0, 280),
    });
  }
  return items;
}

function isRelevant(item) {
  const text = (item.title + ' ' + item.summary).toLowerCase();
  return RELEVANT.some((k) => text.includes(k));
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (thesphera-dashboard)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, feed.name);
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const filtered = all.filter(isRelevant);
    // sort by date desc
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({
      ok: true,
      ts: Date.now(),
      count: filtered.length,
      items: filtered.slice(0, 20),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
