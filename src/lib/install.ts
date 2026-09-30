// Which "save War Room to your home screen" steps to show: an iPhone or iPad, an Android phone, or
// a computer. Pure, tested in install.test.ts.
export type Device = "ios" | "android" | "desktop";

export function deviceOf(userAgent: string, maxTouchPoints = 0): Device {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPads ask for the desktop site and call themselves a Mac, but have a touch screen
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
