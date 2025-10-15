// === ĐỔI URL NÀY sang Web App URL (Apps Script) của bạn ===
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydZ2eEx19rf_dTZnQA9FfGw-yf3gOjaC67HdjjCsnDTOLXtV8Mob6wLYMvX7sxVc03/exec';

/* -------------------- Helpers -------------------- */
const $id = (x) => document.getElementById(x);

/* -------------------- Modal: mở/đóng (Tư vấn) -------------------- */
function openConsultModal() {
  const m = $id('consultModal');
  if (!m) return;
  m.classList.add('active');
  m.classList.remove('hidden');
  setTimeout(() => $id('fullName')?.focus(), 50);
}
function closeConsultModal() {
  const m = $id('consultModal');
  if (!m) return;
  m.classList.remove('active');
  m.classList.add('hidden');
}

/* -------------------- Validate -------------------- */
const nameOk  = (v) => v && v.trim().length >= 2;
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
const phoneOk = (v) => {
  if (!v) return false;
  const digits = (v + '').replace(/\D/g, '');
  return /^(\+?84|84|0)\d{8,10}$/.test(v) || /^(\+?84|84|0)\d{8,10}$/.test(digits);
};
const setErr = (id, show) => { const el = $id(id); if (el) el.classList.toggle('hidden', !show) };

/* -------------------- Toast đơn giản -------------------- */
function toast(message, type = 'success') {
  const n = document.createElement('div');
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 2000; max-width: 340px;
    padding: 16px 18px; border-radius: 10px; color: #fff; font-weight: 600;
    box-shadow: 0 12px 28px rgba(0,0,0,.22); animation: slideIn .25s ease;
    background: ${type === 'error'
      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
      : 'linear-gradient(135deg, #48bb78, #38a169)'};
  `;
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = 'slideOut .25s ease';
    setTimeout(() => document.body.removeChild(n), 250);
  }, 2500);
}

/* -------------------- No-op notification (để HTML cũ không lỗi) -------------------- */
function showNotification(_) { /* no-op */ }

/* ---------- Utilities chuẩn hoá URL PDF để nhúng an toàn ---------- */
function normalizeDriveUrl(url) {
  // /file/d/ID/view  -> /file/d/ID/preview
  const m1 = url.match(/https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1) return `https://drive.google.com/file/d/${m1[1]}/preview`;
  // open?id=ID -> uc?export=view&id=ID
  const m2 = url.match(/https?:\/\/drive\.google\.com\/(?:open|uc)\?[^#]*id=([^&#]+)/i);
  if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
  // bất kỳ .../view -> /preview
  if (/drive\.google\.com\/.*\/view/i.test(url)) return url.replace(/\/view(\?.*)?$/i, '/preview');
  return url;
}
function buildPdfEmbedUrl(rawUrl) {
  let url = rawUrl.trim();
  if (/drive\.google\.com/i.test(url)) return normalizeDriveUrl(url);
  // PDF ngoài: dùng Google Docs Viewer để nhúng
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
}

/* -------------------- PDF Viewer Modal (Hợp đồng) -------------------- */
function openPdfModal(rawUrl) {
  const modal = $id('pdfModal');
  const frame = $id('pdfFrame');
  if (!modal || !frame) return;

  const safeUrl = buildPdfEmbedUrl(rawUrl);
  frame.src = safeUrl;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  // Fallback: nếu bị chặn nhúng, mở tab mới sau 2s
  const timer = setTimeout(() => {
    try {
      if (!frame.contentWindow || !frame.contentDocument) {
        window.open(rawUrl, '_blank', 'noopener');
      }
    } catch {
      window.open(rawUrl, '_blank', 'noopener');
    }
  }, 2000);
  frame.onload = () => clearTimeout(timer);
}
function closePdfModal() {
  const modal = $id('pdfModal');
  const frame = $id('pdfFrame');
  if (!modal || !frame) return;
  frame.src = '';
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = 'auto';
}

/* -------------------- Wire & Submit (DOMContentLoaded) -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const consult = $id('consultModal');
  if (consult) consult.addEventListener('click', (e) => { if (e.target === consult) closeConsultModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeConsultModal(); closeContract(); closePdfModal(); } });

  document.querySelectorAll('.service-card button').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openConsultModal(); });
  });

  const form = $id('consultForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = $id('fullName')?.value.trim() ?? '';
      const phone    = $id('phone')?.value.trim() ?? '';
      const address  = $id('address')?.value.trim() ?? '';
      const email    = $id('email')?.value.trim() ?? '';

      let valid = true;
      setErr('errName',  !(valid = nameOk(fullName)  && valid));
      setErr('errPhone', !(valid = phoneOk(phone)   && valid));
      setErr('errEmail', !(valid = emailOk(email)   && valid));
      if (!valid) return;

      const btn = $id('submitBtn');
      const prev = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Đang gửi...'; btn.disabled = true; }

      try {
        const fd = new FormData();
        fd.append('name', fullName);
        fd.append('phone', phone);
        fd.append('address', address);
        fd.append('email', email);

        const res  = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        let ok = res.ok;
        try {
          const data = await res.json();
          ok = ok && (data.ok === true || Object.keys(data || {}).length === 0);
        } catch { /* nếu không trả JSON nhưng HTTP ok thì vẫn coi như ok */ }

        if (ok) {
          toast('Gửi thành công! Chúng tôi sẽ liên hệ sớm.');
          form.reset();
          closeConsultModal();
        } else {
          toast('Gửi thất bại. Vui lòng thử lại.', 'error');
        }
      } catch (err) {
        console.error(err);
        toast('Lỗi mạng. Vui lòng thử lại.', 'error');
      } finally {
        if (btn) { btn.textContent = prev; btn.disabled = false; }
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  displayContracts(currentPage);
  displayPagination();

  const contractModal = $id('contract-modal');
  if (contractModal) contractModal.addEventListener('click', (e) => { if (e.target === contractModal) closeContract(); });

  const pdfModal = $id('pdfModal');
  if (pdfModal) pdfModal.addEventListener('click', (e) => { if (e.target === pdfModal) closePdfModal(); });
});

