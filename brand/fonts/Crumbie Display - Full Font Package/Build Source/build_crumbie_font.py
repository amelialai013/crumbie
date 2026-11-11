from pathlib import Path
import json, string, html, csv, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.svgLib.path import SVGPath
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0

ROOT=Path(os.environ.get('CRUMBIE_FONT_ROOT', str(Path(__file__).resolve().parent.parent)))
OUT=ROOT/'Fonts'
SOURCE='https://www.figma.com/design/p7frP9QPKw5ZT9Cs5xhyJm/Club-Crumbie?node-id=95-261'
records={}; advances={}; provenance={}

def bounds(rec):
    p=BoundsPen(None);rec.replay(p);return p.bounds

def from_svg(text):
    p=RecordingPen();SVGPath.fromstring(text).draw(p);return p

def sample(x):
    rec=from_svg(x['svg']);b=bounds(rec)
    if b is None:raise ValueError('Empty outline '+x['char'])
    x0,y0,x1,y1=b;s=1000/(y1-y0)
    out=RecordingPen();rec.replay(TransformPen(out,(s,0,0,-s,40-x0*s,y1*s)))
    records[x['char']]=out;advances[x['char']]=round((x1-x0)*s+80)
    provenance[x['char']]='Exact supplied vector; uniformly scaled; Figma '+x['id']

for x in json.loads((ROOT/'source-glyphs.json').read_text())+json.loads((ROOT/'alternate-glyphs.json').read_text()):sample(x)

def rect(x,y,w,h,r=0):
    if not r:return f'M{x} {y}h{w}v{h}h{-w}Z'
    return f'M{x+r} {y}H{x+w-r}Q{x+w} {y} {x+w} {y+r}V{y+h-r}Q{x+w} {y+h} {x+w-r} {y+h}H{x+r}Q{x} {y+h} {x} {y+h-r}V{y+r}Q{x} {y} {x+r} {y}Z'

def ellipse(cx,cy,rx,ry,reverse=False):
    k=.5522847498
    if not reverse:
        return f'M{cx+rx} {cy}C{cx+rx} {cy+ry*k} {cx+rx*k} {cy+ry} {cx} {cy+ry}C{cx-rx*k} {cy+ry} {cx-rx} {cy+ry*k} {cx-rx} {cy}C{cx-rx} {cy-ry*k} {cx-rx*k} {cy-ry} {cx} {cy-ry}C{cx+rx*k} {cy-ry} {cx+rx} {cy-ry*k} {cx+rx} {cy}Z'
    return f'M{cx+rx} {cy}C{cx+rx} {cy-ry*k} {cx+rx*k} {cy-ry} {cx} {cy-ry}C{cx-rx*k} {cy-ry} {cx-rx} {cy-ry*k} {cx-rx} {cy}C{cx-rx} {cy+ry*k} {cx-rx*k} {cy+ry} {cx} {cy+ry}C{cx+rx*k} {cy+ry} {cx+rx} {cy+ry*k} {cx+rx} {cy}Z'

def glyph(name,path,width):
    rec=from_svg(f'<svg xmlns="http://www.w3.org/2000/svg"><path d="{path}"/></svg>')
    out=RecordingPen();rec.replay(TransformPen(out,(1,0,0,-1,40,1000)))
    records[name]=out;advances[name]=int(width+80);provenance[name]='New matching glyph; not present in supplied examples'

