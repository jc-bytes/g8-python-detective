export class PythonRunner {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.worker = null;
    this.pending = null;
  }

  async run(source, inputs, probe) {
    if (this.pending) throw new Error('Stop the current run before starting another.');
    this.worker ??= new Worker(new URL('./runtime-worker.js', import.meta.url));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (result, error) => {
        clearTimeout(timer);
        this.pending = null;
        if (error) reject(error);
        else resolve(result);
      };
      this.pending = { finish };
      const limit = (milliseconds, message) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.worker?.terminate();
          this.worker = null;
          finish(null, new Error(message));
        }, milliseconds);
      };
      this.onStatus('Loading local Python. The first load can take a moment.');
      limit(60000, 'Python did not finish loading. Your work is safe. Retry or download the program for school IDLE.');
      this.worker.onmessage = event => {
        if (event.data.id !== id || !this.pending) return;
        if (event.data.type === 'ready') {
          this.onStatus('Running your actual program…');
          limit(6000, 'Execution stopped after 6 seconds. Check for a loop. Your edits are safe.');
        }
        if (event.data.type === 'result') finish(event.data.result);
        if (event.data.type === 'failure') {
          this.worker.terminate();
          this.worker = null;
          finish(null, new Error(`Python could not run: ${event.data.message}`));
        }
      };
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
        finish(null, new Error('The Python worker could not load. Use a local web server, not a file:// link. Your edits are safe.'));
      };
      this.worker.postMessage({ id, source, inputs, probe });
    });
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    this.pending?.finish(null, new Error('Run stopped. No output was invented or recorded. Your work is safe.'));
  }
}