/* -------------------- Các tương tác khác (giữ để HTML không lỗi) -------------------- */
function interactWithRobot() {
  const robot = document.querySelector('.interactive-robot');
  if (!robot) return;
  robot.style.transform = 'scale(1.2) rotate(10deg)';
  robot.style.filter = 'drop-shadow(0 0 40px rgba(215, 176, 113, 0.8))';
  setTimeout(() => { robot.style.transform = ''; robot.style.filter = 'drop-shadow(0 0 20px rgba(215, 176, 113, 0.3))'; }, 1000);
}
function showRobotInfo() {}
function hideRobotInfo() {}
function exploreAI()     { setTimeout(() => $id('about')?.scrollIntoView({ behavior: 'smooth' }), 300); }
function viewProgram()   { setTimeout(() => $id('values')?.scrollIntoView({ behavior: 'smooth' }), 300); }
function scrollToNext()  { $id('about')?.scrollIntoView({ behavior: 'smooth' }); }
function showFeature(_)  {}
function showValueDetail(_) {}
function exploreService(_)  {}

/* -------------------- Dữ liệu & UI Hợp đồng -------------------- */
const contracts = [
  {
    id: 1,
    title: "Dự án AI Giáo dục Tiểu học",
    description: "Triển khai hệ thống AI hỗ trợ giảng dạy cho các trường tiểu học tại TP.HCM",
    date: "2024-01-15",
    status: "Đang thực hiện",
    value: "2.5 tỷ VNĐ",
    image: "https://cdn.pixabay.com/photo/2018/05/08/08/44/artificial-intelligence-3382507_1280.jpg",
    pdfUrl: "https://drive.google.com/file/d/17YCbZnppMMNMleVXogw1VAHf_zMUuhgj/view?usp=drive_link",
    content: `<!-- GIỮ NỘI DUNG CHI TIẾT BẠN ĐÃ CÓ Ở TRƯỚC -->`
  },
  {
    id: 2,
    title: "Hệ thống Robot THCS",
    description: "Cung cấp và lắp đặt robot giáo dục cho các trường THCS tại Hà Nội",
    date: "2024-02-20",
    status: "Hoàn thành",
    value: "1.8 tỷ VNĐ",
    image: "https://cdn.pixabay.com/photo/2017/08/30/12/45/girl-2696947_1280.jpg",
    pdfUrl: "https://drive.google.com/file/d/175I1b28gBXX2ycL71kHPY_Dh81Jzh0L7/view?usp=drive_link",
    content: `<!-- GIỮ NỘI DUNG CHI TIẾT BẠN ĐÃ CÓ Ở TRƯỚC -->`
  },
  {
    id: 3,
    title: "AI Chatbot Hỗ trợ Học tập",
    description: "Phát triển chatbot AI hỗ trợ học tập cho học sinh THPT",
    date: "2024-03-10",
    status: "Đang thực hiện",
    value: "800 triệu VNĐ",
    image: "https://cdn.pixabay.com/photo/2023/04/06/15/50/chatbot-7904738_1280.jpg",
    pdfUrl: "https://drive.google.com/file/d/1731fEaRhoVQflKEj1QFaOHM0k6-wISE4/view?usp=drive_link",
    content: `<!-- GIỮ NỘI DUNG CHI TIẾT BẠN ĐÃ CÓ Ở TRƯỚC -->`
  },
  // ...Các hợp đồng 4-8 của bạn giữ nguyên (thêm pdfUrl nếu có)
];

let currentPage = 1;
const contractsPerPage = 6;

