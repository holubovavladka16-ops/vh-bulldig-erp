// Facebook's /dialog/send ("Send Dialog") requires a real, registered Facebook App ID to work at all.
// Every module in this app previously called it with `app_id=0`, which is not a valid app id -
// Facebook rejects the request, so the "Messenger" share button never actually worked.
//
// This app has no registered Facebook App ID to provide, so instead of a broken web redirect we use
// the standards-based Web Share API (which lets the user pick Messenger, WhatsApp, or any other app
// installed on their device, and is supported on essentially all mobile browsers). When it isn't
// available (most desktop browsers), we fall back to copying the message to the clipboard so the
// user can paste it into Messenger themselves.

export type MessengerShareResult = 'shared' | 'cancelled' | 'copied'

function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

function canUseClipboard(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText
}

/**
 * Share text (optionally with a link) to Messenger via the OS share sheet, falling back to
 * copying the message to the clipboard when the Web Share API isn't available.
 * Throws only if neither mechanism is supported by the browser.
 */
export async function shareToMessenger(text: string, url?: string): Promise<MessengerShareResult> {
  if (canUseWebShare()) {
    try {
      await navigator.share(url ? { text, url } : { text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
      // Any other Web Share failure: fall through to the clipboard fallback below.
    }
  }

  if (canUseClipboard()) {
    const payload = url ? `${text}\n\n${url}` : text
    await navigator.clipboard.writeText(payload)
    return 'copied'
  }

  throw new Error('Sdílení do Messengeru není v tomto prohlížeči podporováno.')
}
