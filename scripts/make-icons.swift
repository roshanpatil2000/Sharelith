// Draws Sharelith's app icons and splash logo: a coin split in two halves
// (a shared bill) in white, on a diagonal gradient.
// Run from the project root:  swift scripts/make-icons.swift
// Re-run after changing the design; outputs are committed.
import AppKit

func rgb(_ hex: Int) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
          blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}
// Teal into green.
let prod = (rgb(0x006970), rgb(0x2BB673))
var colors = prod

enum Shape { case square, rounded, circle, none }

/// The split coin, centred, `r` = coin radius.
func drawMark(center c: NSPoint, r: CGFloat, background: Bool) {
  let gap = r * 0.12
  let lift = r * 0.10
  // Soft shadow under the halves on coloured backgrounds.
  let shadow = NSShadow()
  shadow.shadowColor = NSColor.black.withAlphaComponent(background ? 0.18 : 0)
  shadow.shadowOffset = NSSize(width: 0, height: -r * 0.05)
  shadow.shadowBlurRadius = r * 0.10
  NSGraphicsContext.saveGraphicsState()
  shadow.set()
  // Left half: solid white.
  let left = NSBezierPath()
  let lc = NSPoint(x: c.x - gap, y: c.y - lift / 2)
  left.move(to: NSPoint(x: lc.x, y: lc.y + r))
  left.appendArc(withCenter: lc, radius: r, startAngle: 90, endAngle: 270, clockwise: false)
  left.close()
  NSColor.white.setFill()
  left.fill()
  // Right half: lifted and slightly translucent, the share being passed on.
  let right = NSBezierPath()
  let rc = NSPoint(x: c.x + gap, y: c.y + lift / 2)
  right.move(to: NSPoint(x: rc.x, y: rc.y - r))
  right.appendArc(withCenter: rc, radius: r, startAngle: 270, endAngle: 90, clockwise: false)
  right.close()
  NSColor.white.withAlphaComponent(0.72).setFill()
  right.fill()
  NSGraphicsContext.restoreGraphicsState()
}

/// Renders a size×size PNG. `markScale` is the coin's diameter as a share of the size.
func render(_ path: String, size: Int, shape: Shape, markScale: CGFloat, background: Bool = true, alpha: Bool = true) {
  let s = CGFloat(size)
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let rect = NSRect(x: 0, y: 0, width: s, height: s)
  if background {
    let clip: NSBezierPath
    switch shape {
    case .square, .none: clip = NSBezierPath(rect: rect)
    case .rounded: clip = NSBezierPath(roundedRect: rect, xRadius: s * 0.2, yRadius: s * 0.2)
    case .circle: clip = NSBezierPath(ovalIn: rect)
    }
    NSGradient(starting: colors.0, ending: colors.1)!.draw(in: clip, angle: 45)
  }
  drawMark(center: NSPoint(x: s / 2, y: s / 2), r: s * markScale / 2, background: background)
  NSGraphicsContext.restoreGraphicsState()
  let url = URL(fileURLWithPath: path)
  try! FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  var png = rep.representation(using: .png, properties: [:])!
  if !alpha {
    // AppKit can't draw into an alpha-less bitmap, so flatten afterwards.
    let src = rep.cgImage!
    let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.draw(src, in: CGRect(x: 0, y: 0, width: size, height: size))
    png = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
  }
  try! png.write(to: url)
}

/// Adaptive background layer: the gradient alone, full bleed.
func renderBackground(_ path: String, size: Int) {
  let s = CGFloat(size)
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGradient(starting: colors.0, ending: colors.1)!.draw(in: NSRect(x: 0, y: 0, width: s, height: s), angle: 45)
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

do {
  let res = "android/app/src/main/res"
  colors = prod
  // Legacy launcher icons (Android 7 and older) and the adaptive layers.
  for (dpi, scale) in [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0), ("xxhdpi", 3.0), ("xxxhdpi", 4.0)] {
    render("\(res)/mipmap-\(dpi)/ic_launcher.png", size: Int(48 * scale), shape: .rounded, markScale: 0.52)
    render("\(res)/mipmap-\(dpi)/ic_launcher_round.png", size: Int(48 * scale), shape: .circle, markScale: 0.52)
    // 108dp canvas; the visible area is the middle 72dp (or a 66dp circle).
    render("\(res)/mipmap-\(dpi)/ic_launcher_foreground.png", size: Int(108 * scale), shape: .none, markScale: 0.36, background: false)
    renderBackground("\(res)/mipmap-\(dpi)/ic_launcher_background.png", size: Int(108 * scale))
  }
}
colors = prod
// iOS uses one 1024×1024 opaque icon; the system rounds the corners.
render("ios/Sharelith/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png", size: 1024, shape: .square, markScale: 0.52, alpha: false)
// Splash logo: the white mark on transparent, for react-native-bootsplash.
render("assets/bootsplash-logo.png", size: 1024, shape: .none, markScale: 0.6, background: false)
// In-app logo (Welcome and loading screens): the rounded icon at 3x of 96pt.
render("assets/app-logo.png", size: 288, shape: .rounded, markScale: 0.52)
print("Icons written.")
