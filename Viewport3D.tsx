import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Point3D, Polygon3D, ViewportMode, PlanarityAnalysis } from '../types/geometry';
import { analyzePolygonPlanarity, triangulatePolygon } from '../utils/geometryMath';
import {
  Rotate3d,
  Grid,
  Eye,
  Crosshair,
  Maximize2,
  Box,
  Layers,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Sliders,
  X,
} from 'lucide-react';

// Helper to create crisp 3D billboard text sprites for point names
function createPointLabelSprite(text: string, isSelected: boolean, scale = 1.0): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  const dpr = 2; // High-DPI canvas
  const fontSize = 28 * dpr;
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  const padX = 16 * dpr;
  const padY = 8 * dpr;
  const w = Math.ceil(textWidth + padX * 2);
  const h = Math.ceil(fontSize + padY * 2);

  canvas.width = w;
  canvas.height = h;

  // Re-apply context font after canvas dimension resize
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Pill / badge background
  const radius = 8 * dpr;
  ctx.beginPath();
  ctx.roundRect(2 * dpr, 2 * dpr, w - 4 * dpr, h - 4 * dpr, radius);

  if (isSelected) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.strokeStyle = '#ffffff';
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  }
  ctx.lineWidth = 2 * dpr;
  ctx.fill();
  ctx.stroke();

  // Text label
  ctx.fillStyle = isSelected ? '#000000' : '#f8fafc';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  const baseWorldHeight = 0.38;
  const worldHeight = baseWorldHeight * Math.max(0.3, Math.min(3.0, scale));
  const aspect = w / h;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1.0);
  sprite.renderOrder = 1000;

  return sprite;
}

