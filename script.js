/**
 * EatSure Complaints Dashboard — script.js
 * =========================================
 * Loads data from data.json, populates filters,
 * renders all Chart.js charts and KPIs, and
 * re-renders everything on filter changes.
 *
 * Architecture:
 *  - loadData()          → fetch & store raw data
 *  - populateFilters()   → build <select> options & CSAT chips
 *  - getFilteredData()   → apply all active filters
 *  - updateDashboard()   → recalculate KPIs + redraw all charts
 *  - Each chart has its own render function for modularity
 */

/* =============================================
   GLOBAL STATE
   ============================================= */
let rawData = [];           // All rows from data.json
let charts = {};            // Holds Chart.js instances (keyed by canvas id)
let activeCsatRatings = new Set(); // Selected CSAT chips (empty = all)

/* =============================================
   COLOUR PALETTE
   Consistent palette used across all charts
   ============================================= */
const PALETTE = {
  orange:   '#f97316',
  blue:     '#3b82f6',
  purple:   '#8b5cf6',
  green:    '#10b981',
  red:      '#ef4444',
  yellow:   '#f59e0b',
  pink:     '#ec4899',
  teal:     '#14b8a6',
  indigo:   '#6366f1',
  lime:     '#84cc16',
  sky:      '#0ea5e9',
  rose:     '#f43f5e',
};

/** Ordered list for consistent chart colours */
const COLOR_LIST = Object.values(PALETTE);

/** Priority colour map */
const PRIORITY_COLORS = {
  'Urgent': '#ef4444',
  'High':   '#f97316',
  'Medium': '#f59e0b',
  'Low':    '#10b981',
};

/** Sentiment colour map */
const SENTIMENT_COLORS = {
  'Very Negative': '#ef4444',
  'Negative':      '#f97316',
  'Neutral':       '#6b7280',
  'Mixed':         '#f59e0b',
  'Positive':      '#10b981',
};

/** Resolution Status colour map */
const RESOLUTION_COLORS = {
  'Resolved':             '#10b981',
  'In Progress':          '#3b82f6',
  'Open':                 '#f97316',
  'Escalated':            '#ef4444',
  'Closed - No Response': '#6b7280',
};


/* =============================================
   ENTRY POINT — runs after DOM is ready
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});


/* =============================================
   DATA LOADING
   ============================================= */
/**
 * Fetches data.json and initialises the dashboard.
 * Uses fetch() — works with any local/remote HTTP server.
 */
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    rawData = await response.json();

    // Normalise empty string fields to null for consistent filtering
    rawData = rawData.map(row => {
      const cleaned = {};
      for (const key in row) {
        cleaned[key] = row[key] === '' ? null : row[key];
      }
      return cleaned;
    });

    // Update header record count
    document.getElementById('totalRecordsLabel').textContent =
      `${rawData.length.toLocaleString()} records loaded`;

    populateFilters();
    setupFilterEvents();
    updateDashboard();
  } catch (err) {
    console.error('Failed to load data.json:', err);
    document.getElementById('totalRecordsLabel').textContent = 'Error loading data';
  }
}


/* =============================================
   FILTER POPULATION
   ============================================= */
/**
 * Reads all unique values per column and fills the <select> dropdowns
 * and CSAT chip buttons.
 */
function populateFilters() {
  const fields = {
    filterBrand:       'brand',
    filterCity:        'city',
    filterLanguage:    'language',
    filterChannel:     'channel',
    filterCategory:    'category',
    filterSubCategory: 'sub_category',
    filterResolution:  'resolution_status',
  };

  for (const [elementId, field] of Object.entries(fields)) {
    const select = document.getElementById(elementId);
    const unique = [...new Set(rawData.map(r => r[field]).filter(Boolean))].sort();
    unique.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val.replace(/_/g, ' ');
      select.appendChild(opt);
    });
  }

  // Build CSAT chip buttons (1–5)
  const container = document.getElementById('csatChips');
  [1, 2, 3, 4, 5].forEach(rating => {
    const chip = document.createElement('button');
    chip.className = 'csat-chip';
    chip.textContent = rating;
    chip.dataset.rating = rating;
    chip.title = `CSAT Rating ${rating}`;
    chip.addEventListener('click', () => toggleCsatChip(chip, rating));
    container.appendChild(chip);
  });
}


/* =============================================
   FILTER EVENTS
   ============================================= */
/**
 * Attaches change listeners to all dropdowns and the Reset button.
 * Every change triggers a full dashboard re-render.
 */
