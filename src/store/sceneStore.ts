import { create } from 'zustand';
import * as THREE from 'three';

interface SceneObject {
  id: string;
  object: THREE.Object3D;
  name: string;
  visible: boolean;
  parentId?: string;
}

interface SceneState {
  objects: SceneObject[];
  selectedObject: THREE.Object3D | null;
  selectedObjects: Set<string>;
  transformMode: 'translate' | 'rotate' | 'scale';
  addObject: (object: THREE.Object3D, name: string, parentId?: string) => void;
  removeObject: (id: string) => void;
  setSelectedObject: (object: THREE.Object3D | null) => void;
  toggleObjectSelection: (id: string) => void;
  clearSelection: () => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  toggleVisibility: (id: string) => void;
  updateObjectName: (id: string, name: string) => void;
  updateObjectProperties: () => void;
  updateObjectColor: (color: string) => void;
  updateObjectOpacity: (opacity: number) => void;
  createGroup: () => void;
  ungroup: (groupId: string) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  objects: [],
  selectedObject: null,
  selectedObjects: new Set(),
  transformMode: 'translate',
  
  addObject: (object, name, parentId) =>
    set((state) => ({
      objects: [...state.objects, { id: crypto.randomUUID(), object, name, visible: true, parentId }],
    })),
    
  removeObject: (id) =>
    set((state) => {
      // Also remove all children when removing a group
      const idsToRemove = new Set([id]);
      state.objects.forEach(obj => {
        if (obj.parentId === id) idsToRemove.add(obj.id);
      });
      
      return {
        objects: state.objects.filter(obj => !idsToRemove.has(obj.id)),
        selectedObject: state.objects.find((obj) => obj.id === id)?.object === state.selectedObject
          ? null
          : state.selectedObject,
        selectedObjects: new Set([...state.selectedObjects].filter(objId => !idsToRemove.has(objId)))
      };
    }),
    
  setSelectedObject: (object) => set({ 
    selectedObject: object,
    selectedObjects: new Set()
  }),
  
  toggleObjectSelection: (id) =>
    set((state) => {
      const newSelection = new Set(state.selectedObjects);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      
      // If this is the only selected object, also set it as the selectedObject for transform controls
      if (newSelection.size === 1) {
        const selectedObj = state.objects.find(obj => obj.id === id);
        if (selectedObj) {
          return { 
            selectedObjects: newSelection,
            selectedObject: selectedObj.object
          };
        }
      }
      
      return { selectedObjects: newSelection };
    }),
    
  clearSelection: () => set({ selectedObjects: new Set() }),
  
  setTransformMode: (mode) => set({ transformMode: mode }),
  
  toggleVisibility: (id) =>
    set((state) => {
      const updatedObjects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj
      );
      
      const toggledObject = updatedObjects.find((obj) => obj.id === id);
      
      const newSelectedObject = (toggledObject && !toggledObject.visible && toggledObject.object === state.selectedObject)
        ? null
        : state.selectedObject;

      return {
        objects: updatedObjects,
        selectedObject: newSelectedObject,
      };
    }),
    
  updateObjectName: (id, name) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, name } : obj
      ),
    })),
    
  updateObjectProperties: () => set((state) => ({ ...state })),
  
  updateObjectColor: (color) => 
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.color.setStyle(color);
        material.needsUpdate = true;
      }
      return state;
    }),
    
  updateObjectOpacity: (opacity) =>
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.needsUpdate = true;
      }
      return state;
    }),
    
  createGroup: () =>
    set((state) => {
      if (state.selectedObjects.size < 2) return state;

      const group = new THREE.Group();
      const groupId = crypto.randomUUID();
      const selectedObjectsArray = Array.from(state.selectedObjects);
      
      // Calculate the center position of all selected objects
      const center = new THREE.Vector3();
      let count = 0;
      
      selectedObjectsArray.forEach(id => {
        const obj = state.objects.find(o => o.id === id);
        if (obj) {
          const worldPosition = new THREE.Vector3();
          obj.object.getWorldPosition(worldPosition);
          center.add(worldPosition);
          count++;
        }
      });
      
      if (count > 0) {
        center.divideScalar(count);
        group.position.copy(center);
      }
      
      // Add objects to group, adjusting their positions relative to the group's center
      const updatedObjects = state.objects.map(obj => {
        if (state.selectedObjects.has(obj.id)) {
          const worldPosition = new THREE.Vector3();
          obj.object.getWorldPosition(worldPosition);
          obj.object.position.copy(worldPosition.sub(center));
          group.add(obj.object);
          return { ...obj, parentId: groupId };
        }
        return obj;
      });

      // Add the group itself
      updatedObjects.push({
        id: groupId,
        object: group,
        name: `Group ${updatedObjects.filter(obj => obj.object instanceof THREE.Group).length + 1}`,
        visible: true
      });

      return {
        objects: updatedObjects,
        selectedObjects: new Set([groupId]),
        selectedObject: group
      };
    }),
    
  ungroup: (groupId) =>
    set((state) => {
      const groupObj = state.objects.find(obj => obj.id === groupId);
      const children = state.objects.filter(obj => obj.parentId === groupId);
      
      if (!groupObj) return state;
      
      // Get the group's world matrix
      const worldMatrix = new THREE.Matrix4();
      groupObj.object.updateWorldMatrix(true, false);
      worldMatrix.copy(groupObj.object.matrixWorld);
      
      const updatedObjects = state.objects
        .filter(obj => obj.id !== groupId) // Remove the group
        .map(obj => {
          if (obj.parentId === groupId) {
            // Apply the group's transformation to the child
            obj.object.applyMatrix4(worldMatrix);
            obj.object.removeFromParent();
            return { ...obj, parentId: undefined };
          }
          return obj;
        });

      return {
        objects: updatedObjects,
        selectedObjects: new Set(),
        selectedObject: null
      };
    })
}));