import { useState, useCallback, useRef, useEffect } from 'react';
import { Point3D, Polygon3D } from '../types/geometry';

export interface GeometryState {
  points: Point3D[];
  polygons: Polygon3D[];
}

const MAX_HISTORY_STEPS = 50;

export function useGeometryHistory(initialState: GeometryState) {
  // Past stack, present state, future stack
  const [past, setPast] = useState<GeometryState[]>([]);
  const [present, setPresent] = useState<GeometryState>(initialState);
  const [future, setFuture] = useState<GeometryState[]>([]);

  // Ref to present to access latest without triggering re-renders in callbacks
  const presentRef = useRef<GeometryState>(present);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  /**
   * Pushes a new state to history if different from present.
   */
  const setGeometry = useCallback(
    (
      action:
        | GeometryState
        | ((prev: GeometryState) => GeometryState),
      recordHistory = true
    ) => {
      const nextState =
        typeof action === 'function' ? action(presentRef.current) : action;

      if (!recordHistory) {
        setPresent(nextState);
        return;
      }

      setPast((prevPast) => {
        const updated = [...prevPast, presentRef.current];
        if (updated.length > MAX_HISTORY_STEPS) {
          return updated.slice(updated.length - MAX_HISTORY_STEPS);
        }
        return updated;
      });

      setPresent(nextState);
      setFuture([]); // Clear future stack on new modification
    },
    []
  );

  /**
   * Resets history with a completely new state (e.g., when choosing a preset or importing)
   */
  const resetWithState = useCallback((newState: GeometryState) => {
    setPast([]);
    setPresent(newState);
    setFuture([]);
  }, []);

  /**
   * Undo to previous state
   */
  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;

      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [presentRef.current, ...prevFuture]);
      setPresent(previous);

      return newPast;
    });
  }, []);

  /**
   * Redo to future state
   */
  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => [...prevPast, presentRef.current]);
      setPresent(next);

      return newFuture;
    });
  }, []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      // Allow undo/redo if not actively typing in an input or if Ctrl+Z/Ctrl+Y pressed
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();

      if (key === 'z') {
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
          if (!isInput && canRedo) {
            e.preventDefault();
            redo();
          }
        } else {
          // Undo: Ctrl+Z / Cmd+Z
          if (!isInput && canUndo) {
            e.preventDefault();
            undo();
          }
        }
      } else if (key === 'y') {
        // Redo: Ctrl+Y / Cmd+Y
        if (!isInput && canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return {
    points: present.points,
    polygons: present.polygons,
    setGeometry,
    resetWithState,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: past.length,
    futureLength: future.length,
  };
}
