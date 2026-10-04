import { Point3D, Polygon3D, PlanarityAnalysis, PolygonDiagnostics, MeshValidationError } from '../types/geometry';

export const DEFAULT_PLANARITY_TOLERANCE = 0.01; // e.g. 0.01 units
export const DEFAULT_TORSION_TOLERANCE_DEG = 1.0; // 1 degree threshold

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function subVec(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function addVec(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dotVec(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lenVec(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalizeVec(v: Vector3): Vector3 {
  const l = lenVec(v);
  if (l < 1e-10) return { x: 0, y: 1, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * Computes polygon normal using Newell's Method.
 * Works accurately for arbitrary non-self-intersecting 3D polygons.
 */
export function computeNewellNormal(points: Vector3[]): Vector3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const next = points[(i + 1) % n];

    nx += (curr.y - next.y) * (curr.z + next.z);
    ny += (curr.z - next.z) * (curr.x + next.x);
    nz += (curr.x - next.x) * (curr.y + next.y);
  }

  return normalizeVec({ x: nx, y: ny, z: nz });
}

/**
 * Calculates centroid of an array of 3D points.
 */
export function computeCentroid(points: Vector3[]): Vector3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  let sx = 0, sy = 0, sz = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sz += p.z;
  }
  return {
    x: sx / points.length,
    y: sy / points.length,
    z: sz / points.length,
  };
}

/**
 * Evaluates planarity and torsion of a polygon.
 */
export function analyzePolygonPlanarity(
  polygon: Polygon3D,
  pointsMap: Map<string, Point3D>,
  distTolerance = DEFAULT_PLANARITY_TOLERANCE,
  torsionToleranceDeg = DEFAULT_TORSION_TOLERANCE_DEG
): PlanarityAnalysis {
  const pts: (Point3D | undefined)[] = polygon.vertexIds.map((id) => pointsMap.get(id));
  const validPts = pts.filter((p): p is Point3D => p !== undefined);

  if (validPts.length < 3) {
    return {
      isPlanar: false,
      isTriangle: false,
      maxDeviation: 0,
      rmsDeviation: 0,
      torsionAngleDeg: 0,
      normal: { x: 0, y: 1, z: 0 },
      planeCenter: { x: 0, y: 0, z: 0 },
      projectedPoints: [],
      status: 'warped',
      warningMessage: 'Meno di 3 vertici validi',
    };
  }

  // Triangles are strictly and always planar by Euclidean definition
  if (validPts.length === 3) {
    const v0 = validPts[0];
    const v1 = validPts[1];
    const v2 = validPts[2];
    const e1 = subVec(v1, v0);
    const e2 = subVec(v2, v0);
    const n = normalizeVec(crossVec(e1, e2));
    const center = computeCentroid(validPts);

    return {
      isPlanar: true,
      isTriangle: true,
      maxDeviation: 0,
      rmsDeviation: 0,
      torsionAngleDeg: 0,
      normal: n,
      planeCenter: center,
      projectedPoints: validPts.map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z })),
      status: 'perfect',
    };
  }

  // Polygon with 4 or more vertices (Quad, Pentagon, etc.)
  const center = computeCentroid(validPts);
  const normal = computeNewellNormal(validPts);

  // Measure deviations from plane: (P - center) · normal
  let maxDev = 0;
  let sumSqDev = 0;
  const projectedPoints: { id: string; x: number; y: number; z: number }[] = [];

  for (const pt of validPts) {
    const diff = subVec(pt, center);
    const distToPlane = dotVec(diff, normal);
    const absDist = Math.abs(distToPlane);
    if (absDist > maxDev) maxDev = absDist;
    sumSqDev += absDist * absDist;

    // Projected point onto best-fit plane
    const proj = subVec(pt, scaleVec(normal, distToPlane));
    projectedPoints.push({ id: pt.id, x: proj.x, y: proj.y, z: proj.z });
  }

  const rmsDev = Math.sqrt(sumSqDev / validPts.length);

  // Compute maximum torsion angle between consecutive triangle facets
  let maxTorsionAngleDeg = 0;
  const triangleNormals: Vector3[] = [];

  for (let i = 0; i < validPts.length; i++) {
    const pA = validPts[i];
    const pB = validPts[(i + 1) % validPts.length];
    const pC = validPts[(i + 2) % validPts.length];
    const e1 = subVec(pB, pA);
    const e2 = subVec(pC, pA);
    const cr = crossVec(e1, e2);
    if (lenVec(cr) > 1e-8) {
      triangleNormals.push(normalizeVec(cr));
    }
  }

  if (triangleNormals.length >= 2) {
    for (let i = 0; i < triangleNormals.length; i++) {
      for (let j = i + 1; j < triangleNormals.length; j++) {
        const dot = Math.min(1, Math.max(-1, dotVec(triangleNormals[i], triangleNormals[j])));
        const angleRad = Math.acos(dot);
        const angleDeg = (angleRad * 180) / Math.PI;
        if (angleDeg > maxTorsionAngleDeg) {
          maxTorsionAngleDeg = angleDeg;
        }
      }
    }
  }

  const isDistPlanar = maxDev <= distTolerance;
  const isTorsionAcceptable = maxTorsionAngleDeg <= torsionToleranceDeg;
  const isPlanar = isDistPlanar && isTorsionAcceptable;

  let status: 'perfect' | 'tolerable' | 'warped' = 'perfect';
  let warningMessage: string | undefined;

  if (maxDev > distTolerance * 5 || maxTorsionAngleDeg > torsionToleranceDeg * 5) {
    status = 'warped';
    warningMessage = `Torsione elevata: deviazione max ${maxDev.toFixed(3)} u, angolo di svergolamento ${maxTorsionAngleDeg.toFixed(1)}°`;
  } else if (!isPlanar) {
    status = 'tolerable';
    warningMessage = `Lieve non-planarità: deviazione ${maxDev.toFixed(3)} u, torsione ${maxTorsionAngleDeg.toFixed(1)}°`;
  }

  return {
    isPlanar,
    isTriangle: false,
    maxDeviation: maxDev,
    rmsDeviation: rmsDev,
    torsionAngleDeg: maxTorsionAngleDeg,
    normal,
    planeCenter: center,
    projectedPoints,
    status,
    warningMessage,
  };
}