function setupFilterEvents() {
  const selectIds = [
    'filterBrand', 'filterCity', 'filterLanguage',
    'filterChannel', 'filterCategory', 'filterSubCategory', 'filterResolution',
  ];
  selectIds.forEach(id => {
    document.getElementById(id).addEventListener('change', updateDashboard);
  });

  document.getElementById('resetFilters').addEventListener('click', resetFilters);
}

/** Toggle a CSAT chip on/off and re-render */
function toggleCsatChip(chipEl, rating) {
  if (activeCsatRatings.has(rating)) {
    activeCsatRatings.delete(rating);
    chipEl.classList.remove('active');
  } else {
    activeCsatRatings.add(rating);
    chipEl.classList.add('active');
  }
  updateDashboard();
}

/** Clears all filters and chips, then re-renders */
function resetFilters() {
  ['filterBrand', 'filterCity', 'filterLanguage',
   'filterChannel', 'filterCategory', 'filterSubCategory', 'filterResolution'].forEach(id => {
    document.getElementById(id).value = '';
  });
  activeCsatRatings.clear();
  document.querySelectorAll('.csat-chip').forEach(el => el.classList.remove('active'));
  updateDashboard();
}


/* =============================================
   FILTERING LOGIC
   ============================================= */
/**
 * Returns a filtered subset of rawData based on current
 * dropdown selections and active CSAT chips.
 */
function getFilteredData() {
  const brand      = document.getElementById('filterBrand').value;
  const city       = document.getElementById('filterCity').value;
  const language   = document.getElementById('filterLanguage').value;
  const channel    = document.getElementById('filterChannel').value;
  const category   = document.getElementById('filterCategory').value;
  const subCat     = document.getElementById('filterSubCategory').value;
  const resolution = document.getElementById('filterResolution').value;

  return rawData.filter(row => {
    if (brand      && row.brand             !== brand)      return false;
    if (city       && row.city              !== city)       return false;
    if (language   && row.language          !== language)   return false;
    if (channel    && row.channel           !== channel)    return false;
    if (category   && row.category          !== category)   return false;
    if (subCat     && row.sub_category      !== subCat)     return false;
    if (resolution && row.resolution_status !== resolution) return false;
    if (activeCsatRatings.size > 0) {
      const r = row.csat_rating ? parseInt(row.csat_rating, 10) : null;
      if (!activeCsatRatings.has(r)) return false;
    }
    return true;
  });
}


/* =============================================
   MAIN UPDATE ORCHESTRATOR
   ============================================= */
/**
 * Called on every filter change.
 * Gets filtered data, updates KPIs and all charts.
 */
function updateDashboard() {
  const data = getFilteredData();

  // Update filtered badge
  const filteredBadge = document.getElementById('filteredBadge');
  const filteredLabel = document.getElementById('filteredRecordsLabel');
  if (data.length < rawData.length) {
    filteredLabel.textContent = `${data.length.toLocaleString()} filtered`;
    filteredBadge.classList.remove('hidden');
    filteredBadge.style.display = 'inline-flex';
  } else {
    filteredBadge.classList.add('hidden');
    filteredBadge.style.display = '';
  }

  updateKPIs(data);
  renderBrandChart(data);
  renderCategoryChart(data);
  renderPriorityCategoryChart(data);
  renderResolutionChart(data);
  renderReopenedChart(data);
  renderSentimentChart(data);
  renderDeviceOSChart(data);
  renderPaymentChart(data);
  renderCsatChart(data);
  renderTop10Chart(data);
  renderPriorityCategoryStackedChart(data);
}


/* =============================================
   KPI CALCULATIONS
   ============================================= */
function updateKPIs(data) {
  // Total Complaints = number of rows
  document.getElementById('kpiComplaints').textContent =
    data.length.toLocaleString();

  // Total Orders = distinct non-null order_id values
  const uniqueOrders = new Set(data.map(r => r.order_id).filter(Boolean));
  document.getElementById('kpiOrders').textContent =
    uniqueOrders.size.toLocaleString();

  // Total Payment Methods = distinct non-null payment_method values
  const uniquePayments = new Set(data.map(r => r.payment_method).filter(Boolean));
  document.getElementById('kpiPaymentMethods').textContent =
    uniquePayments.size.toLocaleString();

  // Average CSAT Rating (only rows with a valid numeric rating)
  const ratings = data
    .map(r => parseFloat(r.csat_rating))
    .filter(v => !isNaN(v));
  const avg = ratings.length > 0
    ? (ratings.reduce((s, v) => s + v, 0) / ratings.length).toFixed(2)
    : '—';
  document.getElementById('kpiAvgCsat').textContent = avg;
}


/* =============================================
   CHART UTILITY HELPERS
   ============================================= */
