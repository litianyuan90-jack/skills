# 照見 · The Mirror Cave

An interactive Dunhuang cave and a 130-second film about time, mirrors, arising and ceasing, and form and emptiness. Bilingual (Chinese / English).

> 观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空。
> When Avalokiteśvara moved deep in the perfection of wisdom, he shone a light on the five aggregates and saw that all of them are empty.

## The idea

The cave follows the truncated-pyramid (覆斗顶) chambers of Mogao. The west niche holds no statue, only a bronze mirror. Once you step inside, the doorway behind you becomes a mirror as well. Two facing mirrors make caves within caves: a thousand caves and a thousand Buddhas.

| Theme | How the piece shows it |
|---|---|
| 镜 Mirror | The reflections are real planar reflections, built as mirrored copies of the cave (`z' = 8k + (-1)^k z`). The regress is exact and endless, with no render-to-texture blur. |
| 时 Time | Each layer deeper in the mirror is a little earlier in time (`uLag × depth`), so looking into the mirror means looking into the past. |
| 生灭 Arising and ceasing | Scroll (or use the rail) to move the murals through time: bare plaster → 起稿 line sketch → 敷彩 colour → aging (red lead darkens, as it really has at Mogao) → flaking → bare earth → 空 → the first stroke again. |
| 色空 Form and emptiness | Every other reflection swaps the colour murals (色) for their line drawings (空). The 色 ⇄ 空 button swaps which side is which. |
| 无我 No self | The mirror shows everything except the visitor. |
| 神秀 / 惠能 | Drag across the mirror to wipe off the dust (Shenxiu). Then keep still: the mirror stand dissolves and only the endless cave remains (Huineng, in the wording of the **Dunhuang manuscript** of the Platform Sūtra: 佛性常清净, not the later 本来无一物). |
| 无尽灯 The inexhaustible lamp | The lamp is reflected into countless lamps. Touching it opens the Vimalakīrti passage 一灯燃百千灯 and the link to agent.space ("pass the lamp"). |

## Contents

```
web/            interactive piece (index.html + main.js + three.js, textures, font slices)
web/film.js     deterministic film timeline (camera splines, state tracks, subtitles, typography)
dist/           hosted single-page build (three.js from jsDelivr, Google Fonts)
video/          script.json (narration), durations, narration WAVs, SRT subtitles (zh / en / zh-en)
tools/          build_textures.py · build_fonts.py · build_artifact.py · render_frames.mjs · build_audio.py
```

The film itself (`zhaojian-mirror-cave.mp4`) is attached to the pull request and the session rather than committed, so the repository stays small.

## Run locally

```bash
cd works/zhaojian-mirror-cave
python3 -m http.server 8765
# interactive:  http://localhost:8765/web/
# film mode:    http://localhost:8765/web/?film=1   (window.__zj.frame(t) renders time t)
```

Controls: drag to look; W/S or ↑/↓ to walk; scroll or the right-hand rail to move through time; drag on the mirror to wipe it; stay still; touch the lamp.

## Rebuild the film

```bash
# 1. textures from the source images (see Sources)
python3 -I tools/build_textures.py <raw_dir> web/tex
# 2. frames: 1920×1080 @ 30 fps, headless Chromium with SwiftShader; run several workers in parallel
node tools/render_frames.mjs <playwright-core> frames 0 130 30 <worker> <workers>
# 3. score + narration mix (all sound is synthesised in the script)
python3 -I tools/build_audio.py video/vo web/film.js mix.wav
# 4. encode
ffmpeg -framerate 30 -i frames/%05d.jpg -i mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest zhaojian-mirror-cave.mp4
```

Narration: Kokoro v1.1-zh (speaker 63) through sherpa-onnx, offline. The voice was picked from 14 candidates by a speech-recognition round trip (4.2 % pinyin error) and pitch (~111 Hz).

## Sources

- **Mogao Cave 217, south wall, Lotus Sūtra tableau** (High Tang). Wikimedia Commons, public domain (PD-Art). Obtained via the attribution file of `rebornrender-ctrl/mogao-daylight-timelapse`.
- **Mural photographs and their line drawings** from the published examples of the DhMural1714 dataset: Zou et al., *Line Drawing Guided Progressive Inpainting of Mural Damages*, `github.com/qinnzou/mural-image-inpainting`. The repository states no license. They are used here for non-commercial artistic display only. Replace them with licensed high-resolution images (for example from the Dunhuang Academy) before any commercial use.
- **Diamond Sūtra frontispiece**, 868 CE, Library Cave, Dunhuang. Public domain. This is a sepia-toned copy from `NguyenTruongAnLab/xuanzang-journey`.
- The thousand Buddhas repeat a single detail of Cave 217. This echoes how Mogao painters repeated a stencil (粉本).
- Fonts: Noto Serif SC, Ma Shan Zheng, Cormorant Garamond (SIL OFL), via @fontsource.

The mirror was designed from scratch: the brief's reference link was a placeholder and never arrived.
