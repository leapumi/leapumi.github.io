# Project assets

Put your material in the paths below; the page will load it automatically.

- `videos/leapumi.mp4`: overview video
- `images/devices.png`: hardware overview figure
- `images/main.png`: LeapUMI-PVP pipeline overview figure
- `connector.STEP`: connector CAD file, available on the Hardware Downloads page
- `hand_back.STEP`: hand back CAD file, available on the Hardware Downloads page
- `fiexed_full_assembly_right.STEP`: source assembly for the interactive CAD preview only; not listed among the downloads
- `cad/hardware-preview.js`: compressed preview generated from the STEP model
- `cad-viewer.js`: interactive viewer; loads preview data as a classic script for compatibility with sandboxed anonymous pages
- `hardware-downloads.js`: anonymous-platform compatibility for the two component download buttons
- `vendor/`: self-hosted Three.js 0.138.3 and OrbitControls, with the upstream MIT license
- `images/collection-01.png` through `images/collection-03.png`: collection shots
- `images/inpainting-01.png` through `images/inpainting-04.png`: inpainting sequence
- `videos/result-05.mp4` through `videos/result-08.mp4`: deployment videos in display order

Replace the placeholder abstract, section subtitles, and example labels directly in `../index.html` when the final material is ready.

## Updating the CAD preview

After replacing `fiexed_full_assembly_right.STEP`, regenerate the preview from the repository root using Node.js:

```powershell
npm install --no-save --package-lock=false occt-import-js@0.0.23
node tools/build-cad-preview.cjs
```

Commit both the assembly STEP file and the generated `cad/hardware-preview.js`. The assembly is used only for the CAD preview. No CAD conversion or external CDN is required in the visitor's browser. Modern browsers with WebGL and `DecompressionStream` are required for the interactive preview.

Both the homepage Hardware button and the link below the CAD preview open `../hardware.html`. That page offers only `connector.STEP` and `hand_back.STEP`, with a separate download button for each file. Paths use the files' actual uppercase `.STEP` extension, including on case-sensitive hosts.

If publishing through Anonymous GitHub, refresh that mirror after updating the source repository. Its website sandbox blocks direct downloads, so each component's download button opens the corresponding anonymous STEP file page; choose Download there. On GitHub Pages, these buttons download the files directly.