# Missing letters: heavy silhouettes, soft exterior corners, open notches,
# and the pointed angular details present in the supplied R, M, N and E.
designs={
'F':(670,'M30 0H650Q680 0 658 25L470 190Q450 208 470 225L600 325Q625 345 600 362L330 520V975Q330 1000 305 1000H30Q0 1000 0 970V30Q0 0 30 0Z'),
'H':(800,'M30 0H245Q270 0 270 25V290Q270 350 400 350Q530 350 530 290V25Q530 0 555 0H770Q800 0 800 30V970Q800 1000 770 1000H555Q530 1000 530 975V680Q530 620 400 620Q270 620 270 680V975Q270 1000 245 1000H30Q0 1000 0 970V30Q0 0 30 0Z'),
'J':(680,'M360 0H650Q680 0 680 30V650C680 875 540 1000 330 1000C130 1000 0 875 0 700Q0 665 35 665H215Q245 665 250 700C260 790 360 800 360 690V0Z'),
'K':(820,'M30 0H255Q285 0 285 30V345L635 10Q650 0 675 0H800Q835 0 810 30L435 470L815 965Q840 1000 800 1000H600Q575 1000 560 980L285 635V970Q285 1000 255 1000H30Q0 1000 0 970V30Q0 0 30 0Z'),
'P':(740,'M30 0H395C600 0 740 130 740 325C740 515 620 645 395 645H290V975Q290 1000 265 1000H30Q0 1000 0 970V30Q0 0 30 0Z'),
'V':(900,'M30 0H280Q305 0 313 28L450 490L587 28Q595 0 620 0H870Q905 0 894 35L600 975Q592 1000 565 1000H335Q308 1000 300 975L6 35Q-5 0 30 0Z'),
'W':(1200,'M25 0H265Q290 0 297 30L390 465L485 175Q493 150 515 150H685Q707 150 715 175L810 465L903 30Q910 0 935 0H1175Q1205 0 1197 32L990 975Q982 1000 955 1000H730Q710 1000 700 975L600 665L500 975Q490 1000 470 1000H245Q218 1000 210 975L3 32Q-5 0 25 0Z'),
'X':(850,'M30 0H260Q280 0 295 25L425 235L555 25Q570 0 590 0H820Q855 0 835 35L565 485L845 965Q865 1000 830 1000H590Q570 1000 555 975L425 755L295 975Q280 1000 260 1000H20Q-15 1000 5 965L285 485L15 35Q-5 0 30 0Z'),
'Z':(800,'M30 0H770Q800 0 800 30V180Q800 200 780 225L380 730H770Q800 730 800 760V970Q800 1000 770 1000H30Q0 1000 0 970V815Q0 795 20 770L415 270H30Q0 270 0 240V30Q0 0 30 0Z'),
'one':(520,'M50 190L280 10Q295 0 320 0H430Q460 0 460 30V970Q460 1000 430 1000H190Q160 1000 160 970V295L70 330Q40 340 40 310V220Q40 200 50 190Z'),
'two':(760,'M25 205C80 65 200 0 390 0C610 0 755 135 755 320C755 450 690 530 560 640L430 750H725Q755 750 755 780V970Q755 1000 725 1000H30Q0 1000 0 970V810Q0 780 25 755L415 350C460 300 440 235 365 235C310 235 275 260 255 310Q245 335 220 325L40 260Q0 245 25 205Z'),
'three':(760,'M45 85C125 25 240 0 370 0C600 0 745 105 745 280C745 380 700 450 615 490C710 530 760 605 760 720C760 900 610 1000 375 1000C220 1000 110 965 35 905Q15 885 30 860L125 720Q140 700 165 715C225 755 295 775 365 775C445 775 485 740 485 680C485 620 440 590 355 590H250Q225 590 225 565V420Q225 395 250 395H350C430 395 470 365 470 310C470 255 430 225 360 225C290 225 230 245 175 280Q150 295 135 270L35 125Q20 100 45 85Z'),
'four':(800,'M395 0H660Q690 0 690 30V555H775Q800 555 800 580V775Q800 800 775 800H690V975Q690 1000 665 1000H445Q420 1000 420 975V800H25Q0 800 0 775V620Q0 600 15 575L365 20Q380 0 395 0ZM420 555V265L240 555Z'),
'five':(760,'M65 0H710Q740 0 740 30V235Q740 265 710 265H310V355C570 295 755 430 755 650C755 880 600 1000 365 1000C210 1000 95 950 25 875Q5 855 25 830L140 685Q160 665 185 685C245 735 320 765 375 735C440 700 430 615 365 585C305 555 235 575 190 600Q170 610 145 600L40 555Q20 545 20 520L35 30Q35 0 65 0Z'),
'six':(780,'M655 35Q685 50 665 80L550 240Q535 260 510 245C420 200 320 245 285 375C525 280 780 400 780 665C780 880 625 1000 395 1000C135 1000 0 825 0 530C0 200 175 0 445 0C525 0 600 10 655 35Z'+ellipse(415,670,88,105,True)),
'seven':(760,'M30 0H730Q760 0 760 30V195Q760 215 750 240L410 975Q400 1000 375 1000H130Q95 1000 110 965L450 270H30Q0 270 0 240V30Q0 0 30 0Z'),
'eight':(780,ellipse(390,280,345,280)+ellipse(390,705,390,295)+ellipse(390,280,78,88,True)+ellipse(390,710,90,100,True)),
'nine':(780,'M125 965Q95 950 115 920L230 760Q245 740 270 755C360 800 460 755 495 625C255 720 0 600 0 335C0 120 155 0 385 0C645 0 780 175 780 470C780 800 605 1000 335 1000C255 1000 180 990 125 965Z'+ellipse(365,330,88,105,True)),
}
for name,(width,path) in designs.items():glyph(name,path,width)