/**
 * Count occurrences of each unique value for a given field.
 * Returns { labels: [], values: [] } sorted by count desc.
 */
function countByField(data, field) {
  const counts = {};
  data.forEach(row => {
    const val = row[field] || '(blank)';
    counts[val] = (counts[val] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(e => e[0]),
    values: sorted.map(e => e[1]),
  };
}

/**
 * Creates or updates a Chart.js instance.
 * If the chart already exists, it is destroyed and recreated
 * to avoid stale data issues.
 */
function upsertChart(canvasId, config) {
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, config);
}

/** Shared default options for a clean, minimal look */
function baseOptions(extraOptions = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { font: { size: 11, family: '-apple-system, "Segoe UI", sans-serif' },
                  color: '#6b7280', boxWidth: 12, padding: 12 },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f9fafb',
        bodyColor: '#d1d5db',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: ctx => ` ${ctx.formattedValue}`,
        },
      },
    },
    ...extraOptions,
  };
}

/** Horizontal bar base options (for readability on many labels) */
function hBarOptions(extraOptions = {}) {
  return baseOptions({
    indexAxis: 'y',
    plugins: {
      ...baseOptions().plugins,
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: '#374151', font: { size: 11 } } },
    },
    ...extraOptions,
  });
}

/** Vertical bar base options */
function vBarOptions(extraOptions = {}) {
  return baseOptions({
    plugins: {
      ...baseOptions().plugins,
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#374151', font: { size: 10 } } },
      y: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
    },
    ...extraOptions,
  });
}


/* =============================================
   CHART RENDER FUNCTIONS
   ============================================= */

/** 1. Complaints by Brand (horizontal bar) */
function renderBrandChart(data) {
  const { labels, values } = countByField(data, 'brand');
  upsertChart('chartBrand', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Complaints',
        data: values,
        backgroundColor: labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: hBarOptions(),
  });
}

/** 2. Complaints by Category (donut) */
function renderCategoryChart(data) {
  const { labels, values } = countByField(data, 'category');
  upsertChart('chartCategory', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'right',
          labels: { font: { size: 11 }, color: '#6b7280', boxWidth: 12, padding: 10 },
        },
      },
      cutout: '60%',
    }),
  });
}

/** 3. Priority per Category (grouped bar) */
function renderPriorityCategoryChart(data) {
  const categories = [...new Set(data.map(r => r.category).filter(Boolean))].sort();
  const priorities = ['Urgent', 'High', 'Medium', 'Low'];

  // Build a count map: category -> priority -> count
  const countMap = {};
  data.forEach(row => {
    const cat = row.category;
    const pri = row.priority;
    if (!cat || !pri) return;
    if (!countMap[cat]) countMap[cat] = {};
    countMap[cat][pri] = (countMap[cat][pri] || 0) + 1;
  });

  const datasets = priorities.map(priority => ({
    label: priority,
    data: categories.map(cat => (countMap[cat] && countMap[cat][priority]) || 0),
    backgroundColor: PRIORITY_COLORS[priority] || '#94a3b8',
    borderRadius: 4,
    barPercentage: 0.7,
  }));

  upsertChart('chartPriorityCategory', {
    type: 'bar',
    data: { labels: categories, datasets },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          labels: { font: { size: 11 }, color: '#6b7280', boxWidth: 12, padding: 10 },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#374151', font: { size: 10 } } },
        y: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
      },
    }),
  });
}

/** 4. Resolution Status (pie) */
function renderResolutionChart(data) {
  const { labels, values } = countByField(data, 'resolution_status');
  const colors = labels.map(l => RESOLUTION_COLORS[l] || '#94a3b8');
  upsertChart('chartResolution', {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'right',
          labels: { font: { size: 10 }, color: '#6b7280', boxWidth: 12, padding: 8 },
        },
      },
    }),
  });
}

/** 5. Reopened Complaints (donut) */
function renderReopenedChart(data) {
  const opened  = data.filter(r => r.reopened === 'True').length;
  const notOpen = data.filter(r => r.reopened === 'False').length;
  upsertChart('chartReopened', {
    type: 'doughnut',
    data: {
      labels: ['Reopened', 'Not Reopened'],
      datasets: [{
        data: [opened, notOpen],
        backgroundColor: [PALETTE.red, PALETTE.green],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: baseOptions({
      cutout: '65%',
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, color: '#6b7280', boxWidth: 12, padding: 12 },
        },
      },
    }),
  });
}

