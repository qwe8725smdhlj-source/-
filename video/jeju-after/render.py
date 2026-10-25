"""'제주도 이후의 삶' 인스타그램 영상 렌더러.

사용: python3 render.py [feed|reels]
  feed  = 1080x1350 (4:5, 피드 게시물 권장)
  reels = 1080x1920 (9:16, 릴스/스토리)

첫 화면이 검게 나오는 문제 대응
  1) 0번째 프레임부터 사진+제목이 완전히 보이도록 구성 (검은 화면에서 페이드인 없음)
  2) B-프레임 미사용(-bf 0) + 편집목록(edit list) 미기록 → 첫 프레임 표시 지연/누락 방지
  3) 고정 30fps, yuv420p, BT.709 색 정보 명시, faststart, 무음 AAC 트랙 포함
  4) 커버 이미지(cover_*.jpg)를 따로 내보내 업로드 시 '커버 수정'에 직접 지정 가능
"""
import sys, subprocess, math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

MODE = sys.argv[1] if len(sys.argv) > 1 else 'feed'
W, H = (1080, 1350) if MODE == 'feed' else (1080, 1920)
FPS = 30
XF = 0.7                       # 디졸브 길이(초)
SERIF = 'assets/NotoSerifKR.ttf'
SANS = 'assets/NotoSansKR[wght].ttf'

# (파일, 노출 시간, 큰 자막, 작은 자막, 포커스 영역 x0,y0,x1,y1, 줌 방향 +1 확대/-1 축소)
SLIDES = [
    ('01', 4.0, '제주도 이후의 삶', '오랜만에 전하는 근황', (400, 600, 2480, 1600), +1),
    ('04', 3.4, '제주에서의 시간', '', (540, 800, 970, 1700), +1),
    ('02', 3.4, '바다가 일상이던 날들', '', (200, 680, 1200, 1600), -1),
    ('03', 3.4, '가끔은 아빠가 미용사', '', (300, 200, 1300, 1300), +1),
    ('05', 3.4, '그리고, 새로운 시작', '', (200, 380, 1950, 1500), +1),
    ('06', 3.4, '좋은 분들을 만나 배우며', '', (300, 90, 720, 676), -1),
    ('08', 3.4, '여름이면 여전히 바다로', '', (100, 250, 870, 1300), +1),
    ('09', 3.4, '아이들은 어느새 이만큼', '', (380, 150, 2000, 1512), -1),
    ('10', 3.4, '온 가족이 함께한 여행', '', (130, 740, 840, 1200), +1),
    ('11', 4.6, '요즘, 우리는', '잘 지내고 있습니다', (0, 250, 1360, 1836), +1),
]

def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * min(max(t, 0), 1))

def font(path, size, wght):
    f = ImageFont.truetype(path, size)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f