# Q retains the supplied O; the tail is the only added part.
rec=RecordingPen();records['O'].replay(rec);ow=advances['O']-80
rec.moveTo((ow*.65,160));rec.lineTo((ow+45,-100));rec.lineTo((ow*.6,25));rec.closePath()
records['Q']=rec;advances['Q']=advances['O']+30;provenance['Q']='New tail applied to exact supplied O outline'
records['zero']=records['O'];advances['zero']=advances['O'];provenance['zero']='Exact supplied O reused as a solid display zero'

punct={
'period':(185,ellipse(92,910,92,90)),
'comma':(215,'M25 820H190V940Q190 1110 35 1160V1060Q95 1020 95 1000H25Z'),
'colon':(185,ellipse(92,360,92,90)+ellipse(92,910,92,90)),
'semicolon':(215,ellipse(100,360,92,90)+'M25 820H190V940Q190 1110 35 1160V1060Q95 1020 95 1000H25Z'),
'exclam':(240,rect(0,0,240,680,45)+ellipse(120,910,100,90)),
'question':(690,'M30 170C105 55 220 0 370 0C565 0 690 105 690 265C690 395 620 470 485 545Q410 590 410 680H175V610Q175 465 300 390C405 330 440 300 440 260C440 205 345 205 285 265Q265 285 245 270L40 215Q5 205 30 170Z'+ellipse(290,910,105,90)),
'hyphen':(430,rect(0,445,430,160,35)),
'endash':(720,rect(0,445,720,160,35)),
'emdash':(1100,rect(0,445,1100,160,35)),
'underscore':(750,rect(0,1050,750,130,25)),
'slash':(650,'M450 -50H630L190 1050H10Z'),
'backslash':(650,'M20 -50H200L640 1050H460Z'),
'parenleft':(390,'M350 -75C60 40 0 235 0 500C0 765 60 960 350 1075L390 850C210 770 215 625 215 500C215 375 210 230 390 150Z'),
'parenright':(390,'M40 -75C330 40 390 235 390 500C390 765 330 960 40 1075L0 850C180 770 175 625 175 500C175 375 180 230 0 150Z'),
'bracketleft':(350,'M0 -50H350V120H190V880H350V1050H0Z'),
'bracketright':(350,'M0 -50H350V1050H0V880H160V120H0Z'),
'braceleft':(450,'M450 -50V120H330Q240 120 240 220V350Q240 450 145 500Q240 550 240 650V780Q240 880 330 880H450V1050H300Q60 1050 60 810V650Q60 575 0 575V425Q60 425 60 350V190Q60 -50 300 -50Z'),
'braceright':(450,'M0 -50V120H120Q210 120 210 220V350Q210 450 305 500Q210 550 210 650V780Q210 880 120 880H0V1050H150Q390 1050 390 810V650Q390 575 450 575V425Q390 425 390 350V190Q390 -50 150 -50Z'),
'quotesingle':(170,rect(0,0,170,300,45)),
'quotedbl':(410,rect(0,0,170,300,45)+rect(240,0,170,300,45)),
'plus':(650,rect(0,425,650,160,25)+rect(245,180,160,650,25)),
'equal':(650,rect(0,300,650,150,25)+rect(0,600,650,150,25)),
'less':(650,'M650 150V360L240 500L650 640V850L0 585V415Z'),
'greater':(650,'M0 150V360L410 500L0 640V850L650 585V415Z'),
'bar':(150,rect(0,-50,150,1100,30)),
'asciitilde':(800,'M0 400Q150 200 400 350Q620 500 800 300V520Q650 720 400 570Q180 420 0 620Z'),
'asciicircum':(700,'M0 330L250 0H450L700 330H450L350 190L250 330Z'),
'asterisk':(650,'M245 0H405L420 200L590 100L650 250L465 340L620 470L510 600L325 440L140 600L30 470L185 340L0 250L60 100L230 200Z'),
'numbersign':(850,'M240 0H420L380 300H550L590 0H770L730 300H850V480H705L680 670H810V850H655L635 1000H455L475 850H305L285 1000H105L125 850H0V670H150L175 480H45V300H200ZM355 480L330 670H500L525 480Z'),
'percent':(900,ellipse(190,220,185,220)+ellipse(710,780,185,220)+'M740 0H900L160 1000H0Z'),
'at':(1050,ellipse(525,500,525,500)+ellipse(525,500,300,300,True)+rect(650,300,170,430,30)+ellipse(490,505,150,190)),
'ampersand':(920,'M600 70C470 -30 180 -10 110 140C40 290 140 400 220 480C65 560 0 660 0 780C0 980 245 1070 470 970L565 905L650 1000H900L730 780L900 555H665L600 630L385 350C320 265 290 210 340 185Q390 160 450 215Z'),
'bullet':(270,ellipse(135,500,135,135)),
}
for name,(width,path) in punct.items():glyph(name,path,width)
rec=RecordingPen();records['S'].replay(rec);w=advances['S']-80
glyph('dollarbar',rect(w/2-25,-100,90,1200,15),w)
records['dollarbar'].replay(rec);records['dollar']=rec;advances['dollar']=advances['S'];provenance['dollar']='Matching currency sign based on supplied S'
del records['dollarbar'];del advances['dollarbar'];del provenance['dollarbar']
records['space']=RecordingPen();advances['space']=380;provenance['space']='Spacing glyph'
glyph('.notdef',rect(0,0,650,1000)+'M150 150V850H500V150Z',650)

