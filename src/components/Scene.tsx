import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const VertexHelper = ({ position, selected, onClick }: { position: THREE.Vector3, selected: boolean, onClick: () => void }) => (
  <mesh position={position} onClick={onClick}>
    <sphereGeometry args={[0.05, 16, 16]} />
    <meshBasicMaterial color={selected ? '#ff0000' : '#ffffff'} />
  </mesh>
);

const EdgeHelper = ({ start, end, selected, onClick }: { start: THREE.Vector3, end: THREE.Vector3, selected: boolean, onClick: () => void }) => {
  const points = [start, end];
  return (
    <line onClick={onClick}>
      <bufferGeometry>
        <float32BufferAttribute attach="attributes-position" args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={selected ? '#ff0000' : '#ffffff'} linewidth={2} />
    </line>
  );
};

const MeshHelpers = () => {
  const { selectedObject, editMode, selectedElements, selectElements } = useSceneStore();
  const { raycaster, camera } = useThree();

  if (!(selectedObject instanceof THREE.Mesh) || editMode === 'object') return null;

  const geometry = selectedObject.geometry as THREE.BufferGeometry;
  const position = geometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  const matrix = selectedObject.matrixWorld;

  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3();
    vertex.fromBufferAttribute(position, i);
    vertex.applyMatrix4(matrix);
    vertices.push(vertex);
  }

  if (editMode === 'vertex') {
    return (
      <group>
        {vertices.map((vertex, i) => (
          <VertexHelper
            key={i}
            position={vertex}
            selected={selectedElements.includes(i)}
            onClick={() => selectElements([i])}
          />
        ))}
      </group>
    );
  }

  if (editMode === 'edge') {
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < position.count; i += 3) {
      edges.push([vertices[i], vertices[i + 1]]);
      edges.push([vertices[i + 1], vertices[i + 2]]);
      edges.push([vertices[i + 2], vertices[i]]);
    }

    return (
      <group>
        {edges.map((edge, i) => (
          <EdgeHelper
            key={i}
            start={edge[0]}
            end={edge[1]}
            selected={selectedElements.includes(i)}
            onClick={() => selectElements([i])}
          />
        ))}
      </group>
    );
  }

  return null;
};

const Scene: React.FC = () => {
  const { 
    objects, 
    selectedObject, 
    selectedObjects,
    setSelectedObject, 
    toggleObjectSelection,
    transformMode,
    editMode,
    clearElementSelection
  } = useSceneStore();

  return (
    <Canvas
      camera={{ position: [5, 5, 5], fov: 75 }}
      className="w-full h-full bg-gray-900"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedObject(null);
          clearElementSelection();
        }
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      <Grid
        infiniteGrid
        cellSize={1}
        sectionSize={3}
        fadeDistance={30}
        fadeStrength={1}
      />

      {objects.map(({ object, visible, id }) => (
        visible && (
          <primitive
            key={id}
            object={object}
            onClick={(e) => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                toggleObjectSelection(id);
              } else {
                setSelectedObject(object);
              }
            }}
          />
        )
      ))}

      {selectedObject && editMode === 'object' && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          onObjectChange={() => useSceneStore.getState().updateObjectProperties()}
          space="world"
        />
      )}

      <MeshHelpers />

      <OrbitControls
        makeDefault
        enabled={!selectedObject || editMode !== 'object'}
      />
    </Canvas>
  );
};

export default Scene;