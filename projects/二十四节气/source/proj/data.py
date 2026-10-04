# -*- coding: utf-8 -*-
"""《二十四节气》内容数据：每镜一个 shot 字典。所有史实见 facts.md。"""
import math

EPS = 23.44  # 黄赤交角（度）

def decl(lam):
    """太阳赤纬 = 太阳直射点纬度（度）"""
    return math.degrees(math.asin(math.sin(math.radians(EPS)) * math.sin(math.radians(lam))))

# 多音字/古读替换，只作用于 TTS
PRON = {
    '桃始华': '桃始花', '桐始华': '桐始花', '白昼最长': '白昼最常', '腐草为萤': '腐草唯萤', '露结为霜': '露结唯霜', '菊有黄华': '菊有黄花', '处暑': '楚暑', '处，止也': '楚，止也',
    '芒种': '忙众', '稻子种': '稻子众', '雁北乡': '雁北向', '二〇一六': '二零一六',
    '《': '', '》': '', '·': '', '“': '', '”': '',
}

SEASONS = {
    'spring': dict(ch='卷一', name='春', sub='春三月，此谓发陈'),
    'summer': dict(ch='卷二', name='夏', sub='夏三月，此谓蕃秀'),
    'autumn': dict(ch='卷三', name='秋', sub='秋三月，此谓容平'),
    'winter': dict(ch='卷四', name='冬', sub='冬三月，此谓闭藏'),
}

