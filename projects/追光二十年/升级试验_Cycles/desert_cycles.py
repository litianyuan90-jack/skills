# 戈壁光伏 + 风机：Blender Cycles 写实重渲（与 three.js 版 C 镜头同构图思路）
import bpy, bmesh, math, sys, numpy as np, addon_utils, time
addon_utils.enable('cycles', default_set=True)
RES = float(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else .5
SPP = int(sys.argv[sys.argv.index('--') + 2]) if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 2 else 64
OUT = sys.argv[sys.argv.index('--') + 3] if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 3 else '/tmp/bl/desert.png'
FRAME_T = float(sys.argv[sys.argv.index('--') + 4]) if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 4 else .5
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene; rng = np.random.default_rng(7)

# ---------- 地形 ----------
def H(x, y):
    flat = 1.2 * np.sin(x * .011 + 1.3) * np.sin(y * .013) + .6 * np.sin(x * .031 + y * .017)
    t = np.clip((y - 520) / 260, 0, 1); t = t * t * (3 - 2 * t)
    dune = (34 * (np.sin(x * .0062 + y * .0021) * .5 + .5) ** 2.2 + 22 * (np.sin(x * .0153 - y * .0047 + 2.) * .5 + .5) ** 3
            + 14 * np.sin(x * .029 + y * .011) ** 2 + 60 * np.clip((y - 1100) / 900, 0, 1) + 26 * (np.sin(x * .0041 - 1.) * .5 + .5) ** 2)
    return flat + t * dune
N = 560; g = np.linspace(-1, 1, N); xs = np.sign(g) * (np.abs(g) ** 2.2) * 16000; ys = -1400 + (np.linspace(0, 1, N) ** 2.4) * 17400; X, Y = np.meshgrid(xs, ys); Z = H(X, Y)
me = bpy.data.meshes.new('terrain'); verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
idx = np.arange(N * N).reshape(N, N); q = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1, 4)
me.from_pydata(verts.tolist(), [], q.tolist()); me.shade_smooth(); ter = bpy.data.objects.new('terrain', me); S.collection.objects.link(ter)

def mat_sand():
    m = bpy.data.materials.new('sand'); nt = m.node_tree; P = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = .004; n1.inputs['Detail'].default_value = 6
    nt.links.new(tc.outputs['Object'], n1.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (.42, .25, .12, 1); ramp.color_ramp.elements[1].color = (.72, .48, .27, 1)
    nt.links.new(n1.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], P.inputs['Base Color'])
    P.inputs['Roughness'].default_value = .92
    # 风成沙纹：拉伸的波纹 + 细噪声
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = .9; wv.inputs['Distortion'].default_value = 6; wv.inputs['Detail'].default_value = 3
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (.02, .006, .02); nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3.; nt.links.new(tc.outputs['Object'], n2.inputs['Vector'])
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'; nt.links.new(wv.outputs['Fac'], add.inputs[0]); nt.links.new(n2.outputs['Fac'], add.inputs[1])
    bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = .25; bm.inputs['Distance'].default_value = .3
    nt.links.new(add.outputs['Value'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], P.inputs['Normal'])
    return m
ter.data.materials.append(mat_sand())

