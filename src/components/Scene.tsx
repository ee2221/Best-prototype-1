import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const DraggableVertex = ({ position, selected, onClick }: { position: THREE.Vector3, selected: boolean, onClick: () => void }) => {
  const mesh = useRef<THREE.Mesh>();
  const dragStart = useRef<THREE.Vector3>();
  const geometry = useSceneStore(state => state.selectedObject?.geometry as THREE.BufferGeometry);
  const positionAttribute = geometry?.attributes.position;

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    dragStart.current = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
  };

  const onPointerMove = (e: any) => {
    if (dragStart.current && positionAttribute) {
      const currentPos = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
      const delta = currentPos.sub(dragStart.current);
      
      // Update vertex position
      const vertexIndex = useSceneStore.getState().selectedElements[0];
      const newPos = new THREE.Vector3().fromBufferAttribute(positionAttribute, vertexIndex).add(delta);
      positionAttribute.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z);
      positionAttribute.needsUpdate = true;
      
      dragStart.current = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
    }
  };

  const onPointerUp = () => {
    dragStart.current = undefined;
  };

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color={selected ? '#ff0000' : '#ffffff'} />
    </mesh>
  );
};

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

  const handleElementSelect = (index: number) => {
    selectElements([index]); // Only allow single selection for dragging
  };

  if (editMode === 'vertex') {
    return (
      <group>
        {vertices.map((vertex, i) => (
          <DraggableVertex
            key={i}
            position={vertex}
            selected={selectedElements.includes(i)}
            onClick={(e) => {
              e.stopPropagation();
              handleElementSelect(i);
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              handleElementSelect(i);
            }}
          />
        ))}
        {selectedElements.length > 0 && (
          <TransformControls
            object={selectedObject}
            mode={useSceneStore.getState().transformMode}
            onObjectChange={() => useSceneStore.getState().updateObjectProperties()}
            space="world"
          />
        )}
      </group>
    );
  }

  if (editMode === 'face') {
    const faces: THREE.Vector3[][] = [];
    for (let i = 0; i < position.count; i += 3) {
      faces.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
    }

    return (
      <group>
        {faces.map((face, i) => (
          <mesh
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              handleElementSelect(i);
            }}
          >
            <bufferGeometry>
              <float32BufferAttribute
                attach="attributes-position"
                args={[new Float32Array(face.flatMap(v => [v.x, v.y, v.z])), 3]}
              />
            </bufferGeometry>
            <meshBasicMaterial
              color={selectedElements.includes(i) ? '#ff0000' : '#ffffff'}
              opacity={0.3}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        {selectedElements.length > 0 && (
          <TransformControls
            object={selectedObject}
            mode={useSceneStore.getState().transformMode}
            onObjectChange={() => useSceneStore.getState().updateObjectProperties()}
            space="world"
          />
        )}
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
        enabled={true}
      />
    </Canvas>
  );
};

export default Scene;