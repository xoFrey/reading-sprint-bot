const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const axios = require('axios');

// Colors
const BG_COLOR = '#FFF0ED';
const TITLE_COLOR = '#D79A96';
const TEXT_COLOR = '#A9746A';
const RANK_COLORS = ['#D4AF37', '#C0C0C0', '#B87333', '#BFA148', '#BFA148', '#BFA148', '#BFA148', '#BFA148', '#BFA148', '#BFA148'];

const ASSETS = path.join(__dirname, '../../assets');

registerFont(path.join(ASSETS, 'fonts/Halimun-W7jn.ttf'), { family: 'Halimun' });

async function fetchAvatar(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

async function generateLeaderboard(results, sprintDurationMs) {
  const W = 600;
  const ENTRY_H = 140;
  const TOP_PAD = 155;
  const BOTTOM_PAD = 120;
  const H = TOP_PAD + results.length * ENTRY_H + BOTTOM_PAD;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  // Load wreath and book images
  const wreathImg = await loadImage(path.join(ASSETS, 'wreath.png'));
  const bookImg = await loadImage(path.join(ASSETS, 'book.png'));

  // Title
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = 'bold 48px Liberation Sans, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Leaderboard', W / 2, 58);

  ctx.font = 'bold 22px Liberation Sans, Arial, sans-serif';
  ctx.fillText(`Duration: ${formatDuration(sprintDurationMs)}`, W / 2, 95);

  // Entries
  for (let i = 0; i < results.length; i++) {
    const user = results[i];
    const color = RANK_COLORS[i] || '#BFA148';
    const cy = TOP_PAD + i * ENTRY_H + ENTRY_H / 2;
    const circleX = 90;
    const wreathSize = 100;

    // Colorize and draw wreath
    const offCanvas = createCanvas(wreathSize, wreathSize);
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(wreathImg, 0, 0, wreathSize, wreathSize);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, wreathSize, wreathSize);
    // Redraw with color tint
    const wreathCanvas = createCanvas(wreathSize, wreathSize);
    const wreathCtx = wreathCanvas.getContext('2d');
    wreathCtx.drawImage(wreathImg, 0, 0, wreathSize, wreathSize);
    wreathCtx.globalCompositeOperation = 'multiply';
    wreathCtx.fillStyle = color;
    wreathCtx.fillRect(0, 0, wreathSize, wreathSize);
    wreathCtx.globalCompositeOperation = 'destination-in';
    wreathCtx.drawImage(wreathImg, 0, 0, wreathSize, wreathSize);
    ctx.drawImage(wreathCanvas, circleX - wreathSize / 2, cy - wreathSize / 2);

    // Profile picture (circular)
    const profileR = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(circleX, cy, profileR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const avatarBuffer = user.avatar_url ? await fetchAvatar(user.avatar_url) : null;
    if (avatarBuffer) {
      const avatarImg = await loadImage(avatarBuffer);
      ctx.drawImage(avatarImg, circleX - profileR, cy - profileR, profileR * 2, profileR * 2);
    } else {
      ctx.fillStyle = '#E8D0CC';
      ctx.fillRect(circleX - profileR, cy - profileR, profileR * 2, profileR * 2);
    }
    ctx.restore();

    // Rank number
    ctx.fillStyle = color;
    ctx.font = 'bold 18px Liberation Sans, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), circleX, cy + 6);

    // Text info
    const tx = circleX + wreathSize / 2 + 15;
    const pagesRead = Number(user.pages_read) || 0;
    const books = Array.isArray(user.books) ? user.books.filter(b => b.title) : [];
    const bookTitles = books.map(b => b.title).join(', ') || '—';
    const activeDuration = user.leave_time && user.join_time
      ? (new Date(user.leave_time) - new Date(user.join_time)) - Number(user.total_pause_ms)
      : sprintDurationMs - Number(user.total_pause_ms);

    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT_COLOR;

    ctx.font = 'bold 20px Liberation Sans, Arial, sans-serif';
    ctx.fillText(`#${i + 1} - ${user.username}`, tx, cy - 38);

    ctx.font = '17px Liberation Sans, Arial, sans-serif';
    // Truncate long book titles
    const maxTitleWidth = W - tx - 20;
    let displayTitle = bookTitles;
    while (ctx.measureText(displayTitle).width > maxTitleWidth && displayTitle.length > 10) {
      displayTitle = displayTitle.slice(0, -4) + '...';
    }
    ctx.fillText(displayTitle, tx, cy - 14);
    ctx.fillText(`${pagesRead} pages read`, tx, cy + 10);
    ctx.fillText(`Duration: ${formatDuration(activeDuration)}`, tx, cy + 34);
  }

  // Book icon bottom right
  const bookW = 110, bookH = 90;
  // Tint book
  const bookCanvas = createCanvas(bookW, bookH);
  const bookCtx = bookCanvas.getContext('2d');
  bookCtx.drawImage(bookImg, 0, 0, bookW, bookH);
  bookCtx.globalCompositeOperation = 'multiply';
  bookCtx.fillStyle = '#BFA148';
  bookCtx.fillRect(0, 0, bookW, bookH);
  bookCtx.globalCompositeOperation = 'destination-in';
  bookCtx.drawImage(bookImg, 0, 0, bookW, bookH);
  ctx.drawImage(bookCanvas, W - bookW - 20, H - bookH - 20);

  return canvas.toBuffer('image/png');
}

module.exports = { generateLeaderboard };