punctmap={'!':'exclam','"':'quotedbl','#':'numbersign','$':'dollar','%':'percent','&':'ampersand',"'":'quotesingle','(':'parenleft',')':'parenright','*':'asterisk','+':'plus',',':'comma','-':'hyphen','.':'period','/':'slash',':':'colon',';':'semicolon','<':'less','=':'equal','>':'greater','?':'question','@':'at','[':'bracketleft','\\':'backslash',']':'bracketright','^':'asciicircum','_':'underscore','`':'quotesingle','{':'braceleft','|':'bar','}':'braceright','~':'asciitilde'}
digitnames=['zero','one','two','three','four','five','six','seven','eight','nine']
cmap={ord(' '):'space',160:'space'}
for c in string.ascii_uppercase:cmap[ord(c)]=c;cmap[ord(c.lower())]=c
for i,name in enumerate(digitnames):cmap[48+i]=name
for c,name in punctmap.items():cmap[ord(c)]=name
for cp,name in {0x2013:'endash',0x2014:'emdash',0x2018:'quotesingle',0x2019:'quotesingle',0x201c:'quotedbl',0x201d:'quotedbl',0x2022:'bullet',0x2026:'ellipsis'}.items():
    if name=='ellipsis':glyph(name,ellipse(90,910,90,90)+ellipse(370,910,90,90)+ellipse(650,910,90,90),740)
    cmap[cp]=name