/**
 * Splits a polygon with >= 4 vertices into planar triangles (Fan / Ear-clipping)
 */
export function triangulatePolygon(
  polygon: Polygon3D,
  pointsMap: Map<string, Point3D>
): Polygon3D[] {
  const ids = polygon.vertexIds;
  if (ids.length <= 3) return [polygon];

  // For a quad (4 vertices), evaluate both diagonal splits [0,1,2] & [0,2,3] vs [1,2,3] & [1,3,0]
  // Choose the diagonal that creates more balanced triangles or minimizes perimeter difference
  if (ids.length === 4) {
    const p0 = pointsMap.get(ids[0]);
    const p1 = pointsMap.get(ids[1]);
    const p2 = pointsMap.get(ids[2]);
    const p3 = pointsMap.get(ids[3]);

    let d02 = 0;
    let d13 = 0;
    if (p0 && p2) d02 = lenVec(subVec(p0, p2));
    if (p1 && p3) d13 = lenVec(subVec(p1, p3));

    // Choose the shorter diagonal for better triangulation aspect ratio
    if (d13 > 0 && d13 < d02) {
      return [
        {
          id: `${polygon.id}_t1`,
          name: `${polygon.name} (T1)`,
          vertexIds: [ids[1], ids[2], ids[3]],
          color: polygon.color,
        },
        {
          id: `${polygon.id}_t2`,
          name: `${polygon.name} (T2)`,
          vertexIds: [ids[1], ids[3], ids[0]],
          color: polygon.color,
        },
      ];
    } else {
      return [
        {
          id: `${polygon.id}_t1`,
          name: `${polygon.name} (T1)`,
          vertexIds: [ids[0], ids[1], ids[2]],
          color: polygon.color,
        },
        {
          id: `${polygon.id}_t2`,
          name: `${polygon.name} (T2)`,
          vertexIds: [ids[0], ids[2], ids[3]],
          color: polygon.color,
        },
      ];
    }
  }

  // Fan triangulation from vertex 0 for N > 4
  const result: Polygon3D[] = [];
  for (let i = 1; i < ids.length - 1; i++) {
    result.push({
      id: `${polygon.id}_t${i}`,
      name: `${polygon.name} (T${i})`,
      vertexIds: [ids[0], ids[i], ids[i + 1]],
      color: polygon.color,
    });
  }
  return result;
}

/**
 * Runs complete mesh validation and diagnoses all errors.
 */
