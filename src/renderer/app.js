(() => {
  'use strict';
  // A prévia HTTP continua isolada: não tem acesso a dados pessoais.
  if (!window.finance) {
    if (location.protocol === 'file:') {
      document.querySelector('.summary-grid').hidden = true; document.querySelector('.content-grid').hidden = true;
      const error = document.querySelector('#module-view'); error.hidden = false;
      error.innerHTML = '<section class="panel"><div class="empty">Não foi possível iniciar a conexão local.<br>Abra o aplicativo com npm start ou pelo executável Pleno.</div></section>';
      return;
    }
    document.querySelector('#database-info').textContent = 'Demonstração';
    document.querySelector('[data-preview="categories"]').hidden = true;
    const data = document.createElement('script'); data.src = 'demo-data.js';
    data.onload = () => { const script = document.createElement('script'); script.src = 'demo-app.js'; document.head.append(script); };
    document.head.append(data); return;
  }
  const $ = selector => document.querySelector(selector);
  const icon = window.plenoIcon;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = { month: localDate.slice(0, 7), view: 'dashboard', data: null, hidden: false, filter: 'all', search: '', card: 0, request: 0, busy: false };
  const names = { dashboard: 'Visão geral', transactions: 'Transações', reserves: 'Reservas', bills: 'Contas fixas', cards: 'Cartões de crédito', categories: 'Categorias' };
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = value => state.hidden ? 'R$ •••••' : currency.format(value / 100);
  const amountInput = value => ((value ?? 0) / 100).toFixed(2).replace('.', ',');
  const dateText = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const shortDate = value => new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const sum = (rows, key = 'amount_cents') => rows.reduce((total, row) => total + row[key], 0);
  const empty = message => `<div class="empty">${message}</div>`;
  const pill = (label, tone = '') => `<span class="state-pill ${tone}">${esc(label)}</span>`;
  const button = (action, label, id, tone = '', extra = '') => `<button class="row-action ${tone}" data-action="${action}" ${id != null ? `data-id="${id}"` : ''} ${extra}>${label}</button>`;
  const options = (items, selected, label = 'name') => items.map(item => `<option value="${esc(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${esc(item[label])}</option>`).join('');
  const formInput = (label, name, value = '', type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const textInput = (label, name, value = '') => formInput(label, name, value, 'text', 'required maxlength="120"');
  const moneyInput = (label, name, value = 0) => formInput(label, name, amountInput(value), 'text', 'required inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" maxlength="12"');
  const dateInput = (label, name, value, required = true) => formInput(label, name, value, 'date', `min="2000-01-01" max="2099-12-31" ${required ? 'required' : ''}`);
  const select = (label, name, content) => `<label>${label}<select name="${name}">${content}</select></label>`;
  const row = (...content) => `<div class="form-row">${content.join('')}</div>`;
  const note = content => `<p class="dialog-description">${content}</p>`;
  const table = (headers, rows, message = 'Nenhum registro neste período.') => rows.length ? `<div class="table-wrap"><table class="management-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty(message);
  const panel = (title, subtitle, actions, body) => `<section class="panel management-panel"><div class="panel-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="inline-actions">${actions}</div></div>${body}</section>`;
  const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let toastTimer;
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
  async function unwrap(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.data; }
  async function refresh() {
    const request = ++state.request;
    const data = await unwrap(window.finance.snapshot(state.month));
    if (request !== state.request) return;
    state.data = data; render();
  }
  async function mutate(action, payload, period) {
    if (state.busy) throw new Error('Aguarde a operação em andamento.');
    state.busy = true;
    try { await unwrap(window.finance.execute(action, payload)); if (period) state.month = period; await refresh(); toast('Alteração salva no banco local.'); }
    finally { state.busy = false; }
  }

  function render() {
    const d = state.data;
    $('#month-label').textContent = new Date(`${state.month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
    $('#previous-month').disabled = state.month <= '2000-01'; $('#next-month').disabled = state.month >= '2099-12';
    $('.breadcrumb strong').textContent = names[state.view];
    $('h1').textContent = state.view === 'dashboard' ? 'Vamos cuidar do seu futuro.' : names[state.view];
    $('.page-heading p').textContent = ({ dashboard: 'Veja como estão suas finanças e planeje os próximos passos.', transactions: 'Receitas, despesas e pagamentos organizados em um só lugar.', reserves: 'Dê um destino ao seu dinheiro antes de gastar.', bills: 'Sua rotina financeira, sem esquecer os próximos meses.', cards: 'Acompanhe compras, parcelas, limites e faturas.', categories: 'Organize seus lançamentos do seu jeito.' })[state.view];
    document.querySelectorAll('.nav-item').forEach(item => {
      const active = (item.dataset.nav || item.dataset.preview) === state.view;
      item.classList.toggle('active', active); if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    $('.summary-grid').hidden = state.view !== 'dashboard'; $('.content-grid').hidden = state.view !== 'dashboard'; $('#module-view').hidden = state.view === 'dashboard';
    $('#balance').textContent = money(d.summary.balance); $('#income').textContent = money(d.summary.income); $('#expenses').textContent = money(d.summary.expenses); $('#invoices-total').textContent = money(d.summary.invoices);
    $('#invoice-count').textContent = `${d.summary.invoiceCount} ${d.summary.invoiceCount === 1 ? 'fatura' : 'faturas'}`;
    $('#demo-date').textContent = `Dados locais · hoje: ${dateText(d.today)}`;
    document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
    renderReserves(); renderUpcoming(); renderTransactions(); renderCard(); renderModule();
  }
  function reserveCards(manage = false) {
    return state.data.reserves.map((r, index) => {
      const percent = r.budget_cents === 0 ? (r.spent_cents ? 100 : 0) : Math.round(r.spent_cents / r.budget_cents * 100);
      return `<article class="reserve ${['green', 'purple', 'orange', 'blue'][index % 4]} ${manage ? 'managed-reserve' : ''}"><div class="reserve-top"><div class="reserve-title"><span class="reserve-icon">${icon('layers')}</span>${esc(r.name)}</div><span class="reserve-percent">${state.hidden ? '••' : percent + '%'}</span></div><div class="progress" role="progressbar" aria-label="Orçamento utilizado: ${esc(r.name)}" ${state.hidden ? '' : `aria-valuenow="${Math.min(percent, 100)}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${percent}% do orçamento"`}><span style="width:${state.hidden ? 0 : Math.min(percent, 100)}%"></span></div><div class="reserve-values"><strong>${money(r.spent_cents)}</strong><span>de ${money(r.budget_cents)}</span></div><div class="reserve-remaining ${r.remaining_cents < 0 ? 'negative' : ''}">${r.remaining_cents < 0 ? 'Excedido em' : 'Disponível:'} ${money(Math.abs(r.remaining_cents))}</div>${manage ? `<div class="reserve-actions">${button('reserve.edit', 'Editar', r.id)}${button('reserve.delete', 'Excluir', r.id, 'danger')}</div>` : ''}</article>`;
    }).join('');
  }
  function renderReserves() {
    $('#reserves').innerHTML = reserveCards() || '<div class="empty empty-reserves">Seu planejamento começa aqui.<br>Crie a primeira reserva deste mês.</div>';
    const remaining = sum(state.data.reserves, 'remaining_cents');
    $('#reserve-insight').textContent = state.data.reserves.length ? (remaining >= 0 ? `Você tem ${money(remaining)} disponíveis nas reservas deste mês.` : `As reservas excederam o orçamento em ${money(-remaining)}.`) : 'Separe valores para o que importa para você.';
  }
  function renderUpcoming() {
    const { upcoming, overdue } = state.data;
    $('#due-count').textContent = upcoming.length;
    $('#upcoming-bills').innerHTML = (overdue.length ? `<div class="overdue-note">${overdue.length} ${overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'} · ${money(sum(overdue))} ${button('overdue', 'Ver')}</div>` : '') + (upcoming.map(b => `<div class="bill"><span class="bill-icon">${icon(b.source === 'invoice' ? 'card' : 'calendar')}</span><div class="bill-copy"><strong>${esc(b.description)}</strong><small>${b.source === 'invoice' ? 'Fatura de cartão' : 'Despesa pendente'}</small></div><div class="bill-right"><strong>${money(b.amount_cents)}</strong><small>${shortDate(b.due_on)}</small></div><button class="icon-button" data-action="${b.source === 'invoice' ? 'invoice.details' : 'transaction.edit'}" data-id="${b.id}" aria-label="Abrir ${esc(b.description)}">${icon('arrowRight')}</button></div>`).join('') || empty('Tudo tranquilo por aqui.<br>Nenhuma conta nos próximos 7 dias.'));
    $('#due-total').textContent = money(sum(upcoming));
  }
  function movements() {
    const direct = state.data.transactions.map(t => ({ ...t, source: 'transaction', date: t.occurred_on, label: t.description, category: t.category_name || 'Pagamento de fatura' }));
    const installments = state.data.installments.filter(i => i.month === state.month).map(i => ({ ...i, kind: 'expense', source: 'installment', date: `${i.month}-01`, label: `${i.description} · ${i.installment_number}/${i.installment_count}`, category: i.category_name }));
    return [...direct, ...installments].filter(t => (state.filter === 'all' || (state.filter === 'canceled' ? t.canceled_at : t.kind === state.filter && !t.canceled_at)) && normal(t.label + ' ' + t.category).includes(normal(state.search))).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }
  function statusLabel(t) {
    if (t.canceled_at) return pill('Cancelada', 'muted');
    if (t.source === 'installment') return pill(({ open: 'Na fatura aberta', closed: 'Na fatura fechada', paid: 'Fatura paga' })[t.status]);
    if (t.paid_on) return pill(t.kind === 'income' ? 'Recebida' : 'Paga', 'good');
    return pill(t.due_on < state.data.today ? 'Atrasada' : 'Pendente', 'warning');
  }
  function transactionRows(manage = false) {
    const list = manage ? movements() : movements().filter(t => !t.canceled_at).slice(0, 5);
    return list.map(t => `<tr class="${t.canceled_at ? 'canceled-row' : ''}"><td><div class="transaction-name"><span class="transaction-icon">${icon(t.source === 'installment' || t.kind === 'invoice_payment' ? 'card' : t.kind === 'income' ? 'arrowDownLeft' : 'wallet')}</span><span>${esc(t.label)}${manage && t.reserve_name ? `<small>Reserva: ${esc(t.reserve_name)}</small>` : ''}</span></div></td><td><span class="category-tag">${esc(t.category)}</span></td><td>${t.source === 'installment' ? esc(t.month) : shortDate(t.date)}</td><td class="amount-cell"><strong class="${t.kind === 'income' ? 'positive' : ''}">${state.hidden ? '' : t.kind === 'income' ? '+ ' : '− '}${money(t.amount_cents)}</strong></td>${manage ? `<td>${statusLabel(t)}</td><td><div class="inline-actions">${t.source === 'installment' ? button('installment.edit', 'Reserva', t.id) : t.kind === 'invoice_payment' ? button('invoice.details', 'Ver fatura', t.invoice_id) : t.canceled_at ? button('transaction.restore', 'Restaurar', t.id) : button('transaction.edit', 'Editar', t.id) + button('transaction.settle', t.paid_on ? 'Desfazer baixa' : t.kind === 'income' ? 'Receber' : 'Pagar', t.id) + button('transaction.delete', t.recurring_bill_id ? 'Cancelar' : 'Excluir', t.id, 'danger')}</div></td>` : ''}</tr>`);
  }
  function renderTransactions() { $('#transactions').innerHTML = transactionRows().join('') || '<tr><td colspan="4" class="empty">Nenhum lançamento neste mês. Comece em “Nova transação”.</td></tr>'; }
  function renderCard() {
    const cards = state.data.cards.filter(c => !c.archived_at);
    state.card = Math.min(state.card, Math.max(0, cards.length - 1)); const c = cards[state.card];
    if (!c) { $('#credit-card').innerHTML = empty('Cadastre seu primeiro cartão<br>e acompanhe suas faturas por aqui.') + `<div class="empty">${button('card.new', 'Cadastrar cartão')}</div>`; return; }
    $('#credit-card').innerHTML = `<div class="bank-card"><div class="bank-top"><strong>${esc(c.name)}</strong><small>Cartão de crédito</small></div><div class="card-chip"><span class="chip-shape"></span>${icon('wifi')}</div><div class="card-number"><span>SEUS PLANOS EM DIA</span><span class="mastercard" aria-hidden="true"><i></i><i></i></span></div></div><div class="card-limit"><div class="card-limit-top"><span>Limite disponível</span><strong>${money(c.available_cents)}</strong></div><div class="progress"><span style="width:${state.hidden || c.limit_cents === 0 ? 0 : Math.min(100, c.committed_cents / c.limit_cents * 100)}%"></span></div><div class="card-limit-bottom"><span>${money(c.committed_cents)} utilizados</span><span>Total ${money(c.limit_cents)}</span></div></div><div class="card-footer"><span>Inclui parcelas futuras</span><div class="card-switch">${cards.map((card, i) => `<button class="${i === state.card ? 'active' : ''}" data-card="${i}" aria-label="Mostrar ${esc(card.name)}" aria-pressed="${i === state.card}"></button>`).join('')}</div><button class="text-button" data-preview="cards">Detalhes ${icon('arrowRight')}</button></div>`;
  }
  function renderModule() {
    if (state.view === 'dashboard') return;
    const d = state.data;
    if (state.view === 'transactions') {
      $('#module-view').innerHTML = panel('Lançamentos do mês', 'Parcelas entram nos gastos; pagamentos de fatura movimentam apenas o caixa.', button('transaction.new', '+ Nova transação') + button('purchase.new', '+ Compra no cartão'), `<div class="module-filters"><select id="module-filter" aria-label="Filtrar transações">${[{ id: 'all', name: 'Todas' }, { id: 'income', name: 'Receitas' }, { id: 'expense', name: 'Despesas e parcelas' }, { id: 'invoice_payment', name: 'Pagamentos de fatura' }, { id: 'canceled', name: 'Canceladas' }].map(o => `<option value="${o.id}" ${state.filter === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select><input id="module-search" type="search" aria-label="Buscar transações" placeholder="Buscar descrição ou categoria" value="${esc(state.search)}"></div><div id="module-transactions">${table(['Descrição', 'Categoria', 'Competência', 'Valor', 'Situação', 'Ações'], transactionRows(true))}</div>`);
    }
    if (state.view === 'reserves') $('#module-view').innerHTML = panel('Seu orçamento em envelopes', 'As sobras não são transferidas automaticamente entre meses.', button('reserve.new', '+ Nova reserva'), `<div class="reserve-grid managed-reserves">${reserveCards(true) || empty('Nenhuma reserva neste mês. Defina seu primeiro envelope.')}</div>`);
    if (state.view === 'bills') $('#module-view').innerHTML = panel('Contas recorrentes', 'Geradas até o mês atual ou consultado. Alterar o modelo não modifica lançamentos existentes.', button('bill.new', '+ Conta fixa'), table(['Descrição', 'Categoria', 'Valor mensal', 'Vencimento', 'Vigência', 'Situação', 'Ações'], d.bills.map(b => `<tr><td>${esc(b.description)}</td><td>${esc(b.category_name)}</td><td>${money(b.amount_cents)}</td><td>Dia ${b.due_day}</td><td>${dateText(b.starts_on)}<small>até ${b.ends_on ? dateText(b.ends_on) : 'sem prazo'}</small></td><td>${pill(b.active ? 'Ativa' : 'Pausada', b.active ? 'good' : 'muted')}</td><td><div class="inline-actions">${button('bill.edit', 'Editar', b.id)}${button('bill.toggle', b.active ? 'Pausar' : 'Retomar', b.id)}${button('bill.delete', 'Excluir modelo', b.id, 'danger')}</div></td></tr>`)));
    if (state.view === 'categories') $('#module-view').innerHTML = panel('Categorias de lançamentos', 'Arquivar preserva o histórico e remove a categoria dos novos lançamentos.', button('category.new', '+ Categoria'), table(['Nome', 'Tipo', 'Situação', 'Ações'], d.categories.map(c => `<tr><td>${esc(c.name)}</td><td>${c.kind === 'income' ? 'Receita' : 'Despesa'}</td><td>${pill(c.archived_at ? 'Arquivada' : 'Ativa', c.archived_at ? 'muted' : 'good')}</td><td>${button('category.edit', 'Editar', c.id)} ${button('category.archive', c.archived_at ? 'Reativar' : 'Arquivar', c.id)}</td></tr>`)));
    if (state.view === 'cards') {
      const invoices = d.invoices.filter(i => i.month === state.month);
      $('#module-view').innerHTML = panel('Limites dos cartões', 'Todas as parcelas não pagas comprometem o limite.', button('card.new', '+ Cartão') + button('purchase.new', '+ Compra'), `<div class="card-management-grid">${d.cards.map(c => `<article class="card-management ${c.archived_at ? 'archived' : ''}"><h3>${esc(c.name)} ${c.archived_at ? pill('Arquivado') : ''}</h3><p>Disponível</p><strong class="card-available">${money(c.available_cents)}</strong><p>${money(c.committed_cents)} utilizados de ${money(c.limit_cents)}</p><p>Fecha dia ${c.closing_day} · vence dia ${c.due_day}</p><div class="inline-actions">${button('card.edit', 'Editar', c.id)}${button('card.archive', c.archived_at ? 'Reativar' : 'Arquivar', c.id)}</div></article>`).join('') || empty('Cadastre um cartão para começar.')}</div>`) + panel('Faturas do mês', 'Feche, confira as parcelas e registre o pagamento integral.', '', table(['Cartão', 'Fechamento', 'Vencimento', 'Total', 'Situação', 'Ações'], invoices.map(i => `<tr><td>${esc(i.card_name)}</td><td>${dateText(i.closes_on)}</td><td>${dateText(i.due_on)}</td><td>${money(i.total_cents)}</td><td>${invoiceStatus(i)}</td><td><div class="inline-actions">${button('invoice.details', 'Detalhes', i.id)}${invoiceActions(i)}</div></td></tr>`))) + panel('Compras e parcelamentos', 'Compras de todos os meses. Para corrigir, todas as parcelas precisam estar em faturas abertas.', '', table(['Compra', 'Cartão', 'Data', 'Total', 'Parcelas', 'Ações'], d.purchases.map(p => `<tr><td>${esc(p.description)}<small>${esc(p.category_name)}</small></td><td>${esc(p.card_name)}</td><td>${dateText(p.purchased_on)}</td><td>${money(p.total_cents)}</td><td>${p.installment_count}×</td><td><div class="inline-actions">${button('purchase.details', 'Parcelas', p.id)}${p.editable ? button('purchase.edit', 'Editar', p.id) + button('purchase.delete', 'Excluir', p.id, 'danger') : pill('Protegida')}</div></td></tr>`)));
    }
  }
  function invoiceStatus(i) { return pill(({ open: 'Aberta', closed: 'Fechada', paid: 'Paga' })[i.status], i.status === 'paid' ? 'good' : i.due_on < state.data.today ? 'warning' : ''); }
  function invoiceActions(i) { return i.status === 'paid' ? button('invoice.undo', 'Desfazer pagamento', i.id) : i.status === 'open' ? button('invoice.close', 'Fechar', i.id) : button('invoice.pay', 'Pagar', i.id) + button('invoice.reopen', 'Reabrir', i.id); }
  function navigate(view) { if (!names[view]) return; state.view = view; state.filter = 'all'; state.search = ''; $('#transaction-search').value = ''; render(); $('#main').focus(); }
  function categoryOptions(kind, selected) { return options(state.data.categories.filter(c => c.kind === kind && !c.archived_at), selected); }
  function reserveOptions(period, selected) { return '<option value="">Sem reserva</option>' + options(state.data.allReserves.filter(r => r.month === period), selected); }
  function showEditor(title, type, fields, id) {
    $('#editor-title').textContent = title;
    const form = $('#editor-form'); form.dataset.type = type; form.dataset.id = id || '';
    form.innerHTML = fields + '<p class="form-error" id="editor-error" role="alert"></p><div class="dialog-footer"><button class="button secondary" type="button" data-close>Cancelar</button><button class="button primary" type="submit">Salvar</button></div>';
    $('#editor-dialog').showModal();
  }
  function openTransaction(t = {}) {
    const d = state.data; const day = t.occurred_on || (state.month === d.today.slice(0, 7) ? d.today : `${state.month}-01`);
    showEditor(t.id ? 'Editar transação' : 'Nova transação', 'transaction', row(select('Tipo', 'kind', `<option value="expense" ${t.kind !== 'income' ? 'selected' : ''}>Despesa</option><option value="income" ${t.kind === 'income' ? 'selected' : ''}>Receita</option>`), moneyInput('Valor (R$)', 'amount_cents', t.amount_cents)) + textInput('Descrição', 'description', t.description) + row(select('Categoria', 'category_id', categoryOptions(t.kind || 'expense', t.category_id)), select('Reserva do mês', 'reserve_id', reserveOptions(day.slice(0, 7), t.reserve_id))) + row(dateInput('Data de competência', 'occurred_on', day), dateInput('Vencimento', 'due_on', t.due_on || day)) + dateInput('Recebido / pago em (vazio = pendente)', 'paid_on', t.id ? t.paid_on || '' : day <= d.today ? day : '', false) + note('Despesas consomem a reserva pela competência. O saldo só muda quando a data de pagamento é preenchida.'), t.id);
    updateTransactionOptions();
  }
  function updateTransactionOptions() {
    const form = $('#editor-form'); if (form.dataset.type !== 'transaction') return;
    const fields = form.elements; const selected = fields.category_id.value;
    fields.category_id.innerHTML = categoryOptions(fields.kind.value, selected);
    const reserve = fields.reserve_id.value;
    fields.reserve_id.innerHTML = reserveOptions(fields.occurred_on.value.slice(0, 7), reserve);
    fields.reserve_id.disabled = fields.kind.value === 'income'; if (fields.reserve_id.disabled) fields.reserve_id.value = '';
  }
  function openReserve(r = {}) {
    showEditor(r.id ? 'Editar reserva' : 'Nova reserva', 'reserve', textInput('Nome da reserva', 'name', r.name) + row(formInput('Mês', 'month', r.month || state.month, 'month', 'required min="2000-01" max="2099-12"'), moneyInput('Orçamento (R$)', 'budget_cents', r.budget_cents)), r.id);
  }
  function openBill(b = {}) {
    showEditor(b.id ? 'Editar conta fixa' : 'Nova conta fixa', 'bill', textInput('Descrição', 'description', b.description) + select('Categoria', 'category_id', categoryOptions('expense', b.category_id)) + row(moneyInput('Valor mensal (R$)', 'amount_cents', b.amount_cents), formInput('Dia do vencimento', 'due_day', b.due_day || 10, 'number', 'required min="1" max="31" step="1"')) + row(dateInput('Início da vigência', 'starts_on', b.starts_on || state.data.today), dateInput('Fim da vigência (opcional)', 'ends_on', b.ends_on || '', false)) + note('Em meses curtos, o vencimento é ajustado para o último dia. Lançamentos já gerados são editados na tela de transações. Retomar uma conta recupera meses não gerados dentro da vigência.'), b.id);
  }
  function openCard(c = {}) {
    showEditor(c.id ? 'Editar cartão' : 'Novo cartão', 'card', textInput('Nome do cartão', 'name', c.name) + moneyInput('Limite total (R$)', 'limit_cents', c.limit_cents) + row(formInput('Dia do fechamento', 'closing_day', c.closing_day || 5, 'number', 'required min="1" max="31"'), formInput('Dia do vencimento', 'due_day', c.due_day || 12, 'number', 'required min="1" max="31"')) + note('Compras no dia do fechamento entram no próximo ciclo. Para mudar as datas de um cartão existente, todas as parcelas devem estar quitadas.'), c.id);
  }
  function openCategory(c = {}) {
    showEditor(c.id ? 'Editar categoria' : 'Nova categoria', 'category', textInput('Nome', 'name', c.name) + select('Tipo', 'kind', `<option value="expense" ${c.kind !== 'income' ? 'selected' : ''}>Despesa</option><option value="income" ${c.kind === 'income' ? 'selected' : ''}>Receita</option>`), c.id);
  }
  function openPurchase(p = {}) {
    const cards = state.data.cards.filter(c => !c.archived_at);
    if (!cards.length) { toast('Cadastre um cartão antes de registrar a compra.'); navigate('cards'); openCard(); return; }
    const names = [...new Set(state.data.allReserves.map(r => r.name))];
    const first = state.data.installments.find(i => i.purchase_id === p.id);
    showEditor(p.id ? 'Editar compra parcelada' : 'Compra no cartão', 'purchase', textInput('Descrição da compra', 'description', p.description) + row(select('Cartão', 'card_id', options(cards, p.card_id)), select('Categoria', 'category_id', categoryOptions('expense', p.category_id))) + row(moneyInput('Valor total da compra (R$)', 'total_cents', p.total_cents), formInput('Número de parcelas', 'installment_count', p.installment_count || 1, 'number', 'required min="1" max="360"')) + dateInput('Data da compra', 'purchased_on', p.purchased_on || state.data.today) + select('Vincular a reservas com o nome', 'reserve_name', '<option value="">Sem reserva</option>' + names.map(name => `<option ${first?.reserve_name === name ? 'selected' : ''}>${esc(name)}</option>`).join('')) + note('O valor total compromete o limite. As parcelas entram nas faturas seguintes. A reserva é vinculada apenas nos meses em que já existe; as demais parcelas ficam sem reserva. Ao editar, o parcelamento e os vínculos são recalculados.'), p.id);
  }
  function openInstallment(i) {
    if (i.status !== 'open') { toast('Reabra a fatura não paga para alterar a reserva.'); return; }
    showEditor(`Reserva da parcela ${i.installment_number}/${i.installment_count}`, 'installment', note(`${esc(i.description)} · fatura ${esc(i.month)} · ${money(i.amount_cents)}`) + select('Reserva da competência', 'reserve_id', reserveOptions(i.month, i.reserve_id)), i.id);
  }
  function openPayment(i) { showEditor(`Pagar fatura ${i.card_name}`, 'payment', note(`Pagamento integral de <strong>${money(i.total_cents)}</strong>. Esse valor sairá do saldo de caixa e será liberado no limite do cartão.`) + dateInput('Data do pagamento', 'paid_on', state.data.today), i.id); }
  function showDetails(title, content) {
    $('#dialog-title').textContent = title; $('#detail-dialog .eyebrow').textContent = 'SEUS REGISTROS';
    $('#dialog-content').innerHTML = content; $('#detail-dialog .dialog-footer span').textContent = 'Dados salvos no banco local';
    $('#detail-dialog').showModal();
  }
  function invoiceDetails(id) {
    const i = state.data.invoices.find(i => i.id === id); if (!i) return;
    const list = state.data.installments.filter(s => s.invoice_id === id);
    showDetails(`Fatura ${i.card_name} · ${i.month}`, `<div class="invoice-overview">${invoiceStatus(i)}<strong>${money(i.total_cents)}</strong><p>Fecha em ${dateText(i.closes_on)} · vence em ${dateText(i.due_on)}</p>${i.paid_on ? `<p>Paga em ${dateText(i.paid_on)}</p>` : ''}</div>${list.map(s => `<div class="detail-row"><div>${esc(s.description)}<small>Parcela ${s.installment_number}/${s.installment_count} · ${esc(s.reserve_name || 'Sem reserva')}</small></div><strong>${money(s.amount_cents)}</strong></div>`).join('')}<div class="inline-actions detail-actions">${invoiceActions(i)}</div>`);
  }
  let pendingConfirmation;
  function confirmChange(message, action, payload) {
    pendingConfirmation = { action, payload }; $('#confirm-message').textContent = message; $('#confirm-error').textContent = ''; $('#confirm-submit').disabled = false; $('#confirm-dialog').showModal();
  }
  function find(name, id) { const value = state.data[name].find(item => item.id === id); if (!value) throw new Error('Registro não encontrado. Atualize a tela.'); return value; }
  async function action(name, id) {
    if (name === 'transaction.new') return openTransaction();
    if (name === 'reserve.new') return openReserve();
    if (name === 'bill.new') return openBill();
    if (name === 'card.new') return openCard();
    if (name === 'purchase.new') return openPurchase();
    if (name === 'category.new') return openCategory();
    if (name === 'transaction.edit' || name === 'transaction.settle') {
      let t = state.data.transactions.find(t => t.id === id);
      if (!t) { const item = [...state.data.upcoming, ...state.data.overdue].find(t => t.id === id && t.source === 'transaction'); if (item) { state.month = item.due_on.slice(0, 7); await refresh(); t = state.data.transactions.find(t => t.id === id); } }
      // Vencimento pode diferir da competência; buscar o registro pelo snapshot do mês original é tratado pelo IPC específico.
      if (!t) { t = await unwrap(window.finance.execute('transaction.get', { id })); }
      if (name.endsWith('edit')) return openTransaction(t);
      if (t.paid_on) return confirmChange('Desfazer a baixa? O lançamento ficará pendente e o saldo de caixa será recalculado.', 'transaction.settle', { id, paid_on: null });
      return showEditor(t.kind === 'income' ? 'Receber lançamento' : 'Pagar despesa', 'settle', note(`${esc(t.description)} · ${money(t.amount_cents)}`) + dateInput('Data da baixa', 'paid_on', state.data.today), id);
    }
    if (name === 'reserve.edit') return openReserve(find('allReserves', id));
    if (name === 'bill.edit') return openBill(find('bills', id));
    if (name === 'card.edit') return openCard(find('cards', id));
    if (name === 'category.edit') return openCategory(find('categories', id));
    if (name === 'purchase.edit') return openPurchase(find('purchases', id));
    if (name === 'installment.edit') return openInstallment(find('installments', id));
    if (name === 'invoice.details') return invoiceDetails(id);
    if (name === 'invoice.pay') return openPayment(find('invoices', id));
    if (name === 'purchase.details') {
      const p = find('purchases', id);
      return showDetails(p.description, state.data.installments.filter(i => i.purchase_id === id).map(i => `<div class="detail-row"><div>Parcela ${i.installment_number}/${i.installment_count}<small>${esc(i.month)} · ${esc(i.card_name)} · ${esc(i.reserve_name || 'Sem reserva')}</small></div><strong>${money(i.amount_cents)}</strong>${button('invoice.details', 'Fatura', i.invoice_id)}</div>`).join(''));
    }
    if (name === 'overdue') return showDetails('Contas atrasadas', state.data.overdue.map(t => `<div class="detail-row"><div>${esc(t.description)}<small>Venceu em ${dateText(t.due_on)}</small></div><strong>${money(t.amount_cents)}</strong>${button(t.source === 'invoice' ? 'invoice.details' : 'transaction.edit', 'Abrir', t.id)}</div>`).join(''));
    if (name === 'backup') {
      const destination = await unwrap(window.finance.backup()); if (destination) toast('Cópia de segurança salva.'); return;
    }
    const messages = {
      'transaction.delete': 'Excluir esta transação? O saldo e a reserva serão recalculados. Se for uma conta fixa, somente esta ocorrência será cancelada para impedir sua recriação.',
      'transaction.restore': 'Restaurar esta ocorrência como despesa pendente?',
      'reserve.delete': 'Excluir a reserva? Só é possível excluir envelopes sem lançamentos vinculados.',
      'bill.delete': 'Excluir este modelo? Se já houver histórico, ele será pausado. As ocorrências existentes permanecem e podem ser canceladas em Transações.',
      'purchase.delete': 'Excluir a compra e todas as suas parcelas? O limite e as reservas serão recalculados.',
      'invoice.close': 'Fechar esta fatura? As parcelas ficarão protegidas até uma reabertura explícita.',
      'invoice.reopen': 'Reabrir esta fatura para correções? Se a data de fechamento já passou, ela voltará a fechar ao reiniciar o aplicativo ou no próximo dia.',
      'invoice.undo': 'Desfazer o pagamento? O valor voltará ao caixa e comprometerá novamente o limite. Faturas pagas deixam de contar como quitadas.'
    };
    if (messages[name]) return confirmChange(messages[name], name, { id });
    if (name === 'bill.toggle') return confirmChange(find('bills', id).active ? 'Pausar a geração desta conta? Lançamentos já gerados permanecem.' : 'Retomar a conta? Meses não gerados dentro da vigência serão recuperados.', name, { id });
    if (name === 'category.archive' || name === 'card.archive') {
      const item = find(name.startsWith('card') ? 'cards' : 'categories', id);
      return confirmChange(item.archived_at ? 'Reativar este cadastro?' : 'Arquivar este cadastro, preservando seu histórico?', name, { id, archived: !item.archived_at });
    }
  }
  function parseMoney(value) {
    if (!/^\d+([,.]\d{1,2})?$/.test(value)) throw new Error('Informe valores como 150,00, sem separador de milhar.');
    const [whole, decimal = ''] = value.replace(',', '.').split('.');
    const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > 999999999) throw new Error('Valor fora do intervalo permitido (até R$ 9.999.999,99).'); return cents;
  }
  $('#editor-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form)); const id = Number(form.dataset.id) || undefined;
      for (const key of ['amount_cents', 'budget_cents', 'limit_cents', 'total_cents']) if (key in values) values[key] = parseMoney(values[key]);
      for (const key of ['category_id', 'reserve_id', 'card_id', 'due_day', 'closing_day', 'installment_count']) if (key in values) values[key] = values[key] === '' ? null : Number(values[key]);
      if (values.kind === 'income' && form.dataset.type === 'transaction') values.reserve_id = null;
      const operation = ({ transaction: 'transaction.save', reserve: 'reserve.save', bill: 'bill.save', card: 'card.save', category: 'category.save', purchase: 'purchase.save', installment: 'installment.reserve', payment: 'invoice.pay', settle: 'transaction.settle' })[form.dataset.type];
      const period = form.dataset.type === 'transaction' ? values.occurred_on.slice(0, 7) : form.dataset.type === 'reserve' ? values.month : undefined;
      await mutate(operation, { ...values, id }, period); $('#editor-dialog').close(); $('#detail-dialog').close();
    } catch (error) { $('#editor-error').textContent = error.message; }
    finally { submit.disabled = false; }
  });
  $('#editor-form').addEventListener('change', event => { if (['kind', 'occurred_on'].includes(event.target.name)) updateTransactionOptions(); });
  $('#confirm-submit').addEventListener('click', async () => {
    const button = $('#confirm-submit'); button.disabled = true;
    try { await mutate(pendingConfirmation.action, pendingConfirmation.payload); $('#confirm-dialog').close(); $('#detail-dialog').close(); }
    catch (error) { $('#confirm-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]'); if (close) { if (!state.busy) close.closest('dialog').close(); return; }
    const nav = event.target.closest('[data-preview],[data-nav]'); if (nav && state.data) { navigate(nav.dataset.preview || nav.dataset.nav); return; }
    const target = event.target.closest('[data-action]'); if (target && state.data) action(target.dataset.action, Number(target.dataset.id)).catch(error => toast(error.message));
    const card = event.target.closest('[data-card]'); if (card) { state.card = Number(card.dataset.card); renderCard(); }
    const tab = event.target.closest('[data-filter]'); if (tab && state.data) { state.filter = tab.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === tab); b.setAttribute('aria-pressed', b === tab); }); renderTransactions(); }
  });
  document.addEventListener('change', event => { if (event.target.id === 'module-filter') { state.filter = event.target.value; $('#module-transactions').innerHTML = table(['Descrição', 'Categoria', 'Competência', 'Valor', 'Situação', 'Ações'], transactionRows(true)); } });
  document.addEventListener('input', event => {
    if (event.target.id === 'transaction-search') { state.search = event.target.value; if (state.data) renderTransactions(); }
    if (event.target.id === 'module-search') { state.search = event.target.value; $('#module-transactions').innerHTML = table(['Descrição', 'Categoria', 'Competência', 'Valor', 'Situação', 'Ações'], transactionRows(true)); }
  });
  async function changeMonth(offset) {
    const date = new Date(`${state.month}-01T12:00:00`); date.setMonth(date.getMonth() + offset);
    state.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    try { await refresh(); } catch (error) { toast(error.message); }
  }
  $('#previous-month').addEventListener('click', () => changeMonth(-1)); $('#next-month').addEventListener('click', () => changeMonth(1));
  $('#new-transaction').addEventListener('click', () => { if (state.data) openTransaction(); });
  $('#privacy-button').addEventListener('click', () => {
    state.hidden = !state.hidden; const label = state.hidden ? 'Mostrar valores' : 'Ocultar valores';
    $('#privacy-button').setAttribute('aria-label', label); $('#privacy-button').setAttribute('aria-pressed', state.hidden); $('#privacy-button').title = label; $('#privacy-button').innerHTML = icon(state.hidden ? 'eyeOff' : 'eye'); if (state.data) render();
  });
  $('#database-info').addEventListener('click', () => { if (state.data) showDetails('Seu banco de dados', note('Todos os registros são armazenados neste computador. Faça uma cópia de segurança antes de trocar de máquina.') + `<code class="database-path">${esc(state.data.databasePath)}</code><div class="detail-actions">${button('backup', 'Salvar cópia de segurança')}</div>` + note('A cópia deve ter um nome novo. Para restaurar, feche o Pleno e substitua o banco seguindo o README.')); });
  $('.brand').addEventListener('click', event => { event.preventDefault(); if (state.data) navigate('dashboard'); });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
    dialog.addEventListener('click', event => { if (event.target === dialog && !state.busy) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  });
  // Recupera recorrências e fechamento quando a janela volta a ser utilizada.
  window.addEventListener('focus', () => { if (state.data && !state.busy && !document.querySelector('dialog[open]')) refresh().catch(error => toast(error.message)); });
  const refreshTimer = setInterval(() => { if (state.data && !state.busy && !document.querySelector('dialog[open]')) refresh().catch(error => toast(error.message)); }, 60000);
  window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
  refresh().catch(error => { $('#module-view').hidden = false; $('#module-view').innerHTML = panel('Não foi possível carregar o banco', esc(error.message), '', empty('Feche e abra o aplicativo para tentar novamente.')); $('.summary-grid').hidden = true; $('.content-grid').hidden = true; });
})();
