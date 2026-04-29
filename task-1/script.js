/* =========================================================
   Star Wars Leaderboard — script.js
   Vanilla JS, no dependencies.
   ========================================================= */

// ─── State ────────────────────────────────────────────────
const state = {
  year: '',
  quarter: '',
  category: '',
  search: '',
  expandedId: null   // id of the currently expanded row
};

// ─── Quarter helper ───────────────────────────────────────
const QUARTER_MAP = {
  Q1: ['01', '02', '03'],
  Q2: ['04', '05', '06'],
  Q3: ['07', '08', '09'],
  Q4: ['10', '11', '12']
};

function activityMatchesFilters(activity) {
  const { year, quarter, category } = state;
  const [actYear, actMonth] = activity.dateISO.split('-');

  if (year && actYear !== year) return false;
  if (quarter && !QUARTER_MAP[quarter].includes(actMonth)) return false;
  if (category && activity.category !== category) return false;
  return true;
}

// ─── Compute filtered totals & sort ───────────────────────
function getFilteredData() {
  const { search } = state;

  return LEADERBOARD_DATA
    .map(person => {
      const matchingActivities = person.activities.filter(activityMatchesFilters);
      const filteredTotal = matchingActivities.reduce((sum, a) => sum + a.points, 0);

      // Category activity counts (not point sums) from filtered activities
      const categoryCounts = {};
      matchingActivities.forEach(a => {
        categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      });

      return { ...person, filteredTotal, filteredActivities: matchingActivities, categoryCounts };
    })
    .filter(person => {
      if (person.filteredTotal === 0) return false;
      if (search && !person.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.filteredTotal - a.filteredTotal);
}

// ─── SVG Silhouettes (8 variants) ────────────────────────
function getSilhouetteSVG(variant) {
  const fill = '#1a2332';
  const silhouettes = {
    // 1. Hooded figure
    1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="38" rx="14" ry="16" fill="${fill}"/>
          <polygon points="50,14 34,44 66,44" fill="${fill}" opacity="0.85"/>
          <path d="M30,100 Q30,62 50,62 Q70,62 70,100Z" fill="${fill}"/>
        </svg>`,
    // 2. Helmeted figure
    2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="34" y="22" width="32" height="30" rx="16" fill="${fill}"/>
          <rect x="34" y="36" width="32" height="8" rx="1" fill="#fff" opacity="0.3"/>
          <path d="M28,100 Q28,60 50,60 Q72,60 72,100Z" fill="${fill}"/>
        </svg>`,
    // 3. Female with long hair
    3: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="36" rx="14" ry="16" fill="${fill}"/>
          <path d="M36,30 Q28,38 28,58 Q28,70 36,72" stroke="${fill}" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M64,30 Q72,38 72,58 Q72,70 64,72" stroke="${fill}" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M30,100 Q30,60 50,60 Q70,60 70,100Z" fill="${fill}"/>
        </svg>`,
    // 4. Bearded figure
    4: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="34" rx="14" ry="16" fill="${fill}"/>
          <path d="M36,42 Q38,58 50,62 Q62,58 64,42" fill="${fill}"/>
          <path d="M30,100 Q30,62 50,62 Q70,62 70,100Z" fill="${fill}"/>
        </svg>`,
    // 5. Robotic — angular head with antenna
    5: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="36" y="26" width="28" height="28" rx="4" fill="${fill}"/>
          <rect x="44" y="16" width="4" height="12" rx="2" fill="${fill}"/>
          <circle cx="46" cy="16" r="3" fill="${fill}"/>
          <rect x="36" y="36" width="10" height="5" rx="1" fill="#fff" opacity="0.3"/>
          <path d="M28,100 Q28,60 50,60 Q72,60 72,100Z" fill="${fill}"/>
        </svg>`,
    // 6. Backpack figure
    6: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="36" rx="14" ry="16" fill="${fill}"/>
          <path d="M30,100 Q30,60 50,60 Q70,60 70,100Z" fill="${fill}"/>
          <rect x="60" y="56" width="14" height="22" rx="4" fill="${fill}" opacity="0.7"/>
          <line x1="60" y1="60" x2="67" y2="56" stroke="${fill}" stroke-width="3"/>
        </svg>`,
    // 7. Caped/cloaked figure
    7: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="34" rx="13" ry="15" fill="${fill}"/>
          <path d="M50,50 L18,100 L82,100 Z" fill="${fill}"/>
          <path d="M37,50 Q28,65 24,100" stroke="${fill}" stroke-width="6" fill="none" opacity="0.6"/>
          <path d="M63,50 Q72,65 76,100" stroke="${fill}" stroke-width="6" fill="none" opacity="0.6"/>
        </svg>`,
    // 8. Neutral — simple head and shoulders
    8: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="36" rx="14" ry="16" fill="${fill}"/>
          <path d="M30,100 Q30,60 50,60 Q70,60 70,100Z" fill="${fill}"/>
        </svg>`
  };
  return silhouettes[variant] || silhouettes[8];
}

// ─── Category SVG Icons ───────────────────────────────────
const ICONS = {
  star: `<svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 1.5l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.77l-4.78 2.51.91-5.32L2.27 7.12l5.34-.78L10 1.5z"/>
  </svg>`,

  search: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/>
    <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  chevronDown: `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 5.5l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Combat Missions: monitor with stand
  combat: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="3" width="16" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/>
    <path d="M7 17h6M10 14v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,

  // Force Training: graduation cap
  training: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 4L2 8l8 4 8-4-8-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5 10v4c0 1.66 2.24 3 5 3s5-1.34 5-3v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="18" y1="8" x2="18" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // Diplomatic Relations: smiley face
  diplomatic: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="7.5" cy="8.5" r="1" fill="currentColor"/>
    <circle cx="12.5" cy="8.5" r="1" fill="currentColor"/>
    <path d="M7 12.5c.8 1.2 2 1.8 3 1.8s2.2-.6 3-1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
};

const CATEGORY_META = {
  'Combat Missions':      { icon: ICONS.combat,     key: 'combat' },
  'Force Training':       { icon: ICONS.training,   key: 'training' },
  'Diplomatic Relations': { icon: ICONS.diplomatic, key: 'diplomatic' }
};

// ─── Render helpers ───────────────────────────────────────
function avatarHTML(person, size = 'list') {
  const cls = size === 'podium' ? 'podium-avatar' : 'list-avatar';
  return `
    <div class="${cls} faction-${person.faction}">
      ${getSilhouetteSVG(person.silhouette)}
    </div>`;
}

function categoryIconsHTML(categoryCounts) {
  return Object.entries(CATEGORY_META)
    .filter(([cat]) => (categoryCounts[cat] || 0) > 0)
    .map(([cat, meta]) => `
      <div class="cat-icon-item" role="img" aria-label="${cat}: ${categoryCounts[cat]} points">
        ${meta.icon}
        <span class="cat-icon-count">${categoryCounts[cat]}</span>
        <span class="tooltip">${cat}</span>
      </div>`
    ).join('');
}

// ─── Render Podium ────────────────────────────────────────
function renderPodium(sorted) {
  const podiumEl = document.getElementById('podium');
  const top3 = sorted.slice(0, 3);

  if (top3.length === 0) {
    podiumEl.innerHTML = '';
    return;
  }

  // Render in natural rank order (1st, 2nd, 3rd) for correct mobile stacking.
  // Desktop stair-step (2nd-left, 1st-centre, 3rd-right) is handled by CSS
  // order properties on .podium-item.rank-N at 768px+.
  const order = top3.slice(); // [1st, 2nd, 3rd]

  podiumEl.innerHTML = order.map(person => {
    const rank = sorted.indexOf(person) + 1;
    const rankClass = `rank-${rank}`;

    return `
      <article class="podium-item ${rankClass}" aria-label="${person.name}, rank ${rank}">
        <div class="podium-info">
          <div class="podium-avatar-wrap">
            <div class="podium-avatar ${rankClass} faction-${person.faction}">
              ${getSilhouetteSVG(person.silhouette)}
            </div>
            <span class="rank-badge ${rankClass}" aria-hidden="true">${rank}</span>
          </div>
          <div class="podium-name">${escapeHTML(person.name)}</div>
          <div class="podium-position">${escapeHTML(person.position)}</div>
          <div class="points-pill">
            ${ICONS.star}
            <span>${person.filteredTotal} pts</span>
          </div>
        </div>
        <div class="podium-step ${rankClass}" aria-hidden="true">
          <span class="podium-step-number">${rank}</span>
        </div>
      </article>`;
  }).join('');

  // Desktop order (2nd-left, 1st-centre, 3rd-right) is handled entirely
  // by CSS using .podium-item.rank-N { order: … } at min-width 768px.
  // No inline styles needed here.
}

// ─── Render Ranking List ──────────────────────────────────
function renderList(sorted) {
  const listEl = document.getElementById('ranking-list');

  if (sorted.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = sorted.map((person, idx) => {
    const rank = idx + 1;
    const icons = categoryIconsHTML(person.categoryCounts);

    // Sort filtered activities by date descending for expansion
    const acts = [...person.filteredActivities].sort((a, b) =>
      new Date(b.dateISO) - new Date(a.dateISO)
    );

    const activityRows = acts.map((a, i) => `
      <tr>
        <td>${escapeHTML(a.title)}</td>
        <td><span class="activity-cat-pill">${escapeHTML(a.category)}</span></td>
        <td><span class="activity-date">${escapeHTML(a.date)}</span></td>
        <td>+${a.points}</td>
      </tr>`).join('');

    return `
      <div class="rank-row" id="row-${person.id}" data-id="${person.id}">
        <div class="rank-row-main"
             role="button"
             tabindex="0"
             aria-expanded="false"
             aria-controls="expanded-${person.id}"
             aria-label="View details for ${escapeHTML(person.name)}">
          <div class="rank-number">${rank}</div>
          ${avatarHTML(person, 'list')}
          <div class="rank-identity">
            <div class="rank-name">${escapeHTML(person.name)}</div>
            <div class="rank-pos">${escapeHTML(person.position)}</div>
          </div>
          <div class="cat-icons" aria-label="Category scores">${icons}</div>
          <div class="rank-total">
            <div class="rank-total-label">Total</div>
            <div class="rank-total-points">
              ${ICONS.star}
              <span>${person.filteredTotal}</span>
            </div>
          </div>
          <button class="expand-btn"
                  aria-label="${person.name} — expand activity details"
                  aria-expanded="false"
                  aria-controls="expanded-${person.id}">
            ${ICONS.chevronDown}
          </button>
        </div>

        <!-- Mobile: category icons on secondary row -->
        <div class="rank-row-secondary" aria-label="Category scores">
          ${icons}
        </div>

        <!-- Expanded activity panel -->
        <div class="rank-row-expanded" id="expanded-${person.id}" role="region" aria-label="Recent activity for ${escapeHTML(person.name)}">
          <div class="expanded-inner">
            <div class="expanded-header">Recent Activity</div>
            <table class="activity-table">
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col">Category</th>
                  <th scope="col">Date</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                ${activityRows || '<tr><td colspan="4">No activities match current filters.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }).join('');

  // Restore expanded state if needed
  if (state.expandedId !== null) {
    const row = document.getElementById(`row-${state.expandedId}`);
    if (row) setRowExpanded(row, true, false);
  }

  // Attach click listeners
  listEl.querySelectorAll('.rank-row-main').forEach(main => {
    main.addEventListener('click', onRowClick);
    main.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(e); }
    });
  });

  listEl.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const row = btn.closest('.rank-row');
      toggleRow(row);
    });
  });
}

