const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Finance, dayInMonth } = require('../src/main/finance.cjs');

function fixture(t, today = '2026-09-18') {
  const clock = { today };
  const service = new Finance(':memory:', { today: () => clock.today });
  t.after(() => service.close());
  const categories = service.snapshot(today.slice(0, 7)).categories;
  return { service, clock, expense: categories.find(c => c.name === 'Alimentação').id, income: categories.find(c => c.name === 'Salário').id };
}
function transaction(f, overrides = {}) {
  return f.service.execute('transaction.save', { kind: 'expense', description: 'Mercado', amount_cents: 10000, occurred_on: f.clock.today, due_on: f.clock.today, paid_on: null, category_id: f.expense, reserve_id: null, ...overrides });
}
function card(f, overrides = {}) { return f.service.execute('card.save', { name: 'Meu cartão', limit_cents: 100000, closing_day: 20, due_day: 28, ...overrides }); }
function purchase(f, cardId, overrides = {}) { return f.service.execute('purchase.save', { card_id: cardId, category_id: f.expense, description: 'Compra', purchased_on: f.clock.today, total_cents: 10000, installment_count: 3, ...overrides }); }

test('banco inicia vazio, com categorias e saldo zero', t => {
  const f = fixture(t); const s = f.service.snapshot('2026-09');
  assert.deepEqual({ ...s.summary }, { balance: 0, income: 0, expenses: 0, invoices: 0, invoiceCount: 0 });
  assert.equal(s.transactions.length, 0); assert.ok(s.categories.length > 0);
  assert.equal(f.service.one('PRAGMA foreign_keys').foreign_keys, 1);
});
test('CRUD, competência e data de recebimento não confundem saldo e gasto', t => {
  const f = fixture(t);
  const r = f.service.execute('reserve.save', { name: 'Mercado', month: '2026-09', budget_cents: 15000 });
  const expense = transaction(f, { reserve_id: r });
  transaction(f, { kind: 'income', category_id: f.income, amount_cents: 50000, paid_on: f.clock.today, occurred_on: '2026-08-31' });
  let s = f.service.snapshot('2026-09');
  assert.equal(s.summary.balance, 50000); assert.equal(s.summary.income, 50000); assert.equal(s.summary.expenses, 10000); assert.equal(s.reserves[0].remaining_cents, 5000);
  f.service.execute('transaction.settle', { id: expense, paid_on: f.clock.today });
  assert.equal(f.service.snapshot('2026-09').summary.balance, 40000);
  transaction(f, { id: expense, amount_cents: 17000, reserve_id: r, paid_on: f.clock.today });
  s = f.service.snapshot('2026-09'); assert.equal(s.summary.balance, 33000); assert.equal(s.reserves[0].remaining_cents, -2000);
  f.service.execute('transaction.delete', { id: expense });
  s = f.service.snapshot('2026-09'); assert.equal(s.summary.balance, 50000); assert.equal(s.summary.expenses, 0); assert.equal(s.reserves[0].remaining_cents, 15000);
});
test('rejeita categoria incompatível, reserva de outro mês e valores inválidos', t => {
  const f = fixture(t);
  const r = f.service.execute('reserve.save', { name: 'Futuro', month: '2026-10', budget_cents: 10000 });
  for (const override of [{ amount_cents: -1 }, { amount_cents: 1.2 }, { amount_cents: NaN }, { amount_cents: 1000000000 }, { category_id: f.income }, { reserve_id: r }, { occurred_on: '2026-02-30' }, { paid_on: '2026-09-19' }]) assert.throws(() => transaction(f, override));
  assert.equal(f.service.snapshot('2026-09').transactions.length, 0);
});
test('reserva utilizada não pode ser removida ou mudar de mês', t => {
  const f = fixture(t); const id = f.service.execute('reserve.save', { name: 'Envelope', month: '2026-09', budget_cents: 0 });
  transaction(f, { reserve_id: id });
  assert.throws(() => f.service.execute('reserve.delete', { id }), /Desvincule/);
  assert.throws(() => f.service.execute('reserve.save', { id, name: 'Envelope', month: '2026-10', budget_cents: 0 }), /mudar de mês/);
});
test('recorrência recupera meses, ajusta dias e preserva cancelamentos', t => {
  const f = fixture(t, '2024-03-15');
  const id = f.service.execute('bill.save', { description: 'Internet', category_id: f.expense, amount_cents: 12000, due_day: 31, starts_on: '2024-01-01', ends_on: null });
  const feb = f.service.snapshot('2024-02').transactions[0];
  assert.equal(feb.due_on, '2024-02-29');
  f.service.snapshot('2024-03'); f.service.snapshot('2024-03');
  assert.equal(f.service.one('SELECT COUNT(*) AS n FROM transactions').n, 3);
  f.service.execute('transaction.delete', { id: feb.id });
  assert.ok(f.service.snapshot('2024-02').transactions[0].canceled_at);
  assert.equal(f.service.snapshot('2024-02').summary.expenses, 0);
  f.service.execute('transaction.restore', { id: feb.id }); assert.equal(f.service.snapshot('2024-02').summary.expenses, 12000);
  f.service.execute('bill.save', { id, description: 'Internet nova', category_id: f.expense, amount_cents: 15000, due_day: 31, starts_on: '2024-01-01', ends_on: '2024-05-15' });
  const april = f.service.snapshot('2024-04').transactions[0]; assert.equal(april.amount_cents, 15000); assert.equal(april.due_on, '2024-04-30');
  assert.equal(f.service.snapshot('2024-05').transactions.length, 0); assert.equal(f.service.snapshot('2024-01').transactions[0].amount_cents, 12000);
});
test('conta pausada não gera e retomada recupera meses faltantes', t => {
  const f = fixture(t);
  const id = f.service.execute('bill.save', { description: 'Academia', category_id: f.expense, amount_cents: 10000, due_day: 5, starts_on: '2026-09-01' });
  f.service.snapshot('2026-09'); f.service.execute('bill.toggle', { id });
  assert.equal(f.service.snapshot('2026-11').transactions.length, 0);
  f.service.execute('bill.toggle', { id }); assert.equal(f.service.snapshot('2026-11').transactions.length, 1);
  f.service.execute('bill.delete', { id }); assert.equal(f.service.snapshot('2026-11').bills[0].active, 0);
});
test('parcelamento conserva centavos, compromete total e aloca reservas por fatura', t => {
  const f = fixture(t); const c = card(f);
  for (const month of ['2026-09', '2026-10']) f.service.execute('reserve.save', { name: 'Compra', month, budget_cents: 10000 });
  purchase(f, c, { reserve_name: 'Compra' }); const s = f.service.snapshot('2026-09');
  assert.deepEqual(s.installments.map(i => i.amount_cents), [3334, 3333, 3333]);
  assert.deepEqual(s.installments.map(i => i.month), ['2026-09', '2026-10', '2026-11']);
  assert.ok(s.installments[0].reserve_id); assert.ok(s.installments[1].reserve_id); assert.equal(s.installments[2].reserve_id, null);
  assert.equal(s.cards[0].available_cents, 90000); assert.equal(s.summary.balance, 0); assert.equal(s.summary.expenses, 3334); assert.equal(s.reserves[0].spent_cents, 3334);
});
test('compras no fechamento vão ao próximo ciclo e vencimentos ajustam mês', t => {
  const f = fixture(t, '2026-01-31'); const c = card(f, { closing_day: 31, due_day: 5 });
  purchase(f, c, { purchased_on: '2026-01-31', installment_count: 2 });
  const s = f.service.snapshot('2026-03'); const first = s.invoices.find(i => i.month === '2026-03');
  assert.equal(first.closes_on, '2026-02-28'); assert.equal(first.due_on, '2026-03-05');
  assert.equal(dayInMonth('2024-02', 31), '2024-02-29');
});
test('limite insuficiente reverte toda a operação sem compra ou fatura órfã', t => {
  const f = fixture(t); const c = card(f, { limit_cents: 10000 }); purchase(f, c);
  assert.throws(() => purchase(f, c, { total_cents: 1, installment_count: 1 }), /Limite insuficiente/);
  let s = f.service.snapshot('2026-09'); assert.equal(s.purchases.length, 1); assert.equal(s.invoices.length, 3);
  assert.throws(() => f.service.execute('card.save', { id: c, name: 'Cartão', limit_cents: 9000, closing_day: 20, due_day: 28 }), /menor/);
  s = f.service.snapshot('2026-09'); assert.equal(s.cards[0].limit_cents, 10000);
});
test('editar compra usa seu limite liberado e conserva os dados em falha', t => {
  const f = fixture(t); const c = card(f, { limit_cents: 10000 }); const id = purchase(f, c);
  purchase(f, c, { id, total_cents: 9000, installment_count: 2 });
  assert.equal(f.service.snapshot('2026-09').cards[0].available_cents, 1000);
  assert.throws(() => purchase(f, c, { id, total_cents: 11000 }), /Limite insuficiente/);
  let s = f.service.snapshot('2026-09'); assert.equal(s.purchases[0].total_cents, 9000); assert.equal(s.installments.length, 2);
  f.service.execute('purchase.delete', { id }); s = f.service.snapshot('2026-09'); assert.equal(s.cards[0].available_cents, 10000); assert.equal(s.invoices.length, 0);
});
test('pagamento não duplica gastos, libera somente sua fatura e pode ser desfeito', t => {
  const f = fixture(t); const c = card(f); const p = purchase(f, c); const i = f.service.snapshot('2026-09').invoices.find(i => i.month === '2026-09');
  assert.throws(() => f.service.execute('invoice.pay', { id: i.id, paid_on: f.clock.today }), /Feche/);
  f.service.execute('invoice.close', { id: i.id });
  assert.throws(() => f.service.execute('purchase.delete', { id: p }), /fechadas/);
  f.service.execute('invoice.pay', { id: i.id, paid_on: f.clock.today });
  let s = f.service.snapshot('2026-09'); assert.equal(s.summary.expenses, 3334); assert.equal(s.summary.balance, -3334); assert.equal(s.cards[0].available_cents, 93334); assert.equal(s.summary.invoices, 0);
  assert.throws(() => f.service.execute('invoice.pay', { id: i.id, paid_on: f.clock.today }));
  assert.throws(() => f.service.execute('transaction.delete', { id: s.transactions[0].id }), /faturas/);
  assert.throws(() => f.service.execute('invoice.reopen', { id: i.id }));
  f.service.execute('invoice.undo', { id: i.id }); s = f.service.snapshot('2026-09'); assert.equal(s.summary.balance, 0); assert.equal(s.cards[0].available_cents, 90000); assert.equal(s.invoices.find(item => item.id === i.id).status, 'closed');
});
test('mudança de dia fecha faturas e reabertura permanece válida no mesmo dia', t => {
  const f = fixture(t); const c = card(f); purchase(f, c); f.clock.today = '2026-09-21';
  const i = f.service.snapshot('2026-09').invoices.find(i => i.month === '2026-09'); assert.equal(i.status, 'closed');
  f.service.execute('invoice.reopen', { id: i.id }); assert.equal(f.service.snapshot('2026-09').invoices.find(x => x.id === i.id).status, 'open');
  f.clock.today = '2026-09-22'; assert.equal(f.service.snapshot('2026-09').invoices.find(x => x.id === i.id).status, 'closed');
});
test('falha em parcela de fatura fechada desfaz inclusive parcelas anteriores', t => {
  const f = fixture(t); const c = card(f); purchase(f, c);
  const october = f.service.snapshot('2026-09').invoices.find(i => i.month === '2026-10'); f.service.execute('invoice.close', { id: october.id });
  assert.throws(() => purchase(f, c), /fechada/);
  assert.equal(f.service.snapshot('2026-09').purchases.length, 1); assert.equal(f.service.snapshot('2026-09').installments.length, 3);
});
test('vincular parcela valida mês e bloqueia fatura fechada', t => {
  const f = fixture(t); const c = card(f); purchase(f, c);
  const s = f.service.snapshot('2026-09'); const i = s.installments[0];
  const r = f.service.execute('reserve.save', { name: 'Envelope', month: '2026-10', budget_cents: 10000 });
  assert.throws(() => f.service.execute('installment.reserve', { id: i.id, reserve_id: r }), /mesmo mês/);
  f.service.execute('installment.reserve', { id: s.installments[1].id, reserve_id: r });
  assert.equal(f.service.snapshot('2026-10').reserves[0].spent_cents, 3333);
  f.service.execute('invoice.close', { id: i.invoice_id }); assert.throws(() => f.service.execute('installment.reserve', { id: i.id, reserve_id: null }), /Reabra/);
});
test('agenda inclui hoje e sétimo dia; vencidos ficam separados', t => {
  const f = fixture(t);
  for (const due_on of ['2026-09-17', '2026-09-18', '2026-09-25', '2026-09-26']) transaction(f, { due_on });
  const s = f.service.snapshot('2026-09'); assert.equal(s.upcoming.length, 2); assert.equal(s.overdue.length, 1);
});
test('arquivamento preserva histórico e categorias usadas não mudam de natureza', t => {
  const f = fixture(t); transaction(f);
  assert.throws(() => f.service.execute('category.save', { id: f.expense, name: 'Alimentação', kind: 'income' }), /utilizadas/);
  f.service.execute('category.archive', { id: f.expense }); assert.throws(() => transaction(f), /ativa/);
  assert.equal(f.service.snapshot('2026-09').transactions.length, 1);
  const c = card(f); purchase(f, c, { category_id: f.service.snapshot('2026-09').categories.find(c => c.name === 'Transporte').id });
  assert.throws(() => f.service.execute('card.archive', { id: c }), /Quite/);
});
test('consultas parametrizadas preservam textos e não executam SQL do usuário', t => {
  const f = fixture(t); const value = "'); DROP TABLE transactions; -- <script>";
  transaction(f, { description: value }); assert.equal(f.service.snapshot('2026-09').transactions[0].description, value);
  assert.throws(() => f.service.execute('db.exec', { sql: 'DROP TABLE categories' }), /não permitida/);
});
test('banco persiste após reabrir e backup é íntegro e independente', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pleno-test-'));
  const filename = path.join(directory, 'financeiro.db'); const backup = path.join(directory, 'backup.db');
  let f; let copy;
  try {
    f = new Finance(filename, { today: () => '2026-09-18' });
    f.execute('reserve.save', { name: 'Reserva persistente', month: '2026-09', budget_cents: 5000 }); f.backup(backup); f.close(); f = null;
    f = new Finance(filename, { today: () => '2026-09-18' }); assert.equal(f.snapshot('2026-09').reserves[0].budget_cents, 5000);
    copy = new Finance(backup, { today: () => '2026-09-18' }); assert.equal(copy.snapshot('2026-09').reserves[0].name, 'Reserva persistente');
    assert.equal(copy.one('PRAGMA integrity_check').integrity_check, 'ok'); assert.deepEqual(copy.all('PRAGMA foreign_key_check'), []);
    assert.throws(() => f.backup(backup));
  } finally {
    f?.close(); copy?.close();
    // Diretório exclusivo do teste, criado acima; somente arquivos diretos são removidos.
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry)); fs.rmdirSync(directory);
  }
});
