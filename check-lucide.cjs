const fs = require('fs');
const path = require('path');

// Read the package.json to see the exact version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('Lucide React version:', packageJson.dependencies['lucide-react']);

try {
  const lucide = require('lucide-react');
  const allIcons = Object.keys(lucide);
  
  console.log('\nTotal icons available:', allIcons.length);
  
  // Check for Blend specifically
  const blendIcons = allIcons.filter(icon => 
    icon.toLowerCase().includes('blend')
  );
  console.log('\nBlend-related icons:', blendIcons);
  
  // Check for similar icons
  const transparencyIcons = allIcons.filter(icon => 
    /blend|layer|mix|transparency|opacity|palette|merge|combine/i.test(icon) && 
    !icon.includes('Icon') && 
    !icon.includes('Lucide')
  );
  console.log('\nTransparency-related icons:', transparencyIcons);
  
  // Check if Blend exists
  console.log('\nDirect check - Blend exists:', 'Blend' in lucide);
  console.log('Direct check - Layers exists:', 'Layers' in lucide);
  console.log('Direct check - Palette exists:', 'Palette' in lucide);
  
} catch (error) {
  console.error('Error loading lucide-react:', error);
}
