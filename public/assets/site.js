/**
 * 김병수 손해사정사무소 공식 스크립트
 * 시인성 높은 UI 인터랙션, 모바일 메뉴, 연락처 복사, 상황별 진단 탭, 사진 관리
 */
document.addEventListener('DOMContentLoaded', function () {
  // 1. 모바일 메뉴 열기/닫기
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navPanel = document.getElementById('mobileNavPanel');
  if (menuBtn && navPanel) {
    menuBtn.addEventListener('click', function () {
      navPanel.classList.toggle('open');
      const isOpen = navPanel.classList.contains('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // 2. 원클릭 상황별 진단 탭 인터랙션
  const pills = document.querySelectorAll('.checker-pill');
  const resultCards = document.querySelectorAll('.checker-result-card');

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      if (!targetId) return;

      pills.forEach(function (p) { p.classList.remove('active'); });
      resultCards.forEach(function (c) { c.classList.remove('active'); });

      this.classList.add('active');
      const targetCard = document.getElementById(targetId);
      if (targetCard) {
        targetCard.classList.add('active');
      }
    });
  });

  // 3. 전화번호 / 계좌 복사 버튼 & 토스트 알림
  const toast = document.getElementById('toastMsg') || createToastElement();
  const copyBtns = document.querySelectorAll('[data-copy-text]');

  copyBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const text = this.getAttribute('data-copy-text');
      if (!text) return;

      const isNotice = text.includes('소비자선임권') || text.includes('선임 통보서');
      const successMsg = isNotice ? '소비자선임권 행사 통보 문안이 클립보드에 복사되었습니다.' : ('내용이 복사되었습니다: ' + text);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast(successMsg);
        }).catch(function () {
          fallbackCopy(text, successMsg);
        });
      } else {
        fallbackCopy(text, successMsg);
      }
    });
  });

  function fallbackCopy(text, successMsg) {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || ('복사되었습니다: ' + text));
    } catch (e) {
      showToast('직접 복사해 주세요');
    }
    document.body.removeChild(input);
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  function createToastElement() {
    const el = document.createElement('div');
    el.id = 'toastMsg';
    el.className = 'toast-msg';
    document.body.appendChild(el);
    return el;
  }

  // 4. 프로필 사진 관리 (영구 파일 및 로컬 사진 동기화, 직접 등록 지원)
  const profileImgs = document.querySelectorAll('.profile-photo-img');
  const uploadInputs = document.querySelectorAll('.profile-upload-input');
  const hideBtns = document.querySelectorAll('.profile-hide-btn');
  const photoActionBars = document.querySelectorAll('.profile-photo-actions');

  // 버튼을 항상 기본 표시 (사용자가 직접 클릭하여 숨길 때만 숨김)
  photoActionBars.forEach(function (bar) {
    bar.style.display = 'flex';
  });

  // 버튼 숨기기 클릭 이벤트
  hideBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      photoActionBars.forEach(function (bar) {
        bar.style.display = 'none';
      });
      showToast('등록 버튼이 숨겨졌습니다. (사진을 클릭하시면 다시 등록창이 열립니다)');
    });
  });

  // 사진 영역 클릭 시 파일 등록 창 바로 열기 지원
  profileImgs.forEach(function (img) {
    img.style.cursor = 'pointer';
    img.title = '클릭하여 내 사진 직접 등록 / 변경';
    img.addEventListener('click', function () {
      const input = document.querySelector('.profile-upload-input');
      if (input) input.click();
    });

    // 이미지 로드 실패 시 공식 인증 엠블럼으로 자동 전환
    img.addEventListener('error', function () {
      if (!img.src.includes('profile-badge.svg')) {
        img.src = '/images/profile-badge.svg';
      }
    });
  });

  // 이미지 파일 전처리 및 서버 영구 동기화 함수 (어느 기기/브라우저든 100% 호환되는 표준 JPEG 변환)
  function processAndSaveImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(JPG, PNG, WEBP 등)만 등록 가능합니다.');
      return;
    }

    showToast('사진을 최적화하여 서버에 영구 저장하는 중입니다...');

    const reader = new FileReader();
    reader.onload = function (evt) {
      const img = new Image();
      img.onload = function () {
        try {
          // 인물 프로필 표준 규격 (680 x 906, 3:4 비율, Retina 고해상도 지원)
          const targetW = 680;
          const targetH = 906;
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 3:4 비율 맞춤 크롭 (인물 사진 특성에 맞춰 상단 12% 중심 맞춤)
          const imgRatio = img.width / img.height;
          const targetRatio = targetW / targetH;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgRatio > targetRatio) {
            sWidth = img.height * targetRatio;
            sx = (img.width - sWidth) / 2;
          } else {
            sHeight = img.width / targetRatio;
            sy = Math.max(0, (img.height - sHeight) * 0.12);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

          // 모든 기기(아이폰, 안드로이드, 카카오톡, 사파리 등)에서 100% 열리는 표준 JPEG 변환 (약 150~250KB)
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

          // 즉시 화면 반영
          profileImgs.forEach(function (el) {
            el.src = optimizedDataUrl;
          });

          try {
            localStorage.setItem('user_profile_photo', optimizedDataUrl);
          } catch (e) {}

          // 서버 파일로 영구 저장
          fetch('/api/save-profile-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: optimizedDataUrl })
          })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data && data.success) {
                const ts = Date.now();
                profileImgs.forEach(function (el) {
                  el.src = '/images/profile-photo.jpg?v=' + ts;
                });
                showToast('✅ 대표 사진이 완벽하게 등록되었습니다! (모든 기기·브라우저·카카오톡 호환 완료)');
              } else {
                showToast('사진이 적용되었습니다.');
              }
            })
            .catch(function () {
              showToast('사진이 적용되었습니다.');
            });
        } catch (err) {
          console.error(err);
          // 캔버스 실패 시 원본 그대로 전송 시도
          fallbackSaveRaw(evt.target.result);
        }
      };
      img.onerror = function () {
        fallbackSaveRaw(evt.target.result);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function fallbackSaveRaw(rawUrl) {
    profileImgs.forEach(function (el) {
      el.src = rawUrl;
    });
    fetch('/api/save-profile-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: rawUrl })
    }).catch(function () {});
  }

  // 파일 선택을 통한 본인 사진 등록
  uploadInputs.forEach(function (input) {
    input.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processAndSaveImage(file);
      }
    });
  });

  // 드래그 앤 드롭으로 프로필 카드에 사진 직접 끌어다 놓기 지원
  document.querySelectorAll('.profile-card').forEach(function (card) {
    card.addEventListener('dragover', function (e) {
      e.preventDefault();
      card.style.outline = '2px dashed var(--navy-accent, #2563EB)';
      card.style.outlineOffset = '4px';
    });
    card.addEventListener('dragleave', function () {
      card.style.outline = 'none';
    });
    card.addEventListener('drop', function (e) {
      e.preventDefault();
      card.style.outline = 'none';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processAndSaveImage(e.dataTransfer.files[0]);
      }
    });
  });

  // 기존 저장된 본인 사진 동기화
  try {
    const savedUserPhoto = localStorage.getItem('user_profile_photo');
    if (savedUserPhoto) {
      if (savedUserPhoto.startsWith('data:image/')) {
        profileImgs.forEach(function (img) {
          img.src = savedUserPhoto;
        });
        // 서버 파일로 영구 저장 동기화
        fetch('/api/save-profile-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: savedUserPhoto })
        }).catch(function () {});
      } else if (savedUserPhoto.includes('profile-badge')) {
        localStorage.removeItem('user_profile_photo');
      }
    }
  } catch (e) {
    // 로컬 스토리지 비활성화 시 무시
  }

  // 5. 업무 지역 표기 통일 보장 ('전국 어디든 가능')
  function normalizeRegionText() {
    try {
      if (document.title && document.title.includes('어디든지')) {
        document.title = document.title.replace(/전국\s*어디든지\s*가능/g, '전국 어디든 가능')
                                       .replace(/전국\s*어디든지/g, '전국 어디든')
                                       .replace(/어디든지/g, '어디든');
      }

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue) {
          if (/전국\s*어디(든지|를\s*가나|나)\s*가능/.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(/전국\s*어디(든지|를\s*가나|나)\s*가능/g, '전국 어디든 가능');
          }
          if (node.nodeValue.includes('전국 어디든지')) {
            node.nodeValue = node.nodeValue.replace(/전국\s*어디든지/g, '전국 어디든');
          }
          if (node.nodeValue.includes('어디든지')) {
            node.nodeValue = node.nodeValue.replace(/어디든지/g, '어디든');
          }
          if (node.nodeValue.includes('진단 담보비의 청구전 사망') || node.nodeValue.includes('진단 담보비의 청구 전 사망')) {
            node.nodeValue = node.nodeValue.replace(/진단\s*담보비의\s*청구\s*전\s*사망/g, '진단비 담보의 청구 전 사망');
          }
          if (node.nodeValue.includes('이미 보험사에서 재검토가 가능한가요')) {
            node.nodeValue = node.nodeValue.replace(/이미\s*보험사에서\s*재검토가\s*가능한가요\??/g, '이미 보험회사에서 보험금 지급이 거절된 경우 재검토가 가능한가요?');
          }
          if (node.nodeValue.includes('미스밀짐')) {
            node.nodeValue = node.nodeValue.replace(/미스밀짐/g, '미끄러짐');
          }
          if (node.nodeValue.includes('미스이짐')) {
            node.nodeValue = node.nodeValue.replace(/미스이짐/g, '미끄러짐');
          }
          if (/미스[밀이]짐/.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(/미스[밀이]짐/g, '미끄러짐');
          }
          if (node.nodeValue.includes('도미흡')) {
            node.nodeValue = node.nodeValue.replace(/도미흡/g, '');
          }
          if (node.nodeValue.includes('도 미흡')) {
            node.nodeValue = node.nodeValue.replace(/도\s*미흡/g, '');
          }
          if (node.nodeValue.includes('반려견 통제 미흡')) {
            node.nodeValue = node.nodeValue.replace(/,\s*반려견\s*통제\s*미흡/g, '').replace(/반려견\s*통제\s*미흡,\s*/g, '').replace(/반려견\s*통제\s*미흡/g, '');
          }
          if (node.nodeValue.includes('통제 미흡')) {
            node.nodeValue = node.nodeValue.replace(/,\s*통제\s*미흡/g, '').replace(/통제\s*미흡,\s*/g, '').replace(/통제\s*미흡/g, '');
          }
        }
      }

      document.querySelectorAll('[alt], [title], [aria-label]').forEach(function (el) {
        ['alt', 'title', 'aria-label'].forEach(function (attr) {
          const val = el.getAttribute(attr);
          if (val && val.includes('어디든지')) {
            el.setAttribute(attr, val.replace(/전국\s*어디(든지|를\s*가나|나)\s*가능/g, '전국 어디든 가능').replace(/어디든지/g, '어디든'));
          }
          if (val && val.includes('미스밀짐')) {
            el.setAttribute(attr, val.replace(/미스밀짐/g, '미끄러짐'));
          }
          if (val && (val.includes('미스이짐') || /미스[밀이]짐/.test(val))) {
            el.setAttribute(attr, val.replace(/미스[밀이]짐/g, '미끄러짐'));
          }
          if (val && val.includes('도미흡')) {
            el.setAttribute(attr, val.replace(/도미흡/g, ''));
          }
          if (val && val.includes('통제 미흡')) {
            el.setAttribute(attr, val.replace(/,\s*통제\s*미흡/g, '').replace(/통제\s*미흡/g, ''));
          }
        });
      });
    } catch (e) {}
  }
  normalizeRegionText();

  if (window.MutationObserver) {
    const obs = new MutationObserver(function () {
      normalizeRegionText();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
});
