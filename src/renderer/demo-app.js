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
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const state = { month: '2026-09', filter: 'all', search: '', hidden: false, card: 0, transactions: structuredClone(window.DEMO.transactions) };
const money = cents => state.hidden ? 'R$ •••••' : currency.format(cents / 100);
const date = iso => new Date(`${iso}T12:00:00`);
const shortDate = iso => date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const sum = list => list.reduce((total, item) => total + item.amount, 0);
const monthItems = () => state.transactions.filter(item => item.date.startsWith(state.month));
const monthInstallments = () => DEMO.installments.filter(item => item.month === state.month);
const monthBills = () => DEMO.bills.filter(item => item.due.startsWith(state.month));
const invoiceTotal = card => sum(monthInstallments().filter(item => item.card === card));
const reserveSpent = reserve => sum(monthItems().filter(item => item.kind === 'expense' && (item.reserve === reserve.name || (!item.reserve && item.category === reserve.name)))) + sum(monthInstallments().filter(item => item.reserve === reserve.name));

function renderSummary() {
  const income = sum(monthItems().filter(item => item.kind === 'income'));
  const expense = sum(monthItems().filter(item => item.kind === 'expense')) + sum(monthInstallments()) + sum(monthBills());
  const balance = DEMO.openingBalance + state.transactions.reduce((total, item) => total + (item.kind === 'income' ? item.amount : -item.amount), 0);
  $('#balance').textContent = money(balance);
  $('#income').textContent = money(income);
  $('#expenses').textContent = money(expense);
  $('#invoices-total').textContent = money(sum(monthInstallments()));
  const count = DEMO.cards.filter(card => invoiceTotal(card.name) > 0).length;
  $('#invoice-count').textContent = `${count} ${count === 1 ? 'fatura' : 'faturas'}`;
  $('#month-label').textContent = date(`${state.month}-01`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  $('#previous-month').disabled = state.month <= '2000-01';
  $('#next-month').disabled = state.month >= '2099-12';
}

function renderReserves() {
  const hasReserves = state.month === '2026-09';
  $('#reserves').innerHTML = hasReserves ? DEMO.reserves.map(reserve => {
    const spent = reserveSpent(reserve);
    const percent = Math.round(spent / reserve.budget * 100);
    return `<article class="reserve ${reserve.tone}"><div class="reserve-top"><div class="reserve-title"><span class="reserve-icon">${icon(reserve.icon)}</span>${reserve.name}</div><span class="reserve-percent">${state.hidden ? '••' : percent + '%'}</span></div><div class="progress" role="progressbar" aria-label="Orçamento utilizado: ${reserve.name}" ${state.hidden ? '' : `aria-valuenow="${Math.min(percent, 100)}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${percent}% do orçamento"`}><span style="width:${state.hidden ? 0 : Math.min(percent, 100)}%"></span></div><div class="reserve-values"><strong>${money(spent)}</strong><span>de ${money(reserve.budget)}</span></div><div class="reserve-remaining">${spent > reserve.budget ? 'Excedido em' : 'Disponível:'} ${money(Math.abs(reserve.budget - spent))}</div></article>`;
  }).join('') : '<p class="empty empty-reserves">Nenhuma reserva demonstrativa neste mês.<br>Volte a setembro para explorar o orçamento.</p>';
  const available = DEMO.reserves.reduce((total, reserve) => total + reserve.budget - reserveSpent(reserve), 0);
  $('#reserve-insight').textContent = hasReserves ? `Você tem ${money(available)} disponíveis nas reservas deste mês.` : 'Cada mês tem seu próprio planejamento.';
}

function upcoming() {
  // Agenda ancorada no “hoje” do cenário, independente do mês selecionado.
  const end = date(DEMO.today); end.setDate(end.getDate() + 7);
  return [...DEMO.bills, ...DEMO.cards.map(card => ({ description: `Fatura ${card.name}`, category: 'Cartão de crédito', due: card.due, icon: 'card', amount: sum(DEMO.installments.filter(item => item.card === card.name && item.month === card.due.slice(0, 7))) }))]
    .filter(item => item.due >= DEMO.today && date(item.due) <= end).sort((a, b) => a.due.localeCompare(b.due));
}
function renderUpcoming() {
  const bills = upcoming();
  $('#due-count').textContent = bills.length;
  $('#upcoming-bills').innerHTML = bills.map(bill => `<div class="bill"><span class="bill-icon">${icon(bill.icon)}</span><div class="bill-copy"><strong>${bill.description}</strong><small>${bill.category}</small></div><div class="bill-right"><strong class="money">${money(bill.amount)}</strong><small>${shortDate(bill.due)}</small></div></div>`).join('');
  $('#due-total').textContent = money(sum(bills));
}
function filteredTransactions() {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return monthItems().filter(item => (state.filter === 'all' || item.kind === state.filter) && normalize(item.description + ' ' + item.category).includes(normalize(state.search))).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}
function renderTransactions() {
  const list = filteredTransactions().slice(0, 5);
  $('#transactions').innerHTML = list.length ? list.map(item => `<tr><td><div class="transaction-name"><span class="transaction-icon">${icon(item.icon)}</span>${escapeHTML(item.description)}</div></td><td><span class="category-tag">${escapeHTML(item.category)}</span></td><td>${shortDate(item.date)}</td><td class="amount-cell"><strong class="money ${item.kind === 'income' ? 'positive' : ''}">${state.hidden ? '' : item.kind === 'income' ? '+ ' : '− '}${money(item.amount)}</strong></td></tr>`).join('') : '<tr><td colspan="4" class="empty">Nenhuma movimentação encontrada neste período.</td></tr>';
}
function renderCard() {
  const card = DEMO.cards[state.card];
  const committed = sum(DEMO.installments.filter(item => item.card === card.name));
  $('#credit-card').innerHTML = `<div class="bank-card"><div class="bank-top"><strong>${card.name}</strong><small>Crédito • Mastercard</small></div><div class="card-chip"><span class="chip-shape"></span>${icon('wifi')}</div><div class="card-number"><span>•••• &nbsp; •••• &nbsp; •••• &nbsp; ${state.hidden ? '••••' : card.lastDigits}</span><span class="mastercard" aria-label="Mastercard"><i></i><i></i></span></div></div><div class="card-limit"><div class="card-limit-top"><span>Limite disponível</span><strong class="money">${money(card.limit - committed)}</strong></div><div class="progress" role="meter" aria-label="Limite comprometido" ${state.hidden ? '' : `aria-valuenow="${committed}" aria-valuemin="0" aria-valuemax="${card.limit}" aria-valuetext="${money(committed)} de ${money(card.limit)}"`}><span style="width:${state.hidden ? 0 : committed / card.limit * 100}%"></span></div><div class="card-limit-bottom"><span>${money(committed)} utilizados</span><span>Total ${money(card.limit)}</span></div></div><div class="card-footer"><span>Inclui parcelas futuras</span><div class="card-switch">${DEMO.cards.map((item, i) => `<button class="${i === state.card ? 'active' : ''}" data-card="${i}" aria-label="Mostrar cartão ${item.name}" aria-pressed="${i === state.card}"></button>`).join('')}</div><button class="text-button" data-preview="cards">Detalhes ${icon('arrowRight')}</button></div>`;
}
function render() {
  renderSummary(); renderReserves(); renderUpcoming(); renderTransactions(); renderCard();
  $('#demo-date').textContent = `Dados fictícios · hoje: ${date(DEMO.today).toLocaleDateString('pt-BR')}`;
}
function detailRow(title, subtitle, value) { return `<div class="detail-row"><div>${escapeHTML(title)}<small>${escapeHTML(subtitle)}</small></div><strong>${escapeHTML(value)}</strong></div>`; }
function showDetails(type) {
  const titles = { transactions: 'Movimentações do mês', reserves: 'Suas reservas', bills: 'Contas fixas', cards: 'Cartões e faturas' };
  let rows = [];
  if (type === 'transactions') rows = monthItems().sort((a, b) => b.date.localeCompare(a.date)).map(item => detailRow(item.description, `${item.category} · ${shortDate(item.date)} · ${item.kind === 'income' ? 'Recebida' : 'Paga'}`, `${item.kind === 'income' ? '+' : '−'} ${money(item.amount)}`));
  if (type === 'reserves' && state.month === '2026-09') rows = DEMO.reserves.map(reserve => detailRow(reserve.name, `Orçamento: ${money(reserve.budget)} · utilizado: ${money(reserveSpent(reserve))}`, `${money(reserve.budget - reserveSpent(reserve))} livres`));
  if (type === 'bills') rows = DEMO.bills.map(bill => detailRow(bill.description, `Mensal · próximo vencimento em ${shortDate(bill.due)}`, money(bill.amount)));
  if (type === 'cards') rows = DEMO.cards.map(card => detailRow(card.name, `Fatura ${state.month === '2026-09' ? card.status.toLowerCase() : 'aberta'} · ${state.month}`, money(invoiceTotal(card.name))));
  $('#dialog-title').textContent = titles[type];
  $('#dialog-content').innerHTML = '<p class="dialog-description">Prévia com dados fictícios. Os cadastros, as edições e os pagamentos serão implementados após a aprovação do visual.</p>' + (rows.join('') || '<p class="empty">Nenhum registro demonstrativo neste mês.</p>');
  $('#detail-dialog').showModal();
}
function shiftMonth(offset) {
  const next = date(`${state.month}-01`); next.setMonth(next.getMonth() + offset);
  state.month = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  render();
}
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }

