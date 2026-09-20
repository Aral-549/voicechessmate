const fs = require("fs");
const path = require("path");

function replaceEmojisInFile(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  // Add SVG styling to CSS if not present
  if (!html.includes(".svg-icon")) {
    const cssRule = `
  .svg-icon {
    width: 1.1em;
    height: 1.1em;
    display: inline-block;
    vertical-align: -0.15em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .icon-lg {
    width: 2em;
    height: 2em;
    vertical-align: middle;
    margin-bottom: 8px;
  }
`;
    html = html.replace("</style>", cssRule + "</style>");
  }

  // Define SVG snippets
  const svgMic = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  const svgEyeOff = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
  const svgSpeaker = `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const svgCpu = `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M9 2v2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M2 9h2"/><path d="M2 15h2"/></svg>`;
  const svgChess = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="m19 21-3-4-2-4 2-5-2-2-4 1-2 3-2 1v5l3 3 2 2h8z"/><path d="M12 9h.01"/></svg>`;
  const svgCheck = `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  const svgBolt = `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const svgFlask = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 2v7.31L4.65 19.3A2 2 0 0 0 6.4 22h11.2a2 2 0 0 0 1.75-2.7L14 9.31V2"/></svg>`;
  const svgRobot = `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>`;
  const svgA11y = `<svg class="svg-icon icon-lg" viewBox="0 0 24 24"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-4-7.5"/></svg>`;
  const svgUsers = `<svg class="svg-icon icon-lg" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const svgHeadphones = `<svg class="svg-icon icon-lg" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
  const svgTrophy = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
  const svgHandshake = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.3 1.3"/><path d="m13 11-2-2a1 1 0 0 0-1.4 0L5.3 13.3a1 1 0 0 0 0 1.4l2 2a1 1 0 0 0 1.4 0l1.3-1.3"/></svg>`;
  const svgLightbulb = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;
  const svgSmartphone = `<svg class="svg-icon" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`;
  const svgGlobe = `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  const svgClock = `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  // Replace decorations & emojis
  html = html.replace(/<div class="board-deco">.*?<\/div>/g, `<div class="board-deco">${svgChess}</div>`);
  html = html.replace(/<div class="chess-row">.*?<\/div>/g, `<div class="chess-row">${svgChess}</div>`);

  // Pills
  html = html.replace(/🎙️/g, svgMic);
  html = html.replace(/♟️|♟/g, svgChess);
  html = html.replace(/⚡/g, svgBolt);
  html = html.replace(/🧪/g, svgFlask);
  html = html.replace(/🤖/g, svgRobot);
  html = html.replace(/⏱️/g, svgClock);
  html = html.replace(/🔊/g, svgSpeaker);
  html = html.replace(/👁️/g, svgEyeOff);
  html = html.replace(/🧠/g, svgCpu);
  html = html.replace(/🏆/g, svgTrophy);
  html = html.replace(/🤝/g, svgHandshake);
  html = html.replace(/🎤/g, svgMic);
  html = html.replace(/📱/g, svgSmartphone);
  html = html.replace(/🌍/g, svgGlobe);
  html = html.replace(/💡/g, svgLightbulb);
  html = html.replace(/✅/g, svgCheck);
  html = html.replace(/💰/g, svgTrophy);
  html = html.replace(/🌗/g, svgEyeOff);
  html = html.replace(/⌨️/g, svgCpu);
  html = html.replace(/🎹/g, svgSpeaker);
  html = html.replace(/🎯/g, svgCheck);
  html = html.replace(/🛠️/g, svgCpu);
  html = html.replace(/🔧/g, svgCpu);
  html = html.replace(/🌐/g, svgGlobe);
  html = html.replace(/🧩/g, svgChess);
  html = html.replace(/<div style="font-size:40px;margin-bottom:12px;">♿<\/div>/g, svgA11y);
  html = html.replace(/<div style="font-size:40px;margin-bottom:12px;">🎓<\/div>/g, svgUsers);
  html = html.replace(/<div style="font-size:40px;margin-bottom:12px;">🎧<\/div>/g, svgHeadphones);

  fs.writeFileSync(filePath, html, "utf8");
  console.log("Cleaned emojis from:", filePath);
}

replaceEmojisInFile(path.join(__dirname, "../public/hackday-presentation.html"));
replaceEmojisInFile(path.join(__dirname, "../public/hackdevengers-presentation.html"));
