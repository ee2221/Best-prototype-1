import React, { useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const VertexEditor = () => {
  const { selectedObject } = useSceneStore();
  const { camera, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const draggedVertex = useRef<number | null>(null);
  const lastMousePosition = useRef<THREE.Vector2>(new THREE.Vector2());

  if (!(selectedObject instanceof THREE.Mesh)) return null;
  const geometry = selectedObject.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;

  const handlePointerDown = (e: THREE.Event) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    
    // Find closest vertex
    let minDist = Infinity;
    let closestVertex = -1;
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positions, i);
      vertex.applyMatrix4(selectedObject.matrixWorld);
      
      const distance = raycaster.ray.distanceToPoint(vertex);
      if (distance < minDist && distance < 0.5) {
        minDist = distance;
        closestVertex = i;
      }
    }
    
    if (closestVertex !== -1) {
      setIsDragging(true);
      draggedVertex.current = closestVertex;
      lastMousePosition.current.set(x, y);
    }
  };

  const handlePointerMove = (e: THREE.Event) => {
    if (!isDragging || draggedVertex.current === null) return;

    const rect = gl.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    const deltaX = x - lastMousePosition.current.x;
    const deltaY = y - lastMousePosition.current.y;
    
    const vertex = new THREE.Vector3();
    vertex.fromBufferAttribute(positions, draggedVertex.current);
    
    // Convert screen space delta to world space
    const worldDelta = new THREE.Vector3(
      deltaX * camera.position.z * 0.1,
      deltaY * camera.position.z * 0.1,
      0
    );
    worldDelta.applyQuaternion(camera.quaternion);
    
    // Apply to all connected vertices
    const vertexPos = new THREE.Vector3(
      positions.getX(draggedVertex.current),
      positions.getY(draggedVertex.current),
      positions.getZ(draggedVertex.current)
    );
    
    for (let i = 0; i < positions.count; i++) {
      const pos = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      if (pos.distanceTo(vertexPos) < 0.001) {
        pos.add(worldDelta);
        positions.setXYZ(i, pos.x, pos.y, pos.z);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    lastMousePosition.current.set(x, y);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    draggedVertex.current = null;
  };

  return (
    <mesh
      position={[0, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
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
      camera={{ position: [0, 0, 5], fov: 50 }}
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
      
      {editMode === 'vertex' ? (
        <>
          {selectedObject && <primitive object={selectedObject} />}
          <VertexEditor />
        </>
      ) : (
        <>
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
        </>
      )}

      <OrbitControls
        makeDefault
        enabled={editMode !== 'vertex'}
      />
    </Canvas>
  );
};

export default Scene;