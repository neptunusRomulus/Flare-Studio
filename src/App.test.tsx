import React from 'react';
import { Button } from '@/components/ui/button';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-3xl font-bold mb-4">Advanced Flare Map Editor</h1>
      <p className="text-muted-foreground mb-4">Testing React + Tailwind + shadcn/ui</p>
      <Button onClick={() => alert('Button works!')}>
        Test Button
      </Button>
      <div className="mt-8">
        <canvas
          width="400" 
          height="300"
          className="border rounded"
          style={{background: '#f0f0f0'}}
        />
      </div>
    </div>
  );
}

export default App;