// ─── Expand / Collapse logic ──────────────────────────────
function onRowClick(e) {
  // Prevent double-fire if expand-btn was clicked (it stops propagation)
  const row = e.currentTarget.closest('.rank-row');
  toggleRow(row);
}

function toggleRow(row) {
  const id = parseInt(row.dataset.id, 10);
  const isExpanded = row.classList.contains('expanded');

  // Collapse all
  document.querySelectorAll('.rank-row.expanded').forEach(r => setRowExpanded(r, false));
  state.expandedId = null;

  // Expand clicked if it wasn't already open
  if (!isExpanded) {
    setRowExpanded(row, true);
    state.expandedId = id;
  }
}

function setRowExpanded(row, expand, animate = true) {
  const main = row.querySelector('.rank-row-main');
  const btn  = row.querySelector('.expand-btn');

  if (expand) {
    row.classList.add('expanded');
    if (main) main.setAttribute('aria-expanded', 'true');
    if (btn)  btn.setAttribute('aria-expanded', 'true');
  } else {
    row.classList.remove('expanded');
    if (main) main.setAttribute('aria-expanded', 'false');
    if (btn)  btn.setAttribute('aria-expanded', 'false');
  }
}

// ─── Full render ──────────────────────────────────────────
function render() {
  const sorted = getFilteredData();
  renderPodium(sorted);
  renderList(sorted);
}

// ─── Utility ─────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Event listeners — Filters ────────────────────────────
function initFilters() {
  document.getElementById('filter-year').addEventListener('change', e => {
    state.year = e.target.value;
    state.expandedId = null;
    render();
  });

  document.getElementById('filter-quarter').addEventListener('change', e => {
    state.quarter = e.target.value;
    state.expandedId = null;
    render();
  });

  document.getElementById('filter-category').addEventListener('change', e => {
    state.category = e.target.value;
    state.expandedId = null;
    render();
  });

  document.getElementById('filter-search').addEventListener('input', e => {
    state.search = e.target.value;
    state.expandedId = null;
    render();
  });
}

// ─── Bootstrap ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  render();
});