def text_layer(title, sub, big):
    """자막을 RGBA로 한 번만 그려두고 프레임마다 위치·투명도만 바꾼다."""
    tf = font(SERIF, 86 if big else 60, 700 if big else 600)
    sf = font(SANS, 40 if big else 36, 400)
    lay = Image.new('RGBA', (W, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    y = 40
    tw = d.textlength(title, font=tf)
    d.text(((W - tw) / 2, y), title, font=tf, fill=(255, 255, 255, 255))
    y += tf.size + 34
    if sub:
        d.line([(W / 2 - 28, y - 14), (W / 2 + 28, y - 14)], fill=(255, 255, 255, 200), width=2)
        sw = d.textlength(sub, font=sf)
        d.text(((W - sw) / 2, y + 6), sub, font=sf, fill=(255, 255, 255, 235))
        y += sf.size + 20
    # 부드러운 그림자로 어떤 배경에서도 읽히게
    a = np.array(lay.split()[-1])
    sh = Image.fromarray((a * 0.55).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    shadow = Image.new('RGBA', lay.size, (0, 0, 0, 0)); shadow.putalpha(sh)
    out = Image.alpha_composite(shadow, lay).crop((0, 0, W, y + 40))
    return np.asarray(out).astype(np.float32) / 255.0

def cover_rect(iw, ih, aspect):
    if iw / ih > aspect: h = ih; w = ih * aspect
    else: w = iw; h = iw / aspect
    return w, h

class Slide:
    def __init__(self, key, dur, title, sub, focus, zdir, idx):
        img = cv2.cvtColor(cv2.imread(f'slim/{key}.jpg'), cv2.COLOR_BGR2RGB)
        self.img = img; self.dur = dur; self.zdir = zdir; self.idx = idx
        ih, iw = img.shape[:2]
        fx0, fy0, fx1, fy1 = focus
        self.fc = ((fx0 + fx1) / 2, (fy0 + fy1) / 2)
        cw, ch = cover_rect(iw, ih, W / H)
        # 포커스(인물)가 꽉 찬 화면에 들어가면 fill, 아니면 원본 전체 + 흐린 배경(fit)
        self.fill = (fx1 - fx0) <= cw * 0.98 and (fy1 - fy0) <= ch * 0.98
        if not self.fill:
            s = W / iw
            self.fw, self.fh = W, int(round(ih * s))
            self.fy = int((H - self.fh) * (0.62 if idx == 0 else 0.40))
            bg = cv2.resize(img, None, fx=0.15, fy=0.15, interpolation=cv2.INTER_AREA)
            bw, bh = cover_rect(bg.shape[1], bg.shape[0], W / H)
            bx, by = (bg.shape[1] - bw) / 2, (bg.shape[0] - bh) / 2
            bg = cv2.resize(bg[int(by):int(by + bh), int(bx):int(bx + bw)], (W, H), interpolation=cv2.INTER_CUBIC)
            self.bg = (cv2.GaussianBlur(bg, (0, 0), 28).astype(np.float32) * 0.55)
        self.cw, self.ch = cw, ch
        self.text = text_layer(title, sub, idx == 0) if title else None

    def frame(self, t):
        """t: 슬라이드 시작 기준 초. 켄번스(느린 줌·팬)."""
        p = ease(t / self.dur)
        z0, z1 = (1.0, 1.08) if self.zdir > 0 else (1.08, 1.0)
        z = z0 + (z1 - z0) * p
        ih, iw = self.img.shape[:2]
        if self.fill:
            w, h = self.cw / z, self.ch / z
            # 시작은 포커스 쪽으로 약간, 끝은 포커스 중앙으로 — 화면 밖으로 나가지 않게 clamp
            cx = np.clip(self.fc[0], w / 2, iw - w / 2); cy = np.clip(self.fc[1], h / 2, ih - h / 2)
            sx, sy = W / w, H / h
            M = np.float32([[sx, 0, -(cx - w / 2) * sx], [0, sy, -(cy - h / 2) * sy]])
            return cv2.warpAffine(self.img, M, (W, H), flags=cv2.INTER_AREA if sx < 1 else cv2.INTER_CUBIC,
                                  borderMode=cv2.BORDER_REFLECT).astype(np.float32)
        out = self.bg.copy()
        s = (W / iw) * z
        cx, cy = self.fc[0] if z > 1 else iw / 2, self.fc[1] if z > 1 else ih / 2
        cx = np.clip(cx, iw / 2 / z, iw - iw / 2 / z); cy = np.clip(cy, ih / 2 / z, ih - ih / 2 / z)
        M = np.float32([[s, 0, self.fw / 2 - cx * s], [0, s, self.fh / 2 - cy * s]])
        fg = cv2.warpAffine(self.img, M, (self.fw, self.fh), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC,
                            borderMode=cv2.BORDER_REFLECT).astype(np.float32)
        out[self.fy:self.fy + self.fh] = fg
        return out

    def overlay(self, frame, t):
        if self.text is None: return frame
        th = self.text.shape[0]
        if self.idx == 0:
            a, dy = 1.0, 0.0                       # 첫 프레임부터 제목이 보이도록 (썸네일용)
        else:
            k = ease((t - 0.35) / 0.7); a, dy = k, (1 - k) * 26
        if a <= 0: return frame
        if self.fill:
            # 아래쪽 그라데이션 + 하단 자막
            y = int(H - th - (110 if MODE == 'feed' else 330) + dy)
            g0 = max(y - 160, 0)
            grad = np.linspace(0, 0.55, H - g0, dtype=np.float32)[:, None, None]
            frame[g0:] *= (1 - grad * a)
        else:
            if self.idx == 0: y = int(max(self.fy - th - 40, 60))
            else: y = int(min(self.fy + self.fh + 30, H - th - 60) + dy)
        y = max(0, min(y, H - th))
        rgb, al = self.text[..., :3] * 255, self.text[..., 3:] * a
        frame[y:y + th] = frame[y:y + th] * (1 - al) + rgb * al
        return frame

def vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    return (1 - 0.18 * np.clip(r - 0.55, 0, 1) ** 1.5)[..., None]

def main():
    slides = [Slide(*s, idx=i) for i, s in enumerate(SLIDES)]
    starts, t = [], 0.0
    for s in slides:
        starts.append(t); t += s.dur - XF
    total = t + XF
    nframes = int(round(total * FPS))
    vig = vignette()
    out = f'out/jeju_after_{MODE}.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
           '-map', '0:v', '-map', '1:a', '-shortest',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-level', '4.1',
           '-pix_fmt', 'yuv420p', '-bf', '0', '-g', str(FPS), '-r', str(FPS), '-fps_mode', 'cfr',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
           '-c:a', 'aac', '-b:a', '128k',
           '-movflags', '+faststart', '-use_editlist', '0', '-avoid_negative_ts', 'make_zero', out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(nframes):
        tt = n / FPS
        frame = None
        for i, s in enumerate(slides):
            lt = tt - starts[i]
            if lt < 0 or lt > s.dur: continue
            f = s.overlay(s.frame(lt), lt)
            # 디졸브: 다음 슬라이드가 앞 슬라이드 위로 서서히
            a = 1.0 if i == 0 else ease(lt / XF)
            frame = f if frame is None else frame * (1 - a) + f * a
        frame = np.clip(frame * vig, 0, 255).astype(np.uint8)
        if n == 0:
            Image.fromarray(frame).save(f'out/cover_{MODE}.jpg', quality=95)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close(); ff.wait()
    print(out, f'{total:.1f}s', nframes, 'frames')

if __name__ == '__main__':
    main()