export function validateMesh(
  points: Point3D[],
  polygons: Polygon3D[],
  tolerance = DEFAULT_PLANARITY_TOLERANCE,
  torsionToleranceDeg = DEFAULT_TORSION_TOLERANCE_DEG
): {
  errors: MeshValidationError[];
  polygonDiagnostics: PolygonDiagnostics[];
  orphanPoints: Point3D[];
  nonPlanarCount: number;
} {
  const pointsMap = new Map<string, Point3D>(points.map((p) => [p.id, p]));
  const usedPointIds = new Set<string>();
  const errors: MeshValidationError[] = [];
  const polygonDiagnostics: PolygonDiagnostics[] = [];
  let nonPlanarCount = 0;

  // Validate each polygon
  polygons.forEach((poly, polyIdx) => {
    const issues: string[] = [];

    // Check vertex count
    if (poly.vertexIds.length < 3) {
      const err: MeshValidationError = {
        id: `err_deg_${poly.id}`,
        type: 'degenerate',
        severity: 'error',
        message: `Il poligono "${poly.name || `P#${polyIdx + 1}`}" ha meno di 3 vertici (${poly.vertexIds.length}).`,
        polygonId: poly.id,
        actionSuggestion: 'Aggiungi vertici o elimina il poligono degenere.',
      };
      errors.push(err);
      issues.push(err.message);
    }

    // Check duplicate consecutive vertices in same polygon
    const setOfVerts = new Set(poly.vertexIds);
    if (setOfVerts.size < poly.vertexIds.length) {
      const err: MeshValidationError = {
        id: `err_dup_${poly.id}`,
        type: 'degenerate',
        severity: 'warning',
        message: `Il poligono "${poly.name}" contiene vertici duplicati nella stessa faccia.`,
        polygonId: poly.id,
        actionSuggestion: 'Rimuovi i vertici duplicati.',
      };
      errors.push(err);
      issues.push(err.message);
    }

    // Check existence of referenced vertices
    for (const vid of poly.vertexIds) {
      if (!pointsMap.has(vid)) {
        const err: MeshValidationError = {
          id: `err_missing_${poly.id}_${vid}`,
          type: 'invalid_index',
          severity: 'error',
          message: `Il poligono "${poly.name}" fa riferimento al vertice mancante ID: ${vid}.`,
          polygonId: poly.id,
          pointId: vid,
          actionSuggestion: 'Verifica la lista dei punti o ridefinisci i vertici del poligono.',
        };
        errors.push(err);
        issues.push(err.message);
      } else {
        usedPointIds.add(vid);
      }
    }

    // Analyze planarity and torsion
    const analysis = analyzePolygonPlanarity(poly, pointsMap, tolerance, torsionToleranceDeg);

    if (!analysis.isPlanar && poly.vertexIds.length >= 4) {
      nonPlanarCount++;
      const isSevere = analysis.status === 'warped';
      const err: MeshValidationError = {
        id: `err_planar_${poly.id}`,
        type: 'non_planar',
        severity: isSevere ? 'error' : 'warning',
        message: `Poligono "${poly.name}" non planare: deviazione max ${analysis.maxDeviation.toFixed(3)} u, torsione ${analysis.torsionAngleDeg.toFixed(1)}°.`,
        polygonId: poly.id,
        actionSuggestion: 'Scegli se mantenere la forma voluta (triangola), proiettare i punti sul piano medio o modificare le coordinate dei vertici.',
      };
      errors.push(err);
      issues.push(err.message);
    }

    polygonDiagnostics.push({
      polygonId: poly.id,
      polygonName: poly.name,
      vertexCount: poly.vertexIds.length,
      analysis,
      issues,
    });
  });

  // Check orphan points (points defined in space but not belonging to any polygon)
  const orphanPoints: Point3D[] = [];
  for (const pt of points) {
    if (!usedPointIds.has(pt.id)) {
      orphanPoints.push(pt);
    }
  }

  if (orphanPoints.length > 0) {
    errors.push({
      id: 'err_orphans',
      type: 'orphan_point',
      severity: 'info',
      message: `${orphanPoints.length} punti non appartengono ad alcun poligono (${orphanPoints.map((p) => p.name).slice(0, 5).join(', ')}${orphanPoints.length > 5 ? '...' : ''}).`,
      actionSuggestion: 'Puoi collegarli a nuovi poligoni oppure rimuoverli.',
    });
  }

  return {
    errors,
    polygonDiagnostics,
    orphanPoints,
    nonPlanarCount,
  };
}