glyphorder=['.notdef','space']+[g for g in records if g not in ['.notdef','space']]
metrics={name:(advances[name],round(bounds(rec)[0]) if bounds(rec) else 0) for name,rec in records.items()}
metrics['three']=(840, 59)
kern={('A','V'):-70,('A','Y'):-65,('A','T'):-35,('T','A'):-65,('T','O'):-35,('V','A'):-70,('W','A'):-40,('Y','A'):-65,('Y','O'):-35,('L','T'):-35,('L','Y'):-50,('L','V'):-45,('O','T'):-20,('R','T'):-20,('R','Y'):-20}
features='languagesystem DFLT dflt;\nfeature kern {\n'+''.join(f'pos {a} {b} {v};\n' for (a,b),v in kern.items())+'} kern;\nfeature ss01 { sub C by C.coming; sub M by M.coming; sub N by N.coming; } ss01;\nfeature ss02 { sub T by T.tuned; sub U by U.tuned; sub N by N.tuned; sub E by E.tuned; } ss02;\n'

def build(ttf):
    fb=FontBuilder(1000,isTTF=ttf);fb.setupGlyphOrder(glyphorder);fb.setupCharacterMap(cmap)
    if ttf:
        glyphs={}
        for name,rec in records.items():
            p=TTGlyphPen(None);rec.replay(Cu2QuPen(p,0.45,reverse_direction=True));glyphs[name]=p.glyph()
        fb.setupGlyf(glyphs)
    else:
        chars={}
        for name,rec in records.items():
            p=T2CharStringPen(advances[name],None);rec.replay(p);chars[name]=p.getCharString(private=None,globalSubrs=None)
        fb.setupCFF('CrumbieDisplay-Regular',{'FullName':'Crumbie Display Regular','FamilyName':'Crumbie Display','Weight':'Regular','version':'1.001'},chars,{})
    fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=1150,descent=-300,lineGap=0)
    fb.setupNameTable({'familyName':'Crumbie Display','styleName':'Regular','uniqueFontIdentifier':'ClubCrumbie:CrumbieDisplay-Regular:1.001','fullName':'Crumbie Display Regular','psName':'CrumbieDisplay-Regular','version':'Version 1.001','manufacturer':'Club Crumbie','designer':'Club Crumbie source lettering; matching extension by Codex','description':'All-caps display font. Supplied Figma letter outlines plus newly designed matching characters. See glyph-provenance.csv.','licenseDescription':'Custom build from user-supplied lettering. No additional rights in source lettering are granted. Not an open-source font licence.'})
    fb.setupOS2(version=4,sTypoAscender=1150,sTypoDescender=-300,sTypoLineGap=0,usWinAscent=1250,usWinDescent=350,sxHeight=1000,sCapHeight=1000,usWeightClass=900,fsSelection=192)
    fb.setupPost();fb.setupMaxp();addOpenTypeFeaturesFromString(fb.font,features)
    if ttf:
        t=newTable('kern');t.version=0;k=KernTable_format_0();k.version=0;k.coverage=1;k.kernTable=kern;t.kernTables=[k];fb.font['kern']=t
    path=OUT/('CrumbieDisplay-Regular.'+('ttf' if ttf else 'otf'));fb.save(path)
    return path

otf=build(False);ttf=build(True)
web=TTFont(ttf);web.flavor='woff2';web.save(OUT/'CrumbieDisplay-Regular.woff2')
(ROOT/'Build Source'/'features.fea').write_text(features)
with (ROOT/'glyph-provenance.csv').open('w',newline='') as f:
    w=csv.writer(f);w.writerow(['Glyph','Provenance','Advance width / 1000 em']);w.writerows((name,provenance[name],advances[name]) for name in glyphorder)
checks=[]
for path in [otf,ttf,OUT/'CrumbieDisplay-Regular.woff2']:
    font=TTFont(path);cm=font.getBestCmap();missing=[chr(cp) for cp in range(32,127) if cp not in cm]
    assert not missing,missing
    assert 'GSUB' in font and 'GPOS' in font
    assert 'kern' in {x.FeatureTag for x in font['GPOS'].table.FeatureList.FeatureRecord}
    assert {'ss01','ss02'} <= {x.FeatureTag for x in font['GSUB'].table.FeatureList.FeatureRecord}
    checks.append({'file':path.name,'glyphs':len(font.getGlyphOrder()),'encodedCharacters':len(cm),'asciiCoverage':'95/95','bytes':path.stat().st_size})
(ROOT/'validation.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks,indent=2))
