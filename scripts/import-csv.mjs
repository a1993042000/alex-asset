import { readFileSync, writeFileSync } from 'node:fs';

const csv = readFileSync('H:/Users/Alex/Desktop/ttt.csv', 'utf8');
const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
const header = lines.shift(); // 日期,交易類別,數量,代號,價格

const rows = [];
const tickers = new Set();
let buyCount = 0, sellCount = 0;

for (const line of lines) {
    const [dateStr, kind, qtyStr, ticker, priceStr] = line.split(',');
    const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) throw new Error(`Bad date: ${dateStr}`);
    const trade_date = `${m[3]}-${m[1]}-${m[2]}`;
    const action = kind === '買進' ? 'buy' : kind === '賣出' ? 'sell' : null;
    if (!action) throw new Error(`Bad action: ${kind}`);
    const shares = Math.abs(parseFloat(qtyStr));
    const price = parseFloat(priceStr);
    if (!Number.isFinite(shares) || shares <= 0) throw new Error(`Bad shares: ${qtyStr}`);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Bad price: ${priceStr}`);

    const t = ticker.trim().toUpperCase();
    const market = /^\d/.test(t) ? 'TW' : 'US';
    const currency = market === 'US' ? 'USD' : 'TWD';
    rows.push({ trade_date, ticker: t, market, action, shares, price, currency });
    tickers.add(t);
    if (action === 'buy') buyCount++; else sellCount++;
}

// Build SQL
const values = rows
    .map((r) => `('${r.trade_date}','${r.ticker}','${r.market}','${r.action}',${r.shares},${r.price},'${r.currency}')`)
    .join(',\n  ');

const sql = `BEGIN;
DELETE FROM asset_portfolio_history;
DELETE FROM asset_transactions;
INSERT INTO asset_transactions (trade_date,ticker,market,action,shares,price,currency) VALUES
  ${values};
COMMIT;`;

writeFileSync('H:/Users/Alex/Desktop/Alex_app/alex-asset/scripts/import.sql', sql);

console.log(`Parsed ${rows.length} rows`);
console.log(`Buy ${buyCount}, Sell ${sellCount}`);
console.log(`Unique tickers (${tickers.size}): ${[...tickers].sort().join(', ')}`);
console.log(`SQL written to scripts/import.sql (${sql.length} bytes)`);
