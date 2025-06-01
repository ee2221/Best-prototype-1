import React from 'react';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import LayersPanel from './components/LayersPanel';
import ObjectProperties from './components/ObjectProperties';

function App() {
  return (
    <div className="w-full h-screen relative">
      <Scene />
      <Toolbar />
      <LayersPanel />
      <ObjectProperties />
      <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg shadow-lg p-4">
        <h2 className="text-lg font-semibold mb-2">3D Modeling App</h2>
        <p className="text-sm text-gray-600">
          Left click + drag to rotate view<br />
          Right click + drag to pan<br />
          Scroll to zoom
        </p>
      </div>
    </div>
  );
}

export default App;