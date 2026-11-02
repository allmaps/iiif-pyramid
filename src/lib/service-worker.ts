import { dev } from '$app/environment'
import { base } from '$app/paths'

/** Create rendering workers only after this page is controlled, including on
 * the very first visit. No reload or persistent tile cache is needed. */
export async function prepareTileProxy(): Promise<void> {
  if (!('serviceWorker' in navigator))
    throw new Error(
      'This browser cannot run the image proxy. Open the app in a current browser over HTTPS or localhost.'
    )
  const scriptUrl = new URL(`${base}/service-worker.js`, location.origin).href
  await navigator.serviceWorker.register(scriptUrl, {
    scope: `${base}/`,
    type: dev ? 'module' : 'classic'
  })
  let readyTimeout: ReturnType<typeof setTimeout>
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        readyTimeout = setTimeout(
          () =>
            reject(
              new Error('The image proxy did not activate. Please retry.')
            ),
          15000
        )
      })
    ])
  } finally {
    clearTimeout(readyTimeout!)
  }
  if (navigator.serviceWorker.controller?.scriptURL === scriptUrl) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        controlled
      )
      reject(
        new Error(
          'The image proxy did not start. Reload the page to try again.'
        )
      )
    }, 15000)
    function controlled() {
      if (navigator.serviceWorker.controller?.scriptURL !== scriptUrl) return
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        controlled
      )
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    controlled()
  })
}
