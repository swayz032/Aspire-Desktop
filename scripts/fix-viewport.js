const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  
  html = html.replace(
    /name="viewport" content="[^"]*"/,
    'name="viewport" content="width=1280, initial-scale=1, minimum-scale=0.5, shrink-to-fit=no"'
  );
  
  html = html.replace(
    '</style>',
    `  html, body { min-width: 1024px !important; }
      @media (max-width: 1023px) {
        html { zoom: 0.8; }
      }
    </style>`
  );
  
  if (!html.includes('link-initialize.js')) {
    html = html.replace(
      '</head>',
      '<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>\n</head>'
    );
  }

  fs.writeFileSync(indexPath, html);
  console.log('Viewport fixed for desktop-only mode');
} else {
  console.error('dist/index.html not found');
}

function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${path.relative(publicDir, src)} to dist`);
  }
}

if (fs.existsSync(publicDir)) {
  copyRecursive(publicDir, distDir);
}
