importScripts('./vendor/pyodide/pyodide.js');

let interpreter;
self.onmessage = async event => {
  const { id, source, inputs } = event.data;
  try {
    interpreter ??= await loadPyodide({ indexURL: new URL('./vendor/pyodide/', self.location.href).href });
    self.postMessage({ id, type: 'ready' });
    if (source === undefined) return;
    interpreter.globals.set('_detective_source', source);
    interpreter.globals.set('_detective_inputs_json', JSON.stringify(inputs));
    interpreter.globals.set('_detective_probe', event.data.probe || '');
    const result = await interpreter.runPythonAsync(`
import builtins, contextlib, io, json, traceback
class _DetectiveOutput(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 30000:
            raise RuntimeError("Output limit reached. Stop and check your program.")
        return super().write(text)
_detective_stdout = _DetectiveOutput()
_detective_stderr = _DetectiveOutput()
_detective_values = iter(json.loads(_detective_inputs_json))
_detective_original_input = builtins.input
_input_echoes = []
def _detective_input(prompt=""):
    start = _detective_stdout.tell()
    print(prompt, end="")
    try:
        value = next(_detective_values)
    except StopIteration:
        raise EOFError("This test supplies only its listed inputs.")
    print(value)
    _input_echoes.append((start, _detective_stdout.tell()))
    return value
_detective_error = ""
_detective_scope = {"__name__": "__main__"}
_detective_reading = None
try:
    builtins.input = _detective_input
    with contextlib.redirect_stdout(_detective_stdout), contextlib.redirect_stderr(_detective_stderr):
        exec(compile(_detective_source, "student_order.py", "exec"), _detective_scope)
        if _detective_probe:
            value = _detective_scope[_detective_probe]
            _detective_reading = {"type": type(value).__name__, "value": repr(value)[:200]}
except BaseException:
    _detective_error = traceback.format_exc(limit=6)
finally:
    builtins.input = _detective_original_input
_printed = _detective_stdout.getvalue()
for start, end in reversed(_input_echoes):
    _printed = _printed[:start] + _printed[end:]
json.dumps({"printed": _printed, "stdout": _detective_stdout.getvalue(), "stderr": _detective_stderr.getvalue(), "error": _detective_error, "reading": _detective_reading})
`);
    self.postMessage({ id, type: 'result', result: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ id, type: 'failure', message: error.message || String(error) });
  }
};
