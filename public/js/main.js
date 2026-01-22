/* ============================================
   NAQSH RESORT - MAIN JAVASCRIPT
   Production-Ready, SEO-Friendly, Fast
   ============================================ */

(function() {
    'use strict';
    
    // ==================
    // INITIALIZATION
    // ==================
    document.addEventListener("DOMContentLoaded", init);
    
    function init() {
        console.log("🏨 Naqsh Resort JS loaded");
        
        initMobileMenu();
        initDatePickers();
        initBookingForm();
        initContactForm();
        initGalleryLightbox();
        initScrollEffects();
        
        console.log("✅ Initialization complete");
    }

    // ==================
    // TOAST NOTIFICATIONS
    // ==================
    function showToast(message, type = 'success', duration = 4000) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
        `;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('show'));
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Please wait...';
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        } else {
            button.textContent = button.dataset.originalText || 'Submit';
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    }

    // ==================
    // MOBILE MENU
    // ==================
    function initMobileMenu() {
        const toggle = document.getElementById("mobile-menu-toggle");
        const nav = document.querySelector("nav");
        
        if (!toggle || !nav) return;
        
        toggle.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("active");
            toggle.classList.toggle("active");
            toggle.setAttribute('aria-expanded', isOpen);
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !toggle.contains(e.target)) {
                nav.classList.remove("active");
                toggle.classList.remove("active");
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                nav.classList.remove("active");
                toggle.classList.remove("active");
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ==================
    // DATE PICKERS - PROPERLY DISABLE PAST DATES
    // ==================
    function initDatePickers() {
        const checkinInput = document.getElementById("checkin");
        const checkoutInput = document.getElementById("checkout");
        
        if (!checkinInput || !checkoutInput) return;
        
        // Get today's date in YYYY-MM-DD format (local timezone)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // Set minimum date to TODAY - this disables all past dates
        checkinInput.min = todayStr;
        checkinInput.value = ''; // Clear any preset value
        
        // Set minimum checkout to tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDateToInput(tomorrow);
        checkoutInput.min = tomorrowStr;
        checkoutInput.value = '';
        
        // Update checkout min when checkin changes
        checkinInput.addEventListener("change", function() {
            if (!this.value) return;
            
            const selectedDate = new Date(this.value);
            const nextDay = new Date(selectedDate);
            nextDay.setDate(selectedDate.getDate() + 1);
            
            checkoutInput.min = formatDateToInput(nextDay);
            
            // Clear checkout if it's before the new minimum
            if (checkoutInput.value && new Date(checkoutInput.value) <= selectedDate) {
                checkoutInput.value = '';
            }
            
            updatePricePreview();
        });
        
        checkoutInput.addEventListener("change", updatePricePreview);
        
        // Prevent manual entry of past dates
        checkinInput.addEventListener("blur", function() {
            if (this.value && new Date(this.value) < new Date(todayStr)) {
                this.value = todayStr;
                showToast("Check-in date cannot be in the past", "error");
            }
        });
    }
    
    function formatDateToInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ==================
    // BOOKING FORM
    // ==================
    const PRICING = {
        group: { rate: 60000 },
        rooms: {
            "Deluxe Garden": { weekday: { ep: 1700, mapai: 2700 }, weekend: { ep: 2200, mapai: 3200 } },
            "Premium Valley": { weekday: { ep: 2000, mapai: 3000 }, weekend: { ep: 2600, mapai: 3600 } },
            "Family Suite": { weekday: { ep: 2700, mapai: 4300 }, weekend: { ep: 3500, mapai: 5500 } }
        }
    };
    
    let serverCalculatedPrice = 0;
    let priceDebounceTimer = null;
    
    function initBookingForm() {
        const form = document.getElementById("availability-form");
        if (!form) return;
        
        // Mode toggle
        const modeInputs = form.querySelectorAll('input[name="booking-mode"]');
        modeInputs.forEach(input => input.addEventListener("change", toggleGroupMode));
        
        // Other inputs for price update
        const roomSelect = document.getElementById("room-type");
        const guestsSelect = document.getElementById("guests");
        const mealInputs = form.querySelectorAll('input[name="meal-plan"]');
        
        if (roomSelect) roomSelect.addEventListener("change", updatePricePreview);
        if (guestsSelect) guestsSelect.addEventListener("change", updatePricePreview);
        mealInputs.forEach(input => input.addEventListener("change", updatePricePreview));
        
        // Form submission - PREVENT DEFAULT COMPLETELY
        form.addEventListener("submit", handleBookingSubmit);
        
        // Initialize mode
        toggleGroupMode();
    }
    
    function toggleGroupMode() {
        const modeInput = document.querySelector('input[name="booking-mode"]:checked');
        if (!modeInput) return;
        
        const isGroup = modeInput.value === "group";
        const roomGroup = document.getElementById("room-select-group");
        const mealGroup = document.getElementById("meal-plan-select-group");
        const groupInfo = document.getElementById("group-info");
        const guestsSelect = document.getElementById("guests");
        
        // Update active class
        document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
        const parentLabel = modeInput.closest('.mode-option');
        if (parentLabel) parentLabel.classList.add('active');
        
        if (isGroup) {
            if (roomGroup) roomGroup.classList.add("hidden");
            if (mealGroup) mealGroup.classList.add("hidden");
            if (groupInfo) groupInfo.classList.remove("hidden");
            if (guestsSelect) guestsSelect.value = "10";
        } else {
            if (roomGroup) roomGroup.classList.remove("hidden");
            if (mealGroup) mealGroup.classList.remove("hidden");
            if (groupInfo) groupInfo.classList.add("hidden");
        }
        
        updatePricePreview();
    }
    
    function updatePricePreview() {
        const checkin = document.getElementById("checkin");
        const checkout = document.getElementById("checkout");
        const priceSummary = document.getElementById("price-summary");
        const totalDisplay = document.getElementById("total-amount");
        const breakdown = document.getElementById("price-breakdown");
        
        if (!checkin || !checkout || !priceSummary) return;
        
        const checkinVal = checkin.value;
        const checkoutVal = checkout.value;
        
        if (!checkinVal || !checkoutVal) {
            if (breakdown) breakdown.innerHTML = "<p class='placeholder-text'>Select dates to see price.</p>";
            if (totalDisplay) totalDisplay.textContent = "₹0";
            priceSummary.classList.add("hidden");
            serverCalculatedPrice = 0;
            return;
        }
        
        const startDate = new Date(checkinVal);
        const endDate = new Date(checkoutVal);
        
        if (startDate >= endDate) return;
        
        // Show local preview immediately
        showLocalPricePreview(startDate, endDate);
        
        // Debounce server call
        clearTimeout(priceDebounceTimer);
        priceDebounceTimer = setTimeout(() => fetchServerPrice(checkinVal, checkoutVal), 300);
    }
    
    function showLocalPricePreview(startDate, endDate) {
        const modeInput = document.querySelector('input[name="booking-mode"]:checked');
        const isGroup = modeInput && modeInput.value === "group";
        const roomSelect = document.getElementById("room-type");
        const mealInput = document.querySelector('input[name="meal-plan"]:checked');
        const breakdown = document.getElementById("price-breakdown");
        const totalDisplay = document.getElementById("total-amount");
        const priceSummary = document.getElementById("price-summary");
        
        let total = 0;
        let html = `<table class="breakdown-table"><thead><tr><th>Date</th><th>Type</th><th style="text-align:right">Rate</th></tr></thead><tbody>`;
        
        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const dayOfWeek = d.getDay();
            const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
            
            let rate = 0;
            let typeLabel = isWeekend ? '<span class="tag-weekend">Weekend</span>' : '<span class="tag-weekday">Weekday</span>';
            
            if (isGroup) {
                rate = PRICING.group.rate;
                typeLabel = '<span class="tag-weekend" style="background:var(--color-accent);color:black">Full Resort</span>';
            } else if (roomSelect && roomSelect.value) {
                const roomKey = roomSelect.value.split(" (")[0];
                const planKey = (mealInput && mealInput.value.includes("MAPAI")) ? "mapai" : "ep";
                const roomPricing = PRICING.rooms[roomKey];
                if (roomPricing) {
                    rate = isWeekend ? roomPricing.weekend[planKey] : roomPricing.weekday[planKey];
                }
            }
            
            total += rate;
            const rateStr = rate ? `₹${rate.toLocaleString('en-IN')}` : 'Select Room';
            html += `<tr><td>${dateStr}</td><td>${typeLabel}</td><td class="row-total">${rateStr}</td></tr>`;
        }
        
        html += `</tbody></table>`;
        
        if (isGroup) {
            html += `<p style="font-size:0.85rem; color:var(--color-text-light); margin-top:5px;">✨ Includes: Bonfire, BBQ, Music Night</p>`;
        }
        
        if (breakdown) breakdown.innerHTML = html;
        if (totalDisplay) totalDisplay.textContent = `₹${total.toLocaleString('en-IN')}`;
        if (priceSummary) priceSummary.classList.remove("hidden");
        
        serverCalculatedPrice = total;
    }
    
    async function fetchServerPrice(checkinVal, checkoutVal) {
        const modeInput = document.querySelector('input[name="booking-mode"]:checked');
        const isGroup = modeInput && modeInput.value === "group";
        const roomSelect = document.getElementById("room-type");
        const mealInput = document.querySelector('input[name="meal-plan"]:checked');
        
        try {
            const response = await fetch('/api/calculate-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkIn: checkinVal,
                    checkOut: checkoutVal,
                    roomType: isGroup ? 'Full Resort' : (roomSelect ? roomSelect.value.split(" (")[0] : 'Deluxe Garden'),
                    mealPlan: (mealInput && mealInput.value.includes("MAPAI")) ? "MAPAI" : "EP",
                    isGroupBooking: isGroup
                })
            });
            
            const result = await response.json();
            if (result.success) {
                serverCalculatedPrice = result.total;
                const totalDisplay = document.getElementById("total-amount");
                if (totalDisplay) {
                    totalDisplay.textContent = `₹${result.total.toLocaleString('en-IN')}`;
                }
            }
        } catch (err) {
            console.warn('Server price fetch failed, using local preview');
        }
    }
    
    async function handleBookingSubmit(e) {
        // CRITICAL: Prevent default form submission
        e.preventDefault();
        e.stopPropagation();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Get values
        const checkin = document.getElementById("checkin")?.value;
        const checkout = document.getElementById("checkout")?.value;
        const guestName = document.getElementById("guest-name")?.value?.trim();
        const guestPhone = document.getElementById("guest-phone")?.value?.trim();
        const roomSelect = document.getElementById("room-type");
        const guestsSelect = document.getElementById("guests");
        const modeInput = document.querySelector('input[name="booking-mode"]:checked');
        const mealInput = document.querySelector('input[name="meal-plan"]:checked');
        
        const isGroup = modeInput && modeInput.value === "group";
        const roomType = roomSelect ? roomSelect.value.split(" (")[0] : '';
        const mealPlan = (mealInput && mealInput.value.includes("MAPAI")) ? "MAPAI" : "EP";
        const guests = guestsSelect ? guestsSelect.value : '2';
        
        // Validation
        if (!checkin || !checkout) {
            showToast("Please select check-in and check-out dates", "error");
            return false;
        }
        
        if (!guestName || guestName.length < 2) {
            showToast("Please enter your full name", "error");
            document.getElementById("guest-name")?.focus();
            return false;
        }
        
        if (!guestPhone || guestPhone.length < 6) {
            showToast("Please enter a valid phone number", "error");
            document.getElementById("guest-phone")?.focus();
            return false;
        }
        
        if (!isGroup && !roomType) {
            showToast("Please select a room", "error");
            return false;
        }
        
        // Check dates aren't in past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(checkin) < today) {
            showToast("Check-in date cannot be in the past", "error");
            return false;
        }
        
        setButtonLoading(submitBtn, true);
        
        const bookingData = {
            guestName,
            guestPhone,
            checkIn: checkin,
            checkOut: checkout,
            guests: parseInt(guests) || 2,
            isGroupBooking: isGroup,
            mealPlan,
            roomType: isGroup ? 'Full Resort' : roomType
        };
        
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                const confirmedAmount = result.data.totalAmount || serverCalculatedPrice;
                showToast(`Booking saved! Ref: ${result.data.id}`, 'success', 5000);
                
                // Open WhatsApp with confirmed details
                const msg = isGroup ?
                    `*Group Booking* 🏰%0aRef: ${result.data.id}%0aName: ${guestName}%0aPhone: ${guestPhone}%0aDates: ${checkin} to ${checkout}%0aGuests: ${guests}%0aTotal: ₹${confirmedAmount.toLocaleString('en-IN')}%0a%0aHi, I'd like to confirm this booking.` :
                    `*Room Booking* 🏨%0aRef: ${result.data.id}%0aName: ${guestName}%0aPhone: ${guestPhone}%0aDates: ${checkin} to ${checkout}%0aRoom: ${roomType}%0aPlan: ${mealPlan}%0aGuests: ${guests}%0aTotal: ₹${confirmedAmount.toLocaleString('en-IN')}%0a%0aHi, checking availability.`;
                
                setTimeout(() => {
                    window.open(`https://wa.me/919045467967?text=${msg}`, "_blank");
                }, 500);
                
                // Reset form
                setTimeout(() => {
                    form.reset();
                    document.getElementById("price-summary")?.classList.add("hidden");
                    toggleGroupMode();
                    initDatePickers(); // Re-initialize date restrictions
                }, 1500);
            } else {
                showToast(result.message || 'Booking failed. Please try again.', 'error');
            }
        } catch (err) {
            console.error("Booking error:", err);
            showToast('Network error. Please try again or call us.', 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
        
        return false;
    }

    // ==================
    // CONTACT FORM
    // ==================
    function initContactForm() {
        const form = document.getElementById("contact-form");
        if (!form) return;
        
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const formData = new FormData(form);
            
            const name = (formData.get('name') || '').trim();
            const phone = (formData.get('phone') || '').trim();
            const message = (formData.get('message') || '').trim();
            
            if (name.length < 2) {
                showToast("Please enter your name", "error");
                return false;
            }
            if (phone.length < 6) {
                showToast("Please enter a valid phone number", "error");
                return false;
            }
            if (message.length < 10) {
                showToast("Please enter a message (at least 10 characters)", "error");
                return false;
            }
            
            setButtonLoading(submitBtn, true);
            
            try {
                const response = await fetch('/api/inquiries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        phone,
                        email: formData.get('email') || '',
                        inquiryType: formData.get('inquiry-type') || 'General',
                        message
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast('Message sent! We\'ll contact you soon.', 'success', 5000);
                    form.reset();
                } else {
                    showToast(result.message || 'Failed to send. Please try again.', 'error');
                }
            } catch (err) {
                showToast('Network error. Please call us at +91 90454 67967', 'error');
            } finally {
                setButtonLoading(submitBtn, false);
            }
            
            return false;
        });
    }

    // ==================
    // GALLERY LIGHTBOX
    // ==================
    function initGalleryLightbox() {
        const images = document.querySelectorAll('.gallery-item img');
        if (!images.length) return;
        
        images.forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => openLightbox(img.src, img.alt));
        });
    }
    
    function openLightbox(src, alt) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-label', 'Image viewer');
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <button class="lightbox-close" aria-label="Close">&times;</button>
                <img src="${src}" alt="${escapeHtml(alt || 'Gallery image')}">
            </div>
        `;
        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';
        
        const close = () => {
            lightbox.remove();
            document.body.style.overflow = '';
        };
        
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
                close();
            }
        });
        
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', handler);
            }
        });
    }

    // ==================
    // SCROLL EFFECTS
    // ==================
    function initScrollEffects() {
        const header = document.getElementById('site-header');
        if (!header) return;
        
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    header.style.boxShadow = window.pageYOffset > 100 ? 
                        '0 4px 20px rgba(0,0,0,0.1)' : 
                        '0 2px 8px rgba(61,61,61,0.08)';
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
})();

// ==================
// INJECT STYLES (Minimal CSS for JS components)
// ==================
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .toast-notification{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(100px);background:#333;color:#fff;padding:16px 24px;border-radius:12px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:10000;opacity:0;transition:all 0.3s ease;max-width:90%;font-family:'Nunito',sans-serif}
        .toast-notification.show{opacity:1;transform:translateX(-50%) translateY(0)}
        .toast-success{background:linear-gradient(135deg,#2D5A3D,#3d7a4d)}
        .toast-error{background:linear-gradient(135deg,#c0392b,#e74c3c)}
        .toast-info{background:linear-gradient(135deg,#2c3e50,#34495e)}
        .toast-icon{font-size:20px;font-weight:bold}
        .toast-message{font-size:15px}
        .lightbox{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:10000;animation:lbFadeIn 0.3s ease}
        @keyframes lbFadeIn{from{opacity:0}to{opacity:1}}
        .lightbox-content{position:relative;max-width:90%;max-height:90%}
        .lightbox-content img{max-width:100%;max-height:85vh;border-radius:8px;object-fit:contain}
        .lightbox-close{position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:36px;cursor:pointer}
        .lightbox-close:hover{color:#d4af37}
        #mobile-menu-toggle.active .bar:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
        #mobile-menu-toggle.active .bar:nth-child(2){opacity:0}
        #mobile-menu-toggle.active .bar:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
    `;
    document.head.appendChild(style);
})();
