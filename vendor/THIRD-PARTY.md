# Packaged dependencies

The activity makes no CDN requests at runtime.

- Pyodide 0.29.3. Core files extracted from the published `pyodide@0.29.3` npm archive. The project license is retained as `pyodide/LICENSE`. `pyodide-lock.json` retains the package metadata distributed with the interpreter. This activity does not install optional Python packages.
- CPython 3.13.2 is identified by the distributed core metadata. Its license is retained as `pyodide/PYTHON-LICENSE`. The upstream lock's `info.version` reads `0.28.0.dev0`; it is retained without modification, not used as this activity's dependency version. The npm distribution and JavaScript loader are pinned to 0.29.3.
- docx 9.7.1. The distributed browser IIFE was copied without modification as `docx.js`. Its license is retained as `DOCX-LICENSE`.

Pyodide upstream: https://github.com/pyodide/pyodide/tree/0.29.3

Runtime documentation: https://pyodide.org/en/0.29.3/usage/webworker.html

docx upstream: https://github.com/dolanmiu/docx

Core distribution archive: https://registry.npmjs.org/pyodide/-/pyodide-0.29.3.tgz

The Python runtime executes student-authored code locally. This is not a hardened sandbox for hostile code, and no cloud execution or identity verification is provided.

PDF reports use pdfmake 0.2.20 with its bundled Roboto fonts and DejaVu Sans Mono and DejaVu Serif. The library and DejaVu licenses are packaged locally.

The case folder’s PDF preview renders the filed PDF with PDF.js 4.10.38. The reader, worker, and Apache license ship in this folder.

## Sound effects

Kenney’s RPG Audio pack is distributed under CC0 1.0 Universal. The shop uses seven clips converted to mono 24 kHz WAV. The license is bundled in `audio/LICENSE`.

Original pack: https://kenney.nl/assets/rpg-audio

Asset source: https://github.com/Boyquotes/kenney-rpg-audio-for-godot/tree/22eb79bb843bbcadcaa6ed119353a33265ffad11
