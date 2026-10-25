import mediapipe as mp, numpy as np, json
from PIL import Image, ImageOps
from mediapipe.tasks.python import vision, BaseOptions
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path='assets/face_landmarker.task'), num_faces=3, min_face_detection_confidence=0.2))
# approximate crop boxes around the user's face (x0,y0,x1,y1) in source px
boxes = {'01':(1450,500,2500,1650),'02':(440,600,880,1000),'03':(400,180,800,560),'04':(680,740,980,1010),
 '05':(880,330,1240,660),'06':(420,120,640,360),'07':(390,120,560,290),'08':(120,220,560,700),
 '09':(760,120,1140,520),'10':(530,770,700,940),'11':(150,200,800,900)}
res={}
for k,(x0,y0,x1,y1) in boxes.items():
    im = ImageOps.exif_transpose(Image.open(f'src/{k}.jpg')).convert('RGB')
    c = im.crop((x0,y0,x1,y1)); s = max(1, 768/max(c.size)); c = c.resize((int(c.width*s),int(c.height*s)), Image.LANCZOS)
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(c).copy()))
    if not r.face_landmarks: print(k,'NO FACE'); continue
    lm = r.face_landmarks[0]
    p = np.array([[l.x*c.width/s+x0, l.y*c.height/s+y0] for l in lm])
    d=lambda a,b: float(np.linalg.norm(p[a]-p[b]))
    yaw = (d(1,234)-d(1,454))/(d(1,234)+d(1,454))
    print(k, 'n=%d'%len(r.face_landmarks), 'center=(%.0f,%.0f)'%tuple(p.mean(0)), 'cheek/eye=%.3f jaw/eye=%.3f cheek/h=%.3f yaw=%.2f'%(d(234,454)/d(33,263), d(172,397)/d(33,263), d(234,454)/d(10,152), yaw))
    res[k]=p.tolist()
json.dump(res,open('lm.json','w'))
