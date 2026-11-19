import {getDocument, GlobalWorkerOptions} from './vendor/pdf-view.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

export async function showPages(reader, blob) {
  const dialog = reader.closest('dialog');
  const loading = getDocument({data: await blob.arrayBuffer(), isEvalSupported:false});
  const canvas = reader.querySelector('canvas');
  const status = reader.querySelector('[role=status]');
  const previous = reader.querySelector('.previous');
  const next = reader.querySelector('.next');
  let pageNumber = 1;
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    dialog.removeEventListener('close', dispose);
    loading.destroy();
  }
  const observer = new MutationObserver(() => { if (!reader.isConnected) dispose(); });
  observer.observe(dialog, {childList:true, subtree:true});
  dialog.addEventListener('close', dispose);
  if (!reader.isConnected || !dialog.open) { dispose(); return; }
  const pdf = await loading.promise;
  async function render(number) {
    previous.disabled = next.disabled = true;
    try {
      const page = await pdf.getPage(number);
      if (disposed) return;
      const viewport = page.getViewport({scale:2});
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({canvasContext:canvas.getContext('2d'), viewport}).promise;
      if (disposed) return;
      page.cleanup();
      pageNumber = number;
      status.textContent = `Page ${number} of ${pdf.numPages}`;
      previous.disabled = number === 1;
      next.disabled = number === pdf.numPages;
    } catch (error) {
      if (!disposed) status.textContent = 'The PDF page could not open. The case file is shown above.';
    }
  }
  previous.onclick = () => render(pageNumber - 1);
  next.onclick = () => render(pageNumber + 1);
  await render(1);
}
