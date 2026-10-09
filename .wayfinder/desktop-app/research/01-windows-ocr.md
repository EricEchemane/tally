# Research: Windows OCR engine options

Ticket: [01 Windows OCR engine options](../issues/01-windows-ocr-engine-options.md). Researched 2026-10-09 from the web only; nothing was installed or run on Windows. Every figure below needs confirming on Simon's machine.

Legend: **[V]** verified in official docs or PyPI metadata · **[S]** secondary source (blog, README, vendor benchmark, forum) · **[I]** my inference, not checked.

## Summary

The pipeline needs little from OCR: line or word text, a box per item so `to_rows()` can group rows, and enough box shape to spot a sideways photo. `to_rows()` produces the row order that the bottom-40% provider-TIN rule (`derive.is_provider_tin`) counts. Confidence only weights the ±90° retry (`score = len(text) * conf`). The M1 bench already found it useless for legibility. Tagalog is not a real requirement: receipts are English with Filipino names in plain Latin script. An English recogniser is enough.

**Shortlist to measure on the 18 sample receipts:**

1. **RapidOCR + onnxruntime (PP-OCR models, ONNX).** The first choice. It needs nothing from the user, its PP-OCR models lead the open-source receipt benchmarks, it returns quadrilateral line boxes with per-line scores (a near drop-in for `Observation`), and it adds about 100 MB to the sidecar, with no Paddle framework. It is Apache-2.0 and its wheel bundles the models, so nothing downloads at runtime. The risk is CPU speed on an office laptop at 2048 px. It is probably about 1–2 s, still small next to the 10–17 s LLM call, but no published figure matches our setup.
2. **Windows.Media.Ocr via the `winrt-*` packages.** The cheap fallback, built into Windows 10/11. It adds under 1 MB to the sidecar and is very fast (about 50 ms per image in one README). The downsides: no confidence values, only word boxes (lines must be built from them), no published receipt accuracy, and it **needs the English OCR language feature** (`Language.OCR~~~en-US~0.0.1.0`). That feature is normally present on English Windows, but the app has to check for it and guide the user if it is missing. Measure it next to RapidOCR. If its accuracy on faded thermal tapes holds up, its size and speed make it attractive.

**Drop PaddleOCR (the full framework).** Its models are the ones RapidOCR already runs. The framework adds a 105 MB `paddlepaddle` wheel plus PaddleX's heavy dependencies (pandas, modelscope, huggingface-hub, aistudio-sdk). Its own docs say **Nuitka is not supported** and PyInstaller needs a special wrapper script.

## Comparison

