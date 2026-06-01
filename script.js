/* =====================================
   HOPEZAA ACADEMY — INTERACTIONS
   ===================================== */

document.addEventListener("DOMContentLoaded", () => {
  const state = {
    token: localStorage.getItem("hopezaa_token") || "",
    user: null,
    courses: [],
    reviews: [],
    currentView: "all",
    checkoutCourseIds: [],
    testimonialAuto: null
  };

  const els = {
    preloader: document.getElementById("preloader"),
    nav: document.getElementById("nav"),
    navToggle: document.getElementById("navToggle"),
    mobileMenu: document.getElementById("mobileMenu"),
    navAuthBtn: document.getElementById("navAuthBtn"),
    mobileAuthBtn: document.getElementById("mobileAuthBtn"),
    coursesApp: document.getElementById("coursesApp"),
    memberGreeting: document.getElementById("memberGreeting"),
    courseGrid: document.getElementById("courseGrid"),
    cartList: document.getElementById("cartList"),
    cartCount: document.getElementById("cartCount"),
    cartTotal: document.getElementById("cartTotal"),
    checkoutCartBtn: document.getElementById("checkoutCartBtn"),
    checkoutModal: document.getElementById("checkoutModal"),
    checkoutItems: document.getElementById("checkoutItems"),
    checkoutTotal: document.getElementById("checkoutTotal"),
    confirmPaymentBtn: document.getElementById("confirmPaymentBtn"),
    refreshAppBtn: document.getElementById("refreshAppBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    adminPanel: document.getElementById("adminPanel"),
    adminCourseList: document.getElementById("adminCourseList"),
    adminReviewForm: document.getElementById("adminReviewForm"),
    reviewCourseSelect: document.getElementById("reviewCourseSelect"),
    authModal: document.getElementById("authModal"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    authMessage: document.getElementById("authMessage"),
    contactForm: document.getElementById("contactForm"),
    formSuccess: document.getElementById("formSuccess"),
    toast: document.getElementById("toast"),
    testiTrack: document.getElementById("testiTrack"),
    testiDots: document.getElementById("testiDots"),
    testiPrev: document.getElementById("testiPrev"),
    testiNext: document.getElementById("testiNext")
  };

  const money = (value) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0
    }).format(value);

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const showToast = (message) => {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3600);
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
    return data;
  };

  const setSession = (data) => {
    if (data.token) {
      state.token = data.token;
      localStorage.setItem("hopezaa_token", data.token);
    }
    state.user = data.user || state.user;
    state.courses = data.courses || state.courses;
    state.reviews = data.reviews || state.reviews;
    renderAll();
  };

  const loadPublic = async () => {
    try {
      const data = await request("/api/public");
      state.courses = data.courses || [];
      state.reviews = data.reviews || [];
      renderTestimonials();
    } catch {
      showToast("เปิดเว็บผ่านคำสั่ง npm start เพื่อใช้งาน backend");
    }
  };

  const loadSession = async () => {
    if (!state.token) return loadPublic();
    try {
      const data = await request("/api/me");
      setSession(data);
    } catch {
      localStorage.removeItem("hopezaa_token");
      state.token = "";
      state.user = null;
      await loadPublic();
      updateAuthUi();
    }
  };

  const openModal = (modal) => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = (modal) => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const openAuth = () => {
    if (state.user) {
      showCourseArea();
      return;
    }
    setAuthMode("login");
    els.authMessage.classList.remove("show");
    openModal(els.authModal);
  };

  const setAuthMode = (mode) => {
    document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.authMode === mode);
    });
    els.loginForm.hidden = mode !== "login";
    els.registerForm.hidden = mode !== "register";
  };

  const showCourseArea = () => {
    if (!state.user) return openAuth();
    els.coursesApp.hidden = false;
    els.coursesApp.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateAuthUi = () => {
    const label = state.user ? "เปิดคอร์สของฉัน" : "เข้าสู่ระบบ";
    if (els.navAuthBtn) els.navAuthBtn.textContent = label;
    if (els.mobileAuthBtn) els.mobileAuthBtn.textContent = label;
    if (els.coursesApp) els.coursesApp.hidden = !state.user;
    if (els.adminPanel) els.adminPanel.hidden = state.user?.role !== "admin";
    if (els.memberGreeting && state.user) {
      const roleText = state.user.role === "admin" ? "แอดมิน" : "ผู้เรียน";
      els.memberGreeting.textContent = `ยินดีต้อนรับ ${state.user.name} (${roleText}) เลือกซื้อคอร์ส เพิ่มลงตะกร้า หรือชำระเงินได้จากหน้านี้`;
    }
  };

  const renderAll = () => {
    updateAuthUi();
    renderCourses();
    renderCart();
    renderAdmin();
    renderTestimonials();
  };

  const userPurchases = () => new Set(state.user?.purchases || []);
  const userCart = () => new Set(state.user?.cart || []);

  const renderCourses = () => {
    if (!els.courseGrid || !state.user) return;
    const purchases = userPurchases();
    const cart = userCart();
    const courses =
      state.currentView === "owned"
        ? state.courses.filter((course) => purchases.has(course.id))
        : state.courses;

    if (!courses.length) {
      els.courseGrid.innerHTML =
        '<div class="empty-state">ยังไม่มีคอร์สในมุมมองนี้</div>';
      return;
    }

    els.courseGrid.innerHTML = courses
      .map((course) => {
        const owned = purchases.has(course.id);
        const inCart = cart.has(course.id);
        const full = course.enrolled >= course.capacity;
        const seatsLeft = Math.max(course.capacity - course.enrolled, 0);

        return `
          <article class="course-card">
            <div class="course-level">${escapeHtml(course.level)}</div>
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.description)}</p>
            <div class="course-meta">
              <span>${course.lessons} บทเรียน</span>
              <span>${course.hours} ชั่วโมง</span>
              <span>${course.enrolled} ผู้เรียน</span>
            </div>
            <div class="course-price">${money(course.price)}</div>
            ${
              owned
                ? '<div class="course-owned">ซื้อแล้ว พร้อมเรียน</div>'
                : `<div class="course-actions">
                    <button class="btn btn-outline" type="button" data-course-action="cart" data-course-id="${course.id}" ${inCart || full ? "disabled" : ""}>${inCart ? "อยู่ในตะกร้า" : full ? "เต็มแล้ว" : "เพิ่มตะกร้า"}</button>
                    <button class="btn btn-gold" type="button" data-course-action="buy" data-course-id="${course.id}" ${full ? "disabled" : ""}>ซื้อทันที</button>
                  </div>`
            }
          </article>
        `;
      })
      .join("");
  };

  const renderCart = () => {
    if (!els.cartList || !state.user) return;
    const courses = state.courses.filter((course) => (state.user.cart || []).includes(course.id));
    const total = courses.reduce((sum, course) => sum + course.price, 0);

    els.cartCount.textContent = courses.length;
    els.cartTotal.textContent = money(total);
    els.checkoutCartBtn.disabled = courses.length === 0;

    if (!courses.length) {
      els.cartList.innerHTML = '<div class="empty-state">ยังไม่มีคอร์สในตะกร้า</div>';
      return;
    }

    els.cartList.innerHTML = courses
      .map(
        (course) => `
          <div class="cart-item">
            <div>
              <h4>${escapeHtml(course.title)}</h4>
              <p>${money(course.price)}</p>
            </div>
            <button class="cart-remove" type="button" data-remove-cart="${course.id}" aria-label="ลบ ${escapeHtml(course.title)}">×</button>
          </div>
        `
      )
      .join("");
  };

  const renderAdmin = () => {
    if (!els.adminPanel || !state.user || state.user.role !== "admin") return;
    els.adminCourseList.innerHTML = state.courses
      .map(
        (course) => `
          <article class="admin-course">
            <div>
              <h4>${escapeHtml(course.title)}</h4>
              <p>ผู้เรียน ${course.enrolled} คน · ราคา ${money(course.price)}</p>
            </div>
            <div class="admin-controls">
              <button type="button" data-admin-adjust="${course.id}" data-field="enrolled" data-delta="-1" aria-label="ลดจำนวนผู้เรียน">−</button>
              <button type="button" data-admin-adjust="${course.id}" data-field="enrolled" data-delta="1" aria-label="เพิ่มจำนวนผู้เรียน">+</button>
            </div>
          </article>
        `
      )
      .join("");

    els.reviewCourseSelect.innerHTML = state.courses
      .map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)
      .join("");
  };

  const renderTestimonials = () => {
    if (!els.testiTrack) return;
    clearInterval(state.testimonialAuto);
    els.testiTrack.style.transform = "translateX(0)";
    els.testiDots.innerHTML = "";

    const reviews = state.reviews.length
      ? state.reviews
      : [
          {
            name: "HopeZaa Academy",
            courseTitle: "Programming Course",
            message: "สมัครสมาชิกเพื่อเริ่มเรียนและดูรีวิวจากผู้เรียนจริง"
          }
        ];

    els.testiTrack.innerHTML = reviews
      .map(
        (review) => `
          <div class="testi-card">
            <div class="testi-quote">"</div>
            <p>${escapeHtml(review.message)}</p>
            <div class="testi-author">
              <div class="testi-avatar">${escapeHtml(review.name.slice(0, 1))}</div>
              <div>
                <div class="testi-name">${escapeHtml(review.name)}</div>
                <div class="testi-role">${escapeHtml(review.courseTitle || "HopeZaa Academy")}</div>
              </div>
            </div>
          </div>
        `
      )
      .join("");

    const slides = els.testiTrack.children.length;
    let current = 0;

    for (let i = 0; i < slides; i += 1) {
      const dot = document.createElement("button");
      dot.className = `testi-dot${i === 0 ? " active" : ""}`;
      dot.setAttribute("aria-label", `สไลด์ที่ ${i + 1}`);
      dot.addEventListener("click", () => goTo(i));
      els.testiDots.appendChild(dot);
    }

    const dots = els.testiDots.querySelectorAll(".testi-dot");

    function goTo(index) {
      current = (index + slides) % slides;
      els.testiTrack.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((dot, idx) => dot.classList.toggle("active", idx === current));
      restart();
    }

    function restart() {
      clearInterval(state.testimonialAuto);
      state.testimonialAuto = setInterval(() => goTo(current + 1), 6000);
    }

    els.testiPrev.onclick = () => goTo(current - 1);
    els.testiNext.onclick = () => goTo(current + 1);
    els.testiTrack.parentElement.onmouseenter = () => clearInterval(state.testimonialAuto);
    els.testiTrack.parentElement.onmouseleave = restart;

    let startX = 0;
    els.testiTrack.ontouchstart = (event) => {
      startX = event.touches[0].clientX;
    };
    els.testiTrack.ontouchend = (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
    };

    if (slides > 1) restart();
  };

  const openCheckout = (courseIds) => {
    const uniqueIds = [...new Set(courseIds)].filter(Boolean);
    if (!uniqueIds.length) {
      showToast("ยังไม่มีคอร์สสำหรับชำระเงิน");
      return;
    }
    const selected = state.courses.filter((course) => uniqueIds.includes(course.id));
    if (!selected.length) return;

    state.checkoutCourseIds = selected.map((course) => course.id);
    els.checkoutItems.innerHTML = selected
      .map(
        (course) => `
          <div class="checkout-item">
            <span>${escapeHtml(course.title)}</span>
            <strong>${money(course.price)}</strong>
          </div>
        `
      )
      .join("");
    els.checkoutTotal.textContent = money(selected.reduce((sum, course) => sum + course.price, 0));
    openModal(els.checkoutModal);
  };

  const logout = () => {
    localStorage.removeItem("hopezaa_token");
    state.token = "";
    state.user = null;
    state.currentView = "all";
    state.checkoutCourseIds = [];
    updateAuthUi();
    loadPublic();
    showToast("ออกจากระบบแล้ว");
  };

  const setupBaseInteractions = () => {
    window.addEventListener("load", () => {
      setTimeout(() => els.preloader && els.preloader.classList.add("done"), 800);
    });
    setTimeout(() => els.preloader && els.preloader.classList.add("done"), 2200);

    const setNavState = () => {
      if (!els.nav) return;
      if (window.scrollY > 40) els.nav.classList.add("scrolled");
      else els.nav.classList.remove("scrolled");
    };
    setNavState();
    window.addEventListener("scroll", setNavState, { passive: true });

    const closeMenu = () => {
      els.navToggle?.classList.remove("active");
      els.mobileMenu?.classList.remove("active");
    };
    els.navToggle?.addEventListener("click", () => {
      els.navToggle.classList.toggle("active");
      els.mobileMenu.classList.toggle("active");
    });
    els.mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const id = link.getAttribute("href");
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        event.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });

    const revealEls = document.querySelectorAll(".reveal-up, .reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));

    const animateCounter = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const duration = 2000;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.floor(target * eased);
        el.textContent = value.toLocaleString("th-TH");
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString("th-TH");
      };
      requestAnimationFrame(tick);
    };
    const counterObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    document.querySelectorAll(".stat-num").forEach((counter) => counterObs.observe(counter));

    const heroBg = document.querySelector(".hero-bg");
    if (heroBg) {
      window.addEventListener(
        "scroll",
        () => {
          const y = window.scrollY;
          if (y < 800) heroBg.style.transform = `translateY(${y * 0.25}px)`;
        },
        { passive: true }
      );
    }

    document.querySelectorAll(".service-card").forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(201, 169, 97, 0.12), var(--ink) 60%)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.background = "";
      });
    });
  };

  const setupAppEvents = () => {
    document.querySelectorAll("[data-open-auth]").forEach((button) => {
      button.addEventListener("click", openAuth);
    });
    els.navAuthBtn?.addEventListener("click", openAuth);
    els.mobileAuthBtn?.addEventListener("click", () => {
      els.navToggle?.classList.remove("active");
      els.mobileMenu?.classList.remove("active");
      openAuth();
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => closeModal(els.authModal));
    });
    document.querySelectorAll("[data-close-checkout]").forEach((button) => {
      button.addEventListener("click", () => closeModal(els.checkoutModal));
    });

    document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
      tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
    });

    els.loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(els.loginForm));
      try {
        const data = await request("/api/login", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        setSession(data);
        closeModal(els.authModal);
        els.loginForm.reset();
        showToast("เข้าสู่ระบบสำเร็จ");
        showCourseArea();
      } catch (error) {
        els.authMessage.textContent = error.message;
        els.authMessage.classList.add("show");
      }
    });

    els.registerForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(els.registerForm));
      try {
        const data = await request("/api/register", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        setSession(data);
        closeModal(els.authModal);
        els.registerForm.reset();
        showToast("สมัครสมาชิกและเข้าสู่ระบบแล้ว");
        showCourseArea();
      } catch (error) {
        els.authMessage.textContent = error.message;
        els.authMessage.classList.add("show");
      }
    });

    document.querySelectorAll(".course-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.currentView = tab.dataset.view;
        document.querySelectorAll(".course-tab").forEach((item) => item.classList.toggle("active", item === tab));
        renderCourses();
      });
    });

    els.courseGrid?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-course-action]");
      if (!button) return;
      const courseId = button.dataset.courseId;
      if (button.dataset.courseAction === "buy") {
        openCheckout([courseId]);
        return;
      }
      try {
        const data = await request("/api/cart/add", {
          method: "POST",
          body: JSON.stringify({ courseId })
        });
        setSession(data);
        showToast("เพิ่มคอร์สลงตะกร้าแล้ว");
      } catch (error) {
        showToast(error.message);
      }
    });

    els.cartList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-cart]");
      if (!button) return;
      try {
        const data = await request("/api/cart/remove", {
          method: "POST",
          body: JSON.stringify({ courseId: button.dataset.removeCart })
        });
        setSession(data);
        showToast("ลบคอร์สออกจากตะกร้าแล้ว");
      } catch (error) {
        showToast(error.message);
      }
    });

    els.checkoutCartBtn?.addEventListener("click", () => openCheckout(state.user?.cart || []));

    els.confirmPaymentBtn?.addEventListener("click", async () => {
      try {
        const data = await request("/api/checkout", {
          method: "POST",
          body: JSON.stringify({ courseIds: state.checkoutCourseIds })
        });
        setSession(data);
        closeModal(els.checkoutModal);
        showToast(`ชำระเงินสำเร็จ บันทึกคำสั่งซื้อ ${data.order.id} แล้ว`);
      } catch (error) {
        showToast(error.message);
      }
    });

    els.refreshAppBtn?.addEventListener("click", async () => {
      await loadSession();
      showToast("รีเฟรชข้อมูลแล้ว");
    });
    els.logoutBtn?.addEventListener("click", logout);

    els.adminCourseList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-admin-adjust]");
      if (!button) return;
      try {
        const data = await request(`/api/admin/courses/${button.dataset.adminAdjust}/adjust`, {
          method: "POST",
          body: JSON.stringify({
            field: button.dataset.field,
            delta: Number(button.dataset.delta)
          })
        });
        setSession(data);
        showToast("อัปเดตจำนวนคอร์สแล้ว");
      } catch (error) {
        showToast(error.message);
      }
    });

    els.adminReviewForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(els.adminReviewForm));
      try {
        const data = await request("/api/admin/reviews", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        setSession(data);
        els.adminReviewForm.reset();
        showToast("เพิ่มรีวิวบนหน้าแรกแล้ว");
      } catch (error) {
        showToast(error.message);
      }
    });

    els.contactForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(els.contactForm));
      try {
        await request("/api/contact", {
          method: "POST",
          body: JSON.stringify(formData)
        });
        els.formSuccess.classList.add("show");
        els.contactForm.reset();
        setTimeout(() => els.formSuccess.classList.remove("show"), 5000);
      } catch (error) {
        showToast(error.message);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.authModal?.classList.contains("open")) closeModal(els.authModal);
      if (els.checkoutModal?.classList.contains("open")) closeModal(els.checkoutModal);
    });
  };

  setupBaseInteractions();
  setupAppEvents();
  loadSession();
});