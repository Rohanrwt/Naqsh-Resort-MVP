/* ============================================
   NAQSH RESORT - MAIN JAVASCRIPT
   Production-Ready Version
   
   Note: Price calculations shown are PREVIEWS only.
   The actual price is ALWAYS calculated server-side.
   ============================================ */

document.addEventListener("DOMContentLoaded", function () {
  console.log("🏨 Naqsh Resort JS loaded (Secure Version)");

  // ==================
  // TOAST NOTIFICATIONS
  // ==================
  function showToast(message, type = 'success', duration = 4000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-message">${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.dataset.originalText = button.innerText;
      button.innerText = 'Please wait...';
      button.disabled = true;
      button.style.opacity = '0.7';
    } else {
      button.innerText = button.dataset.originalText || 'Submit';
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  // ==================
  // MOBILE MENU
  // ==================
  const menuToggle = document.getElementById("mobile-menu-toggle");
  const nav = document.querySelector("nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      nav.classList.toggle("active");
      menuToggle.classList.toggle("active");
    });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !menuToggle.contains(e.target)) {
        nav.classList.remove("active");
        menuToggle.classList.remove("active");
      }
    });
  }

  // ==================
  // DATE VALIDATION
  // ==================
  const checkinInput = document.getElementById("checkin");
  const checkoutInput = document.getElementById("checkout");

  if (checkinInput && checkoutInput) {
    const today = new Date().toISOString().split("T")[0];
    checkinInput.setAttribute("min", today);

    checkinInput.addEventListener("change", function () {
      if (!this.value) return;
      const checkinDate = new Date(this.value);
      const nextDay = new Date(checkinDate);
      nextDay.setDate(checkinDate.getDate() + 1);
      const nextDayString = nextDay.toISOString().split("T")[0];
      
      checkoutInput.setAttribute("min", nextDayString);
      if (checkoutInput.value && checkoutInput.value < nextDayString) {
        checkoutInput.value = "";
      }
      fetchPriceFromServer();
    });

    checkoutInput.addEventListener("change", fetchPriceFromServer);
  }

  // ==================
  // BOOKING FORM SETUP
  // ==================
  const bookingForm = document.getElementById("availability-form");
  const priceSummary = document.getElementById("price-summary");
  const totalDisplay = document.getElementById("total-amount");
  const breakdownContainer = document.getElementById("price-breakdown");
  
  // Local pricing for PREVIEW only (actual price comes from server)
  const PREVIEW_PRICING = {
    group: { rate: 60000 },
    rooms: {
      "Deluxe Garden": { weekday: { ep: 1700, mapai: 2700 }, weekend: { ep: 2200, mapai: 3200 } },
      "Premium Valley": { weekday: { ep: 2000, mapai: 3000 }, weekend: { ep: 2600, mapai: 3600 } },
      "Family Suite": { weekday: { ep: 2700, mapai: 4300 }, weekend: { ep: 3500, mapai: 5500 } }
    }
  };

  const inputs = {
    checkin: document.getElementById("checkin"),
    checkout: document.getElementById("checkout"),
    room: document.getElementById("room-type"),
    guests: document.getElementById("guests"),
    mealPlan: document.querySelectorAll('input[name="meal-plan"]'),
    mode: document.querySelectorAll('input[name="booking-mode"]')
  };

  if (bookingForm) {
    inputs.mode.forEach(r => r.addEventListener("change", toggleGroupMode));
    
    const allInputs = [inputs.room, inputs.guests, ...inputs.mealPlan];
    allInputs.forEach(el => el && el.addEventListener("change", fetchPriceFromServer));

    bookingForm.addEventListener("submit", handleFormSubmit);
    toggleGroupMode();
  }

  function toggleGroupMode() {
    const modeEl = document.querySelector('input[name="booking-mode"]:checked');
    if (!modeEl) return;
    
    const isGroup = modeEl.value === "group";
    const roomSelectGroup = document.getElementById("room-select-group");
    const mealPlanGroup = document.getElementById("meal-plan-select-group");
    const groupInfo = document.getElementById("group-info");
    
    document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
    modeEl.closest('.mode-option').classList.add('active');

    if (isGroup) {
      if (roomSelectGroup) roomSelectGroup.classList.add("hidden");
      if (mealPlanGroup) mealPlanGroup.classList.add("hidden");
      if (groupInfo) groupInfo.classList.remove("hidden");
      document.getElementById("guests").value = "10";
    } else {
      if (roomSelectGroup) roomSelectGroup.classList.remove("hidden");
      if (mealPlanGroup) mealPlanGroup.classList.remove("hidden");
      if (groupInfo) groupInfo.classList.add("hidden");
    }
    fetchPriceFromServer();
  }

  // ==================
  // SERVER-SIDE PRICE CALCULATION
  // ==================
  let priceDebounceTimer = null;
  let serverCalculatedPrice = 0;
  
  async function fetchPriceFromServer() {
    if (!inputs.checkin || !inputs.checkout) return;
    
    const checkinStr = inputs.checkin.value;
    const checkoutStr = inputs.checkout.value;
    
    if (!checkinStr || !checkoutStr) {
      if (breakdownContainer) {
        breakdownContainer.innerHTML = "<p class='placeholder-text'>Select dates to see price.</p>";
      }
      if (totalDisplay) totalDisplay.innerText = "₹0";
      if (priceSummary) priceSummary.classList.add("hidden");
      serverCalculatedPrice = 0;
      return;
    }

    // Show local preview immediately for better UX
    showLocalPricePreview();

    // Debounce server calls
    clearTimeout(priceDebounceTimer);
    priceDebounceTimer = setTimeout(async () => {
      const modeEl = document.querySelector('input[name="booking-mode"]:checked');
      const isGroup = modeEl ? modeEl.value === "group" : false;
      const roomType = inputs.room ? inputs.room.value.split(" (")[0] : 'Deluxe Garden';
      const planEl = document.querySelector('input[name="meal-plan"]:checked');
      const mealPlan = (planEl && planEl.value.includes("MAPAI")) ? "MAPAI" : "EP";

      try {
        const response = await fetch('/api/calculate-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkIn: checkinStr,
            checkOut: checkoutStr,
            roomType: isGroup ? 'Full Resort' : roomType,
            mealPlan,
            isGroupBooking: isGroup
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          serverCalculatedPrice = result.total;
          updatePriceDisplay(result);
        }
      } catch (err) {
        console.warn('Could not fetch server price, using preview:', err);
        // Keep local preview on error
      }
    }, 300);
  }

  function showLocalPricePreview() {
    if (!inputs.checkin || !inputs.checkout) return;
    
    const checkinStr = inputs.checkin.value;
    const checkoutStr = inputs.checkout.value;
    
    const checkin = new Date(checkinStr);
    const checkout = new Date(checkoutStr);
    if (checkin >= checkout) return;

    const modeEl = document.querySelector('input[name="booking-mode"]:checked');
    const isGroup = modeEl ? modeEl.value === "group" : false;
    let total = 0;
    
    let html = `<table class="breakdown-table">
                  <thead><tr><th>Date</th><th>Type</th><th style="text-align:right">Rate</th></tr></thead><tbody>`;

    for (let d = new Date(checkin); d < checkout; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const dayOfWeek = d.getDay();
      const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
      
      let nightlyRate = 0;
      let rateLabel = "-";
      let typeLabel = isWeekend ? `<span class="tag-weekend">Weekend</span>` : `<span class="tag-weekday">Weekday</span>`;

      if (isGroup) {
        nightlyRate = PREVIEW_PRICING.group.rate;
        rateLabel = `₹${nightlyRate.toLocaleString('en-IN')}`;
        typeLabel = `<span class="tag-weekend" style="background:var(--color-accent);color:black">Full Resort</span>`;
      } else {
        const roomType = inputs.room ? inputs.room.value : '';
        if (roomType) {
          const roomKey = roomType.split(" (")[0];
          const planEl = document.querySelector('input[name="meal-plan"]:checked');
          const planKey = (planEl && planEl.value.includes("MAPAI")) ? "mapai" : "ep";

          if (PREVIEW_PRICING.rooms[roomKey]) {
            nightlyRate = isWeekend ? 
              PREVIEW_PRICING.rooms[roomKey].weekend[planKey] : 
              PREVIEW_PRICING.rooms[roomKey].weekday[planKey];
            rateLabel = `₹${nightlyRate.toLocaleString('en-IN')}`;
          }
        } else {
          rateLabel = "Select Room";
        }
      }

      total += nightlyRate;
      html += `<tr><td>${dateStr}</td><td>${typeLabel}</td><td class="row-total">${rateLabel}</td></tr>`;
    }

    html += `</tbody></table>`;
    
    if (isGroup) {
      html += `<p style="font-size:0.85rem; color:var(--color-text-light); margin-top:5px;">✨ Includes: Bonfire, BBQ, Music Night</p>`;
    }

    if (breakdownContainer) breakdownContainer.innerHTML = html;
    if (totalDisplay) totalDisplay.innerText = `₹${total.toLocaleString('en-IN')}`;
    if (priceSummary) priceSummary.classList.remove("hidden");
    
    serverCalculatedPrice = total;
  }

  function updatePriceDisplay(serverResult) {
    if (!serverResult || !serverResult.breakdown) return;
    
    let html = `<table class="breakdown-table">
                  <thead><tr><th>Date</th><th>Type</th><th style="text-align:right">Rate</th></tr></thead><tbody>`;
    
    serverResult.breakdown.forEach(night => {
      const dateStr = new Date(night.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const typeLabel = night.isWeekend ? 
        `<span class="tag-weekend">Weekend</span>` : 
        `<span class="tag-weekday">Weekday</span>`;
      
      html += `<tr><td>${dateStr}</td><td>${typeLabel}</td><td class="row-total">₹${night.rate.toLocaleString('en-IN')}</td></tr>`;
    });
    
    html += `</tbody></table>`;
    
    if (serverResult.roomType === 'Full Resort') {
      html += `<p style="font-size:0.85rem; color:var(--color-text-light); margin-top:5px;">✨ Includes: Bonfire, BBQ, Music Night</p>`;
    }
    
    html += `<p style="font-size:0.75rem; color:var(--color-text-light); margin-top:8px; text-align:center;">✓ Price verified by server</p>`;

    if (breakdownContainer) breakdownContainer.innerHTML = html;
    if (totalDisplay) totalDisplay.innerText = `₹${serverResult.total.toLocaleString('en-IN')}`;
    if (priceSummary) priceSummary.classList.remove("hidden");
  }

  // ==================
  // FORM SUBMISSION
  // ==================
  async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    const modeEl = document.querySelector('input[name="booking-mode"]:checked');
    const isGroup = modeEl ? modeEl.value === "group" : false;
    const checkin = inputs.checkin ? inputs.checkin.value : '';
    const checkout = inputs.checkout ? inputs.checkout.value : '';
    const guests = inputs.guests ? inputs.guests.value : '2';
    
    const guestNameEl = document.getElementById("guest-name");
    const guestPhoneEl = document.getElementById("guest-phone");
    const guestName = guestNameEl ? guestNameEl.value.trim() : "";
    const guestPhone = guestPhoneEl ? guestPhoneEl.value.trim() : "";

    // Client-side validation
    if (!checkin || !checkout) {
      showToast("Please select check-in and check-out dates.", "error");
      return;
    }

    if (guestName.length < 2) {
      showToast("Please enter your full name (at least 2 characters).", "error");
      if (guestNameEl) guestNameEl.focus();
      return;
    }

    if (guestPhone.length < 6) {
      showToast("Please enter a valid phone number.", "error");
      if (guestPhoneEl) guestPhoneEl.focus();
      return;
    }

    const roomType = inputs.room ? inputs.room.value.split(" (")[0] : '';
    const planEl = document.querySelector('input[name="meal-plan"]:checked');
    const mealPlan = (planEl && planEl.value.includes("MAPAI")) ? "MAPAI" : "EP";

    if (!isGroup && !roomType) {
      showToast("Please select a room.", "error");
      return;
    }

    // Prepare booking data (server will calculate price!)
    const bookingData = {
      guestName,
      guestPhone,
      checkIn: checkin,
      checkOut: checkout,
      guests: parseInt(guests) || 2,
      isGroupBooking: isGroup,
      mealPlan,
      roomType: isGroup ? 'Full Resort' : roomType
      // NOTE: No totalAmount sent - server calculates it!
    };

    setButtonLoading(submitBtn, true);

    try {
      console.log("📤 Sending booking data...", bookingData);
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      
      const result = await response.json();
      console.log("📥 Server response:", result);
      
      if (result.success) {
        const confirmedAmount = result.data.totalAmount || serverCalculatedPrice;
        
        showToast(`Booking received! Ref: ${result.data.id} | Total: ₹${confirmedAmount.toLocaleString('en-IN')}`, 'success', 6000);
        
        // Prepare WhatsApp message with server-confirmed price
        let whatsappMessage = isGroup ?
          `*Group Booking Request* 🏰%0aRef: ${result.data.id}%0aName: ${guestName}%0aPhone: ${guestPhone}%0aDates: ${checkin} to ${checkout}%0aType: Full Resort%0aGuests: ${guests}%0aTotal: ₹${confirmedAmount.toLocaleString('en-IN')}%0a%0aHi, I would like to confirm this booking.` :
          `*Booking Request* 🏨%0aRef: ${result.data.id}%0aName: ${guestName}%0aPhone: ${guestPhone}%0aDates: ${checkin} to ${checkout}%0aRoom: ${roomType}%0aPlan: ${mealPlan}%0aGuests: ${guests}%0aTotal: ₹${confirmedAmount.toLocaleString('en-IN')}%0a%0aHi, checking availability.`;
        
        setTimeout(() => {
          window.open(`https://wa.me/919045467967?text=${whatsappMessage}`, "_blank");
        }, 1000);
        
        setTimeout(() => {
          bookingForm.reset();
          if (priceSummary) priceSummary.classList.add("hidden");
          toggleGroupMode();
        }, 2000);
      } else {
        showToast(result.message || 'Could not process booking. Please try again.', 'error');
      }
    } catch (err) {
      console.error("❌ Booking error:", err);
      showToast('Network error. Please try again or call us directly.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  // ==================
  // CONTACT FORM
  // ==================
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const formData = new FormData(contactForm);
      
      const name = (formData.get('name') || '').trim();
      const phone = (formData.get('phone') || '').trim();
      const message = (formData.get('message') || '').trim();

      if (name.length < 2) {
        showToast("Please enter your name.", "error");
        return;
      }
      if (phone.length < 6) {
        showToast("Please enter a valid phone number.", "error");
        return;
      }
      if (message.length < 10) {
        showToast("Please enter a message (at least 10 characters).", "error");
        return;
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
          showToast('Message sent successfully! We\'ll get back to you soon.', 'success', 5000);
          contactForm.reset();
        } else {
          showToast(result.message || 'Could not send message. Please try again.', 'error');
        }
      } catch (err) {
        console.error("Contact form error:", err);
        showToast('Network error. Please call us at +91 90454 67967', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }

  // ==================
  // UI ENHANCEMENTS
  // ==================
  
  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Header scroll effect
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.pageYOffset > 100 ? 
        '0 4px 16px rgba(0,0,0,0.1)' : 
        '0 2px 8px rgba(61, 61, 61, 0.08)';
    });
  }

  // Gallery lightbox
  const galleryItems = document.querySelectorAll('.gallery-item img');
  if (galleryItems.length > 0) {
    galleryItems.forEach(img => {
      img.style.cursor = 'pointer';
      img.addEventListener('click', function() {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `<div class="lightbox-content"><button class="lightbox-close">&times;</button><img src="${this.src}" alt="${this.alt || 'Gallery image'}"></div>`;
        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';
        
        lightbox.addEventListener('click', (e) => {
          if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
            lightbox.remove();
            document.body.style.overflow = '';
          }
        });
        
        document.addEventListener('keydown', function escHandler(e) {
          if (e.key === 'Escape') {
            lightbox.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', escHandler);
          }
        });
      });
    });
  }

  console.log("✅ Naqsh Resort JS ready (Secure Mode)");
});

