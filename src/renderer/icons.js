(() => {
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h15v11H6a3 3 0 0 1-3-3V6"/><path d="M21 12h-6v5h6"/><path d="M17 14.5h.1"/>',
  arrows: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 17l10 5 10-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  card: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 15c4 8 15 2 15-12Z M4 21 15 10m-7 7v-5"/>',
  chevronDown: '<path d="m7 10 5 5 5-5"/>', chevronLeft: '<path d="m14 6-6 6 6 6"/>', chevronRight: '<path d="m9 6 6 6-6 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10 5a13 13 0 0 1 12 7s-1 2-3 4M6 6a17 17 0 0 0-4 6s4 7 10 7c2 0 4-1 5-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 4 4L19 6"/>',
  arrowDownLeft: '<path d="M18 6 6 18M6 7v11h11"/>', arrowUpRight: '<path d="M6 18 18 6M7 6h11v11"/>', arrowRight: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  car: '<path d="m5 8 2-4h10l2 4 2 2v8H3v-8l2-2Zm0 0h14M6 12h2m8 0h2M5 18v3m14-3v3"/>',
  play: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4V8Z"/>',
  basket: '<path d="m8 3-4 6m12-6 4 6M2 9h20l-3 11H5L2 9Zm7 4v3m6-3v3"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1s-1 7 8 15c9-8 11-12 8-15Z"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0M12 20h.01"/>',
  bolt: '<path d="m14 2-11 12h8l-1 8L21 9h-8l1-7Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0m-9 1v3"/>',
  home: '<path d="m2 10 10-8 10 8M5 8v13h14V8M9 21v-8h6v8"/>',
  utensils: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v19M20 3c-5 3-5 11 0 11V3Zm0 11v8"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.wallet}</svg>`;
window.plenoIcon = icon;
})();
