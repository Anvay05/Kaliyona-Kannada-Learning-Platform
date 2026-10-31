# Open Source Attribution — City Reader Kannada OCR Models

Kaliyona's **City Reader** offline Kannada OCR pipeline evaluates and utilizes open-source Tesseract OCR language models for Kannada (`kan`) and English (`eng`).

---

## 1. Project Anuvaad Kannada OCR Model (`anuvaad_kan.traineddata`)
- **Project**: [Project Anuvaad — `anuvaad-ocr-model`](https://github.com/project-anuvaad/anuvaad-ocr-model)
- **Model Artifact**: `https://anuvaad-pubnet-weights.s3.amazonaws.com/anuvaad_kan.traineddata` (`7,989,557` bytes)
- **License**: [MIT License](https://github.com/project-anuvaad/anuvaad-ocr-model/blob/master/LICENSE)
- **Copyright**: Copyright (c) 2020 EkStep Foundation / Project Anuvaad Contributors
- **Usage in Kaliyona**: Evaluated in the City Reader 3-model A/B benchmark (`lib/reader/devHarness.ts`) for Kannada conjunct (*ottakshara*) and document recognition.

---

## 2. Indic-OCR Kannada Model (`indickan.traineddata`)
- **Project**: [Indic-OCR — `tessdata`](https://github.com/indic-ocr/tessdata) (`https://indic-ocr.github.io/tessdata/`)
- **Model Artifact**: `https://raw.githubusercontent.com/indic-ocr/tessdata/master/kan/kan.traineddata` (renamed to `indickan.traineddata`, `52,109,845` bytes)
- **License**: Apache License 2.0 / Open Source (Team Indic-OCR, `@rkvsraman`)
- **Usage in Kaliyona**: Evaluated in the City Reader 3-model A/B benchmark (`lib/reader/devHarness.ts`) for glyph-decomposed Kannada script recognition.

---

## 3. Tesseract OCR Fast Models (`kan.traineddata` & `eng.traineddata`)
- **Project**: [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) & [tesseract.js](https://github.com/naptha/tesseract.js)
- **Model Artifacts**:
  - `kan.traineddata` (`3,608,633` bytes) — Integerized LSTM Kannada model
  - `eng.traineddata` (`4,113,088` bytes) — Integerized LSTM English model
- **License**: [Apache License 2.0](https://github.com/tesseract-ocr/tessdata_fast/blob/main/LICENSE)
- **Usage in Kaliyona**: Bundled in `/public/tessdata/` for 100% offline, zero-network on-device dual-language (`kan+eng`) recognition in City Reader.