interface Viewport3DProps {
  points: Point3D[];
  polygons: Polygon3D[];
  selectedPointId: string | null;
  selectedPolygonId: string | null;
  onSelectPoint: (id: string | null) => void;
  onSelectPolygon: (id: string | null) => void;
  onUpdatePointCoord: (id: string, coord: 'x' | 'y' | 'z', value: number) => void;
  onAutoFixPolygon: (polyId: string, method: 'triangulate' | 'project') => void;
  surfaceSize?: number;
  onUpdateSurfaceSize?: (size: number) => void;
  labelScale?: number;
  onUpdateLabelScale?: (scale: number) => void;
  showSurfacePlane?: boolean;
  onToggleSurfacePlane?: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  points,
  polygons,
  selectedPointId,
  selectedPolygonId,
  onSelectPoint,
  onSelectPolygon,
  onUpdatePointCoord,
  onAutoFixPolygon,
  surfaceSize,
  onUpdateSurfaceSize,
  labelScale,
  onUpdateLabelScale,
  showSurfacePlane,
  onToggleSurfacePlane,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [viewportMode, setViewportMode] = useState<ViewportMode>('perspective');
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showBestFitPlane, setShowBestFitPlane] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [internalSurfaceSize, setInternalSurfaceSize] = useState(30);
  const [internalLabelScale, setInternalLabelScale] = useState(1.0);
  const [internalShowSurfacePlane, setInternalShowSurfacePlane] = useState(false);

  const activeSurfaceSize = surfaceSize ?? internalSurfaceSize;
  const activeLabelScale = labelScale ?? internalLabelScale;
  const activeShowSurfacePlane = showSurfacePlane ?? internalShowSurfacePlane;

  const handleUpdateSurfaceSize = (s: number) => {
    if (onUpdateSurfaceSize) onUpdateSurfaceSize(s);
    else setInternalSurfaceSize(s);
  };

  const handleUpdateLabelScale = (sc: number) => {
    if (onUpdateLabelScale) onUpdateLabelScale(sc);
    else setInternalLabelScale(sc);
  };

  const handleToggleSurfacePlane = () => {
    if (onToggleSurfacePlane) onToggleSurfacePlane();
    else setInternalShowSurfacePlane((prev) => !prev);
  };

  const [activeHoverInfo, setActiveHoverInfo] = useState<string | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camerasRef = useRef<{
    perspective: THREE.PerspectiveCamera;
    top: THREE.OrthographicCamera;
    front: THREE.OrthographicCamera;
    side: THREE.OrthographicCamera;
  } | null>(null);
  const controlsRef = useRef<{
    perspective: OrbitControls;
    top: OrbitControls;
    front: OrbitControls;
    side: OrbitControls;
  } | null>(null);

  const dynamicObjectsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const surfacePlaneRef = useRef<THREE.Mesh | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);

  // Point picking raycaster
  const raycasterRef = useRef(new THREE.Raycaster());
  const mousePosRef = useRef(new THREE.Vector2());

  // Quick lookup maps
  const pointsMap = new Map<string, Point3D>(points.map((p) => [p.id, p]));

  // Selected polygon analysis
  const selectedPoly = polygons.find((p) => p.id === selectedPolygonId);
  const selectedAnalysis: PlanarityAnalysis | null = selectedPoly
    ? analyzePolygonPlanarity(selectedPoly, pointsMap)
    : null;

  // Initialize Three.js Scene, Cameras and Controls once
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900 CAD dark theme
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    // Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-10, -10, -10);
    scene.add(dirLight2);

    // Axes
    const axes = new THREE.AxesHelper(5);
    (axes.material as THREE.Material).depthTest = false;
    axes.renderOrder = 999;
    scene.add(axes);
    axesHelperRef.current = axes;

    // Dynamic objects group (vertices, faces, lines, overlays)
    scene.add(dynamicObjectsGroupRef.current);

    // Setup 4 Cameras:
    // 1. Perspective
    const aspect = width / height;
    const perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    perspCamera.position.set(8, 8, 10);
    perspCamera.lookAt(0, 0, 0);

    // 2. Top (XZ plane)
    const frustumSize = 16;
    const topCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    topCamera.position.set(0, 30, 0);
    topCamera.up.set(0, 0, -1);
    topCamera.lookAt(0, 0, 0);

    // 3. Front (XY plane)
    const frontCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    frontCamera.position.set(0, 0, 30);
    frontCamera.up.set(0, 1, 0);
    frontCamera.lookAt(0, 0, 0);

    // 4. Side (ZY plane)
    const sideCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    sideCamera.position.set(30, 0, 0);
    sideCamera.up.set(0, 1, 0);
    sideCamera.lookAt(0, 0, 0);

    camerasRef.current = {
      perspective: perspCamera,
      top: topCamera,
      front: frontCamera,
      side: sideCamera,
    };

    // Orbit Controls for Perspective
    const perspControls = new OrbitControls(perspCamera, canvasRef.current);
    perspControls.enableDamping = true;
    perspControls.dampingFactor = 0.05;

    // Orbit Controls for Orthographic cameras (pan & zoom only, no orbit)
    const topControls = new OrbitControls(topCamera, canvasRef.current);
    topControls.enableRotate = false;
    topControls.enableDamping = true;

    const frontControls = new OrbitControls(frontCamera, canvasRef.current);
    frontControls.enableRotate = false;
    frontControls.enableDamping = true;

    const sideControls = new OrbitControls(sideCamera, canvasRef.current);
    sideControls.enableRotate = false;
    sideControls.enableDamping = true;

    controlsRef.current = {
      perspective: perspControls,
      top: topControls,
      front: frontControls,
      side: sideControls,
    };

    // Animation Loop with Quad View support
    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      if (!rendererRef.current || !sceneRef.current || !camerasRef.current || !controlsRef.current) return;

      const activeRenderer = rendererRef.current;
      const activeScene = sceneRef.current;
      const { perspective, top, front, side } = camerasRef.current;
      const controls = controlsRef.current;

      controls.perspective.update();
      controls.top.update();
      controls.front.update();
      controls.side.update();

      const w = containerRef.current?.clientWidth || width;
      const h = containerRef.current?.clientHeight || height;

      if (viewportMode === 'quad') {
        // Render 4 Quad Viewports with WebGL Scissor
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);

        activeRenderer.setScissorTest(true);

        // 1. Top-Left: Perspective 3D
        activeRenderer.setViewport(0, halfH, halfW, halfH);
        activeRenderer.setScissor(0, halfH, halfW, halfH);
        activeRenderer.setClearColor(0x0f172a);
        perspective.aspect = halfW / halfH;
        perspective.updateProjectionMatrix();
        activeRenderer.render(activeScene, perspective);

        // 2. Top-Right: Top View (XZ)
        activeRenderer.setViewport(halfW, halfH, halfW, halfH);
        activeRenderer.setScissor(halfW, halfH, halfW, halfH);
        activeRenderer.setClearColor(0x090d16);
        const topAspect = halfW / halfH;
        top.left = (-frustumSize * topAspect) / 2;
        top.right = (frustumSize * topAspect) / 2;
        top.top = frustumSize / 2;
        top.bottom = -frustumSize / 2;
        top.updateProjectionMatrix();
        activeRenderer.render(activeScene, top);

        // 3. Bottom-Left: Front View (XY)
        activeRenderer.setViewport(0, 0, halfW, halfH);
        activeRenderer.setScissor(0, 0, halfW, halfH);
        activeRenderer.setClearColor(0x090d16);
        const frontAspect = halfW / halfH;
        front.left = (-frustumSize * frontAspect) / 2;
        front.right = (frustumSize * frontAspect) / 2;
        front.top = frustumSize / 2;
        front.bottom = -frustumSize / 2;
        front.updateProjectionMatrix();
        activeRenderer.render(activeScene, front);

        // 4. Bottom-Right: Side View (ZY)
        activeRenderer.setViewport(halfW, 0, halfW, halfH);
        activeRenderer.setScissor(halfW, 0, halfW, halfH);
        activeRenderer.setClearColor(0x0b1120);
        const sideAspect = halfW / halfH;
        side.left = (-frustumSize * sideAspect) / 2;
        side.right = (frustumSize * sideAspect) / 2;
        side.top = frustumSize / 2;
        side.bottom = -frustumSize / 2;
        side.updateProjectionMatrix();
        activeRenderer.render(activeScene, side);

        activeRenderer.setScissorTest(false);
      } else {
        // Single Active Camera
        activeRenderer.setScissorTest(false);
        activeRenderer.setViewport(0, 0, w, h);
        activeRenderer.setClearColor(0x0f172a);

        let activeCamera: THREE.Camera = perspective;
        if (viewportMode === 'perspective') {
          perspective.aspect = w / h;
          perspective.updateProjectionMatrix();
          activeCamera = perspective;
        } else {
          const orthoAspect = w / h;
          let orthoCam = top;
          if (viewportMode === 'front_xz') orthoCam = front;
          if (viewportMode === 'side_yz') orthoCam = side;

          orthoCam.left = (-frustumSize * orthoAspect) / 2;
          orthoCam.right = (frustumSize * orthoAspect) / 2;
          orthoCam.top = frustumSize / 2;
          orthoCam.bottom = -frustumSize / 2;
          orthoCam.updateProjectionMatrix();
          activeCamera = orthoCam;
        }

        activeRenderer.render(activeScene, activeCamera);
      }
    };

    render();

    // Resize Observer for responsive canvas
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && rendererRef.current) {
          rendererRef.current.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [viewportMode]);

  // Dynamic Grid and Surface Plane updates
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clean previous grid
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      gridHelperRef.current.geometry.dispose();
      if (Array.isArray(gridHelperRef.current.material)) {
        gridHelperRef.current.material.forEach((m) => m.dispose());
      } else {
        (gridHelperRef.current.material as THREE.Material).dispose();
      }
      gridHelperRef.current = null;
    }

    // Clean previous surface plane
    if (surfacePlaneRef.current) {
      scene.remove(surfacePlaneRef.current);
      surfacePlaneRef.current.geometry.dispose();
      if (Array.isArray(surfacePlaneRef.current.material)) {
        surfacePlaneRef.current.material.forEach((m) => m.dispose());
      } else {
        (surfacePlaneRef.current.material as THREE.Material).dispose();
      }
      surfacePlaneRef.current = null;
    }

    // Create new grid if enabled
    if (showGrid) {
      const divisions = Math.max(4, Math.round(activeSurfaceSize));
      const grid = new THREE.GridHelper(activeSurfaceSize, divisions, 0x38bdf8, 0x1e293b);
      grid.position.y = 0;
      scene.add(grid);
      gridHelperRef.current = grid;
    }

    // Create new ground surface plane if enabled
    if (activeShowSurfacePlane) {
      const planeGeom = new THREE.PlaneGeometry(activeSurfaceSize, activeSurfaceSize);
      const planeMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(planeGeom, planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.01;
      scene.add(plane);
      surfacePlaneRef.current = plane;
    }
  }, [activeSurfaceSize, showGrid, activeShowSurfacePlane]);

  // Update visibility of axes
  useEffect(() => {
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
  }, [showAxes]);

  // Re-build 3D objects when points, polygons, or selection changes
  useEffect(() => {
    const group = dynamicObjectsGroupRef.current;
    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ('geometry' in child && (child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
      if ('material' in child) {
        const mat = (child as THREE.Mesh | THREE.Sprite).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ('map' in m && m.map) (m.map as THREE.Texture).dispose();
            m.dispose();
          });
        } else if (mat) {
          if ('map' in mat && mat.map) (mat.map as THREE.Texture).dispose();
          mat.dispose();
        }
      }
    }

    const pointsMap = new Map<string, Point3D>(points.map((p) => [p.id, p]));

    // 1. Draw Polygons & Faces
    polygons.forEach((poly) => {
      const validPoints = poly.vertexIds
        .map((id) => pointsMap.get(id))
        .filter((p): p is Point3D => p !== undefined);

      if (validPoints.length < 3) return;

      const isSelected = poly.id === selectedPolygonId;
      const analysis = analyzePolygonPlanarity(poly, pointsMap);
      const isPlanar = analysis.isPlanar;
      const isWarped = analysis.status === 'warped';

      // Face & Edge color logic:
      // 1. If polygon has planarity error or torsion -> RED (0xef4444) for error checking
      // 2. Otherwise (planar/valid) -> user chosen poly.color OR default GREEN (0x10b981)
      let faceColor = 0x10b981; // Default Green
      let edgeColor = 0x34d399; // Default Green border
      let faceOpacity = 0.38;

      if (!isPlanar) {
        // Non-planar or torsion error: strictly RED
        faceColor = 0xef4444;
        edgeColor = 0xef4444;
        faceOpacity = 0.58;
      } else if (poly.color) {
        // Planar with custom user-assigned color
        try {
          faceColor = new THREE.Color(poly.color).getHex();
          edgeColor = new THREE.Color(poly.color).getHex();
          faceOpacity = 0.50;
        } catch {
          faceColor = 0x10b981;
          edgeColor = 0x34d399;
        }
      } else {
        // Planar default: Green
        faceColor = 0x10b981;
        edgeColor = 0x34d399;
        faceOpacity = 0.38;
      }

      if (isSelected) {
        faceOpacity = Math.min(1.0, faceOpacity + 0.3);
      }

      // Build face mesh geometry using triangulation for rendering
      const subTriangles = triangulatePolygon(poly, pointsMap);
      const triGeom = new THREE.BufferGeometry();
      const positions: number[] = [];

      subTriangles.forEach((subTri) => {
        const v0 = pointsMap.get(subTri.vertexIds[0]);
        const v1 = pointsMap.get(subTri.vertexIds[1]);
        const v2 = pointsMap.get(subTri.vertexIds[2]);
        if (v0 && v1 && v2) {
          positions.push(v0.x, v0.y, v0.z);
          positions.push(v1.x, v1.y, v1.z);
          positions.push(v2.x, v2.y, v2.z);
        }
      });

      triGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      triGeom.computeVertexNormals();

      const faceMaterial = new THREE.MeshStandardMaterial({
        color: faceColor,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: faceOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const faceMesh = new THREE.Mesh(triGeom, faceMaterial);
      faceMesh.userData = { type: 'polygon', polygonId: poly.id };
      group.add(faceMesh);

      // 2. Draw Polygon Outer Wireframe Edges
      const edgePoints: THREE.Vector3[] = [];
      validPoints.forEach((p) => edgePoints.push(new THREE.Vector3(p.x, p.y, p.z)));
      // Close loop
      edgePoints.push(new THREE.Vector3(validPoints[0].x, validPoints[0].y, validPoints[0].z));

      const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePoints);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xfacc15 : edgeColor,
        linewidth: isSelected ? 3 : 1.5,
        transparent: true,
        opacity: isSelected ? 1.0 : 0.85,
      });
      const edgeLine = new THREE.Line(edgeGeom, edgeMat);
      edgeLine.userData = { type: 'polygon', polygonId: poly.id };
      group.add(edgeLine);

      // If polygon has torsion (split triangles), draw the internal fold/diagonal edge as dashed or faint line
      if (poly.vertexIds.length >= 4 && !isPlanar) {
        subTriangles.forEach((st) => {
          const stPts = st.vertexIds
            .map((id) => pointsMap.get(id))
            .filter((p): p is Point3D => p !== undefined);
          if (stPts.length === 3) {
            const innerEdgePoints = [
              new THREE.Vector3(stPts[0].x, stPts[0].y, stPts[0].z),
              new THREE.Vector3(stPts[1].x, stPts[1].y, stPts[1].z),
              new THREE.Vector3(stPts[2].x, stPts[2].y, stPts[2].z),
              new THREE.Vector3(stPts[0].x, stPts[0].y, stPts[0].z),
            ];
            const innerEdgeGeom = new THREE.BufferGeometry().setFromPoints(innerEdgePoints);
            const innerEdgeMat = new THREE.LineDashedMaterial({
              color: 0xef4444,
              dashSize: 0.2,
              gapSize: 0.1,
              transparent: true,
              opacity: 0.8,
            });
            const innerLine = new THREE.Line(innerEdgeGeom, innerEdgeMat);
            group.add(innerLine);
          }
        });
      }
    });

    // 3. Draw Best-Fit Reference Plane & Deviation Lines for Selected Non-Planar Polygon
    if (selectedPolygonId && showBestFitPlane) {
      const poly = polygons.find((p) => p.id === selectedPolygonId);
      if (poly && poly.vertexIds.length >= 4) {
        const analysis = analyzePolygonPlanarity(poly, pointsMap);
        if (!analysis.isPlanar) {
          const { normal, planeCenter, projectedPoints } = analysis;
          const centerVec = new THREE.Vector3(planeCenter.x, planeCenter.y, planeCenter.z);
          const normVec = new THREE.Vector3(normal.x, normal.y, normal.z);

          // Draw Best-Fit plane visual disc/quad
          const planeSize = Math.max(3, analysis.maxDeviation * 4 + 2);
          const planeGeom = new THREE.PlaneGeometry(planeSize, planeSize);
          const planeMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const planeMesh = new THREE.Mesh(planeGeom, planeMat);

          // Orient plane to match normal
          const defaultNormal = new THREE.Vector3(0, 0, 1);
          planeMesh.quaternion.setFromUnitVectors(defaultNormal, normVec);
          planeMesh.position.copy(centerVec);
          group.add(planeMesh);

          // Draw Normal Vector Arrow
          const arrowHelper = new THREE.ArrowHelper(normVec, centerVec, 1.5, 0x38bdf8, 0.4, 0.2);
          group.add(arrowHelper);

          // Draw Perpendicular Deviation Lines from vertices to plane
          for (const proj of projectedPoints) {
            const orig = pointsMap.get(proj.id);
            if (orig) {
              const linePoints = [
                new THREE.Vector3(orig.x, orig.y, orig.z),
                new THREE.Vector3(proj.x, proj.y, proj.z),
              ];
              const devGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
              const devMat = new THREE.LineBasicMaterial({
                color: 0xef4444,
                linewidth: 2,
              });
              const devLine = new THREE.Line(devGeom, devMat);
              group.add(devLine);

              // Small projection anchor mark on the plane
              const anchorGeom = new THREE.SphereGeometry(0.06, 8, 8);
              const anchorMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
              const anchorMesh = new THREE.Mesh(anchorGeom, anchorMat);
              anchorMesh.position.set(proj.x, proj.y, proj.z);
              group.add(anchorMesh);
            }
          }
        }
      }
    }

    // 4. Draw Vertex Spheres
    const sphereRadius = 0.14;
    const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);

    points.forEach((pt) => {
      const isSelected = pt.id === selectedPointId;
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xf59e0b : 0xe2e8f0,
        emissive: isSelected ? 0xd97706 : 0x1e293b,
        roughness: 0.2,
        metalness: 0.5,
      });

      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.set(pt.x, pt.y, pt.z);
      sphere.userData = { type: 'point', pointId: pt.id, pointName: pt.name };
      group.add(sphere);

      // Selected halo ring
      if (isSelected) {
        const ringGeom = new THREE.RingGeometry(0.22, 0.28, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(pt.x, pt.y, pt.z);
        ring.lookAt(8, 8, 10);
        group.add(ring);
      }

      // 3D Point Name Billboard Label
      if (showLabels) {
        const labelSprite = createPointLabelSprite(pt.name, isSelected, activeLabelScale);
        labelSprite.position.set(pt.x, pt.y + 0.18 + 0.18 * activeLabelScale, pt.z);
        group.add(labelSprite);
      }
    });
  }, [points, polygons, selectedPointId, selectedPolygonId, showBestFitPlane, showLabels, activeLabelScale]);

  // Handle Raycasting Pointer Click
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !camerasRef.current || !rendererRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    mousePosRef.current.set(x, y);

    // Pick camera based on viewport mode
    let camera: THREE.Camera = camerasRef.current.perspective;
    if (viewportMode === 'top_xy') camera = camerasRef.current.top;
    if (viewportMode === 'front_xz') camera = camerasRef.current.front;
    if (viewportMode === 'side_yz') camera = camerasRef.current.side;

    raycasterRef.current.setFromCamera(mousePosRef.current, camera);
    const intersects = raycasterRef.current.intersectObjects(dynamicObjectsGroupRef.current.children, true);

    if (intersects.length > 0) {
      // Prioritize point clicks over face clicks
      const pointHit = intersects.find((hit) => hit.object.userData?.type === 'point');
      if (pointHit) {
        const pId = pointHit.object.userData.pointId;
        onSelectPoint(pId);
        return;
      }

      const polyHit = intersects.find((hit) => hit.object.userData?.type === 'polygon');
      if (polyHit) {
        const polyId = polyHit.object.userData.polygonId;
        onSelectPolygon(polyId);
        return;
      }
    } else {
      // Clicked background: deselect
      onSelectPoint(null);
      onSelectPolygon(null);
    }
  };

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    if (!camerasRef.current || !controlsRef.current) return;
    const { perspective, top, front, side } = camerasRef.current;
    const controls = controlsRef.current;

    perspective.position.set(8, 8, 10);
    perspective.lookAt(0, 0, 0);
    controls.perspective.target.set(0, 0, 0);
    controls.perspective.update();

    top.position.set(0, 30, 0);
    top.lookAt(0, 0, 0);
    controls.top.target.set(0, 0, 0);
    controls.top.update();

    front.position.set(0, 0, 30);
    front.lookAt(0, 0, 0);
    controls.front.target.set(0, 0, 0);
    controls.front.update();

    side.position.set(30, 0, 0);
    side.lookAt(0, 0, 0);
    controls.side.target.set(0, 0, 0);
    controls.side.update();
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none" ref={containerRef}>
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Viewport Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-700/60 rounded-lg p-1 shadow-lg pointer-events-auto">
          <button
            onClick={() => setViewportMode('perspective')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewportMode === 'perspective'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Vista 3D Prospettica con orbita libera"
          >
            <Rotate3d className="w-3.5 h-3.5" />
            <span>3D Libera</span>
          </button>

          <button
            onClick={() => setViewportMode('top_xy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewportMode === 'top_xy'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Vista Ortogonale dall'alto (Piano X-Z)"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            <span>Alto (X-Z)</span>
          </button>

          <button
            onClick={() => setViewportMode('front_xz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewportMode === 'front_xz'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Vista Ortogonale Frontale (Piano X-Y)"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            <span>Fronte (X-Y)</span>
          </button>

          <button
            onClick={() => setViewportMode('side_yz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewportMode === 'side_yz'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Vista Ortogonale Laterale (Piano Z-Y)"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span>Fianco (Z-Y)</span>
          </button>

          <button
            onClick={() => setViewportMode('quad')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewportMode === 'quad'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Vista CAD 4 Riquadri: 3D + 3 Assi Ortogonali contemporanei"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>4 Viste CAD</span>
          </button>
        </div>

        {/* Right: Display Overlays & Camera Reset */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/60 rounded-lg p-1 shadow-lg pointer-events-auto">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 ${
              showGrid ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Mostra / Nascondi Griglia"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowAxes(!showAxes)}
            className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 ${
              showAxes ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Mostra / Nascondi Assi Cartesiani (X: Rosso, Y: Verde, Z: Blu)"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2 py-1 rounded-md transition-colors text-xs flex items-center gap-1.5 ${
              showLabels ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-white'
            }`}
            title="Mostra / Nascondi Nomi dei Punti nella vista 3D"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nomi Punti</span>
          </button>

          <button
            onClick={() => setShowBestFitPlane(!showBestFitPlane)}
            className={`p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 ${
              showBestFitPlane ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Mostra / Nascondi Piano di Riferimento Planarità & Vettori Scostamento"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetCamera}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
            title="Ripristina Posizione Telecamera"
          >
            Centra Vista
          </button>

          <div className="w-[1px] h-3.5 bg-slate-700/60 my-auto" />

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              isSettingsOpen
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Regola dimensioni superficie di lavoro ed etichette punti"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Impostazioni</span>
          </button>
        </div>
      </div>

      {/* Floating Settings Popover */}
      {isSettingsOpen && (
        <div className="absolute top-14 right-3 z-30 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl text-slate-100 flex flex-col gap-3.5 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">Impostazioni Superficie & Etichette</span>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Dimensione Superficie di Lavoro (Griglia) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Dimensioni Superficie:</span>
              <span className="font-mono text-sky-400 font-semibold tabular-nums">{activeSurfaceSize} unità</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={activeSurfaceSize}
              onChange={(e) => handleUpdateSurfaceSize(parseFloat(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center gap-1.5 pt-0.5">
              {[15, 30, 60, 100].map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleUpdateSurfaceSize(sz)}
                  className={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${
                    activeSurfaceSize === sz
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz}u
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={activeShowSurfacePlane}
                onChange={handleToggleSurfacePlane}
                className="accent-sky-500 rounded"
              />
              <span>Piano d&apos;appoggio superficie semitrasparente</span>
            </label>
          </div>

          {/* 2. Dimensione Etichette Punti */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Dimensione Etichette Nomi:</span>
              <span className="font-mono text-sky-400 font-semibold tabular-nums">{Math.round(activeLabelScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={activeLabelScale}
              onChange={(e) => handleUpdateLabelScale(parseFloat(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center gap-1.5 pt-0.5">
              {[
                { label: 'Piccole', val: 0.6 },
                { label: 'Standard', val: 1.0 },
                { label: 'Grandi', val: 1.6 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleUpdateLabelScale(opt.val)}
                  className={`flex-1 py-1 text-[10px] rounded transition-colors ${
                    Math.abs(activeLabelScale - opt.val) < 0.1
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Quad View Overlay Labels */}
      {viewportMode === 'quad' && (
        <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2">
          {/* Top-Left: 3D Perspective */}
          <div className="border-r border-b border-slate-700/50 p-2 flex items-start justify-between">
            <span className="text-[11px] font-mono font-medium text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
              3D Prospettica (Orbita)
            </span>
          </div>

          {/* Top-Right: Top (XZ) */}
          <div className="border-b border-slate-700/50 p-2 flex items-start justify-between">
            <span className="text-[11px] font-mono font-medium text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
              Pianta / Top (Piano X-Z)
            </span>
          </div>

          {/* Bottom-Left: Front (XY) */}
          <div className="border-r border-slate-700/50 p-2 flex items-start justify-between">
            <span className="text-[11px] font-mono font-medium text-sky-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
              Prospetto / Front (Piano X-Y)
            </span>
          </div>

          {/* Bottom-Right: Side (ZY) */}
          <div className="p-2 flex items-start justify-between">
            <span className="text-[11px] font-mono font-medium text-rose-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
              Fianco / Side (Piano Z-Y)
            </span>
          </div>
        </div>
      )}

      {/* Selected Non-Planar Polygon Floating Action Bar */}
      {selectedPoly && selectedAnalysis && !selectedAnalysis.isPlanar && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-20 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3.5 shadow-2xl text-slate-100">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 truncate">
                  Poligono non planare: {selectedPoly.name}
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {selectedPoly.vertexIds.length} vertici
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Scostamento max: <strong className="text-amber-400">{selectedAnalysis.maxDeviation.toFixed(3)} u</strong> · Torsione: <strong className="text-amber-400">{selectedAnalysis.torsionAngleDeg.toFixed(1)}°</strong>
              </p>
            </div>
          </div>

          {/* Action buttons suggested by user brief */}
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => onAutoFixPolygon(selectedPoly.id, 'triangulate')}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              title="Spezza in triangoli planari conservando la geometria esatta dei vertici 3D"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Triangola (Mantieni 3D)</span>
            </button>

            <button
              onClick={() => onAutoFixPolygon(selectedPoly.id, 'project')}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              title="Proietta i vertici sul piano medio per rendere il poligono perfettamente piatto"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Proietta su Piano</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend & Navigation Info */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-4 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span>Asse X</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Asse Y (Alto)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
            <span>Asse Z</span>
          </span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">
          Trascina per ruotare · Shift + Trascina per spostare · Rotella per zoom
        </span>
      </div>
    </div>
  );
};
