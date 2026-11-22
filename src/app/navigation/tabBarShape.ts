/** The floating tab bar's measurements, in points. */
export const TAB_BAR = {
  height: 64,
  /** Space between the bar and the sides of the screen. */
  margin: 12,
  topRadius: 12,
  bottomRadius: 24,
  circle: 56,
  /** How far below the bar's top edge the circle's center sits. */
  circleCenter: 9,
  /** The notch's radius: the circle plus an even gap around it. */
  notch: 36,
  /** The rounded corners where the bar dips into the notch. */
  shoulder: 9,
} as const;

/** How far the circle rises above the bar. */
export const TAB_BAR_OVERHANG = TAB_BAR.circle / 2 - TAB_BAR.circleCenter;

/**
 * Center of each tab. The first and last are just far enough in for a whole
 * notch beside the bar's rounded corner; the rest are evenly between.
 */
export function tabCenters(width: number, count: number): number[] {
  const first = TAB_BAR.notch + TAB_BAR.shoulder + TAB_BAR.topRadius;
  const step = (width - 2 * first) / Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) => first + step * i);
}

/** SVG path of the bar with the notch centered at x. Runs on the UI thread. */
export function tabBarPath(width: number, center: number): string {
  'worklet';
  const {
    height: h,
    topRadius: top,
    bottomRadius: bottom,
    circleCenter: cy,
    notch: r,
    shoulder: s,
  } = TAB_BAR;
  // A spring can overshoot; the notch mustn't cross a corner.
  const edge = r + s + top;
  const x = Math.min(Math.max(center, edge), width - edge);
  return [
    `M${top} 0`,
    `H${x - r - s}`,
    `A${s} ${s} 0 0 1 ${x - r} ${cy}`,
    `A${r} ${r} 0 0 0 ${x + r} ${cy}`,
    `A${s} ${s} 0 0 1 ${x + r + s} 0`,
    `H${width - top}`,
    `Q${width} 0 ${width} ${top}`,
    `V${h - bottom}`,
    `Q${width} ${h} ${width - bottom} ${h}`,
    `H${bottom}`,
    `Q0 ${h} 0 ${h - bottom}`,
    `V${top}`,
    `Q0 0 ${top} 0`,
    'Z',
  ].join(' ');
}