# name, 黄经, 约略公历, 三候, 旁白, 诗(两句), 出处, 场景
TERMS = [
 ('立春',315,'2月4日前后',['东风解冻','蛰虫始振','鱼陟负冰'],'立春。东风解冻，蛰虫始振，一岁之始。',
  ['律回岁晚冰霜少','春到人间草木知'],'宋 · 张栻《立春偶成》',
  dict(season='spring',tod='dawn',snow=.55,ice=.9,thaw=1,green=.15,wind=1,mist=.35)),
 ('雨水',330,'2月19日前后',['獭祭鱼','鸿雁来','草木萌动'],'雨水。冰雪化作雨，草木萌动。',
  ['好雨知时节','当春乃发生'],'唐 · 杜甫《春夜喜雨》',
  dict(season='spring',tod='overcast',rain=.7,green=.4,mist=.7,geese=1)),
 ('惊蛰',345,'3月5日前后',['桃始华','仓庚鸣','鹰化为鸠'],'惊蛰。春雷乍响，桃始华。',
  ['微雨众卉新','一雷惊蛰始'],'唐 · 韦应物《观田家》',
  dict(season='spring',tod='storm',rain=.35,lightning=1,green=.6,blossom=.8,bloomcol='peach',mist=.4)),
 ('春分',0,'3月20日前后',['玄鸟至','雷乃发声','始电'],'春分。太阳直射赤道，昼夜平分。',
  ['仲春初四日','春色正中分'],'唐 · 徐铉《春分日》',
  dict(orbit=True)),
 ('清明',15,'4月4日前后',['桐始华','田鼠化为鴽','虹始见'],'清明。气清景明，桐始华。',
  ['清明时节雨纷纷','路上行人欲断魂'],'唐 · 杜牧《清明》（一说）',
  dict(season='spring',tod='misty',rain=.3,green=.85,blossom=.6,bloomcol='white',mist=.9,swallows=1)),
 ('谷雨',30,'4月20日前后',['萍始生','鸣鸠拂其羽','戴胜降于桑'],'谷雨。雨生百谷，春天的最后一程。',
  ['谷雨春光晓','山川黛色青'],'唐 · 元稹《咏廿四气诗》',
  dict(season='spring',tod='soft',rain=.45,green=1,petals=1,bloomcol='peach',blossom=.3,mist=.5)),
 ('立夏',45,'5月5日前后',['蝼蝈鸣','蚯蚓出','王瓜生'],'立夏。万物至此，皆长大。',
  ['泥新巢燕闹','花尽蜜蜂稀'],'宋 · 陆游《立夏》',
  dict(season='summer',tod='noon',green=1,swallows=1,mist=.2)),
 ('小满',60,'5月21日前后',['苦菜秀','靡草死','麦秋至'],'小满。麦粒渐满，尚未全熟。',
  ['最爱垄头麦','迎风笑落红'],'宋 · 欧阳修《小满》',
  dict(season='summer',tod='sunset',green=1,wheat=.45,mist=.25)),
 ('芒种',75,'6月5日前后',['螳螂生','䴗始鸣','反舌无声'],'芒种。有芒的麦子收，有芒的稻子种。',
  ['时雨及芒种','四野皆插秧'],'宋 · 陆游《时雨》',
  dict(season='summer',tod='noon',green=1,wheat=1,paddy=1,mist=.2)),
 ('夏至',90,'6月21日前后',['鹿角解','蜩始鸣','半夏生'],'夏至。太阳直射北回归线，白昼最长。',
  ['昼晷已云极','宵漏自此长'],'唐 · 韦应物《夏至避暑北池》',
  dict(orbit=True)),
 ('小暑',105,'7月7日前后',['温风至','蟋蟀居壁','鹰始挚'],'小暑。温风至，蟋蟀居壁。',
  ['倏忽温风至','因循小暑来'],'唐 · 元稹《咏廿四气诗》',
  dict(season='summer',tod='haze',green=1,lotus=1,heat=1,mist=.3)),
 ('大暑',120,'7月22日前后',['腐草为萤','土润溽暑','大雨时行'],'大暑。腐草为萤，一年最热。',
  ['赤日几时过','清风无处寻'],'宋 · 曾几《大暑》',
  dict(season='summer',tod='night',green=1,lotus=1,fireflies=1,moon=1,mist=.3)),
 ('立秋',135,'8月7日前后',['凉风至','白露降','寒蝉鸣'],'立秋。凉风至，寒蝉鸣。',
  ['乳鸦啼散玉屏空','一枕新凉一扇风'],'宋 · 刘翰《立秋》',
  dict(season='autumn',tod='sunset',green=.85,autumn=.25,leaves=.3,wind=.6,mist=.3)),
 ('处暑',150,'8月23日前后',['鹰乃祭鸟','天地始肃','禾乃登'],'处暑。处，止也，暑气至此而止。',
  ['离离暑云散','袅袅凉风起'],'唐 · 白居易《早秋曲江感怀》',
  dict(season='autumn',tod='clear',green=.7,autumn=.4,wheat=.9,eagle=1,mist=.15)),
 ('白露',165,'9月7日前后',['鸿雁来','玄鸟归','群鸟养羞'],'白露。阴气渐重，露凝而白。',
  ['露从今夜白','月是故乡明'],'唐 · 杜甫《月夜忆舍弟》',
  dict(season='autumn',tod='night',green=.6,autumn=.5,dew=1,moon=1,mist=.6)),
 ('秋分',180,'9月23日前后',['雷始收声','蛰虫坯户','水始涸'],'秋分。昼夜再次平分，雷始收声。',
  ['金气秋分','风清露冷秋期半'],'宋 · 谢逸《点绛唇》',
  dict(orbit=True)),
 ('寒露',195,'10月8日前后',['鸿雁来宾','雀入大水为蛤','菊有黄华'],'寒露。鸿雁来宾，菊有黄华。',
  ['袅袅凉风动','凄凄寒露零'],'唐 · 白居易《池上》',
  dict(season='autumn',tod='clear',green=.4,autumn=.8,geese=1,chrys=1,mist=.3)),
 ('霜降',210,'10月23日前后',['豺乃祭兽','草木黄落','蛰虫咸俯'],'霜降。气肃而凝，露结为霜。',
  ['月落乌啼霜满天','江枫渔火对愁眠'],'唐 · 张继《枫桥夜泊》',
  dict(season='autumn',tod='night',green=.2,autumn=1,maple=1,leaves=1,frost=1,moon=1,boat=1,mist=.5)),
 ('立冬',225,'11月7日前后',['水始冰','地始冻','雉入大水为蜃'],'立冬。水始冰，地始冻。',
  ['霜降向人寒','轻冰渌水漫'],'唐 · 元稹《咏廿四气诗》',
  dict(season='winter',tod='overcast',green=0,autumn=.6,bare=.7,ice=.35,frost=.6,mist=.5)),
 ('小雪',240,'11月22日前后',['虹藏不见','天气上升','闭塞而成冬'],'小雪。虹藏不见，天地闭塞而成冬。',
  ['晚来天欲雪','能饮一杯无'],'唐 · 白居易《问刘十九》',
  dict(season='winter',tod='dusk',bare=1,snow=.4,snowfall=.4,ice=.5,mist=.5,lamp=1)),
 ('大雪',255,'12月7日前后',['鹖鴠不鸣','虎始交','荔挺出'],'大雪。大者，盛也，至此而雪盛矣。',
  ['千山鸟飞绝','万径人踪灭'],'唐 · 柳宗元《江雪》',
  dict(season='winter',tod='snowday',bare=1,snow=1,snowfall=1,boat=1,fisher=1,mist=.7)),
 ('冬至',270,'12月21日前后',['蚯蚓结','麋角解','水泉动'],'冬至。白昼最短，阳气自此回升。',
  ['天时人事日相催','冬至阳生春又来'],'唐 · 杜甫《小至》',
  dict(orbit=True)),
 ('小寒',285,'1月5日前后',['雁北乡','鹊始巢','雉始雊'],'小寒。雁北乡，鹊始巢。',
  ['小寒连大吕','欢鹊垒新巢'],'唐 · 元稹《咏廿四气诗》',
  dict(season='winter',tod='coldclear',bare=1,snow=.85,ice=.8,magpie=1,plum=.4,mist=.3)),
 ('大寒',300,'1月20日前后',['鸡始乳','征鸟厉疾','水泽腹坚'],'大寒。水泽腹坚，春天就在下一站。',
  ['旧雪未及消','新雪又拥户'],'宋 · 邵雍《大寒吟》',
  dict(season='winter',tod='snowday',bare=1,snow=1,snowfall=.7,ice=1,plum=1,wind=1,mist=.6,dawnlight=1)),
]

