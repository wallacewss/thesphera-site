// Vercel Serverless Function — /api/data
// Retorna preços de commodities + FX em JSON unificado.
// Fontes públicas gratuitas (sem chave de API):
//   - Stooq (CSV) → commodities
//   - frankfurter.app (JSON) → FX

const STOOQ_URL = (syms) =>
  `https://stooq.com/q/l/?s=${syms.join(',')}&f=sd2t2ohlcv&h&e=csv`;

const FRANKFURTER_URL =
  'https://api.frankfurter.app/latest?from=USD&to=CLP,AUD,CAD,EUR,MXN,BRL,PEN';

// Symbol map: Stooq ticker → display info
const COMMODITY_DEFS = [
  { sym: 'hg.f',  label: 'Copper · COMEX',     unit: 'USD/lb', mult: 1, bench: 'HG=F' },
  { sym: 'gc.f',  label: 'Gold · COMEX',       unit: 'USD/oz', mult: 1, bench: 'GC=F' },
  { sym: 'si.f',  label: 'Silver · COMEX',     unit: 'USD/oz', mult: 1, bench: 'SI=F' },
  { sym: 'tio.f', label: 'Iron Ore 62% · SGX', unit: 'USD/t',  mult: 1, bench: 'TIO=F' },
  { sym: 'bz.f',  label: 'Brent Crude',        unit: 'USD/bbl', mult: 1, bench: 'BZ=F' },
  { sym: 'cl.f',  label: 'WTI Crude',          unit: 'USD/bbl', mult: 1, bench: 'CL=F' },
];

function parseStooqCsv(csv) {
  // header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return {};
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length < 7) continue;
    const sym = cells[0].toLowerCase();
    const close = parseFloat(cells[6]);
    const open = parseFloat(cells[3]);
    if (Number.isFinite(close)) {
      out[sym] = {
        date: cells[1],
        time: cells[2],
        close,
        open,
        change: Number.isFinite(open) ? close - open : null,
        changePct: Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : null,
      };
    }
  }
  return out;
}

async function fetchCommodities() {
  const syms = COMMODITY_DEFS.map((d) => d.sym);
  const res = await fetch(STOOQ_URL(syms), {
    headers: { 'User-Agent': 'Mozilla/5.0 (thesphera-dashboard)' },
  });
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const text = await res.text();
  const parsed = parseStooqCsv(text);

  return COMMODITY_DEFS.map((d) => {
    const row = parsed[d.sym];
    return {
      sym: d.sym,
      label: d.label,
      unit: d.unit,
      bench: d.bench,
      value: row ? row.close * d.mult : null,
      change: row ? row.change : null,
      changePct: row ? row.changePct : null,
      date: row ? row.date : null,
    };
  });
}

async function fetchFX() {
  const res = await fetch(FRANKFURTER_URL);
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = await res.json();
  // base = USD; rates is { CLP: ..., AUD: ..., ... }
  const out = [];
  const rates = data.rates || {};
  for (const [ccy, rate] of Object.entries(rates)) {
    out.push({ pair: `USD/${ccy}`, value: rate, date: data.date });
  }
  // AUD/USD is the inverse of USD/AUD
  if (rates.AUD) {
    out.push({ pair: 'AUD/USD', value: 1 / rates.AUD, date: data.date });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  try {
    const [commodities, fx] = await Promise.allSettled([fetchCommodities(), fetchFX()]);
    res.status(200).json({
      ok: true,
      ts: Date.now(),
      commodities: commodities.status === 'fulfilled' ? commodities.value : { error: String(commodities.reason) },
      fx: fx.status === 'fulfilled' ? fx.value : { error: String(fx.reason) },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