# ---------- 光伏阵列：一个大网格，每块板 8 顶点 ----------
def mat_pv():
    m = bpy.data.materials.new('pv'); nt = m.node_tree; P = nt.nodes['Principled BSDF']
    uv = nt.nodes.new('ShaderNodeUVMap'); br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.; br.offset = 0.; br.squash = 1.
    br.inputs['Brick Width'].default_value = 1 / 12; br.inputs['Row Height'].default_value = 1 / 6; br.inputs['Mortar Size'].default_value = .004
    br.inputs['Color1'].default_value = (.012, .022, .055, 1); br.inputs['Color2'].default_value = (.016, .03, .07, 1); br.inputs['Mortar'].default_value = (.35, .37, .4, 1)
    nt.links.new(uv.outputs['UV'], br.inputs['Vector']); nt.links.new(br.outputs['Color'], P.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = .045; rr.inputs['To Max'].default_value = .5
    nt.links.new(br.outputs['Fac'], rr.inputs['Value']); nt.links.new(rr.outputs['Result'], P.inputs['Roughness'])
    P.inputs['IOR'].default_value = 1.52; P.inputs['Coat Weight'].default_value = .6; P.inputs['Coat Roughness'].default_value = .03
    return m
def mat_frame():
    m = bpy.data.materials.new('frame'); P = m.node_tree.nodes['Principled BSDF']; P.inputs['Base Color'].default_value = (.55, .56, .58, 1); P.inputs['Metallic'].default_value = .9; P.inputs['Roughness'].default_value = .35; return m
PW, PD, TILT = 4.6, 2.3, math.radians(32)
grow = FRAME_T  # 0..1 铺设进度（远处先铺满）
V, F, UV, FM = [], [], [], []
row_pitch, col_pitch = 6.8, 5.0
base = np.array([[-PW / 2, 0, 0], [PW / 2, 0, 0], [PW / 2, PD * math.cos(TILT), PD * math.sin(TILT)], [-PW / 2, PD * math.cos(TILT), PD * math.sin(TILT)]])
mask_n = lambda x, y: np.sin(x * .013 + 2) * np.sin(y * .017 + 1) + .5 * np.sin(x * .041 - y * .023)
cnt = 0
for y in np.arange(-260, 560, row_pitch):
    if int((y + 260) // row_pitch) % 24 == 23: continue          # 东西向检修道
    for x in np.arange(-1500, 1500, col_pitch):
        if int((x + 1500) // col_pitch) % 30 == 29: continue      # 南北向检修道
        if mask_n(x, y) > 1.15: continue                         # 未铺设的沙地
        reveal = (y + 260) / 820 * .5 + .5 * (np.sin(x * .002) * .5 + .5)
        if reveal < 1 - grow * 1.05: continue
        z = H(x, y) + 1.1; v0 = len(V)
        for k, b in enumerate(base): V.append((x + b[0], y + b[1], z + b[2]))
        F.append((v0, v0 + 1, v0 + 2, v0 + 3)); UV += [(0, 0), (1, 0), (1, 1), (0, 1)]; cnt += 1
pm = bpy.data.meshes.new('pv'); pm.from_pydata(V, [], F); uvl = pm.uv_layers.new(name='UVMap')
uvl.data.foreach_set('uv', np.array(UV, dtype=np.float32).ravel()); pv = bpy.data.objects.new('pv', pm); S.collection.objects.link(pv); pv.data.materials.append(mat_pv())
sol = pv.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = .06
# 支架：每块板一根立柱（细长方体），并入一个网格
LV, LF = [], []
for f in F[::1]:
    a = np.array(V[f[0]]); b = np.array(V[f[1]]); cx, cy = (a[0] + b[0]) / 2, a[1] + .7; zt = a[2] + .3; zb = zt - 1.6; v0 = len(LV); r = .06
    LV += [(cx - r, cy - r, zb), (cx + r, cy - r, zb), (cx + r, cy + r, zb), (cx - r, cy + r, zb), (cx - r, cy - r, zt), (cx + r, cy - r, zt), (cx + r, cy + r, zt), (cx - r, cy + r, zt)]
    LF += [(v0, v0 + 1, v0 + 5, v0 + 4), (v0 + 1, v0 + 2, v0 + 6, v0 + 5), (v0 + 2, v0 + 3, v0 + 7, v0 + 6), (v0 + 3, v0, v0 + 4, v0 + 7)]
lm = bpy.data.meshes.new('legs'); lm.from_pydata(LV, [], LF); lg = bpy.data.objects.new('legs', lm); S.collection.objects.link(lg); lg.data.materials.append(mat_frame())
print('panels', cnt, flush=True)

# ---------- 风机：一套原型 + 集合实例 ----------
white = bpy.data.materials.new('white'); P = white.node_tree.nodes['Principled BSDF']; P.inputs['Base Color'].default_value = (.82, .82, .83, 1); P.inputs['Roughness'].default_value = .38
def build_rotor():
    bm_ = bmesh.new(); L = 62
    bmesh.ops.create_uvsphere(bm_, u_segments=16, v_segments=10, radius=2.2)
    for k in range(3):
        prof = [(0, 1.6), (.12, 2.4), (.3, 2.0), (.6, 1.2), (1., .35)]; vs = []; ca, sa = math.cos(2 * math.pi * k / 3), math.sin(2 * math.pi * k / 3)
        R = lambda p: (p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca)
        for s_, w in prof:
            vs.append([bm_.verts.new(R(p)) for p in ((-w * .35, 0, 2 + s_ * L), (w * .65, -.25 * w, 2 + s_ * L), (w * .2, .45 * w * (1 - s_) + .05, 2 + s_ * L))])
        for i in range(len(vs) - 1):
            for j in range(3): bm_.faces.new((vs[i][j], vs[i][(j + 1) % 3], vs[i + 1][(j + 1) % 3], vs[i + 1][j]))
        bm_.faces.new(vs[-1])
    m = bpy.data.meshes.new('rotor'); bm_.to_mesh(m); m.shade_smooth(); m.materials.append(white); return m
def build_tower():
    bm_ = bmesh.new()
    bmesh.ops.create_cone(bm_, cap_ends=True, segments=32, radius1=2.6, radius2=1.4, depth=152, matrix=__import__('mathutils').Matrix.Translation((0, 0, 16)))
    bmesh.ops.create_cube(bm_, size=1, matrix=__import__('mathutils').Matrix.Translation((0, -1.5, 93)) @ __import__('mathutils').Matrix.Diagonal((3.6, 11, 3.8, 1)))
    m = bpy.data.meshes.new('tower'); bm_.to_mesh(m); m.materials.append(white); return m
TM, RM = build_tower(), build_rotor()
tpos = []
for row, (y0, x0, n_) in enumerate([(640, -2200, 14), (980, -2600, 14), (1450, -3200, 13)]):
    for i in range(n_): tpos.append((x0 + i * (300 + 120 * row) + rng.uniform(-40, 40), y0 + rng.uniform(-50, 50)))
ROTORS = []
for x, y in tpos:
    yaw = math.radians(rng.uniform(-14, 14)); z = float(H(x, y)) - 1
    to = bpy.data.objects.new('tower', TM); S.collection.objects.link(to); to.location = (x, y, z); to.rotation_euler = (0, 0, yaw)
    ro = bpy.data.objects.new('rotor', RM); S.collection.objects.link(ro)
    ro.location = (x + 7.6 * math.sin(yaw), y - 7.6 * math.cos(yaw), z + 93); ro.rotation_euler = (0, rng.uniform(0, 2.1), yaw); ROTORS.append(ro)

# ---------- 天空 + 太阳 + 大气 ----------
W = bpy.data.worlds.new('sky'); S.world = W; nt = W.node_tree; nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_disc = True; sky.sun_size = math.radians(1.2); sky.sun_intensity = 1.
SUN_EL = math.radians(float(__import__('os').environ.get('SEL', '5'))); SUN_AZ = math.radians(float(__import__('os').environ.get('SAZ', '200')))   # 西北偏西，画面左前方逆光
sky.sun_elevation = SUN_EL; sky.sun_rotation = SUN_AZ; sky.altitude = 1200; sky.air_density = 1.; sky.aerosol_density = 2.2
bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 1.; out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 0.; sd.color = (1., .66, .40); sd.angle = math.radians(.6)
so = bpy.data.objects.new('sun', sd); S.collection.objects.link(so)
d = np.array([math.cos(SUN_EL) * math.sin(SUN_AZ - math.pi / 2) * -1, math.cos(SUN_EL) * math.cos(SUN_AZ - math.pi / 2), math.sin(SUN_EL)])
from mathutils import Vector
so.rotation_euler = (-Vector(d)).to_track_quat('-Z', 'Y').to_euler()
# 薄雾：均匀体积（解析采样，开销小）
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 900, 150)); fog = bpy.context.object; fog.scale = (34000, 34000, 420)
fm = bpy.data.materials.new('fog'); fnt = fm.node_tree; fnt.nodes.remove(fnt.nodes['Principled BSDF']); pvn = fnt.nodes.new('ShaderNodeVolumePrincipled')
pvn.inputs['Color'].default_value = (.95, .80, .66, 1); pvn.inputs['Density'].default_value = .00016; pvn.inputs['Anisotropy'].default_value = .72
fnt.links.new(pvn.outputs['Volume'], fnt.nodes['Material Output'].inputs['Volume']); fog.data.materials.append(fm)
if __import__('os').environ.get('NOFOG'): bpy.data.objects.remove(fog)

# ---------- 相机 ----------
cd = bpy.data.cameras.new('cam'); cd.lens = 32; cd.clip_start = .5; cd.clip_end = 60000; cd.sensor_width = 36; cd.dof.use_dof = True; cd.dof.aperture_fstop = 11; cd.dof.focus_distance = 600
cam = bpy.data.objects.new('cam', cd); S.collection.objects.link(cam); S.camera = cam
u = FRAME_T
cam.location = (-60 - 40 * u, -420 + 120 * u, 26 + 70 * u)
tgt = Vector((-300 - 160 * u, 700, 22)); cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()

# ---------- 渲染 ----------
R = S.render; R.engine = 'CYCLES'; R.resolution_x = 1920; R.resolution_y = 804; R.resolution_percentage = int(RES * 100)
C = S.cycles; C.device = 'CPU'; C.samples = SPP; C.use_adaptive_sampling = True; C.adaptive_threshold = .02; C.use_denoising = True
C.denoiser = 'OPENIMAGEDENOISE'; C.max_bounces = 4; C.diffuse_bounces = 2; C.glossy_bounces = 2; C.transmission_bounces = 2; C.volume_bounces = 1
C.transparent_max_bounces = 2; C.caustics_reflective = False; C.caustics_refractive = False; C.volume_step_rate = 4
S.view_settings.view_transform = 'AgX'; S.view_settings.look = 'AgX - Medium High Contrast'; S.view_settings.exposure = float(__import__('os').environ.get('EXP', '-3'))
R.image_settings.file_format = 'PNG'; R.filepath = OUT; R.threads_mode = 'FIXED'; R.threads = 4
import os
NF = int(os.environ.get('NF', '0'))
if NF == 0:
    t0 = time.time(); bpy.ops.render.render(write_still=True); print('render %.1fs' % (time.time() - t0), flush=True)
else:
    os.makedirs('/tmp/bl/anim', exist_ok=True); ph = [r.rotation_euler[1] for r in ROTORS]
    for f in range(int(os.environ.get('LIMIT', NF))):
        tt = f / 24; out = '/tmp/bl/anim/f%04d.png' % f
        if os.path.exists(out): continue
        e = f / max(1, NF - 1); e = e * e * (3 - 2 * e); u2 = .80 + .15 * e
        cam.location = (-60 - 40 * u2, -420 + 120 * u2, 26 + 70 * u2)
        tg = Vector((-300 - 160 * u2, 700, 22)); cam.rotation_euler = (tg - cam.location).to_track_quat('-Z', 'Y').to_euler()
        for r, p0 in zip(ROTORS, ph): r.rotation_euler[1] = p0 + 1.45 * tt
        R.filepath = out; t0 = time.time(); bpy.ops.render.render(write_still=True); print('frame', f, '%.1fs' % (time.time() - t0), flush=True)
