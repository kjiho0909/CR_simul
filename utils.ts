
import { Point } from './types';

/**
 * Calculates a brachistochrone (cycloid) curve between two points.
 * Parametric equations for a cycloid starting at origin:
 * x = R(theta - sin(theta))
 * y = R(1 - cos(theta))
 */
export const getCycloidPoints = (start: Point, end: Point, segments: number = 100): Point[] => {
  const points: Point[] = [];
  
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  // We need to find R and theta_max that satisfy:
  // dx = R(theta - sin(theta))
  // dy = R(1 - cos(theta))
  // Dividing these gives: dx/dy = (theta - sin(theta)) / (1 - cos(theta))
  // We can solve this numerically or use an approximation for the game guide.
  
  // Simplified approximation for game visualization that maintains the characteristic 'dip'
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Cycloid usually goes from 0 to something like 2.5-3.5 radians for these ratios
    const theta = t * Math.PI * 1.1; 
    
    // Normalizing the cycloid shape to fit start and end
    const rawX = (theta - Math.sin(theta));
    const rawY = (1 - Math.cos(theta));
    
    const maxX = (Math.PI * 1.1 - Math.sin(Math.PI * 1.1));
    const maxY = (1 - Math.cos(Math.PI * 1.1));
    
    const px = start.x - (rawX / maxX) * dx;
    const py = start.y + (rawY / maxY) * dy;
    
    points.push({ x: px, y: py });
  }
  
  return points;
};
