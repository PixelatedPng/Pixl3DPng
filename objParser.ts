import { Point3D, Polygon3D } from '../types/geometry';
import { triangulatePolygon } from './geometryMath';

export interface ExportObjOptions {
  triangulateAll?: boolean;
  includeNormals?: boolean;
  modelName?: string;
}

/**
 * Generates Wavefront OBJ text from points and polygons.
 */
export function exportToOBJ(
  points: Point3D[],
  polygons: Polygon3D[],
  options: ExportObjOptions = {}
): string {
  const { triangulateAll = false, includeNormals = true, modelName = 'Pixelated3DPng_Model' } = options;

  const pointsMap = new Map<string, Point3D>(points.map((p) => [p.id, p]));
  const pointIndexMap = new Map<string, number>();

  const lines: string[] = [];
  lines.push(`# Wavefront OBJ File`);
  lines.push(`# Created by Pixelated3DPng`);
  lines.push(`# Model: ${modelName}`);
  lines.push(`# Vertices: ${points.length}`);
  lines.push(`# Polygons: ${polygons.length}`);
  lines.push(`o ${modelName.replace(/\s+/g, '_')}`);
  lines.push(``);

  // Write Vertices (1-indexed in OBJ standard)
  points.forEach((pt, index) => {
    pointIndexMap.set(pt.id, index + 1);
    lines.push(`v ${pt.x.toFixed(6)} ${pt.y.toFixed(6)} ${pt.z.toFixed(6)}`);
  });

  lines.push(``);

  // Process polygons
  let targetPolygons: Polygon3D[] = polygons;
  if (triangulateAll) {
    targetPolygons = polygons.flatMap((poly) => triangulatePolygon(poly, pointsMap));
  }

  // Calculate face normals if requested
  if (includeNormals) {
    targetPolygons.forEach((poly) => {
      const v0 = pointsMap.get(poly.vertexIds[0]);
      const v1 = pointsMap.get(poly.vertexIds[1]);
      const v2 = pointsMap.get(poly.vertexIds[2]);
      if (v0 && v1 && v2) {
        const ax = v1.x - v0.x;
        const ay = v1.y - v0.y;
        const az = v1.z - v0.z;
        const bx = v2.x - v0.x;
        const by = v2.y - v0.y;
        const bz = v2.z - v0.z;
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        lines.push(`vn ${(nx / len).toFixed(6)} ${(ny / len).toFixed(6)} ${(nz / len).toFixed(6)}`);
      } else {
        lines.push(`vn 0.000000 1.000000 0.000000`);
      }
    });
    lines.push(``);
  }

  // Write faces
  targetPolygons.forEach((poly, polyIndex) => {
    const validIdxs = poly.vertexIds
      .map((id) => pointIndexMap.get(id))
      .filter((idx): idx is number => idx !== undefined);

    if (validIdxs.length >= 3) {
      if (includeNormals) {
        const normalIdx = polyIndex + 1;
        const faceStr = validIdxs.map((idx) => `${idx}//${normalIdx}`).join(' ');
        lines.push(`f ${faceStr}`);
      } else {
        lines.push(`f ${validIdxs.join(' ')}`);
      }
    }
  });

  return lines.join('\n');
}

/**
 * Downloads a string content as a file in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParseResult {
  points: Point3D[];
  polygons: Polygon3D[];
  errors: string[];
}

/**
 * Robust bulk parser capable of parsing OBJ files, CSV coordinates, or custom XYZ / Face lists.
 */
