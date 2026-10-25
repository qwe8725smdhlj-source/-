"""얼굴 윤곽(볼·턱선) 슬림 보정: 1번 사진(기준) 대비 넓어 보이는 사진만 은은하게."""
import json, numpy as np, cv2
OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
# 기준(01) 대비 cheek/eye·jaw/eye 비율 초과분의 약 60~70%만 보정(상한 6%) — 과보정 방지
STRENGTH = {'03':0.03,'04':0.045,'05':0.055,'06':0.01,'07':0.055,'09':0.05,'10':0.04,'11':0.02}

def field(shape, pts, disp, sigma):
    H,W = shape[:2]
    x0,y0 = np.maximum(pts.min(0)-3*sigma,0).astype(int); x1,y1 = np.minimum(pts.max(0)+3*sigma,[W,H]).astype(int)
    gx,gy = np.meshgrid(np.arange(x0,x1,dtype=np.float32), np.arange(y0,y1,dtype=np.float32))
    dx = np.zeros_like(gx); dy = np.zeros_like(gx)
    for (px,py),(ddx,ddy) in zip(pts,disp):
        w = np.exp(-((gx-px)**2+(gy-py)**2)/(2*sigma**2))
        dx += w*ddx; dy += w*ddy
    return (x0,y0,x1,y1), dx, dy

def warp(img, pts, disp, sigma):
    (x0,y0,x1,y1),dx,dy = field(img.shape, np.array(pts,float), np.array(disp,float), sigma)
    # 역방향 매핑: 출력 픽셀 y 는 y - D(y) 에서 샘플링 (작은 변위에서 충분히 정확)
    gx,gy = np.meshgrid(np.arange(x0,x1,dtype=np.float32), np.arange(y0,y1,dtype=np.float32))
    out = img.copy()
    out[y0:y1,x0:x1] = cv2.remap(img, gx-dx, gy-dy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return out

def slim_landmarks(img, p, s):
    p = np.array(p); top, chin = p[10], p[152]
    axis = (chin-top)/np.linalg.norm(chin-top); h = np.linalg.norm(chin-top)
    nrm = np.array([axis[1],-axis[0]])
    pts, disp = [], []
    for i in OVAL:
        v = p[i]-top; t = v@axis/h; off = v@nrm          # t: 0=이마, 1=턱끝
        wv = np.clip((t-0.35)/0.3,0,1)                    # 광대 아래(볼·턱)만 강하게, 이마·관자놀이는 거의 0
        d = -s*off*wv*nrm
        pts.append(p[i]); disp.append(d)
        if t > 0.55:                                      # 턱 아래 목선도 함께 살짝
            pts.append(p[i]+axis*0.12*h); disp.append(d*0.6)
    return warp(img, pts, disp, sigma=0.11*h)

if __name__ == '__main__':
    import sys
    lm = json.load(open('lm.json'))
    for k in ['02','03','04','05','06','07','08','09','10','11','01']:
        img = cv2.imread(f'src/{k}.jpg')
        if k in STRENGTH: img = slim_landmarks(img, lm[k], STRENGTH[k])
        if k == '08':  # 옆모습: 턱 아래·목선(배경과 맞닿는 윤곽)을 위·안쪽으로 살짝
            pts = [(480,590),(460,610),(440,625),(420,640),(400,600),(380,570)]
            disp= [(-6,-7),(-7,-8),(-6,-8),(-4,-6),(-3,-5),(-2,-3)]
            img = warp(img, pts, disp, sigma=28)
        cv2.imwrite(f'slim/{k}.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 96])
        print('done', k)
