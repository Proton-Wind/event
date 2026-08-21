const fs = require('fs');

// ↓↓↓ ご自身のGASのWebアプリURLに書き換えてください ↓↓↓
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwBMphPm5mpKg6fl8ZfTfYdTbh6khW53nYYHzu1FSXLB86yoDHvKU6eHqJjXOppqecC/exec";

async function main() {
  console.log("Fetching calendar data from GAS...");
  const res = await fetch(GAS_API_URL);
  const data = await res.json();

  const width = 1200, height = 800, margin = 15;
  const headerHeight = 55, dayHeaderHeight = 28;
  const gridWidth = width - margin * 2;
  const gridHeight = height - margin * 2 - headerHeight - dayHeaderHeight;
  const colWidth = gridWidth / 7;
  const rowHeight = gridHeight / 6;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; display:block;">`;
  svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
  svg += `<text x="${margin}" y="${margin + 35}" font-size="30" font-weight="bold" fill="#000000">${data.year}年 ${data.month}月</text>`;
  svg += `<text x="${width - margin}" y="${margin + 35}" font-size="16" fill="#666666" text-anchor="end">${escapeXml(data.calendarTitle)}</text>`;
  svg += `<line x1="${margin}" y1="${margin + headerHeight - 10}" x2="${width - margin}" y2="${margin + headerHeight - 10}" stroke="#000000" stroke-width="2"/>`;

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const startY = margin + headerHeight;
  dayNames.forEach((d, i) => {
    const x = margin + i * colWidth;
    const color = (i === 0) ? '#d00000' : (i === 6) ? '#0055d0' : '#000000';
    svg += `<rect x="${x}" y="${startY}" width="${colWidth}" height="${dayHeaderHeight}" fill="#f0f0f0" stroke="#cccccc"/>`;
    svg += `<text x="${x + colWidth / 2}" y="${startY + 19}" font-size="15" font-weight="bold" fill="${color}" text-anchor="middle">${d}</text>`;
  });

  const calStartY = startY + dayHeaderHeight;
  const parts = data.gridStartDate.split('-');
  const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  for (let i = 0; i < 42; i++) {
    const col = i % 7, row = Math.floor(i / 7);
    const cellX = margin + col * colWidth;
    const cellY = calStartY + row * rowHeight;

    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + i);

    const y = curDate.getFullYear();
    const m = ('0' + (curDate.getMonth() + 1)).slice(-2);
    const d = ('0' + curDate.getDate()).slice(-2);
    const dateKey = `${y}-${m}-${d}`;

    const isCurrentMonth = (curDate.getMonth() + 1) === data.month;
    const isToday = (dateKey === data.todayStr);

    let cellBg = isCurrentMonth ? '#ffffff' : '#f5f5f5';
    if (isToday) cellBg = '#eef6ff';

    svg += `<rect x="${cellX}" y="${cellY}" width="${colWidth}" height="${rowHeight}" fill="${cellBg}" stroke="#cccccc"/>`;
    if (isToday) {
      svg += `<rect x="${cellX}" y="${cellY}" width="${colWidth}" height="${rowHeight}" fill="none" stroke="#0066cc" stroke-width="2"/>`;
    }

    let dateColor = isCurrentMonth ? '#000000' : '#aaaaaa';
    if (isToday) dateColor = '#0066cc';
    svg += `<text x="${cellX + 6}" y="${cellY + 18}" font-size="15" font-weight="bold" fill="${dateColor}">${curDate.getDate()}</text>`;

    if (data.eventsByDate && data.eventsByDate[dateKey]) {
      let eventY = cellY + 34;
      const events = data.eventsByDate[dateKey];
      const maxShow = Math.min(events.length, 3);
      for (let j = 0; j < maxShow; j++) {
        const ev = events[j];
        const shortTitle = ev.length > 13 ? ev.slice(0, 12) + '…' : ev;
        svg += `<rect x="${cellX + 3}" y="${eventY - 12}" width="${colWidth - 6}" height="17" fill="#e8e8e8" rx="2"/>`;
        svg += `<text x="${cellX + 6}" y="${eventY + 1}" font-size="11" fill="#111111">${escapeXml(shortTitle)}</text>`;
        eventY += 19;
      }
      if (events.length > 3) {
        svg += `<text x="${cellX + 6}" y="${eventY + 1}" font-size="10" fill="#777777">+他${events.length - 3}件</text>`;
      }
    }
  }
  svg += `</svg>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #ffffff; }
    #container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div id="container">
    ${svg}
  </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html, 'utf8');
  console.log("index.html successfully generated!");
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

main().catch(err => { console.error(err); process.exit(1); });
