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

  // 4. 프로필 사진 관리 (사용자 본인 실제 사진 반영 및 영구 보존)
  const photoInputs = document.querySelectorAll('.profile-file-input');
  const profileImgs = document.querySelectorAll('.profile-photo-img');
  const resetBtns = document.querySelectorAll('.profile-reset-btn');

  // 로컬 스토리지에 저장된 사용자 실제 사진이 있으면 즉시 반영
  try {
    let savedUserPhoto = localStorage.getItem('user_profile_photo');
    if (savedUserPhoto) {
      // 이전에 저장된 기본 엠블럼 SVG 또는 데이터 URL에 구버전 텍스트가 있을 경우 정화
      if (savedUserPhoto.includes('G0001628') || savedUserPhoto.includes('profile-badge') || savedUserPhoto.includes('data:image/svg+xml')) {
        localStorage.removeItem('user_profile_photo');
        savedUserPhoto = null;
      } else if (savedUserPhoto.includes('전국 어디든지 가능') || savedUserPhoto.includes('전국 어디든지') || savedUserPhoto.includes('어디든지')) {
        savedUserPhoto = savedUserPhoto.replace(/전국\s*어디(든지|를\s*가나|나)\s*가능/g, '전국 어디든 가능')
                                       .replace(/전국\s*어디든지/g, '전국 어디든')
                                       .replace(/어디든지/g, '어디든');
        localStorage.setItem('user_profile_photo', savedUserPhoto);
      }
      if (savedUserPhoto) {
        profileImgs.forEach(function (img) {
          img.src = savedUserPhoto;
        });
        resetBtns.forEach(function (btn) {
          btn.style.display = 'inline-block';
        });
      }
    }
  } catch (e) {
    // 로컬 스토리지 비활성화 시 무시
  }

  photoInputs.forEach(function (input) {
    input.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (evt) {
        const dataUrl = evt.target.result;
        profileImgs.forEach(function (img) {
          img.src = dataUrl;
        });
        resetBtns.forEach(function (btn) {
          btn.style.display = 'inline-block';
        });
        try {
          localStorage.setItem('user_profile_photo', dataUrl);
        } catch (err) {
          console.warn('LocalStorage limit reached', err);
        }
        showToast('본인 사진이 성공적으로 등록되었습니다.');
      };
      reader.readAsDataURL(file);
    });
  });

  resetBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      try {
        localStorage.removeItem('user_profile_photo');
      } catch (e) {}
      profileImgs.forEach(function (img) {
        img.src = '/images/profile-badge.svg?v=20261012b';
      });
      resetBtns.forEach(function (b) {
        b.style.display = 'none';
      });
      showToast('공식 공인 등록증 엠블럼으로 재설정되었습니다.');
    });
  });

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