/** 6. Sentiment Distribution (horizontal bar) */
function renderSentimentChart(data) {
  const sentimentOrder = ['Very Negative', 'Negative', 'Neutral', 'Mixed', 'Positive'];
  const counts = {};
  data.forEach(row => {
    if (row.sentiment) counts[row.sentiment] = (counts[row.sentiment] || 0) + 1;
  });
  const labels = sentimentOrder.filter(s => counts[s]);
  const values = labels.map(s => counts[s]);
  const colors = labels.map(s => SENTIMENT_COLORS[s] || '#94a3b8');

  upsertChart('chartSentiment', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Count',
        data: values,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: hBarOptions(),
  });
}

/** 7. Device OS (donut) */
function renderDeviceOSChart(data) {
  const { labels, values } = countByField(data, 'device_os');
  const osColors = { 'Android': PALETTE.green, 'iOS': PALETTE.blue, 'Web': PALETTE.purple };
  upsertChart('chartDeviceOS', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(l => osColors[l] || '#94a3b8'),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }],
    },
    options: baseOptions({
      cutout: '65%',
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, color: '#6b7280', boxWidth: 12, padding: 12 },
        },
      },
    }),
  });
}

/** 8. Payment Method (vertical bar) */
function renderPaymentChart(data) {
  const { labels, values } = countByField(data, 'payment_method');
  upsertChart('chartPayment', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Complaints',
        data: values,
        backgroundColor: labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: vBarOptions(),
  });
}

/** 9. CSAT Rating Distribution (vertical bar) */
function renderCsatChart(data) {
  const csatLabels = ['1', '2', '3', '4', '5'];
  const counts = {};
  data.forEach(row => {
    if (row.csat_rating) counts[row.csat_rating] = (counts[row.csat_rating] || 0) + 1;
  });
  const values = csatLabels.map(r => counts[r] || 0);
  const ratingColors = {
    '1': PALETTE.red,
    '2': PALETTE.orange,
    '3': PALETTE.yellow,
    '4': PALETTE.teal,
    '5': PALETTE.green,
  };

  upsertChart('chartCsat', {
    type: 'bar',
    data: {
      labels: csatLabels.map(r => `⭐ ${r}`),
      datasets: [{
        label: 'Responses',
        data: values,
        backgroundColor: csatLabels.map(r => ratingColors[r]),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: vBarOptions(),
  });
}

/**
 * 10. Top 10 Highest EatSure Complaints Feedback (by order_value_inr)
 * Shows the 10 complaints with the highest order value.
 */
function renderTop10Chart(data) {
  // Filter rows with a valid numeric order value
  const valid = data
    .filter(r => r.order_value_inr && !isNaN(parseFloat(r.order_value_inr)))
    .map(r => ({
      id: r.complaint_id,
      brand: r.brand || '(unknown)',
      value: parseFloat(r.order_value_inr),
      category: r.category || '',
    }));

  // Sort descending and take top 10
  valid.sort((a, b) => b.value - a.value);
  const top10 = valid.slice(0, 10);

  const labels  = top10.map(r => `${r.id} · ${r.brand}`);
  const values  = top10.map(r => r.value);
  const colors  = top10.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]);

  upsertChart('chartTop10', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Order Value (₹)',
        data: values,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: hBarOptions({
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: ctx => ` ₹${ctx.formattedValue}`,
          },
        },
      },
    }),
  });
}

/**
 * 11. Priority per Category — Stacked bar
 * Shows all priorities stacked for each category for
 * a fuller picture of workload distribution.
 */
function renderPriorityCategoryStackedChart(data) {
  const categories = [...new Set(data.map(r => r.category).filter(Boolean))].sort();
  const priorities = ['Urgent', 'High', 'Medium', 'Low'];

  const countMap = {};
  data.forEach(row => {
    const cat = row.category;
    const pri = row.priority;
    if (!cat || !pri) return;
    if (!countMap[cat]) countMap[cat] = {};
    countMap[cat][pri] = (countMap[cat][pri] || 0) + 1;
  });

  const datasets = priorities.map(priority => ({
    label: priority,
    data: categories.map(cat => (countMap[cat] && countMap[cat][priority]) || 0),
    backgroundColor: PRIORITY_COLORS[priority] || '#94a3b8',
    stack: 'priority',
    borderRadius: 0,
  }));

  upsertChart('chartPriorityCategoryStacked', {
    type: 'bar',
    data: { labels: categories, datasets },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          labels: { font: { size: 11 }, color: '#6b7280', boxWidth: 12, padding: 10 },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#374151', font: { size: 11 } },
        },
        y: {
          stacked: true,
          grid: { color: '#f3f4f6' },
          ticks: { color: '#9ca3af', font: { size: 10 } },
        },
      },
    }),
  });
}