function displayContracts(page) {
  const startIndex = (page - 1) * contractsPerPage;
  const endIndex = startIndex + contractsPerPage;
  const contractsToShow = contracts.slice(startIndex, endIndex);

  const grid = $id('contracts-grid');
  if (!grid) return;
  grid.innerHTML = '';

  contractsToShow.forEach(contract => {
    const hasPdf = !!contract.pdfUrl;
    const el = document.createElement('div');
    el.className = 'contract-card bg-white rounded-xl overflow-hidden shadow-lg';
    el.innerHTML = `
      <div class="relative">
        <img src="${contract.image}" alt="${contract.title}" class="w-full h-48 object-cover interactive-robot">
        <div class="absolute top-4 right-4">
          <span class="px-3 py-1 text-xs font-semibold rounded-full ${
            contract.status === 'Hoàn thành' ? 'bg-green-100 text-green-800' :
            contract.status === 'Đang thực hiện' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }">${contract.status}</span>
        </div>
        ${hasPdf ? `
          <button class="absolute bottom-3 left-3 bg-black/70 hover:bg-black/85 text-white text-xs px-3 py-1 rounded-md"
                  onclick="openPdfModal('${contract.pdfUrl}'); event.stopPropagation();">
            📄 Xem PDF
          </button>` : ``}
      </div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-3">
          <span class="text-sm text-gray-500">${contract.date}</span>
          <span class="text-lg font-bold text-secondary">${contract.value}</span>
        </div>
        <h3 class="text-xl font-bold text-primary mb-2">${contract.title}</h3>
        <p class="text-gray-600 mb-4">${contract.description}</p>
        <div class="flex gap-2">
          ${
            hasPdf
              ? `<button onclick="openPdfModal('${contract.pdfUrl}')"
                         class="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors text-sm flex-1 interactive-button">
                  📄 PDF
                 </button>`
              : `<button disabled
                         class="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm flex-1 cursor-not-allowed">
                  📄 PDF chưa có
                 </button>`
          }
        </div>
      </div>
    `;

    // ✅ Click vào CARD: ưu tiên mở PDF, fallback modal/ toast
    el.classList.add('cursor-pointer');
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (contract.pdfUrl) {
        openPdfModal(contract.pdfUrl);
      } else if (contract.content && contract.content.trim() !== '' && contract.content.trim() !== '<!-- GIỮ NỘI DUNG CHI TIẾT BẠN ĐÃ CÓ Ở TRƯỚC -->') {
        viewContract(contract.id);
      } else {
        toast('Hợp đồng này chưa có file PDF.', 'error');
      }
    });

    grid.appendChild(el);
  });
}


function displayPagination() {
  const totalPages = Math.ceil(contracts.length / contractsPerPage);
  const pagination = $id('pagination');
  if (!pagination) return;
  pagination.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.className = `page-btn ${i === currentPage ? 'active' : ''} interactive-button`;
    b.textContent = i;
    b.onclick = () => { currentPage = i; displayContracts(currentPage); displayPagination(); };
    pagination.appendChild(b);
  }
}

function viewContract(id) {
  const c = contracts.find(x => x.id === id);
  if (!c) return;
  $id('contract-title').textContent = c.title;
  $id('contract-details').innerHTML = c.content || '<p>Đang cập nhật nội dung…</p>';
  const cm = $id('contract-modal');
  if (cm) { cm.style.display = 'block'; document.body.style.overflow = 'hidden'; }
}
function closeContract() {
  const cm = $id('contract-modal');
  if (cm) { cm.style.display = 'none'; document.body.style.overflow = 'auto'; }
}

/* Alias cũ: nếu HTML còn gọi downloadPDF() */
function downloadPDF(id) {
  const c = contracts.find(x => x.id === id);
  if (c?.pdfUrl) openPdfModal(c.pdfUrl);
  else toast('Hợp đồng này chưa có file PDF.', 'error');
}

  // Reveal when the rail enters viewport
  (function(){
    const rail = document.getElementById('socialRail');
    if (!rail) return;
    const items = rail.querySelectorAll('.rail-item');
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          items.forEach((it)=> it.style.opacity = ''); // allow CSS animation
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    io.observe(rail);
  })();

  // Magnetic hover: icon hơi "nghiêng" theo chuột
  (function(){
    const rail = document.getElementById('socialRail');
    if (!rail) return;
    rail.querySelectorAll('.rail-btn').forEach(btn=>{
      const maxTilt = 6; // độ nghiêng tối đa (deg)
      const maxShift = 4; // px
      btn.addEventListener('mousemove', (e)=>{
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 2 - 1;  // -1..1
        const y = ((e.clientY - r.top) / r.height) * 2 - 1;  // -1..1
        btn.style.transform = `translateX(-4px) scale(1.04) rotateX(${-y*maxTilt}deg) rotateY(${x*maxTilt}deg) translateY(${y*maxShift}px)`;
      });
      btn.addEventListener('mouseleave', ()=>{
        btn.style.transform = '';
      });
    });
  })();