// ==================
// INJECT STYLES
// ==================
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .toast-notification { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: #fff; padding: 16px 24px; border-radius: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 10000; opacity: 0; transition: all 0.3s ease; max-width: 90%; font-family: 'Nunito', sans-serif; }
    .toast-notification.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .toast-success { background: linear-gradient(135deg, #2D5A3D, #3d7a4d); }
    .toast-error { background: linear-gradient(135deg, #c0392b, #e74c3c); }
    .toast-info { background: linear-gradient(135deg, #2c3e50, #34495e); }
    .toast-icon { font-size: 20px; font-weight: bold; }
    .toast-message { font-size: 15px; }
    .lightbox { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .lightbox-content { position: relative; max-width: 90%; max-height: 90%; }
    .lightbox-content img { max-width: 100%; max-height: 85vh; border-radius: 8px; object-fit: contain; }
    .lightbox-close { position: absolute; top: -40px; right: 0; background: none; border: none; color: #fff; font-size: 36px; cursor: pointer; }
    .lightbox-close:hover { color: #d4af37; }
    #mobile-menu-toggle.active .bar:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
    #mobile-menu-toggle.active .bar:nth-child(2) { opacity: 0; }
    #mobile-menu-toggle.active .bar:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
  `;
  document.head.appendChild(style);
})();
