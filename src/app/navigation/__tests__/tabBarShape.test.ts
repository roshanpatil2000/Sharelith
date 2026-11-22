import { TAB_BAR, tabBarPath, tabCenters } from '../tabBarShape';

const edge = TAB_BAR.notch + TAB_BAR.shoulder + TAB_BAR.topRadius;

describe('floating tab bar shape', () => {
  it.each([296, 336, 378, 575])(
    'fits a whole notch at each end and 44pt targets (%s wide)',
    width => {
      const centers = tabCenters(width, 4);
      expect(centers[0]).toBe(edge);
      expect(centers[3]).toBeCloseTo(width - edge);
      expect(centers[1]! - centers[0]!).toBeGreaterThanOrEqual(44);
    },
  );

  it('moves the notch with the tab', () => {
    expect(tabBarPath(366, 100)).not.toBe(tabBarPath(366, 200));
  });

  it('keeps a spring overshoot inside the corners', () => {
    expect(tabBarPath(366, -20)).toBe(tabBarPath(366, edge));
    expect(tabBarPath(366, 500)).toBe(tabBarPath(366, 366 - edge));
  });
});
