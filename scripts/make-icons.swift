// Draws Sharelith's app icons and splash logo: a white "S" on teal.
// Run from the project root:  swift scripts/make-icons.swift
// Re-run after changing the colour or letter; outputs are committed.
import AppKit

let teal = NSColor(srgbRed: 0x00 / 255, green: 0x83 / 255, blue: 0x8A / 255, alpha: 1)

enum Shape { case square, rounded, circle, none }

/// Renders a size×size PNG. `letterScale` is the S's cap height as a share of the size.
func render(_ path: String, size: Int, shape: Shape, letterScale: CGFloat, background: Bool = true, alpha: Bool = true) {
  let s = CGFloat(size)
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: alpha ? 4 : 3, hasAlpha: alpha, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let rect = NSRect(x: 0, y: 0, width: s, height: s)
  if background {
    teal.setFill()
    switch shape {
    case .square: NSBezierPath(rect: rect).fill()
    case .rounded: NSBezierPath(roundedRect: rect, xRadius: s * 0.2, yRadius: s * 0.2).fill()
    case .circle: NSBezierPath(ovalIn: rect).fill()
    case .none: break
    }
  }
  let font = NSFont.systemFont(ofSize: s * letterScale / 0.72, weight: .bold)
  let text = NSAttributedString(
    string: "S", attributes: [.font: font, .foregroundColor: NSColor.white])
  let bounds = text.boundingRect(with: rect.size, options: [.usesDeviceMetrics])
  let origin = NSPoint(
    x: (s - bounds.width) / 2 - bounds.minX,
    y: (s - bounds.height) / 2 - bounds.minY)
  text.draw(at: origin)
  NSGraphicsContext.restoreGraphicsState()
  let url = URL(fileURLWithPath: path)
  try! FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try! rep.representation(using: .png, properties: [:])!.write(to: url)
}

let res = "android/app/src/main/res"
// Legacy launcher icons (Android 7 and older) and the adaptive foreground.
for (dpi, scale) in [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0), ("xxhdpi", 3.0), ("xxxhdpi", 4.0)] {
  render("\(res)/mipmap-\(dpi)/ic_launcher.png", size: Int(48 * scale), shape: .rounded, letterScale: 0.5)
  render("\(res)/mipmap-\(dpi)/ic_launcher_round.png", size: Int(48 * scale), shape: .circle, letterScale: 0.5)
  // 108dp canvas; the visible area is the middle 72dp, so keep the S inside it.
  render("\(res)/mipmap-\(dpi)/ic_launcher_foreground.png", size: Int(108 * scale), shape: .none, letterScale: 0.32, background: false)
}
// iOS uses one 1024×1024 opaque icon; the system rounds the corners.
// App Store icons must not have an alpha channel.
render("ios/Sharelith/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png", size: 1024, shape: .square, letterScale: 0.5, alpha: false)
// Splash logo: white S on transparent, for react-native-bootsplash.
render("assets/bootsplash-logo.png", size: 1024, shape: .none, letterScale: 0.62, background: false)
print("Icons written.")