SEASON_OF = {}
for i, t in enumerate(TERMS):
    SEASON_OF[t[0]] = ['spring', 'summer', 'autumn', 'winter'][i // 6]

CN_NUM = '〇一二三四五六七八九'
def cn_deg(d):
    return ''.join(CN_NUM[int(c)] for c in str(int(d)))

def build_shots():
    shots = []
    # ---------- 序章 ----------
    shots.append(dict(id='p1', kind='orbit', ch='序章', tempo='slow', min_bars=4,
        narr='地球绕着太阳，一年走完三百六十度。', caption='地球绕着太阳，一年走完三百六十度。',
        cam=dict(mode='wide', a0=-30, a1=10, el0=55, el1=28, d0=150, d1=105), lam0=200, lam1=300, show_ticks=0,
        fx='lap'))
    shots.append(dict(id='p2', kind='orbit', ch='序章', tempo='slow', min_bars=3,
        narr='古人把这条路，每十五度切一刀，', caption='古人把这条路，每十五度切一刀，',
        cam=dict(mode='wide', a0=10, a1=40, el0=28, el1=62, d0=105, d1=118), lam0=300, lam1=330, show_ticks=1,
        fx='cut'))
    shots.append(dict(id='p3', kind='orbit', ch='序章', tempo='slow', min_bars=3,
        narr='切出二十四个节点，这就是二十四节气。', caption='切出二十四个节点，这就是——二十四节气。',
        cam=dict(mode='wide', a0=40, a1=70, el0=62, el1=78, d0=118, d1=128), lam0=330, lam1=345, show_ticks=2,
        fx='labels'))
    shots.append(dict(id='title', kind='title', ch='', tempo='slow', min_bars=4, narr='',
        cam=dict(mode='earth', lam=312), lam0=310, lam1=315))
    order = ['spring', 'summer', 'autumn', 'winter']
    for si, s in enumerate(order):
        S = SEASONS[s]
        t0 = TERMS[si * 6]
        shots.append(dict(id='card_' + s, kind='season', ch=S['ch'] + ' · ' + S['name'], season=s,
            tempo='card', min_bars=2, narr='', big=S['name'], sub=S['sub'],
            lam0=t0[1] - 12, lam1=t0[1] - 1.5))
        for k in range(6):
            name, lam, date, hou, narr, poem, src, scene = TERMS[si * 6 + k]
            idx = si * 6 + k + 1
            shots.append(dict(id='t%02d' % idx, kind='orbit_term' if scene.get('orbit') else 'land',
                ch=S['ch'] + ' · ' + S['name'], season=s, tempo='term', min_bars=4,
                term=name, idx=idx, lam=lam, lam0=lam - 1.5, lam1=lam + 1.5, date=date, hou=hou,
                narr=narr, caption=narr, poem=poem, src=src, scene=scene,
                decl=round(decl(lam), 1), lamcn=cn_deg(lam)))
    # ---------- 尾声 ----------
    shots.append(dict(id='e1', kind='orbit', ch='尾声', tempo='slow', min_bars=3,
        narr='转完一圈，又回到立春。', caption='转完一圈，又回到立春。',
        cam=dict(mode='wide', a0=60, a1=100, el0=70, el1=50, d0=120, d1=110), lam0=300, lam1=315, show_ticks=2, fx='full'))
    shots.append(dict(id='e2', kind='orbit', ch='尾声', tempo='slow', min_bars=3,
        narr='两千多年前，《淮南子》已把它们一一写下。', caption='两千多年前，《淮南子》已把它们一一写下。',
        cam=dict(mode='wide', a0=100, a1=130, el0=50, el1=35, d0=110, d1=100), lam0=315, lam1=325, show_ticks=2, fx='full'))
    shots.append(dict(id='e3', kind='orbit', ch='尾声', tempo='slow', min_bars=3,
        narr='二〇一六年，二十四节气列入人类非物质文化遗产。',
        caption='2016年，“二十四节气”列入人类非物质文化遗产代表作名录。',
        cam=dict(mode='wide', a0=130, a1=160, el0=35, el1=25, d0=100, d1=92), lam0=325, lam1=335, show_ticks=2, fx='full'))
    shots.append(dict(id='e4', kind='orbit', ch='尾声', tempo='slow', min_bars=3,
        narr='太阳每走十五度，大地就换一种表情。', caption='太阳每走十五度，大地就换一种表情。',
        cam=dict(mode='wide', a0=160, a1=200, el0=25, el1=60, d0=92, d1=160), lam0=335, lam1=345, show_ticks=2, fx='full'))
    shots.append(dict(id='end', kind='end', ch='', tempo='slow', min_bars=4, narr='',
        cam=dict(mode='wide', a0=200, a1=215, el0=60, el1=70, d0=160, d1=175), lam0=345, lam1=352, show_ticks=2))
    return shots

if __name__ == '__main__':
    sh = build_shots()
    print(len(sh), 'shots;', sum(len(s['narr']) for s in sh), 'narr chars')
    for t in TERMS:
        print(t[0], t[1], round(decl(t[1]), 1))