export function parseBulkInput(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const points: Point3D[] = [];
  const polygons: Polygon3D[] = [];
  const errors: string[] = [];

  // Temporary list to map 1-based index (for OBJ format) or 0-based index
  const importedPointsByIndex: string[] = [];
  let isObjFormat = false;

  // First pass: detect if format has standard OBJ keywords ('v ', 'f ')
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('v ') || line.startsWith('f ')) {
      isObjFormat = true;
      break;
    }
  }

  if (isObjFormat) {
    // Standard OBJ parser
    lines.forEach((rawLine, lineNo) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const parts = line.split(/\s+/);
      const tag = parts[0];

      if (tag === 'v') {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          errors.push(`Riga ${lineNo + 1}: coordinate vertice non valide "${line}"`);
        } else {
          const ptId = `pt_${points.length + 1}`;
          points.push({
            id: ptId,
            name: `V${points.length + 1}`,
            x,
            y,
            z,
          });
          importedPointsByIndex.push(ptId);
        }
      } else if (tag === 'f') {
        // Face vertex format: v, v/vt, v//vn, or v/vt/vn
        const vTokens = parts.slice(1);
        const vertexIds: string[] = [];

        for (const token of vTokens) {
          const vIdxStr = token.split('/')[0];
          let vIdx = parseInt(vIdxStr, 10);
          if (isNaN(vIdx)) continue;

          // OBJ allows negative relative indices
          if (vIdx < 0) {
            vIdx = importedPointsByIndex.length + vIdx + 1;
          }

          // 1-based index to 0-based
          const pointId = importedPointsByIndex[vIdx - 1];
          if (pointId) {
            vertexIds.push(pointId);
          } else {
            errors.push(`Riga ${lineNo + 1}: vertice indice ${vIdx} non trovato`);
          }
        }

        if (vertexIds.length >= 3) {
          polygons.push({
            id: `poly_${polygons.length + 1}`,
            name: `Poligono ${polygons.length + 1}`,
            vertexIds,
          });
        }
      }
    });

    return { points, polygons, errors };
  }

  // Generic / CSV / Space-separated list parser
  // Checks if section starts with "POINTS:" or "VERTICES:" and "POLYGONS:" or "FACES:"
  let currentSection: 'auto' | 'points' | 'polygons' = 'auto';

  lines.forEach((rawLine, lineNo) => {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;

    const lower = line.toLowerCase();
    if (lower.startsWith('punti:') || lower.startsWith('points:') || lower.startsWith('vertices:')) {
      currentSection = 'points';
      return;
    }
    if (lower.startsWith('poligoni:') || lower.startsWith('polygons:') || lower.startsWith('facce:') || lower.startsWith('faces:')) {
      currentSection = 'polygons';
      return;
    }

    // Check for explicit polygon prefixes (e.g. "p 0 1 2" or "poly: 0, 1, 2" or "f 1 2 3")
    if (
      line.startsWith('p ') ||
      line.startsWith('f ') ||
      line.startsWith('poly ') ||
      currentSection === 'polygons'
    ) {
      let cleanLine = line;
      if (line.startsWith('p ') || line.startsWith('f ')) {
        cleanLine = line.substring(2).trim();
      } else if (line.startsWith('poly ')) {
        cleanLine = line.substring(5).trim();
      }

      // Split by comma or space
      const tokens = cleanLine.split(/[\s,]+/).filter((t) => t.length > 0);
      const vertexIds: string[] = [];

      for (const token of tokens) {
        // Can be index or point ID/name
        const num = parseInt(token, 10);
        if (!isNaN(num)) {
          // Check if matches 0-based or 1-based index
          if (num >= 0 && num < points.length) {
            vertexIds.push(points[num].id);
          } else if (num >= 1 && num <= points.length) {
            vertexIds.push(points[num - 1].id);
          } else {
            errors.push(`Riga ${lineNo + 1}: Indice vertice ${num} fuori intervallo [0..${points.length - 1}]`);
          }
        } else {
          // Try to match by point name or point ID
          const matched = points.find((p) => p.name.toLowerCase() === token.toLowerCase() || p.id === token);
          if (matched) {
            vertexIds.push(matched.id);
          } else {
            errors.push(`Riga ${lineNo + 1}: Punto "${token}" non riconosciuto`);
          }
        }
      }

      if (vertexIds.length >= 3) {
        polygons.push({
          id: `poly_${polygons.length + 1}`,
          name: `Poligono ${polygons.length + 1}`,
          vertexIds,
        });
      } else if (tokens.length > 0) {
        errors.push(`Riga ${lineNo + 1}: Un poligono richiede almeno 3 vertici validi`);
      }
      return;
    }

    // Parse as point (x, y, z or name, x, y, z)
    // Replace commas with spaces if separated by commas
    const parts = line.split(/[\s,]+/).filter((t) => t.length > 0);

    if (parts.length >= 3) {
      let name = `P${points.length + 1}`;
      let x = NaN;
      let y = NaN;
      let z = NaN;

      if (parts.length === 3) {
        x = parseFloat(parts[0]);
        y = parseFloat(parts[1]);
        z = parseFloat(parts[2]);
      } else if (parts.length >= 4) {
        // Check if first token is non-number (name)
        const testFirst = parseFloat(parts[0]);
        if (isNaN(testFirst)) {
          name = parts[0];
          x = parseFloat(parts[1]);
          y = parseFloat(parts[2]);
          z = parseFloat(parts[3]);
        } else {
          // It might be x y z with extra comment
          x = parseFloat(parts[0]);
          y = parseFloat(parts[1]);
          z = parseFloat(parts[2]);
        }
      }

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        points.push({
          id: `pt_${points.length + 1}`,
          name,
          x,
          y,
          z,
        });
      } else {
        errors.push(`Riga ${lineNo + 1}: Impossibile interpretare come punto o poligono: "${line}"`);
      }
    }
  });

  return { points, polygons, errors };
}