document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
$('#previous-month').addEventListener('click', () => shiftMonth(-1));
$('#next-month').addEventListener('click', () => shiftMonth(1));
$('#transaction-search').addEventListener('input', event => { state.search = event.target.value; renderTransactions(); });
$('#privacy-button').addEventListener('click', () => {
  state.hidden = !state.hidden;
  $('#privacy-button').setAttribute('aria-pressed', state.hidden);
  const label = state.hidden ? 'Mostrar valores' : 'Ocultar valores';
  $('#privacy-button').setAttribute('aria-label', label); $('#privacy-button').title = label;
  $('#privacy-button').innerHTML = icon(state.hidden ? 'eyeOff' : 'eye'); render();
});
document.addEventListener('click', event => {
  const preview = event.target.closest('[data-preview]'); if (preview) showDetails(preview.dataset.preview);
  const close = event.target.closest('[data-close]'); if (close) close.closest('dialog').close();
  const tab = event.target.closest('[data-filter]');
  if (tab) { state.filter = tab.dataset.filter; document.querySelectorAll('[data-filter]').forEach(button => { const active = button === tab; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); }); renderTransactions(); }
  const card = event.target.closest('[data-card]'); if (card) { state.card = Number(card.dataset.card); renderCard(); }
});
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
$('#new-transaction').addEventListener('click', () => {
  $('#transaction-form').reset(); $('#form-error').textContent = '';
  $('#transaction-form').elements.date.value = state.month === '2026-09' ? DEMO.today : `${state.month}-01`;
  $('#transaction-dialog').showModal();
});
$('#transaction-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = new FormData(event.target);
  const amountText = fields.get('amount').trim();
  const [whole, fraction = ''] = amountText.replace(',', '.').split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  const description = fields.get('description').trim();
  if (!/^\d+([,.]\d{1,2})?$/.test(amountText) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999 || !description) { $('#form-error').textContent = 'Informe uma descrição e um valor entre R$ 0,01 e R$ 9.999.999,99.'; return; }
  state.transactions.push({ id: Date.now(), description, amount, date: fields.get('date'), category: fields.get('category'), kind: fields.get('kind'), icon: fields.get('kind') === 'income' ? 'arrowDownLeft' : 'wallet' });
  state.month = fields.get('date').slice(0, 7); state.filter = 'all'; state.search = ''; $('#transaction-search').value = '';
  document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === 'all'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $('#transaction-dialog').close(); render(); toast('Lançamento adicionado à demonstração. Não será salvo.');
});
render();
