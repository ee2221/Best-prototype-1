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
  const { camera } = useThree();

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    if (selected) {
      dragStart.current = position.clone();
      // Disable OrbitControls while dragging
      const controls = document.querySelector('.orbit-controls');
      if (controls) controls.setAttribute('enabled', 'false');
    }
  };

  const onPointerMove = (e: any) => {
    if (dragStart.current && selected && positionAttribute && mesh.current) {
      // Get mouse position in normalized device coordinates
      const mouse = new THREE.Vector2(
        (e.offsetX / e.target.offsetWidth) * 2 - 1,
        -(e.offsetY / e.target.offsetHeight) * 2 + 1
      );

      // Create ray from mouse position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Get the plane perpendicular to the camera
      const planeNormal = new THREE.Vector3().subVectors(camera.position, position).normalize();
      const plane = new THREE.Plane(planeNormal, -position.dot(planeNormal));

      // Find intersection point
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectionPoint);

      // Convert to local space
      const worldToLocal = new THREE.Matrix4().copy(selectedObject.matrixWorld).invert();
      const localPosition = intersectionPoint.clone().applyMatrix4(worldToLocal);

      // Update all connected vertices
      for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        if (Math.abs(vertex.x - dragStart.current.x) < 0.001 &&
            Math.abs(vertex.y - dragStart.current.y) < 0.001 &&
            Math.abs(vertex.z - dragStart.current.z) < 0.001) {
          positionAttribute.setXYZ(i, localPosition.x, localPosition.y, localPosition.z);
        }
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
      dragStart.current = localPosition;
    }
  };

  const onPointerUp = () => {
    dragStart.current = undefined;
    // Re-enable OrbitControls after dragging
    const controls = document.querySelector('.orbit-controls');
    if (controls) controls.setAttribute('enabled', 'true');
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
        enabled={editMode === 'object'}
        className="orbit-controls"
      />
    </Canvas>
  );
};

export default Scene;