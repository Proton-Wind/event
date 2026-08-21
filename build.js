const fs = require('fs');

// ↓↓↓ ご自身のGASのWebアプリURLに書き換えてください ↓↓↓
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxfkxly17QNOkPsvL4aPk4dg30Sue4zEVGci2vpVfM6goKD4sgCcin4cdgWW7bS9A/exec";

async function main() {
  console.log("Fetching calendar data from GAS...");
  const res = await fetch(GAS_API_URL);
  const data = await res.json();

  // 800x480 解像度設定
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

  // 1. ヘッダー
  svg += `<text x="${marginX + 4}" y="${marginY + 26}" font-size="26" font-weight="900" fill="#000000" font-family="'Helvetica Neue', Arial, sans-serif">${data.year}年 ${data.month}月</text>`;
  svg += `<text x="${width - marginX - 4}" y="${marginY + 25}" font-size="14" font-weight="bold" fill="#444444" text-anchor="end" font-family="sans-serif">${escapeXml(data.calendarTitle)}</text>`;
  svg += `<line x1="${marginX}" y1="${marginY + headerHeight - 3}" x2="${width - marginX}" y2="${marginY + headerHeight - 3}" stroke="#000000" stroke-width="2"/>`;

  // 2. 曜日ヘッダー
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const startY = marginY + headerHeight;
  dayNames.forEach((d, i) => {
    const x = marginX + i * colWidth;
    let textColor = '#000000';
    if (i === 0) textColor = '#cc0000';
    if (i === 6) textColor = '#0044cc';
    svg += `<rect x="${x}" y="${startY}" width="${colWidth}" height="${dayHeaderHeight}" fill="#eeeeee" stroke="#888888" stroke-width="1"/>`;
    svg += `<text x="${x + colWidth / 2}" y="${startY + 17}" font-size="15" font-weight="bold" fill="${textColor}" text-anchor="middle" font-family="sans-serif">${d}</text>`;
  });

  // 3. カレンダー背景マスの描画
  const calStartY = startY + dayHeaderHeight;
  const parts = data.gridStartDate.split('-');
  const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  for (let i = 0; i < 42; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const cellX = marginX + col * colWidth;
    const cellY = calStartY + row * rowHeight;

    const curDate = new Date(baseDate);
    curDate.setDate(baseDate.getDate() + i);

    const y = curDate.getFullYear();
    const m = ('0' + (curDate.getMonth() + 1)).slice(-2);
    const d = ('0' + curDate.getDate()).slice(-2);
    const dateKey = `${y}-${m}-${d}`;

    const isCurrentMonth = (curDate.getMonth() + 1) === data.month;
    const isToday = (dateKey === data.todayStr);

    let cellBg = isCurrentMonth ? '#ffffff' : '#f4f4f4';
    svg += `<rect x="${cellX}" y="${cellY}" width="${colWidth}" height="${rowHeight}" fill="${cellBg}" stroke="#aaaaaa" stroke-width="1"/>`;

    if (isToday) {
      svg += `<rect x="${cellX + 1}" y="${cellY + 1}" width="${colWidth - 2}" height="${rowHeight - 2}" fill="none" stroke="#000000" stroke-width="3"/>`;
    }

    let dateColor = isCurrentMonth ? '#000000' : '#888888';
    if (isToday) dateColor = '#000000';
    svg += `<text x="${cellX + 5}" y="${cellY + 18}" font-size="16" font-weight="900" fill="${dateColor}" font-family="sans-serif">${curDate.getDate()}</text>`;
  }

  // 4. Googleカレンダー風 複数日帯バー（スパン）の描画ロジック
  const events = data.events || [];
  
  // 日付文字列から 0〜41 のインデックスに変換
  function getDayIndex(dateStr) {
    const p = dateStr.split('-');
    const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    const diffTime = d.getTime() - baseDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // 週ごと（6行）にイベントを整理
  for (let week = 0; week < 6; week++) {
    const weekStartIdx = week * 7;
    const weekEndIdx = weekStartIdx + 6;
    const weekY = calStartY + week * rowHeight;

    // 各曜日のスロット占有状況 (最大2レーン)
    const slotOccupied = [[false, false, false, false, false, false, false], [false, false, false, false, false, false, false]];

    // 複数日イベントを優先して長い順にソート
    const weekEvents = [];
    events.forEach(ev => {
      const sIdx = getDayIndex(ev.startDateStr);
      const eIdx = getDayIndex(ev.endDateStr);

      if (eIdx >= weekStartIdx && sIdx <= weekEndIdx) {
        const segStart = Math.max(sIdx, weekStartIdx);
        const segEnd = Math.min(eIdx, weekEndIdx);
        const segStartCol = segStart - weekStartIdx;
        const segEndCol = segEnd - weekStartIdx;
        const span = segEndCol - segStartCol + 1;
        const isStartOfWeekOrEvent = (segStart === sIdx) || (segStartCol === 0);

        weekEvents.push({
          ...ev,
          segStartCol,
          segEndCol,
          span,
          isStartOfWeekOrEvent
        });
      }
    });

    // 長い帯を優先配置
    weekEvents.sort((a, b) => b.span - a.span);

    // スロット（上下位置）を割り当てて描画
    weekEvents.forEach(ev => {
      let assignedSlot = -1;
      for (let s = 0; s < 2; s++) {
        let fits = true;
        for (let c = ev.segStartCol; c <= ev.segEndCol; c++) {
          if (slotOccupied[s][c]) {
            fits = false;
            break;
          }
        }
        if (fits) {
          assignedSlot = s;
          for (let c = ev.segStartCol; c <= ev.segEndCol; c++) {
            slotOccupied[s][c] = true;
          }
          break;
        }
      }

      if (assignedSlot !== -1) {
        const barX = marginX + ev.segStartCol * colWidth + 2;
        const barWidth = ev.span * colWidth - 4;
        const barY = weekY + 26 + assignedSlot * 18;
        const barHeight = 16;

        // 連続した帯バー（角丸）
        svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="#dddddd" stroke="#888888" stroke-width="0.5" rx="3"/>`;

        // 開始位置のみテキストを左詰めで表示
        if (ev.isStartOfWeekOrEvent) {
          const textX = barX + 4;
          const textY = barY + 12;
          const displayTitle = (ev.timeStr || "") + ev.title;
          const maxChars = Math.floor(ev.span * 6.5); // スパン幅に応じた文字数
          const trimmed = displayTitle.length > maxChars ? displayTitle.slice(0, maxChars - 1) + '…' : displayTitle;

          svg += `<text x="${textX}" y="${textY}" font-size="11.5" font-weight="bold" fill="#000000" font-family="sans-serif">${escapeXml(trimmed)}</text>`;
        }
      }
    });
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
  console.log("Multi-day span calendar generated successfully!");
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

main().catch(err => { console.error(err); process.exit(1); });
