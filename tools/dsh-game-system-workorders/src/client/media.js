// Browser-only, bounded transient previews. No paths or bytes are persisted.
export function createThumbnailPool({ createURL = blob => URL.createObjectURL(blob), revokeURL = url => URL.revokeObjectURL(url), maxItem = 5 * 1024 * 1024, maxBytes = 20 * 1024 * 1024, concurrency = 3 } = {}) {
  let disposed = false, active = 0, reserved = 0;
  const queued = [], entries = new Set();
  function pump() {
    while (!disposed && active < concurrency && queued.length) {
      const entry = queued.shift();
      if (entry.finished) continue;
      active++;
      (async () => {
        try {
          const blob = await entry.load(entry.controller.signal);
          if (disposed || entry.controller.signal.aborted) throw new Error('previewCancelled');
          if (!(blob.size > 0) || blob.size > maxItem || reserved - entry.size + blob.size > maxBytes) throw new Error('previewTooLarge');
          reserved += blob.size - entry.size; entry.size = blob.size;
          entry.url = createURL(blob);
          entry.resolve({ url: entry.url, release: () => finish(entry) });
        } catch (error) { finish(entry, error); }
        finally { active--; pump(); }
      })();
    }
  }
  function finish(entry, error) {
    if (entry.finished) return;
    entry.finished = true;
    entry.controller.abort(); entry.off?.();
    reserved -= entry.size; entries.delete(entry);
    if (entry.url) revokeURL(entry.url);
    if (error) entry.reject(error);
  }
  return {
    load(size, load, signal) {
      if (disposed || signal?.aborted) return Promise.reject(new Error('previewCancelled'));
      if (!(size > 0) || size > maxItem || reserved + size > maxBytes) return Promise.reject(new Error('previewTooLarge'));
      return new Promise((resolve, reject) => {
        const entry = { size, load, resolve, reject, controller: new AbortController(), finished: false };
        const abort = () => finish(entry, new Error('previewCancelled'));
        signal?.addEventListener('abort', abort, { once: true });
        entry.off = () => signal?.removeEventListener('abort', abort);
        entries.add(entry); reserved += size; queued.push(entry); pump();
      });
    },
    dispose() { disposed = true; for (const entry of [...entries]) finish(entry, new Error('previewCancelled')); queued.length = 0; },
    stats() { return { active, bytes: reserved, entries: entries.size, queued: queued.filter(e => !e.finished).length }; },
  };
}
