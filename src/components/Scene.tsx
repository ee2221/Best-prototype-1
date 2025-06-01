import React, { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const DraggableVertex = ({ position, selected, onClick, vertexIndex }: { position: THREE.Vector3, selected: boolean, onClick: () => void, vertexIndex: number }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const dragStart = useRef<THREE.Vector3>();
  const selectedObject = useSceneStore(state => state.selectedObject as THREE.Mesh);
  const geometry = selectedObject?.geometry as THREE.BufferGeometry;
  const positionAttribute = geometry?.attributes.position;
  const initialPosition = useRef(position.clone());

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    if (selected) {
      dragStart.current = e.point.clone();
      initialPosition.current = position.clone();
    }
  };

  const onPointerMove = (e: any) => {
    if (dragStart.current && selected && positionAttribute) {
      const currentPos = e.point.clone();
      const delta = currentPos.sub(dragStart.current);
      
      // Update vertex position in local space
      const worldToLocal = new THREE.Matrix4().copy(selectedObject.matrixWorld).invert();
      const localDelta = delta.applyMatrix4(worldToLocal);
      
      const newPosition = initialPosition.current.clone().add(localDelta);
      position.copy(newPosition);
      
      // Find all instances of this vertex in the geometry
      for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        if (Math.abs(vertex.x - initialPosition.current.x) < 0.001 &&
            Math.abs(vertex.y - initialPosition.current.y) < 0.001 &&
            Math.abs(vertex.z - initialPosition.current.z) < 0.001) {
          positionAttribute.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
        }
      }
      
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  };

  const onPointerUp = () => {
    dragStart.current = undefined;
  };

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshBasicMaterial color={selected ? '#ff0000' : '#ffffff'} />
    </mesh>
  );
};

const MeshHelpers = () => {
  const { selectedObject, editMode, selectedElements, selectElements } = useSceneStore();

  if (!(selectedObject instanceof THREE.Mesh) || editMode === 'object') return null;

  // Only show vertex editing for BoxGeometry
  if (!(selectedObject.geometry instanceof THREE.BoxGeometry)) return null;

  const geometry = selectedObject.geometry;
  const position = geometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  const vertexIndices: number[] = [];
  const matrix = selectedObject.matrixWorld;

  // Get unique vertices for cube
  const uniqueVertices = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3();
    vertex.fromBufferAttribute(position, i);
    vertex.applyMatrix4(matrix);
    
    const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, i);
      vertices.push(vertex);
      vertexIndices.push(i);
    }
  }

  const handleElementSelect = (index: number) => {
    selectElements([vertexIndices[index]]);
  };

  if (editMode === 'vertex') {
    return (
      <group>
        {vertices.map((vertex, i) => (
          <DraggableVertex
            key={i}
            position={vertex}
            selected={selectedElements.includes(vertexIndices[i])}
            onClick={() => handleElementSelect(i)}
            vertexIndex={vertexIndices[i]}
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
        enabled={true}
      />
    </Canvas>
  );
};

export default Scene;