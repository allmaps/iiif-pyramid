/** Close native dialogs on a backdrop click, without dismissing a drag from inside. */
export function dismissOnBackdrop(dialog: HTMLDialogElement) {
  let startedOutside = false
  function outside(event: MouseEvent) {
    const box = dialog.getBoundingClientRect()
    return (
      event.target === dialog &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    )
  }
  function pointerdown(event: PointerEvent) {
    startedOutside = outside(event)
  }
  function click(event: MouseEvent) {
    if (startedOutside && outside(event)) dialog.close()
    startedOutside = false
  }
  dialog.addEventListener('pointerdown', pointerdown)
  dialog.addEventListener('click', click)
  return {
    destroy() {
      dialog.removeEventListener('pointerdown', pointerdown)
      dialog.removeEventListener('click', click)
    }
  }
}
