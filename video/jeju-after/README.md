# 제주도 이후의 삶 (인스타그램 영상)

사진 → 얼굴 윤곽 보정 → 켄번스 모션·자막·디졸브 영상 렌더링.

## 순서
1. `src/01.jpg ~ 11.jpg` 에 사진 배치, `assets/` 에 `face_landmarker.task`(MediaPipe), `NotoSerifKR.ttf`, `NotoSansKR[wght].ttf`
2. `python3 detect_faces.py` → `lm.json` (얼굴 랜드마크)
3. `python3 slim.py` → `slim/` (01번 사진 기준, 넓어 보이는 사진만 볼·턱선 2~5.5% 보정)
4. `python3 render.py feed` (1080x1350) / `python3 render.py reels` (1080x1920) → `out/`

자막·순서·노출 시간은 `render.py` 의 `SLIDES` 에서 수정.

## 첫 화면 검은색 문제 대응
- 0프레임부터 사진+제목이 보이게 구성 (검은 화면 페이드인 없음)
- B-프레임 0, MP4 edit list 미기록, 첫 프레임 pts=0 키프레임
- 30fps 고정, yuv420p, BT.709 태그, faststart, 무음 AAC 트랙
- `out/cover_*.jpg` 를 업로드 시 '커버 수정 → 카메라 롤에서 추가'로 지정
