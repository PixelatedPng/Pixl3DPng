export interface Point3D {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface Polygon3D {
  id: string;
  name: string;
  /** Array of Point3D ids in order of perimeter */
  vertexIds: string[];
  color?: string;
}

export interface PlanarityAnalysis {
  isPlanar: boolean;
  isTriangle: boolean;
  maxDeviation: number; // Max perpendicular distance of vertex to best-fit plane
  rmsDeviation: number; // Root mean square deviation
  torsionAngleDeg: number; // Max angular divergence between consecutive triangle normals
  normal: { x: number; y: number; z: number };
  planeCenter: { x: number; y: number; z: number };
  projectedPoints: { id: string; x: number; y: number; z: number }[];
  status: 'perfect' | 'tolerable' | 'warped';
  warningMessage?: string;
}

export interface PolygonDiagnostics {
  polygonId: string;
  polygonName: string;
  vertexCount: number;
  analysis: PlanarityAnalysis;
  issues: string[];
}

export interface MeshValidationError {
  id: string;
  type: 'non_planar' | 'torsion' | 'degenerate' | 'orphan_point' | 'invalid_index';
  severity: 'error' | 'warning' | 'info';
  message: string;
  polygonId?: string;
  pointId?: string;
  actionSuggestion?: string;
}

export type ViewportMode = 'perspective' | 'top_xy' | 'front_xz' | 'side_yz' | 'quad';
