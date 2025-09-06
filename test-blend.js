import * as LucideIcons from 'lucide-react';

console.log('Checking for Blend icon:');
console.log('Blend available:', 'Blend' in LucideIcons);
console.log('Available blend/layer icons:', Object.keys(LucideIcons).filter(key => 
  /blend|layer|mix|palette/i.test(key) && !key.includes('Icon') && !key.includes('Lucide')
));
