const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Finance, localToday } = require('../src/main/finance.cjs');
const renderer = path.join(__dirname, '../src/renderer');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function mount(t) {
  const service = new Finance(':memory:');
  const errors = [];
  const virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(path.join(renderer, 'index.html'), 'utf8'), { runScripts: 'outside-only', url: 'file:///app/index.html', pretendToBeVisual: true, virtualConsole });
  t.after(() => { dom.window.close(); service.close(); assert.deepEqual(errors, []); });
  const w = dom.window; const document = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const respond = work => { try { return Promise.resolve({ ok: true, data: work() }); } catch (error) { return Promise.resolve({ ok: false, error: error.message }); } };
  w.finance = { snapshot: month => respond(() => service.snapshot(month)), execute: (action, payload) => respond(() => service.execute(action, payload)), backup: () => Promise.resolve({ ok: true, data: null }) };
  w.eval(fs.readFileSync(path.join(renderer, 'icons.js'), 'utf8')); w.eval(fs.readFileSync(path.join(renderer, 'app.js'), 'utf8'));
  await tick();
  const click = async selector => { const element = document.querySelector(selector); assert.ok(element, `Elemento encontrado: ${selector}`); element.click(); await tick(); };
  const fill = (name, value) => { const field = document.querySelector('#editor-form').elements[name]; assert.ok(field, name); field.value = String(value); field.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const submit = async () => { document.querySelector('#editor-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await tick(); };
  return { service, w, document, click, fill, submit, month: localToday().slice(0, 7) };
}

test('formulário de receita salva, atualiza o saldo e permite edição e exclusão', async t => {
  const m = await mount(t); const { document: d, click, fill, submit, service, month } = m;
  assert.match(d.querySelector('#balance').textContent, /0,00/);
  await click('#new-transaction'); fill('kind', 'income'); fill('description', 'Salário de teste'); fill('amount_cents', '3500,10');
  assert.equal(d.querySelector('#editor-form').elements.reserve_id.disabled, true);
  await submit(); assert.equal(d.querySelector('#editor-dialog').open, false);
  assert.equal(service.snapshot(month).summary.balance, 350010); assert.match(d.querySelector('#balance').textContent, /3.500,10/);
  await click('[data-preview="transactions"]'); assert.equal(d.querySelector('.summary-grid').hidden, true);
  await click('[data-action="transaction.edit"]'); fill('amount_cents', '3600,00'); await submit();
  assert.equal(service.snapshot(month).summary.balance, 360000);
  await click('[data-action="transaction.delete"]'); await click('#confirm-submit'); assert.equal(service.snapshot(month).transactions.length, 0);
});
test('reserva e despesa vinculada atualizam a barra e mantêm saldo pendente', async t => {
  const { document: d, click, fill, submit, service, month } = await mount(t);
  await click('[data-preview="reserves"]'); await click('[data-action="reserve.new"]'); fill('name', 'Gasolina'); fill('budget_cents', '150,00'); await submit();
  const reserve = service.snapshot(month).reserves[0];
  await click('#new-transaction'); fill('description', 'Posto'); fill('amount_cents', '100,00'); fill('reserve_id', reserve.id); fill('paid_on', ''); await submit();
  assert.equal(service.snapshot(month).reserves[0].remaining_cents, 5000); assert.equal(service.snapshot(month).summary.balance, 0);
  await click('[data-nav="dashboard"]'); assert.match(d.querySelector('#reserves').textContent, /67%/);
  await click('#privacy-button'); assert.ok(!d.querySelector('#reserves').textContent.includes('100,00')); assert.match(d.querySelector('#balance').textContent, /••/);
});
test('conta fixa gera ocorrência e cancelar pelo formulário não recria o lançamento', async t => {
  const { click, fill, submit, service, month } = await mount(t);
  await click('[data-preview="bills"]'); await click('[data-action="bill.new"]'); fill('description', 'Internet'); fill('amount_cents', '99,90'); fill('starts_on', month + '-01'); fill('due_day', '1'); await submit();
  assert.equal(service.snapshot(month).transactions.length, 1);
  await click('[data-preview="transactions"]'); await click('[data-action="transaction.delete"]'); await click('#confirm-submit');
  assert.ok(service.snapshot(month).transactions[0].canceled_at); assert.equal(service.snapshot(month).summary.expenses, 0);
});
test('cartão, parcelamento e pagamento funcionam através dos formulários', async t => {
  const { document: d, click, fill, submit, service, month } = await mount(t);
  await click('[data-preview="cards"]'); await click('[data-action="card.new"]'); fill('name', 'Cartão teste'); fill('limit_cents', '2000,00'); fill('closing_day', '31'); fill('due_day', '5'); await submit();
  await click('[data-action="purchase.new"]'); fill('description', 'Notebook'); fill('total_cents', '100,00'); fill('installment_count', '3'); await submit();
  let snapshot = service.snapshot(month); assert.equal(snapshot.purchases.length, 1); assert.equal(snapshot.cards[0].available_cents, 190000);
  await click('[data-action="purchase.details"]'); await click('[data-action="invoice.details"]'); await click('#detail-dialog [data-action="invoice.close"]'); await click('#confirm-submit');
  // Reabre os detalhes da mesma primeira parcela, que pode estar em outro mês.
  await click('[data-action="purchase.details"]'); await click('[data-action="invoice.details"]'); await click('#detail-dialog [data-action="invoice.pay"]'); await submit();
  snapshot = service.snapshot(month); assert.equal(snapshot.cards[0].available_cents, 193334); assert.equal(snapshot.summary.balance, -3334);
  assert.equal(snapshot.invoices.filter(i => i.status === 'paid').length, 1);
  assert.equal(d.querySelector('#editor-dialog').open, false);
});
test('erros financeiros são exibidos e preservam o formulário para correção', async t => {
  const { document: d, click, fill, submit, service, month } = await mount(t);
  await click('#new-transaction'); fill('description', 'Inválida'); fill('amount_cents', '0,00'); await submit();
  assert.equal(d.querySelector('#editor-dialog').open, true); assert.match(d.querySelector('#editor-error').textContent, /inteiro/); assert.equal(service.snapshot(month).transactions.length, 0);
});
test('nomes são escapados e busca filtra sem executar conteúdo HTML', async t => {
  const { w, document: d, click, fill, submit } = await mount(t);
  await click('#new-transaction'); fill('description', '<img src=x onerror=alert(1)>'); fill('amount_cents', '10,00'); await submit();
  await click('[data-preview="transactions"]'); assert.equal(d.querySelectorAll('#module-view img').length, 0); assert.ok(d.querySelector('#module-view').textContent.includes('<img'));
  const search = d.querySelector('#module-search'); search.value = 'não existe'; search.dispatchEvent(new w.Event('input', { bubbles: true })); assert.match(d.querySelector('#module-transactions').textContent, /Nenhum registro/);
});
