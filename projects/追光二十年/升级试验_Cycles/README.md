# 渲染升级试验：Blender Cycles

把《追光二十年》的戈壁镜头从 three.js（SwiftShader 软件光栅）换成 Blender 5.0 Cycles 路径追踪重做。

| 文件 | 说明 |
|---|---|
| `对比_threejs_vs_cycles.jpg` | 同一镜头对比：上为原版，下为 Cycles |
| `戈壁_cycles_静帧.jpg` | 1920×804，96 spp，单帧约 4 分钟（4 核 CPU） |
| `戈壁_cycles_4秒试片.mp4` | 1280×536 渲染后放大，28 spp + OIDN 降噪，约 50 秒/帧；镜头上升推进，风机转动 |
| `desert_cycles.py` | 场景脚本：`python3 desert_cycles.py -- <分辨率比例> <采样> <输出> <铺设进度>`；`NF=120 LIMIT=96` 渲染序列 |

场景：程序化沙丘地形（延伸 16 km）、约 6.4 万块光伏板（带支架、单元格反射材质）、41 台风机、多重散射物理天空、均匀体积薄雾、AgX 色彩管理。

成本：按 4 核 CPU 估算，整条 2 分钟片若全部用 Cycles 渲染需要数十小时；更现实的做法是只把戈壁、城市等写实镜头换成 Cycles，地图和数据层保留 three.js。
