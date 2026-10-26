/**
 * Chiranjit Kar Photography — Haute Couture Editorial Engine
 * Interactive Liquid Physics, Gallery Engine, Scroll Reveal & FAQ System
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeroSlider();
    initMobileMenu();
    initLiquidCursor();
    initNavbarScroll();
    initPortfolioGrid();
    initLightbox();
    initScrollReveal();
    initCardMouseSpotlight();
    initFaqSystem();
    initBackToTop();
    initNewsletterForm();
});

// ==========================================
// MOBILE NAVIGATION
// ==========================================
function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const menu = document.getElementById('mobile-menu-links');
    if (!toggle || !menu) return;

    const openIcon = toggle.querySelector('.mobile-menu-icon-open');
    const closeIcon = toggle.querySelector('.mobile-menu-icon-close');

    function setOpen(isOpen) {
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
        menu.classList.toggle('hidden', !isOpen);
        menu.inert = !isOpen;
        if (openIcon) openIcon.classList.toggle('hidden', isOpen);
        if (closeIcon) closeIcon.classList.toggle('hidden', !isOpen);
        document.body.classList.toggle('overflow-hidden', isOpen);
    }

    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            toggle.focus();
        }
    });

    document.addEventListener('click', event => {
        if (toggle.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target) && !toggle.contains(event.target)) {
            setOpen(false);
        }
    });

    window.matchMedia('(min-width: 768px)').addEventListener('change', event => {
        if (event.matches) setOpen(false);
    });
}

// ==========================================
// 1. FULL-BLEED CINEMATIC HERO SLIDER
// ==========================================
let currentSlide = 0;
let slideInterval = null;

function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slide-dot');
    const counterCurrent = document.getElementById('hero-counter-current');
    const collectionTag = document.getElementById('hero-collection-tag');
    const conceptText = document.getElementById('hero-concept-text');
    const heroData = window.HERO_SLIDES || [];

    if (!slides.length) return;

    function goToSlide(idx) {
        currentSlide = (idx + slides.length) % slides.length;
        
        slides.forEach((slide, i) => {
            if (i === currentSlide) {
                slide.classList.remove('opacity-0', 'scale-105', 'z-0');
                slide.classList.add('opacity-100', 'scale-100', 'z-10');
            } else {
                slide.classList.remove('opacity-100', 'scale-100', 'z-10');
                slide.classList.add('opacity-0', 'scale-105', 'z-0');
            }
        });

        // Update dots
        dots.forEach((dot, i) => {
            if (i === currentSlide) {
                dot.classList.remove('w-2', 'bg-white/30');
                dot.classList.add('w-8', 'bg-gold-400');
            } else {
                dot.classList.remove('w-8', 'bg-gold-400');
                dot.classList.add('w-2', 'bg-white/30');
            }
        });

        // Update counter & texts
        if (counterCurrent) counterCurrent.textContent = `0${currentSlide + 1}`;
        if (heroData[currentSlide]) {
            if (collectionTag) collectionTag.textContent = heroData[currentSlide].collection;
            if (conceptText) conceptText.textContent = `"${heroData[currentSlide].concept}"`;
        }
    }

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            clearInterval(slideInterval);
            goToSlide(idx);
            startAutoPlay();
        });
    });

    function startAutoPlay() {
        clearInterval(slideInterval);
        slideInterval = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, 9000);
    }

    const heroSlider = document.getElementById('hero-slider');
    if (heroSlider) {
        heroSlider.addEventListener('mouseenter', () => clearInterval(slideInterval));
        heroSlider.addEventListener('mouseleave', startAutoPlay);
    }

    window.goToSlide = goToSlide;
    window.stopAutoPlay = () => clearInterval(slideInterval);

    goToSlide(0);
    startAutoPlay();
}

// ==========================================
// 2. NAVBAR SCROLL EFFECT
// ==========================================
function initNavbarScroll() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 60) {
            nav.classList.add('bg-noir-950/90', 'backdrop-blur-2xl', 'border-b', 'border-white/10', 'py-3.5', 'shadow-2xl');
            nav.classList.remove('py-5');
        } else {
            nav.classList.remove('bg-noir-950/90', 'backdrop-blur-2xl', 'border-b', 'border-white/10', 'shadow-2xl');
            nav.classList.add('py-5');
        }
    });
}

// ==========================================
// 3. LIQUID CURSOR FOLLOWER
// ==========================================
function initLiquidCursor() {
    const cursor = document.getElementById('liquid-cursor');
    const dot = document.getElementById('liquid-dot');
    if (!cursor || !dot) return;

    let targetX = -100, targetY = -100;
    let curX = -100, curY = -100;

    window.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        dot.style.left = `${targetX}px`;
        dot.style.top = `${targetY}px`;
    });

    function renderCursor() {
        curX += (targetX - curX) * 0.18;
        curY += (targetY - curY) * 0.18;
        cursor.style.left = `${curX}px`;
        cursor.style.top = `${curY}px`;
        requestAnimationFrame(renderCursor);
    }
    renderCursor();
}

// ==========================================
// 4. PORTFOLIO GRID & DYNAMIC SHUFFLE ENGINE
// ==========================================
let currentFilter = 'all';
let filteredItems = [];

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initPortfolioGrid() {
    const grid = document.getElementById('portfolio-grid');
    const tabs = document.querySelectorAll('.portfolio-tab-btn');
    const shuffleBtn = document.getElementById('portfolio-shuffle-btn');

    if (!grid) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.getAttribute('data-category') || tab.getAttribute('data-filter') || 'all';
            renderPortfolioGrid();
        });
    });

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            // Animate shuffle icon rotation
            const icon = shuffleBtn.querySelector('i, svg');
            if (icon) {
                icon.style.transform = 'rotate(360deg)';
                icon.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
                setTimeout(() => {
                    icon.style.transform = '';
                    icon.style.transition = '';
                }, 600);
            }

            // Smooth liquid reshuffle transition
            grid.style.opacity = '0';
            grid.style.transform = 'translateY(12px)';
            grid.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

            setTimeout(() => {
                if (currentFilter === 'all') {
                    window.PORTFOLIO_ITEMS = shuffleArray(window.PORTFOLIO_ITEMS || []);
                    renderPortfolioGrid();
                } else {
                    filteredItems = shuffleArray(filteredItems);
                    renderCards(filteredItems);
                }

                grid.style.opacity = '1';
                grid.style.transform = 'translateY(0)';
            }, 250);
        });
    }

    renderPortfolioGrid();
}

function renderPortfolioGrid() {
    const allItems = window.PORTFOLIO_ITEMS || [];
    if (currentFilter === 'all') {
        filteredItems = [...allItems];
    } else {
        filteredItems = allItems.filter(item => item.category === currentFilter);
    }
    renderCards(filteredItems);
}

function renderCards(items) {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'portfolio-card group relative overflow-hidden rounded-2xl bg-noir-900 border border-white/5 cursor-pointer aspect-[4/5] editorial-reveal';
        
        const cleanPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;

        card.innerHTML = `
            <img src="${cleanPath}" alt="${item.title} - ${item.subtitle} | Haute Couture Fashion Photography by Chiranjit Kar" loading="lazy" decoding="async" class="w-full h-full object-cover object-center transition-all duration-700">
            
            <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-noir-950/70 via-noir-950/15 to-transparent pointer-events-none"></div>

            <div class="absolute top-3 right-3 z-10">
                <span class="px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full bg-noir-950/80 backdrop-blur-md border border-white/10 text-gold-300 font-semibold">
                    ${item.tag}
                </span>
            </div>

            <div class="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                <div class="liquid-glass rounded-xl p-4 border border-white/10 shadow-2xl">
                    <div class="text-[10px] tracking-[0.25em] uppercase text-gold-400 font-semibold mb-1">
                        ${item.categoryName}
                    </div>
                    <h3 class="font-cinzel text-base sm:text-lg font-bold text-white tracking-wide leading-tight group-hover:text-gold-200 transition-colors mb-1">
                        ${item.title}
                    </h3>
                    <p class="text-xs text-neutral-400 font-light line-clamp-1 mb-2">
                        ${item.subtitle}
                    </p>
                    <div class="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/10">
                        <span class="truncate max-w-[140px]">Model: <strong class="text-neutral-200">${item.model}</strong></span>
                        <span class="text-gold-400 flex items-center gap-1 font-semibold">
                            View <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            openLightbox(index);
        });

        grid.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ==========================================
// 5. DARKROOM LIGHTBOX
// ==========================================
let activeLightboxIndex = 0;

function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    if (!lightbox) return;

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', () => navigateLightbox(-1));
    nextBtn.addEventListener('click', () => navigateLightbox(1));

    window.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
}

function openLightbox(index) {
    activeLightboxIndex = index;
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateLightboxContent();
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function navigateLightbox(dir) {
    if (!filteredItems.length) return;
    activeLightboxIndex = (activeLightboxIndex + dir + filteredItems.length) % filteredItems.length;
    updateLightboxContent();
}

function updateLightboxContent() {
    const item = filteredItems[activeLightboxIndex];
    if (!item) return;

    const img = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title');
    const subtitle = document.getElementById('lightbox-subtitle');
    const desc = document.getElementById('lightbox-desc');
    const model = document.getElementById('lightbox-model');
    const ratio = document.getElementById('lightbox-ratio');
    const tag = document.getElementById('lightbox-tag');
    const whatsapp = document.getElementById('lightbox-whatsapp');

    const cleanPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;

    img.src = cleanPath;
    img.alt = `${item.title} - ${item.subtitle} | Haute Couture Fashion Photography by Chiranjit Kar`;
    title.textContent = item.title;
    subtitle.textContent = item.subtitle;
    desc.textContent = item.description;
    model.textContent = item.model;
    ratio.textContent = `${item.aspectRatio} (${item.width}x${item.height}px)`;
    tag.textContent = item.tag;

    const encodedMsg = encodeURIComponent(`Hi Chiranjit, I saw your photograph "${item.title}" (${item.subtitle}) in your portfolio and would like to inquire about a similar photoshoot.`);
    whatsapp.href = `https://wa.me/917005238823?text=${encodedMsg}`;
}

// ==========================================
// 6. EDITORIAL SCROLL REVEAL SYSTEM
// ==========================================
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.editorial-reveal, .editorial-reveal-left, .editorial-reveal-right');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
}

// ==========================================
// 7. CARD DYNAMIC MOUSE SPOTLIGHT
// ==========================================
function initCardMouseSpotlight() {
    const cards = document.querySelectorAll('.liquid-card, .faq-grid-item');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// ==========================================
// 8. ALL 40 FAQS SEARCH & ACCORDION SYSTEM
// ==========================================
let currentFaqCategory = 'all';
let faqSearchQuery = '';

function initFaqSystem() {
    const container = document.getElementById('faq-accordion-grid');
    const categoryTabs = document.querySelectorAll('.faq-cat-btn');
    const searchInput = document.getElementById('faq-search-input');
    const allFaqs = window.ALL_FAQS || [];

    if (!container || !allFaqs.length) return;

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFaqCategory = tab.getAttribute('data-category');
            renderFaqs(allFaqs);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            faqSearchQuery = e.target.value.toLowerCase().trim();
            renderFaqs(allFaqs);
        });
    }

    renderFaqs(allFaqs);
}

function renderFaqs(allFaqs) {
    const container = document.getElementById('faq-accordion-grid');
    const countBadge = document.getElementById('faq-count-badge');
    if (!container) return;

    let filtered = allFaqs.filter(faq => {
        const matchesCat = (currentFaqCategory === 'all' || faq.category === currentFaqCategory);
        const matchesQuery = !faqSearchQuery || 
                             faq.question.toLowerCase().includes(faqSearchQuery) || 
                             faq.answer.toLowerCase().includes(faqSearchQuery) ||
                             faq.categoryName.toLowerCase().includes(faqSearchQuery);
        return matchesCat && matchesQuery;
    });

    if (countBadge) {
        countBadge.textContent = `Showing ${filtered.length} of ${allFaqs.length} Inquiries`;
    }

    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center liquid-glass rounded-2xl border border-white/5">
                <i data-lucide="search-x" class="w-8 h-8 text-neutral-500 mx-auto mb-3"></i>
                <h4 class="font-cinzel text-lg text-neutral-300 font-bold mb-1">No matching inquiries found</h4>
                <p class="text-xs text-neutral-500">Try searching with another keyword or select "All Inquiries".</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    filtered.forEach(faq => {
        const card = document.createElement('div');
        card.className = 'faq-grid-item liquid-card rounded-2xl border border-white/10 overflow-hidden cursor-pointer';
        
        let catBadgeStyle = 'bg-gold-400/10 text-gold-300 border-gold-400/20';
        let catShortName = 'STUDIO PRACTICE';
        if (faq.category === 'collaborations') {
            catBadgeStyle = 'bg-blue-400/10 text-blue-300 border-blue-400/20';
            catShortName = 'COLLABORATION';
        } else if (faq.category === 'model-agreement') {
            catBadgeStyle = 'bg-rose-400/10 text-rose-300 border-rose-400/20';
            catShortName = 'MODEL RELEASE';
        } else if (faq.category === 'verification-service') {
            catBadgeStyle = 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20';
            catShortName = 'VERIFICATION';
        }

        card.innerHTML = `
            <div class="faq-header p-5 sm:p-6 flex items-start justify-between gap-4">
                <div class="flex items-start gap-3 sm:gap-4">
                    <span class="font-cinzel text-base sm:text-lg font-bold text-gold-400/80 pt-0.5 select-none">
                        ${faq.number}
                    </span>
                    <div>
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${catBadgeStyle} font-semibold font-mono">
                                ${catShortName}
                            </span>
                        </div>
                        <h4 class="font-cinzel text-sm sm:text-base font-bold text-neutral-100 leading-snug group-hover:text-gold-200 transition-colors">
                            ${faq.question}
                        </h4>
                    </div>
                </div>
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
                    <i data-lucide="plus" class="faq-toggle-icon w-4 h-4"></i>
                </div>
            </div>
            <div class="faq-accordion-body">
                <div class="faq-accordion-inner px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-neutral-300 font-light leading-relaxed border-t border-white/5">
                    <div class="pt-3">
                        ${faq.answer}
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.faq-header').addEventListener('click', () => {
            const isOpen = card.classList.contains('is-open');
            card.classList.toggle('is-open', !isOpen);
        });

        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ==========================================
// 9. FLOATING BACK TO TOP BUTTON
// ==========================================
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 450) {
            btn.classList.remove('hide');
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
            btn.classList.add('hide');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ==========================================
// 10. LUXURY NEWSLETTER / DISPATCH FORM
// ==========================================
function initNewsletterForm() {
    const form = document.getElementById('newsletter-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const feedback = document.getElementById('newsletter-feedback');
        if (input && input.value) {
            if (feedback) {
                feedback.classList.remove('hidden');
                feedback.textContent = `✓ Inscription confirmed for ${input.value}. You will receive private lookbook previews.`;
            }
            input.value = '';
            setTimeout(() => {
                if (feedback) feedback.classList.add('hidden');
            }, 6000);
        }
    });
}
