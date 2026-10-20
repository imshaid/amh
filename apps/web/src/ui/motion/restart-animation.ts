/**
 * Plays a CSS animation class again from the start, even while a previous run is still going.
 */
export function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  // Reading layout makes the browser drop the old run before the class comes back.
  void element.getBoundingClientRect();
  element.classList.add(className);
}
