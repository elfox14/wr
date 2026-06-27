const fs = require('fs');
const files = [
  'components/MarketClient.tsx',
  'components/LeaderboardClient.tsx',
  'components/HomeClient.tsx',
  'components/GroupsClient.tsx',
  'components/AssetClient.tsx',
  'app/articles/page.tsx',
  'app/article/[id]/page.tsx',
  'app/news/page.tsx',
  'app/portfolio/page.tsx',
  'app/rewards/page.tsx',
  'app/matches/page.tsx',
  'app/leagues/[id]/page.tsx',
  'app/leagues/page.tsx',
  'app/admin/page.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Remove import
    content = content.replace(/import\s+\{\s*Navbar\s*\}\s+from\s+['"]@\/components\/ui\/Navbar['"];?\n?/g, '');
    // Remove component usage
    content = content.replace(/<Navbar\s*\/>\n?/g, '');
    fs.writeFileSync(file, content);
    console.log('Processed', file);
  }
});
