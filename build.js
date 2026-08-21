const fs = require('fs');

// ↓↓↓ ご自身のGASのWebアプリURLに書き換えてください ↓↓↓
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwBMphPm5mpKg6fl8ZfTfYdTbh6khW53nYYHzu1FSXLB86yoDHvKU6eHqJjXOppqecC/exec";

async function main() {
  console.log("Fetching calendar data from GAS...");
  const res = await fetch(GAS_API_URL);
  const data = await res.json();

  // reTerminal 7.5インチ (800x480) 専用サイズ設定
  const width = 800;
  const height = 480;
  const marginX = 8;
  const marginY = 6;
  const headerHeight = 36;
  const dayHeaderHeight = 24;

  const gridWidth = width - marginX * 2;
  const gridHeight = height - marginY * 2 - headerHeight - dayHeaderHeight;
  const colWidth = gridWidth / 7;
  const rowHeight = gridHeight / 6;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; display:block; background:#ffffff;">`;
  svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;

  // 1. カレンダー上部ヘッダー（年月・カレンダー名）
  svg += `<text x="${marginX + 4}" y="${marginY + 26}" font-size="26" font-weight="900" fill="#000000" font-family="'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif">${data.year}年 ${data.month}月</text>`;
  svg += `<text x="${width - marginX - 4}" y="${marginY + 25}" font-size="14" font-weight="bold" fill="#444444" text-anchor="end" font-family="sans-serif">${escapeXml(data.calendarTitle)}</text>`;
  svg += `<line x1="${marginX}" y1="${marginY + headerHeight - 3}" x2="${width - marginX}" y2="${marginY + headerHeight - 3}" stroke="#000000" stroke-width="2"/>`;

  // 2. 曜日ヘッダー（文字サイズ拡大）
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const startY = marginY + headerHeight;
  dayNames.forEach((d, i) => {
    const x = marginX + i * colWidth;
    let textColor = '#000000';
    if (i === 0) textColor = '#cc0000'; // 日曜（赤/濃いグレー）
    if (i === 6) textColor = '#0044cc'; // 土曜（青/濃いグレー）
    svg += `<rect x="${x}" y="${startY}" width="${colWidth}" height="${dayHeaderHeight}" fill="#eeeeee" stroke="#888888" stroke-width="1"/>`;
    svg += `<text x="${x + colWidth / 2}" y="${startY + 17}" font-size="15" font-weight="bold" fill="${textColor}" text-anchor="middle" font-family="sans-serif">${d}</text>`;
  });

  // 3. 日付マスの描画
  const calStartY = startY + dayHeaderHeight;
  const parts = data.gridStartDate.split('-');
  const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  for (let i = 0; i < 42; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const cellX = marginX + col * colWidth;
    const cellY = calStartY + row * rowHeight;

    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + i);

    const y = curDate.getFullYear();
    const m = ('0' + (curDate.getMonth() + 1)).slice(-2);
    const d = ('0' + curDate.getDate()).slice(-2);
    const dateKey = `${y}-${m}-${d}`;

    const isCurrentMonth = (curDate.getMonth() + 1) === data.month;
    const isToday = (dateKey === data.todayStr);

    // セル背景（E-Inkで見やすいコントラスト）
    let cellBg = isCurrentMonth ? '#ffffff' : '#f2f2f2';
    svg += `<rect x="${cellX}" y="${cellY}" width="${colWidth}" height="${rowHeight}" fill="${cellBg}" stroke="#aaaaaa" stroke-width="1"/>`;

    // 今日（太枠で強調）
    if (isToday) {
      svg += `<rect x="${cellX + 1}" y="${cellY + 1}" width="${colWidth - 2}" height="${rowHeight - 2}" fill="none" stroke="#000000" stroke-width="3"/>`;
    }

    // 日付の数字（大きく太く）
    let dateColor = isCurrentMonth ? '#000000' : '#888888';
    if (isToday) dateColor = '#000000';
    svg += `<text x="${cellX + 5}" y="${cellY + 18}" font-size="17" font-weight="900" fill="${dateColor}" font-family="sans-serif">${curDate.getDate()}</text>`;

    // 予定の表示（大きく・太く・読みやすく）
    if (data.eventsByDate && data.eventsByDate[dateKey]) {
      let eventY = cellY + 31;
      const events = data.eventsByDate[dateKey];
      // 1マスあたり最大2件まで大きく表示（3件以上は「+他○件」）
      const maxShow = Math.min(events.length, 2);
      
      for (let j = 0; j < maxShow; j++) {
        const ev = events[j];
        // 800巾に合わせて最大7文字程度でトリミング
        const shortTitle = ev.length > 7 ? ev.slice(0, 6) + '…' : ev;
        
        svg += `<rect x="${cellX + 2}" y="${eventY - 10}" width="${colWidth - 4}" height="14" fill="#dddddd" rx="2"/>`;
        svg += `<text x="${cellX + 4}" y="${eventY + 1}" font-size="11" font-weight="bold" fill="#000000" font-family="sans-serif">${escapeXml(shortTitle)}</text>`;
        eventY += 15;
      }

      if (events.length > 2) {
        svg += `<text x="${cellX + 4}" y="${eventY + 1}" font-size="9" font-weight="bold" fill="#555555" font-family="sans-serif">+他${events.length - 2}件</text>`;
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
  console.log("800x480 optimized index.html generated!");
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

main().catch(err => { console.error(err); process.exit(1); });
