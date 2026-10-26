/** Autonomous movement stays inside a 12 × 6 px area around its anchor. */
export function compactFlightPose(time: number, anchorX: number, anchorY: number) {
  return {
    x: anchorX + Math.sin(time * 0.00065) * 6,
    y: anchorY + Math.sin(time * 0.0011) * 3,
    yaw: Math.sin(time * 0.0007) * 0.08,
    pitch: Math.sin(time * 0.0009) * 0.04,
    bank: Math.sin(time * 0.00065) * 1.2,
  };
}
