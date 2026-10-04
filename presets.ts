import { Point3D, Polygon3D } from '../types/geometry';

export interface PresetModel {
  id: string;
  name: string;
  description: string;
  points: Point3D[];
  polygons: Polygon3D[];
}

export const PRESET_MODELS: PresetModel[] = [
  {
    id: 'warped_quad_demo',
    name: 'Demo Torsione & Non-Planarità',
    description: 'Quadrilatero con vertice sollevato (svergolamento) e triangoli adiacenti per testare la verifica e la correzione.',
    points: [
      { id: 'p1', name: 'P1', x: -2.0, y: 0.0, z: -2.0 },
      { id: 'p2', name: 'P2', x: 2.0, y: 0.0, z: -2.0 },
      { id: 'p3', name: 'P3', x: 2.5, y: 0.0, z: 2.0 },
      { id: 'p4', name: 'P4', x: -2.0, y: 1.8, z: 2.0 }, // Non-planar lifted vertex!
      { id: 'p5', name: 'P5', x: 0.0, y: 3.2, z: 0.0 }, // Apex
    ],
    polygons: [
      {
        id: 'poly_warped',
        name: 'Quad Svergolato (Non Planare)',
        vertexIds: ['p1', 'p2', 'p3', 'p4'],
        color: '#f59e0b',
      },
      {
        id: 'poly_tri1',
        name: 'Faccia Anteriore',
        vertexIds: ['p1', 'p2', 'p5'],
        color: '#38bdf8',
      },
      {
        id: 'poly_tri2',
        name: 'Faccia Laterale DX',
        vertexIds: ['p2', 'p3', 'p5'],
        color: '#10b981',
      },
    ],
  },
  {
    id: 'cube_mesh',
    name: 'Cubo Regolare (6 Quad Planari)',
    description: 'Cubo 3D con 8 vertici e 6 facce quadrangolari perfettamente planari.',
    points: [
      { id: 'c0', name: 'V0 (-1,-1,-1)', x: -1.5, y: -1.5, z: -1.5 },
      { id: 'c1', name: 'V1 (1,-1,-1)', x: 1.5, y: -1.5, z: -1.5 },
      { id: 'c2', name: 'V2 (1,1,-1)', x: 1.5, y: 1.5, z: -1.5 },
      { id: 'c3', name: 'V3 (-1,1,-1)', x: -1.5, y: 1.5, z: -1.5 },
      { id: 'c4', name: 'V4 (-1,-1,1)', x: -1.5, y: -1.5, z: 1.5 },
      { id: 'c5', name: 'V5 (1,-1,1)', x: 1.5, y: -1.5, z: 1.5 },
      { id: 'c6', name: 'V6 (1,1,1)', x: 1.5, y: 1.5, z: 1.5 },
      { id: 'c7', name: 'V7 (-1,1,1)', x: -1.5, y: 1.5, z: 1.5 },
    ],
    polygons: [
      { id: 'f_bottom', name: 'Faccia Inferiore', vertexIds: ['c0', 'c1', 'c5', 'c4'], color: '#64748b' },
      { id: 'f_top', name: 'Faccia Superiore', vertexIds: ['c3', 'c7', 'c6', 'c2'], color: '#38bdf8' },
      { id: 'f_front', name: 'Faccia Frontale', vertexIds: ['c4', 'c5', 'c6', 'c7'], color: '#10b981' },
      { id: 'f_back', name: 'Faccia Posteriore', vertexIds: ['c1', 'c0', 'c3', 'c2'], color: '#6366f1' },
      { id: 'f_left', name: 'Faccia Sinistra', vertexIds: ['c0', 'c4', 'c7', 'c3'], color: '#a855f7' },
      { id: 'f_right', name: 'Faccia Destra', vertexIds: ['c5', 'c1', 'c2', 'c6'], color: '#f59e0b' },
    ],
  },
  {
    id: 'pyramid',
    name: 'Piramide a Base Rettangolare',
    description: 'Struttura con base quadrangolare piana e quattro facce triangolari convergenti sul vertice superiore.',
    points: [
      { id: 'b0', name: 'B0', x: -2.0, y: 0.0, z: -2.0 },
      { id: 'b1', name: 'B1', x: 2.0, y: 0.0, z: -2.0 },
      { id: 'b2', name: 'B2', x: 2.0, y: 0.0, z: 2.0 },
      { id: 'b3', name: 'B3', x: -2.0, y: 0.0, z: 2.0 },
      { id: 'top', name: 'Apex', x: 0.0, y: 3.0, z: 0.0 },
    ],
    polygons: [
      { id: 'pyr_base', name: 'Base Rettangolare', vertexIds: ['b0', 'b1', 'b2', 'b3'], color: '#64748b' },
      { id: 'pyr_f1', name: 'Triangolo Nord', vertexIds: ['b0', 'b1', 'top'], color: '#38bdf8' },
      { id: 'pyr_f2', name: 'Triangolo Est', vertexIds: ['b1', 'b2', 'top'], color: '#10b981' },
      { id: 'pyr_f3', name: 'Triangolo Sud', vertexIds: ['b2', 'b3', 'top'], color: '#f59e0b' },
      { id: 'pyr_f4', name: 'Triangolo Ovest', vertexIds: ['b3', 'b0', 'top'], color: '#ec4899' },
    ],
  },
  {
    id: 'roof_pavilion',
    name: 'Falda Architettonica a Padiglione',
    description: 'Modello strutturale per architettura con falde inclinate e compluvi.',
    points: [
      { id: 'r0', name: 'Gronda SO', x: -3.0, y: 0.0, z: -2.0 },
      { id: 'r1', name: 'Gronda SE', x: 3.0, y: 0.0, z: -2.0 },
      { id: 'r2', name: 'Gronda NE', x: 3.0, y: 0.0, z: 2.0 },
      { id: 'r3', name: 'Gronda NO', x: -3.0, y: 0.0, z: 2.0 },
      { id: 'k0', name: 'Colmo Ovest', x: -1.5, y: 2.0, z: 0.0 },
      { id: 'k1', name: 'Colmo Est', x: 1.5, y: 2.0, z: 0.0 },
    ],
    polygons: [
      { id: 'rf_south', name: 'Falda Sud', vertexIds: ['r0', 'r1', 'k1', 'k0'], color: '#ef4444' },
      { id: 'rf_north', name: 'Falda Nord', vertexIds: ['k0', 'k1', 'r2', 'r3'], color: '#f59e0b' },
      { id: 'rf_west', name: 'Timpano Ovest', vertexIds: ['r3', 'r0', 'k0'], color: '#38bdf8' },
      { id: 'rf_east', name: 'Timpano Est', vertexIds: ['r1', 'r2', 'k1'], color: '#10b981' },
      { id: 'rf_floor', name: 'Solaio Base', vertexIds: ['r0', 'r3', 'r2', 'r1'], color: '#64748b' },
    ],
  },
];
