import {getDocument, GlobalWorkerOptions} from './vendor/pdf-view.mjs';

import {pdfBlob} from './export.js';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

async function drawPage(page, canvas) {
  const viewport = page.getViewport({scale:2});
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({canvasContext:canvas.getContext('2d'), viewport}).promise;
  page.cleanup();
}

export async function imagePageReport(blob) {
  const loading = getDocument({data:await blob.arrayBuffer(), isEvalSupported:false});
  const canvas = document.createElement('canvas');
  try {
    const pdf = await loading.promise;
    const {info} = await pdf.getMetadata();
    const content = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const {width, height} = page.getViewport({scale:1});
      await drawPage(page, canvas);
      content.push({image:canvas.toDataURL('image/jpeg', 0.95), width, height, pageBreak:number > 1 ? 'before' : undefined});
    }
    return await pdfBlob(globalThis.pdfMake.createPdf({
      info:{title:info.Title, author:info.Author}, pageSize:'LETTER', pageMargins:0, content
    }));
  } finally {
    canvas.width = canvas.height = 0;
    await loading.destroy();
  }
}