| | **RapidOCR + onnxruntime** | **Windows.Media.Ocr (`winrt-Windows.Media.Ocr`)** | **PaddleOCR 3.x** |
|---|---|---|---|
| Python package (latest) | `rapidocr` 3.10.0 (2026-10-08) + `onnxruntime` 1.31.0 (2026-10-09) **[V]** | `winrt-Windows.Media.Ocr` 3.2.1 + `winrt-runtime` 3.2.1 (2025-06-06), or the `winocr` 0.0.15 wrapper **[V]** | `paddleocr` 3.7.0 (2026-06-11) → `paddlex[ocr-core]` 3.7.x + `paddlepaddle` 3.3.1 **[V]** |
| Licence | Apache-2.0 (rapidocr; the PP-OCR models are Apache-2.0); MIT (onnxruntime) **[V]** | MIT bindings; the engine is part of Windows **[V]** | Apache-2.0 **[V]** |
| Python 3.12 (our pin) | yes (onnxruntime 1.31 needs ≥ 3.11) **[V]** | yes, cp312 win_amd64 wheels **[V]** | yes **[V]** |
| Wheel sizes, win_amd64 | rapidocr 27.3 MB (bundles det/cls/rec models) + onnxruntime 14.9 MB + opencv-python-headless 43.8 MB + numpy/shapely/pyclipper **[V]** | winrt-runtime 0.2 MB + about 6 namespace wheels of about 40 KB each **[V]** | paddlepaddle 104.8 MB + paddlex 2.2 MB + many dependencies; models download separately **[V]** |
| Packaged sidecar cost | about 100–150 MB unpacked **[I]** | under 1 MB **[I]** | about 300 MB or more **[I]** |
| Line text + boxes | `out.boxes` (N, 4, 2) pixel quads, `out.txts`, `out.scores`, one entry per detected text line **[V]** | `OcrResult.lines[].words[].bounding_rect` (x, y, w, h in pixels). **Lines have no box**: take the union of their word rects **[V]** | `rec_texts`, `rec_scores`, `rec_polys` / `rec_boxes` **[S]** |
| Confidence | per line **[V]** | **none** **[V]** | per line **[S]** |
| Rotation | the cls model fixes 0/180° per line. Sideways pages: our existing ±90° retry still works off box shape **[V]/[I]** | `OcrResult.text_angle` = clockwise skew of the text; "text at different angles → only part recognized". No documented 90° support **[V]**. The `is_sideways` box-shape trigger may not fire; needs testing **[I]** | `use_doc_orientation_classify` (0/90/180/270) and `use_textline_orientation` **[S]** |
| Language | default models (rapidocr ≥ 3.9: PP-OCRv6 small det/rec) cover Chinese + English; PP-OCRv6 covers 46 Latin-script languages **[V]**. Tagalog is not named anywhere **[V]**; not needed **[I]** | needs an installed OCR language feature; `en-US` is enough. No Filipino OCR pack confirmed **[S]** | same models as RapidOCR **[V]** |
| Windows language pack needed? | no | **yes**: `Language.OCR~~~en-US~0.0.1.0` (or another `en-*`). Usually present on English Windows **[S]**; Windows 11 standard users can add it from Settings **[V]** | no |
| CPU speed | no figure for receipts at 2048 px. PP-OCRv5 mobile through Paddle on a Xeon: **1.75 s/img** (v4 mobile 1.37 s) **[V]**. RapidOCR Python, small strips, Core Ultra 9: about 0.3 s/img **[S]** | about **48 ms/img** single core (1000 runs of one test image) **[S]** | 1.75 s/img (v5 mobile, Xeon Gold 6271C) **[V]** |
| Receipt accuracy | PP-OCR models: CER about 0.20 vs Tesseract 0.33 on SROIE receipts (vendor benchmark, PaddleOCR 3.7 on GPU) **[S]**. PP-OCRv5 rec on printed English 0.875 vs v4 0.660 **[V]** | no published receipt benchmark; "decent, weaker on complex layouts" **[S]** | same as RapidOCR **[S]** |
| PyInstaller | must bundle `rapidocr/models/*.onnx` and `config.yaml` (`--collect-data rapidocr`). onnxruntime DLLs need the **VC++ 2019 runtime** **[V]/[I]** | `winrt._winrt` is a compiled extension: `--collect-all winrt` or hidden imports **[I]** | official wrapper: `--collect-data paddlex --collect-binaries paddle --copy-metadata …` **[V]** |
| Nuitka | expected to work with `--include-package-data=rapidocr` **[I]** | expected to work **[I]** | **not supported** (official docs) **[V]** |

## Details

### What our pipeline needs (from the code)

