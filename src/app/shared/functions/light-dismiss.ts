/**
 * Closes a modal dialog when its backdrop is clicked, for browsers without
 * `<dialog closedby="any">` support (Safari). Call once with the dialog element.
 */
export function enableLightDismissFallback(dialog: HTMLDialogElement): void {
  if ('closedBy' in HTMLDialogElement.prototype) {
    return;
  }
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) {
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const insideDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.bottom &&
      rect.left <= event.clientX &&
      event.clientX <= rect.right;
    if (!insideDialog) {
      dialog.close();
    }
  });
}
