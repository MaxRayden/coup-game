export interface SeatPosition {
  left: string;
  top: string;
}

export function seatPosition(index: number, total: number): SeatPosition {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const x = 50 + 42 * Math.cos(angle);
  const y = 50 + 40 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

export function returnCountText(required: number): string {
  if (required === 1) return "1 carta";
  return `${required} cartas`;
}