- `api/pipeline/ocr.py`: each observation is `(text, confidence, (x, y, w, h))`, normalised, with **y measured from the bottom** (Vision's convention).
  - `is_sideways`: median box h/w > 1.5.
  - The ±90° retry picks the rotation with the higher `sum(len(t) * c)`.
  - `to_rows` joins boxes whose vertical centres overlap (`< 0.6 * min(h)`), left to right.
- `api/pipeline/derive.py`: `is_provider_tin` uses **row index** (`i >= len(rows) * 0.6`) on the grouped text, not pixel geometry. Any engine whose boxes group into the right rows satisfies the bottom-40% rule.
- Bench finding (`.wayfinder/liquidation-review/research/03-m1-bench/FINDINGS.md`): "OCR confidence is useless for legibility". An engine with no confidence only loses the tiebreak weighting on rotation. `len(text)` alone works as the score **[I]**.
- So a Windows `_recognize()` only has to return the same `Observation` list. `to_rows`, `is_sideways` and the rest of the pipeline stay unchanged. The engine choice can hide behind `_recognize()` (by `sys.platform`).

### RapidOCR (ONNX Runtime)

- **Packages [V]:** [`rapidocr` 3.10.0](https://pypi.org/project/rapidocr/), Apache-2.0, py ≥ 3.8, a 27.3 MB pure-Python wheel.
  - Since 2.0.6 it does **not** depend on onnxruntime; install it alongside: `pip install rapidocr onnxruntime`.
  - Dependencies: pyclipper, opencv-python-headless, numpy < 3, six, Shapely, PyYAML, Pillow, tqdm, omegaconf, requests, colorlog.
  - The wheel **bundles the det/cls/rec models**, so no runtime download is needed for the defaults.
  - Source: [install docs](https://rapidai.github.io/RapidOCRDocs/main/install_usage/rapidocr/install/).
  - [`onnxruntime` 1.31.0](https://pypi.org/project/onnxruntime/): MIT, py ≥ 3.11, cp312 win_amd64 wheel 14.9 MB.
- **Default models [V]:** rapidocr ≥ 3.9 uses PP-OCRv6 small det + rec and PP-OCRv4 mobile cls; < 3.9 used PP-OCRv4 mobile for all three ([usage docs](https://rapidai.github.io/RapidOCRDocs/main/install_usage/rapidocr/usage/)). Model type (`ModelType.TINY` / `MEDIUM`), `lang_type` and OCR version can be set per stage. The engine can also be switched per stage (onnxruntime, openvino, torch). Pin the rapidocr version so the models don't change underneath the measured accuracy.
- **API [V]:**
  ```python
  from rapidocr import RapidOCR
  engine = RapidOCR()                     # build once, reuse
  out = engine(np_or_path, use_cls=True)  # use_det / use_cls / use_rec switches
  out.boxes   # (N, 4, 2) pixel quads, one per text line
  out.txts    # tuple[str]
  out.scores  # tuple[float]
  out.elapse_list  # det / cls / rec seconds
  ```
  - `return_word_box=True` adds per-character boxes in `word_results`.
  - Adapter to our `Observation` **[I]:** `x = min(xs)/W`, `w = (max(xs)-min(xs))/W`, `h = (max(ys)-min(ys))/H`, `y = 1 - max(ys)/H` (flip to bottom origin).
- **Rotation [I]:** the cls model handles upside-down lines only.
  - On a sideways photo, DBNet still finds the text lines, as tall narrow quads, so `is_sideways` should fire and the existing ±90° retry applies.
  - PP-OCR's crop step also auto-rotates crops with h/w ≥ 1.5, so a single pass may already read sideways text. Measure on `dup-mrdiy-rotated` before relying on it.
- **Offline models [V]:** local paths go through `Det.model_path`, `Cls.model_path`, `Rec.model_path` / `Rec.model_dir`, and `Rec.rec_keys_path` ([offline model guide](https://rapidai.github.io/RapidOCRDocs/main/install_usage/rapidocr/how_to_use_offline_model/)). The docs use both `Rec.model_path` and `Rec.model_dir`; check against the source.
- **Speed:**
  - No published figure matches receipts at 2048 px on a laptop CPU.
  - Closest: the official PP-OCRv5 page gives **1.75 s/img for v5 mobile, 1.37 s for v4 mobile** on an Intel Xeon Gold 6271C through PaddlePaddle, on a 200-image mixed set **[V]** ([PP-OCRv5 intro](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html)).
  - A NuGet page and a cnblogs post report RapidOCR Python 3.8.1 at about 17.9 s for 60 small 1180×92 strips (≈ 0.3 s each) on a Core Ultra 9 285K, partly with an OpenVINO backend **[S]** ([RapidOCRSharpOnnx](https://www.nuget.org/packages/rapidocrsharponnx)).
  - Expect roughly 1–2 s per receipt on an office laptop **[I]**, against 10–17 s for extraction.
  - Tuning knobs: the det `limit_side_len` (shrinking further than 2048 px helps detection speed) and the TINY models.
- **Accuracy:**
  - PP-OCRv5 printed-English recognition: 0.875 (mobile) vs 0.660 for v4 mobile **[V]** (same PP-OCRv5 page).
  - On SROIE English receipts, PaddleOCR 3.7.0 scored CER ≈ 0.20 / WER ≈ 0.33 vs Tesseract 5.3.4 at 0.33 / 0.56 **[S]**. This is a vendor benchmark, run on a GPU, with inconsistent speed tables ([imagetotable.ai](https://imagetotable.ai/references/tesseract-vs-paddleocr-receipt-benchmark)).
  - Nothing published on faded Philippine thermal tapes.
- **Packaging pitfalls:**
  - Include rapidocr's data files: `--collect-data rapidocr` in PyInstaller, `--include-package-data=rapidocr` in Nuitka. The engine loads `config.yaml` and `models/` relative to the package **[S]/[I]**. An Arch packaging thread hit a stray `config.yaml` problem **[S]** ([AUR python-rapidocr](https://aur.archlinux.org/packages/python-rapidocr?O=0)).
  - onnxruntime on Windows needs the **Visual C++ 2019+ runtime** **[V]** ([ORT install requirements](https://onnxruntime.ai/docs/install/)). It is usually present but not guaranteed on a clean machine; ship `vcruntime140*.dll` or the redistributable.
  - Install either `opencv-python-headless` or `opencv-python`, not both **[V]**. Headless is the default since 3.10.0.
  - The `requests` / `tqdm` dependencies are unused once the models are bundled, but harmless.

### Windows.Media.Ocr (WinRT)

- **Bindings [V]:** the community [PyWinRT](https://github.com/pywinrt/pywinrt) project (MIT) ships per-namespace packages.
  - Needed: `winrt-runtime`, `winrt-Windows.Media.Ocr`, `winrt-Windows.Graphics.Imaging`, `winrt-Windows.Storage.Streams`, `winrt-Windows.Globalization`, `winrt-Windows.Foundation`, `winrt-Windows.Foundation.Collections`.
  - All are 3.2.1 (2025-06-06), py ≥ 3.9, with cp312 win_amd64 wheels of about 40 KB each (runtime 0.2 MB).
  - **Avoid `winsdk`:** its last release is 1.0.0b10 from Aug 2023, its classifiers stop at Python 3.12, and PyWinRT moved back to the `winrt` namespace ([PyPI](https://pypi.org/project/winsdk/)).
  - [`winocr`](https://pypi.org/project/winocr/) 0.0.15 (Oct 2024, MIT) is a thin wrapper over these packages. It has `recognize_pil(img, 'en')`, and its result has `.text`, `.text_angle`, `.lines[].text` and `.lines[].words[].bounding_rect{x, y, width, height}`. It is useful as reference code for converting PIL to `SoftwareBitmap`; vendoring the 30 lines is safer than depending on a stale package **[I]**.
- **API [V]** ([OcrEngine](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine), [OcrResult](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrresult), [OcrLine](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrline)):
  - Create the engine with `OcrEngine.try_create_from_language(Language("en-US"))` or `try_create_from_user_profile_languages()`. Check `available_recognizer_languages` and `is_language_supported(lang)` first.
  - `await engine.recognize_async(software_bitmap)` returns an `OcrResult` with `lines`, `text` and `text_angle` (clockwise rotation in degrees, null if undetected).
  - An `OcrLine` has only `text` and `words`. Boxes live on `OcrWord.bounding_rect`.
  - **No confidence at any level.**
  - `OcrEngine.max_image_dimension` caps the input size. Our images are already ≤ 2048 px.
  - Available since Windows 10 build 10240.
- **Adapter [I]:** for each line, take the union of its word rects to get a line box, flip y to bottom origin, and set conf = 1.0.
  - Windows sometimes splits one printed row into several "lines" when words are far apart (common on receipts: label ... amount). `to_rows` regroups them, so no harm.
  - `RecognizeAsync` is async. Call it via `asyncio.run()` in the OCR worker thread, or await it if the pipeline is already async.
- **Rotation [V]/[I]:** Microsoft documents `TextAngle` and says "if the image contains text at different angles, only part of the text will be recognized correctly". Nothing says 90° pages are read.
  - On a sideways photo, Windows may return few or garbled words with normal-looking boxes, so `is_sideways` may not fire.
  - Possible trigger: `text_angle` near ±90, or very low character yield. Then retry ±90° and score by `len(text)`.
  - Test this on `dup-mrdiy-rotated`.
- **Language pack [V]/[S]:**
  - OCR is a per-language Feature on Demand, `Language.OCR~~~<locale>~0.0.1.0`, which depends on that language's Basic feature. Microsoft recommends OEMs preinstall OCR for each shipped language ([Language FODs](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/features-on-demand-language-fod)) **[V]**.
  - In Windows 11, **standard (non-admin) users can add language features from Settings → Time & language** **[V]** (same page).
  - Scripted install needs elevated PowerShell: `Add-WindowsCapability -Online -Name "Language.OCR~~~en-US~0.0.1.0"` ([winocr README](https://pypi.org/project/winocr/)) **[S]**. Pack sizes in its listing are about 0.2–3.4 MB **[S]**.
  - A forum report says adding English did not bring the OCR pack automatically **[S]**. So the first-run wizard must check `available_recognizer_languages` for any `en-*` and show a fix-it step if none is found.
  - No Filipino/Tagalog OCR pack was found **[S]**; English handles our receipts.
- **Speed [S]:** the winocr README times 1000 runs of one test image at 48 s on one core (≈ 48 ms each) and 16 s on 4 cores. The CPU, image size and text density are unstated.
- **Accuracy [S]:** no published receipt or thermal-print benchmark. Iron Software (a competitor) calls it "decent", weaker on complex layouts ([blog](https://ironsoftware.com/ocr/csharp/blog/ocr-tools/windows-ocr-engine-vs-tesseract/)). Forum advice for small receipt fonts is to upscale 2–3× first ([ui.vision forum](https://forum.ui.vision/t/single-digit-number-ocr-for-receipts/15098/2)). This conflicts with our 2048 px cap, so measure both sizes.
- **Packaging pitfalls [I]:**
  - `winrt._winrt` is a compiled extension and the namespace modules load dynamically, so PyInstaller may miss them. Use `--collect-all winrt` or explicit hidden imports for `winrt.windows.media.ocr`, `winrt.windows.graphics.imaging` and the others.
  - No model files to ship; nothing for Nuitka beyond including the package.
  - The engine lives in Windows itself, so OCR behaviour can change with Windows updates, outside our control.
- **Not an option:** the newer Windows App SDK `TextRecognizer` (Windows AI APIs). Microsoft says it is "more accurate and faster" than `Windows.Media.Ocr` and NPU-accelerated, but the docs mark it experimental / not for production, and secondary sources tie it to Copilot+ PCs ([docs](https://learn.microsoft.com/zh-cn/windows/ai/apis/text-recognition)). It is also hard to reach from Python **[S]/[I]**. Revisit later.

### PaddleOCR 3.x (full framework)

- **Packages [V]:** [`paddleocr` 3.7.0](https://pypi.org/project/paddleocr/), Apache-2.0. It depends on `paddlex[ocr-core]` 3.7.x (pandas, pydantic, modelscope, huggingface-hub, aistudio-sdk and more) and needs [`paddlepaddle`](https://pypi.org/project/paddlepaddle/) 3.3.1 (cp312 win_amd64 wheel **104.8 MB**).
- **Models:** PP-OCRv5 (a 109-language multilingual model, better Latin coverage) and PP-OCRv6 (one model for Chinese, English, Japanese and 46 Latin-script languages) **[V]** (PyPI page). Models are fetched on first use from model hubs **[S]/[I]**, so they must be pre-fetched and bundled for an offline sidecar.
- **API [S]:**
  ```python
  PaddleOCR(use_doc_orientation_classify=..., use_doc_unwarping=..., use_textline_orientation=...).predict(img)
  ```
  The results carry `rec_texts`, `rec_scores`, `rec_polys` and `rec_boxes`, plus `doc_preprocessor_res.angle` ([quick start](https://www.paddleocr.ai/v3.4.1/en/quick_start.html)). Document orientation classification (0/90/180/270) would replace our ±90° retry.
- **Packaging [V]:** the [official packaging guide](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/others/packaging.html) says **"packaging with Nuitka is currently not supported"**.
  - PyInstaller needs their wrapper, which runs `pyinstaller main.py --collect-data paddlex --collect-binaries paddle --copy-metadata …` for every dependency.
  - It was tested only on Win 11 / Python 3.10 / Paddle 3.0 / PaddleOCR 3.1.
  - Missing optional dependencies raise `RuntimeError: xxx requires additional dependencies` at runtime.
- **Verdict:** same models as RapidOCR, about 3× the size, a fragile freeze, and no speed advantage on CPU. Not worth measuring. Use RapidOCR to measure the PP-OCR models, and switch its models to PP-OCRv5 or server-size if accuracy needs it.

### Also considered

- **Tesseract 5:** needs a separate native binary next to the sidecar. A vendor benchmark shows clearly worse receipt accuracy than PP-OCR (SROIE CER 0.33 vs 0.20) **[S]**. Not shortlisted.

## Suggested measurement (for the follow-up ticket)

On Simon's Windows laptop, run the 18 fixtures through both engines with the M1 bench harness. Keep `to_rows` and the 2048 px cap, and also try 1.5–2× upscaling for Windows OCR. Record:

1. OCR seconds per receipt, cold and warm.
2. Field accuracy after derive, compared with the M1's 91%.
3. Whether `dup-mrdiy-rotated` ends up upright.
4. The faded Mercury / `or-cebu-2022` tapes.
5. The packaged sidecar size delta.

Also run `Get-WindowsCapability -Online -Name "Language.OCR*"` on Simon's machine and on a fresh Windows 11 install, to see whether en-US OCR is present by default.
