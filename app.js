document.addEventListener('DOMContentLoaded', function () {
  // API Configuration
  const API_URL = window.location.origin || 'http://localhost:5000';
  
  // DOM Elements
  const donorForm = document.getElementById('donorRegistration');
  const bloodRequestForm = document.getElementById('bloodRequest');
  const newsletterForm = document.getElementById('newsletterForm');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  const refreshInventoryBtn = document.getElementById('refreshInventory');
  const updateTimeElement = document.getElementById('updateTime');

  // Initialize application
  initApp();

  function initApp() {
    setupEventListeners();
    updateInventoryTime();
    loadInventoryStats();
    
    // Update inventory time every hour
    setInterval(updateInventoryTime, 3600000);
  }

  function setupEventListeners() {
    // Mobile menu
    if (mobileMenuBtn && mainNav) {
      mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Donor form
    if (donorForm) {
      setupFormValidation(donorForm);
      donorForm.addEventListener('submit', handleDonorRegistration);
    }

    // Blood request form
    if (bloodRequestForm) {
      setupFormValidation(bloodRequestForm);
      bloodRequestForm.addEventListener('submit', handleBloodRequest);
    }

    // Newsletter form
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', handleNewsletterSubscription);
    }

    // Refresh inventory
    if (refreshInventoryBtn) {
      refreshInventoryBtn.addEventListener('click', loadInventoryStats);
    }

    // Form input validation
    setupRealTimeValidation();
  }

  function toggleMobileMenu() {
    const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
    mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
    mainNav.classList.toggle('show');
  }

  function setupFormValidation(form) {
    const inputs = form.querySelectorAll('input, select');
    
    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        validateField(this);
      });
      
      input.addEventListener('input', function() {
        clearFieldError(this);
      });
    });
  }

  function setupRealTimeValidation() {
    // Phone number validation
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
      input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
          this.value = this.value.slice(0, 10);
        }
      });
    });

    // Age validation
    const ageInput = document.getElementById('donorAge');
    if (ageInput) {
      ageInput.addEventListener('input', function(e) {
        if (this.value < 18) this.value = 18;
        if (this.value > 65) this.value = 65;
      });
    }

    // Date validation - cannot select past dates
    const dateInput = document.getElementById('requiredDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.min = today;
    }
  }

  function validateField(field) {
    clearFieldError(field);

    const value = field.value.trim();
    const formGroup = field.closest('.form-group');

    // Required field validation
    if (field.hasAttribute('required') && !value) {
      showFieldError(field, 'This field is required');
      return false;
    }

    // Email validation
    if (field.type === 'email' && value && !isValidEmail(value)) {
      showFieldError(field, 'Please enter a valid email address');
      return false;
    }

    // Phone validation
    if (field.type === 'tel' && value && !isValidPhone(value)) {
      showFieldError(field, 'Please enter a valid 10-digit phone number');
      return false;
    }

    // Age validation
    if (field.id === 'donorAge' && value) {
      const age = parseInt(value);
      if (age < 18 || age > 65) {
        showFieldError(field, 'Age must be between 18 and 65 years');
        return false;
      }
    }

    // Units validation
    if (field.id === 'unitsRequired' && value) {
      const units = parseInt(value);
      if (units < 1 || units > 10) {
        showFieldError(field, 'Units must be between 1 and 10');
        return false;
      }
    }

    return true;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function isValidPhone(phone) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  }

  function showFieldError(field, message) {
    const formGroup = field.closest('.form-group');
    let errorElement = formGroup.querySelector('.field-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      formGroup.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    formGroup.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    const formGroup = field.closest('.form-group');
    const errorElement = formGroup.querySelector('.field-error');
    if (errorElement) errorElement.remove();
    formGroup.classList.remove('error');
    field.removeAttribute('aria-invalid');
  }

  async function handleDonorRegistration(e) {
    e.preventDefault();
    
    const submitBtn = donorForm.querySelector('button[type="submit"]');
    const formData = new FormData(donorForm);
    const donorData = Object.fromEntries(formData);
    
    // Validate all fields
    let isValid = true;
    const inputs = donorForm.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (!validateField(input)) {
        isValid = false;
      }
    });

    if (!isValid) {
      showMessage('Please fix the errors in the form', 'error');
      return;
    }

    // Show loading state
    setButtonLoading(submitBtn, true);

    try {
      const response = await fetch(`${API_URL}/api/donors`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(donorData),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message, 'success');
        donorForm.reset();
        
        // Update inventory stats after new registration
        setTimeout(loadInventoryStats, 1000);
      } else {
        showMessage(data.message || 'Error registering donor', 'error');
      }
    } catch (error) {
      console.error('Donor registration error:', error);
      showMessage('Network error: Unable to connect to server', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function handleBloodRequest(e) {
    e.preventDefault();
    
    const submitBtn = bloodRequestForm.querySelector('button[type="submit"]');
    const formData = new FormData(bloodRequestForm);
    const requestData = Object.fromEntries(formData);
    
    // Validate all fields
    let isValid = true;
    const inputs = bloodRequestForm.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (!validateField(input)) {
        isValid = false;
      }
    });

    if (!isValid) {
      showMessage('Please fix the errors in the form', 'error');
      return;
    }

    // Show loading state
    setButtonLoading(submitBtn, true);

    try {
      const response = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok) {
        let message = data.message;
        if (data.matchingDonors > 0) {
          message += ` Found ${data.matchingDonors} potential donor(s) in your area.`;
        }
        showMessage(message, 'success');
        bloodRequestForm.reset();
      } else {
        showMessage(data.message || 'Error submitting blood request', 'error');
      }
    } catch (error) {
      console.error('Blood request error:', error);
      showMessage('Network error: Unable to connect to server', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  function handleNewsletterSubscription(e) {
    e.preventDefault();
    showMessage('Thank you for subscribing to our newsletter!', 'success');
    newsletterForm.reset();
  }

  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }

  function showMessage(msg, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add icon based on message type
    let icon = 'info-circle';
    switch (type) {
      case 'success':
        icon = 'check-circle';
        break;
      case 'error':
        icon = 'exclamation-circle';
        break;
      case 'warning':
        icon = 'exclamation-triangle';
        break;
    }
    
    toast.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <span>${msg}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  function updateInventoryTime() {
    const now = new Date();
    if (updateTimeElement) {
      updateTimeElement.textContent = now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium'
      });
    }
  }

  async function loadInventoryStats() {
    if (refreshInventoryBtn) {
      refreshInventoryBtn.disabled = true;
      refreshInventoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
      const response = await fetch(`${API_URL}/api/inventory`);
      if (response.ok) {
        const inventory = await response.json();
        updateInventoryDisplay(inventory);
        showMessage('Inventory updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      showMessage('Unable to load inventory data', 'error');
    } finally {
      if (refreshInventoryBtn) {
        refreshInventoryBtn.disabled = false;
        refreshInventoryBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Inventory';
      }
      updateInventoryTime();
    }
  }

  function updateInventoryDisplay(inventory) {
    // This is a mock update - in a real app, you'd update based on actual data
    console.log('Inventory data:', inventory);
    
    // You can implement actual inventory updates here based on the API response
    // For now, we'll just show a success message
  }

  // Health check on load
  async function checkServerHealth() {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (!response.ok) {
        showMessage('Server connection issue detected', 'warning');
      }
    } catch (error) {
      showMessage('Unable to connect to server', 'error');
    }
  }

  // Run health check after a short delay
  setTimeout(checkServerHealth, 2000);

  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Close mobile menu if open
        if (mainNav.classList.contains('show')) {
          toggleMobileMenu();
        }
      }
    });
  });
});