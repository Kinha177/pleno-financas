const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

class FinanceError extends Error {}
function requireThat(condition, message) { if (!condition) throw new FinanceError(message); }
function text(value, label = 'Nome') {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120, `${label}: informe de 1 a 120 caracteres.`);
  return value.trim();
}
function integer(value, min = 1, max = 999999999) {
  requireThat(Number.isSafeInteger(value) && value >= min && value <= max, `Informe um número inteiro entre ${min} e ${max}.`);
  return value;
}
function month(value) {
  requireThat(typeof value === 'string' && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value), 'Mês inválido (2000 a 2099).');
  return value;
}
function isoDate(value) {
  requireThat(typeof value === 'string' && /^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value), 'Data inválida (2000 a 2099).');
  const parsed = new Date(`${value}T12:00:00Z`);
  requireThat(!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, 'Data inválida.');
  return value;
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function addMonths(value, count) {
  const [year, m] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, m - 1 + count, 1));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}`;
}
function dayInMonth(value, day) {
  const [year, m] = value.split('-').map(Number);
  return `${value}-${String(Math.min(day, new Date(Date.UTC(year, m, 0)).getUTCDate())).padStart(2, '0')}`;
}
function plusDays(value, count) {
  const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

class Finance {
  constructor(filename, { today = localToday, schemaPath = path.join(__dirname, '../../schema.sql') } = {}) {
    this.filename = filename;
    this.today = today;
    this.lastMaintenance = null;
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    const version = this.one('PRAGMA user_version').user_version;
    requireThat(version <= 1, 'Este banco foi criado por uma versão mais recente do Pleno.');
    if (version === 0) {
      if (!this.one("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")) this.db.exec(fs.readFileSync(schemaPath, 'utf8'));
      this.atomic(() => {
        const categories = [['Salário', 'income'], ['Freelance', 'income'], ['Outras receitas', 'income'], ['Saldo inicial', 'income'], ['Alimentação', 'expense'], ['Transporte', 'expense'], ['Moradia', 'expense'], ['Lazer', 'expense'], ['Saúde', 'expense'], ['Educação', 'expense'], ['Outras despesas', 'expense']];
        for (const [name, kind] of categories) this.run('INSERT OR IGNORE INTO categories(name,kind) VALUES(?,?)', name, kind);
        this.db.exec('PRAGMA user_version=1');
      });
    }
  }
  one(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  atomic(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
  row(table, id) {
    // table é exclusivamente uma constante interna, nunca vem do renderer.
    const row = this.one(`SELECT * FROM ${table} WHERE id=?`, integer(id));
    requireThat(row, 'Registro não encontrado. Atualize a tela e tente novamente.'); return row;
  }
  category(id, kind) {
    const category = this.row('categories', id);
    requireThat(!category.archived_at && category.kind === kind, 'Escolha uma categoria ativa compatível com o tipo do lançamento.');
    return id;
  }
  reserve(id, period) {
    if (id == null) return null;
    requireThat(this.row('monthly_reserves', id).month === period, 'A reserva deve pertencer ao mesmo mês da despesa ou da fatura.');
    return id;
  }
  paidDate(value) {
    if (!value) return null;
    isoDate(value); requireThat(value <= this.today(), 'A data de pagamento não pode estar no futuro.'); return value;
  }
  maintain(period) {
    const today = this.today();
    this.atomic(() => {
      for (const bill of this.all('SELECT * FROM recurring_bills WHERE active=1')) {
        const through = period > today.slice(0, 7) ? period : today.slice(0, 7);
        const until = bill.ends_on ? (through < bill.ends_on.slice(0, 7) ? through : bill.ends_on.slice(0, 7)) : through;
        for (let m = bill.starts_on.slice(0, 7); m <= until; m = addMonths(m, 1)) {
          const due = dayInMonth(m, bill.due_day);
          if (due < bill.starts_on || (bill.ends_on && due > bill.ends_on)) continue;
          this.run(`INSERT OR IGNORE INTO transactions(kind,description,amount_cents,occurred_on,due_on,category_id,recurring_bill_id,recurrence_month)
            VALUES('expense',?,?,?,?,?,?,?)`, bill.description, bill.amount_cents, due, due, bill.category_id, bill.id, m);
        }
      }
      // Uma reabertura explícita dura até reiniciar o app ou mudar o dia.
      if (this.lastMaintenance !== today) this.run('UPDATE invoices SET closed_at=CURRENT_TIMESTAMP WHERE closed_at IS NULL AND closes_on<=?', today);
    });
    this.lastMaintenance = today;
  }
  snapshot(period) {
    month(period); this.maintain(period);
    const today = this.today();
    const sums = this.one(`SELECT
      COALESCE(SUM(CASE WHEN paid_on IS NOT NULL THEN CASE WHEN kind='income' THEN amount_cents ELSE -amount_cents END ELSE 0 END),0) AS balance,
      COALESCE(SUM(CASE WHEN kind='income' AND paid_on IS NOT NULL AND substr(paid_on,1,7)=? THEN amount_cents ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN kind='expense' AND substr(occurred_on,1,7)=? THEN amount_cents ELSE 0 END),0) AS expenses
      FROM transactions WHERE canceled_at IS NULL`, period, period);
    sums.expenses += this.one('SELECT COALESCE(SUM(p.amount_cents),0) AS total FROM installments p JOIN invoices i ON i.id=p.invoice_id WHERE i.month=?', period).total;
    const outstanding = this.one("SELECT COALESCE(SUM(total_cents),0) AS total,COUNT(*) AS count FROM invoice_summary WHERE month=? AND status<>'paid' AND total_cents>0", period);
    const agenda = this.all(`SELECT id,description,amount_cents,due_on,'transaction' AS source FROM transactions WHERE kind='expense' AND paid_on IS NULL AND canceled_at IS NULL
      UNION ALL SELECT i.id,'Fatura '||c.name,i.total_cents,i.due_on,'invoice' FROM invoice_summary i JOIN credit_cards c ON c.id=i.card_id WHERE i.status<>'paid' AND i.total_cents>0 ORDER BY due_on,id`);
    return {
      today, month: period, databasePath: this.filename,
      summary: { ...sums, invoices: outstanding.total, invoiceCount: outstanding.count },
      categories: this.all('SELECT * FROM categories ORDER BY archived_at IS NOT NULL,kind,name'),
      reserves: this.all('SELECT * FROM reserve_summary WHERE month=? ORDER BY name', period),
      allReserves: this.all('SELECT * FROM monthly_reserves ORDER BY month DESC,name'),
      transactions: this.all(`SELECT t.*,c.name AS category_name,r.name AS reserve_name FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN monthly_reserves r ON r.id=t.reserve_id WHERE substr(t.occurred_on,1,7)=? ORDER BY t.occurred_on DESC,t.id DESC`, period),
      bills: this.all('SELECT b.*,c.name AS category_name FROM recurring_bills b JOIN categories c ON c.id=b.category_id ORDER BY b.active DESC,b.description'),
      cards: this.all('SELECT * FROM card_limit_summary ORDER BY archived_at IS NOT NULL,name'),
      invoices: this.all('SELECT i.*,c.name AS card_name FROM invoice_summary i JOIN credit_cards c ON c.id=i.card_id WHERE total_cents>0 ORDER BY i.month DESC,c.name'),
      purchases: this.all(`SELECT p.*,c.name AS card_name,k.name AS category_name,
        NOT EXISTS(SELECT 1 FROM installments s JOIN invoice_summary i ON i.id=s.invoice_id WHERE s.purchase_id=p.id AND i.status<>'open') AS editable
        FROM card_purchases p JOIN credit_cards c ON c.id=p.card_id JOIN categories k ON k.id=p.category_id ORDER BY p.purchased_on DESC,p.id DESC`),
      installments: this.all(`SELECT s.*,i.month,i.status,p.description,p.installment_count,c.name AS card_name,k.name AS category_name,r.name AS reserve_name
        FROM installments s JOIN invoice_summary i ON i.id=s.invoice_id JOIN card_purchases p ON p.id=s.purchase_id JOIN credit_cards c ON c.id=p.card_id JOIN categories k ON k.id=p.category_id LEFT JOIN monthly_reserves r ON r.id=s.reserve_id ORDER BY i.month,s.installment_number`),
      upcoming: agenda.filter(item => item.due_on >= today && item.due_on <= plusDays(today, 7)),
      overdue: agenda.filter(item => item.due_on < today)
    };
  }
  execute(action, payload = {}) {
    requireThat(payload && typeof payload === 'object' && !Array.isArray(payload), 'Dados inválidos.');
    // Revalida fechamento e recorrências antes de qualquer gravação do dia.
    this.maintain(this.today().slice(0, 7));
    return this.atomic(() => {
      switch (action) {
        case 'transaction.get': return this.row('transactions', payload.id);
        case 'transaction.save': return this.saveTransaction(payload);
        case 'transaction.delete': return this.deleteTransaction(payload.id);
        case 'transaction.settle': {
          const t = this.row('transactions', payload.id);
          requireThat(t.kind !== 'invoice_payment' && !t.canceled_at, 'Use a tela de faturas para alterar um pagamento de cartão.');
          const paid = this.paidDate(payload.paid_on);
          this.run('UPDATE transactions SET paid_on=? WHERE id=?', paid, t.id); return t.id;
        }
        case 'transaction.restore': {
          const t = this.row('transactions', payload.id); requireThat(t.canceled_at && t.recurring_bill_id, 'Esta transação não está cancelada.');
          this.run('UPDATE transactions SET canceled_at=NULL WHERE id=?', t.id); return t.id;
        }
        case 'reserve.save': return this.saveReserve(payload);
        case 'reserve.delete': {
          const r = this.row('monthly_reserves', payload.id);
          requireThat(!this.one('SELECT id FROM transactions WHERE reserve_id=? UNION ALL SELECT id FROM installments WHERE reserve_id=? LIMIT 1', r.id, r.id), 'Desvincule os lançamentos antes de excluir a reserva.');
          this.run('DELETE FROM monthly_reserves WHERE id=?', r.id); return r.id;
        }
        case 'category.save': return this.saveCategory(payload);
        case 'category.archive': {
          const c = this.row('categories', payload.id);
          requireThat(!this.one('SELECT id FROM recurring_bills WHERE category_id=? AND active=1', c.id), 'Altere a categoria das contas fixas ativas antes de arquivar.');
          this.run('UPDATE categories SET archived_at=? WHERE id=?', payload.archived === false ? null : new Date().toISOString(), c.id); return c.id;
        }
        case 'bill.save': return this.saveBill(payload);
        case 'bill.toggle': { const b = this.row('recurring_bills', payload.id); this.category(b.category_id, 'expense'); this.run('UPDATE recurring_bills SET active=? WHERE id=?', b.active ? 0 : 1, b.id); return b.id; }
        case 'bill.delete': {
          const b = this.row('recurring_bills', payload.id);
          if (this.one('SELECT id FROM transactions WHERE recurring_bill_id=?', b.id)) this.run('UPDATE recurring_bills SET active=0 WHERE id=?', b.id);
          else this.run('DELETE FROM recurring_bills WHERE id=?', b.id);
          return b.id;
        }
        case 'card.save': return this.saveCard(payload);
        case 'card.archive': {
          const c = this.row('card_limit_summary', payload.id);
          requireThat(payload.archived === false || c.committed_cents === 0, 'Quite as faturas e parcelas futuras antes de arquivar o cartão.');
          this.run('UPDATE credit_cards SET archived_at=? WHERE id=?', payload.archived === false ? null : new Date().toISOString(), c.id); return c.id;
        }
        case 'purchase.save': return this.savePurchase(payload);
        case 'purchase.delete': {
          this.assertEditablePurchase(payload.id); this.run('DELETE FROM installments WHERE purchase_id=?', payload.id); this.run('DELETE FROM card_purchases WHERE id=?', payload.id); this.removeEmptyInvoices(); return payload.id;
        }
        case 'installment.reserve': {
          const installment = this.row('installments', payload.id); const invoice = this.row('invoice_summary', installment.invoice_id);
          requireThat(invoice.status === 'open', 'Reabra a fatura antes de alterar a reserva.');
          this.run('UPDATE installments SET reserve_id=? WHERE id=?', this.reserve(payload.reserve_id, invoice.month), installment.id); return installment.id;
        }
        case 'invoice.close': {
          const i = this.row('invoice_summary', payload.id); requireThat(i.status === 'open', 'A fatura já está fechada ou paga.');
          this.run('UPDATE invoices SET closed_at=CURRENT_TIMESTAMP WHERE id=?', i.id); return i.id;
        }
        case 'invoice.reopen': {
          const i = this.row('invoice_summary', payload.id); requireThat(i.status === 'closed', 'Somente faturas fechadas e não pagas podem ser reabertas.');
          this.run('UPDATE invoices SET closed_at=NULL WHERE id=?', i.id); return i.id;
        }
        case 'invoice.pay': return this.payInvoice(payload);
        case 'invoice.undo': {
          const i = this.row('invoice_summary', payload.id); requireThat(i.status === 'paid', 'A fatura não está paga.');
          this.run('DELETE FROM transactions WHERE invoice_id=?', i.id); return i.id;
        }
        default: throw new FinanceError('Operação não permitida.');
      }
    });
  }
  saveTransaction(p) {
    const old = p.id ? this.row('transactions', p.id) : null;
    requireThat(!old || (old.kind !== 'invoice_payment' && !old.canceled_at), 'Este lançamento não pode ser editado diretamente.');
    requireThat(['income', 'expense'].includes(p.kind), 'Tipo de transação inválido.');
    const occurred = isoDate(p.occurred_on); const due = isoDate(p.due_on); const paid = this.paidDate(p.paid_on);
    requireThat(!old?.recurring_bill_id || (p.kind === 'expense' && occurred.slice(0, 7) === old.recurrence_month), 'Uma ocorrência de conta fixa deve permanecer como despesa no mês original.');
    const category = this.category(p.category_id, p.kind);
    requireThat(p.kind === 'expense' || p.reserve_id == null, 'Receitas não podem consumir reservas.');
    const reserve = this.reserve(p.reserve_id, occurred.slice(0, 7));
    const args = [p.kind, text(p.description, 'Descrição'), integer(p.amount_cents), occurred, due, paid, category, reserve];
    if (old) { this.run('UPDATE transactions SET kind=?,description=?,amount_cents=?,occurred_on=?,due_on=?,paid_on=?,category_id=?,reserve_id=? WHERE id=?', ...args, old.id); return old.id; }
    return Number(this.run('INSERT INTO transactions(kind,description,amount_cents,occurred_on,due_on,paid_on,category_id,reserve_id) VALUES(?,?,?,?,?,?,?,?)', ...args).lastInsertRowid);
  }
  deleteTransaction(id) {
    const t = this.row('transactions', id);
    requireThat(t.kind !== 'invoice_payment', 'Desfaça o pagamento na tela de faturas.');
    if (t.recurring_bill_id) this.run('UPDATE transactions SET canceled_at=CURRENT_TIMESTAMP,paid_on=NULL WHERE id=?', id);
    else this.run('DELETE FROM transactions WHERE id=?', id);
    return id;
  }
  saveReserve(p) {
    const args = [text(p.name), month(p.month), integer(p.budget_cents, 0)];
    if (p.id) {
      const old = this.row('monthly_reserves', p.id);
      requireThat(old.month === p.month || !this.one('SELECT id FROM transactions WHERE reserve_id=? UNION ALL SELECT id FROM installments WHERE reserve_id=? LIMIT 1', p.id, p.id), 'Uma reserva com lançamentos não pode mudar de mês.');
      this.run('UPDATE monthly_reserves SET name=?,month=?,budget_cents=? WHERE id=?', ...args, p.id); return p.id;
    }
    return Number(this.run('INSERT INTO monthly_reserves(name,month,budget_cents) VALUES(?,?,?)', ...args).lastInsertRowid);
  }
  saveCategory(p) {
    requireThat(['income', 'expense'].includes(p.kind), 'Tipo de categoria inválido.'); const name = text(p.name);
    if (p.id) {
      const c = this.row('categories', p.id);
      const used = this.one('SELECT id FROM transactions WHERE category_id=? UNION ALL SELECT id FROM card_purchases WHERE category_id=? UNION ALL SELECT id FROM recurring_bills WHERE category_id=? LIMIT 1', p.id, p.id, p.id);
      requireThat(c.kind === p.kind || !used, 'Categorias utilizadas não podem mudar de tipo.');
      this.run('UPDATE categories SET name=?,kind=? WHERE id=?', name, p.kind, p.id); return p.id;
    }
    return Number(this.run('INSERT INTO categories(name,kind) VALUES(?,?)', name, p.kind).lastInsertRowid);
  }
  saveBill(p) {
    const start = isoDate(p.starts_on); const end = p.ends_on ? isoDate(p.ends_on) : null;
    requireThat(!end || end >= start, 'O fim da vigência deve ser posterior ao início.');
    const args = [text(p.description, 'Descrição'), this.category(p.category_id, 'expense'), integer(p.amount_cents), integer(p.due_day, 1, 31), start, end];
    if (p.id) { this.row('recurring_bills', p.id); this.run('UPDATE recurring_bills SET description=?,category_id=?,amount_cents=?,due_day=?,starts_on=?,ends_on=? WHERE id=?', ...args, p.id); return p.id; }
    return Number(this.run('INSERT INTO recurring_bills(description,category_id,amount_cents,due_day,starts_on,ends_on) VALUES(?,?,?,?,?,?)', ...args).lastInsertRowid);
  }
  saveCard(p) {
    const args = [text(p.name), integer(p.limit_cents, 0), integer(p.closing_day, 1, 31), integer(p.due_day, 1, 31)];
    if (p.id) {
      const card = this.row('card_limit_summary', p.id);
      requireThat(p.limit_cents >= card.committed_cents, 'O novo limite não pode ser menor que o valor comprometido.');
      requireThat((p.closing_day === card.closing_day && p.due_day === card.due_day) || card.committed_cents === 0, 'Quite as parcelas antes de mudar as datas do ciclo. As datas das faturas existentes são preservadas.');
      this.run('UPDATE credit_cards SET name=?,limit_cents=?,closing_day=?,due_day=? WHERE id=?', ...args, p.id); return p.id;
    }
    return Number(this.run('INSERT INTO credit_cards(name,limit_cents,closing_day,due_day) VALUES(?,?,?,?)', ...args).lastInsertRowid);
  }
  assertEditablePurchase(id) {
    this.row('card_purchases', id);
    requireThat(!this.one("SELECT s.id FROM installments s JOIN invoice_summary i ON i.id=s.invoice_id WHERE s.purchase_id=? AND i.status<>'open' LIMIT 1", id), 'A compra possui parcelas em faturas fechadas ou pagas. Reabra as faturas não pagas antes de corrigir.');
  }
  removeEmptyInvoices() { this.run('DELETE FROM invoices WHERE NOT EXISTS(SELECT 1 FROM installments WHERE invoice_id=invoices.id) AND NOT EXISTS(SELECT 1 FROM transactions WHERE invoice_id=invoices.id)'); }
  savePurchase(p) {
    const purchased = isoDate(p.purchased_on);
    requireThat(purchased <= this.today(), 'A data da compra não pode estar no futuro.');
    const total = integer(p.total_cents); const count = integer(p.installment_count, 1, Math.min(360, total));
    const category = this.category(p.category_id, 'expense'); const description = text(p.description, 'Descrição');
    const card = this.row('credit_cards', p.card_id); requireThat(!card.archived_at, 'Este cartão está arquivado.');
    if (p.id) { this.assertEditablePurchase(p.id); this.run('DELETE FROM installments WHERE purchase_id=?', p.id); }
    const limit = this.row('card_limit_summary', card.id);
    requireThat(total <= limit.available_cents, `Limite insuficiente. Disponível: ${(limit.available_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
    let closingMonth = purchased.slice(0, 7);
    if (purchased >= dayInMonth(closingMonth, card.closing_day)) closingMonth = addMonths(closingMonth, 1);
    const schedule = [];
    for (let index = 0; index < count; index++) {
      const closes = dayInMonth(addMonths(closingMonth, index), card.closing_day);
      let due = dayInMonth(closes.slice(0, 7), card.due_day);
      if (due <= closes) due = dayInMonth(addMonths(closes.slice(0, 7), 1), card.due_day);
      isoDate(closes); isoDate(due);
      const period = due.slice(0, 7);
      let invoice = this.one('SELECT * FROM invoice_summary WHERE card_id=? AND month=?', card.id, period);
      if (invoice) requireThat(invoice.status === 'open', 'Uma das faturas está fechada ou paga. Reabra a fatura antes de lançar a compra.');
      else {
        const id = Number(this.run('INSERT INTO invoices(card_id,month,closes_on,due_on) VALUES(?,?,?,?)', card.id, period, closes, due).lastInsertRowid);
        invoice = { id, closes_on: closes };
      }
      let reserveId = null;
      if (p.reserve_name) {
        const reserve = this.one('SELECT id FROM monthly_reserves WHERE name=? COLLATE NOCASE AND month=?', text(p.reserve_name), period);
        reserveId = reserve?.id ?? null;
      }
      schedule.push({ invoice, amount: Math.floor(total / count) + (index < total % count ? 1 : 0), reserveId });
    }
    let id = p.id;
    if (id) this.run('UPDATE card_purchases SET card_id=?,category_id=?,description=?,purchased_on=?,total_cents=?,installment_count=? WHERE id=?', card.id, category, description, purchased, total, count, id);
    else id = Number(this.run('INSERT INTO card_purchases(card_id,category_id,description,purchased_on,total_cents,installment_count) VALUES(?,?,?,?,?,?)', card.id, category, description, purchased, total, count).lastInsertRowid);
    schedule.forEach((item, index) => this.run('INSERT INTO installments(purchase_id,invoice_id,reserve_id,installment_number,amount_cents) VALUES(?,?,?,?,?)', id, item.invoice.id, item.reserveId, index + 1, item.amount));
    // Faturas históricas recém-criadas já nascem fechadas após receber as parcelas.
    for (const item of schedule) if (item.invoice.closes_on <= this.today() && !('status' in item.invoice)) this.run('UPDATE invoices SET closed_at=CURRENT_TIMESTAMP WHERE id=?', item.invoice.id);
    this.removeEmptyInvoices(); return id;
  }
  payInvoice(p) {
    const invoice = this.row('invoice_summary', p.id);
    requireThat(invoice.status === 'closed' && invoice.total_cents > 0, 'Feche a fatura antes de pagar. Faturas pagas ou vazias não podem ser pagas novamente.');
    const paid = this.paidDate(p.paid_on); requireThat(paid, 'Informe a data de pagamento.');
    const latestPurchase = this.one('SELECT MAX(p.purchased_on) AS date FROM installments s JOIN card_purchases p ON p.id=s.purchase_id WHERE s.invoice_id=?', invoice.id).date;
    requireThat(paid >= latestPurchase, 'O pagamento não pode ser anterior às compras desta fatura.');
    const card = this.row('credit_cards', invoice.card_id);
    this.run("INSERT INTO transactions(kind,description,amount_cents,occurred_on,due_on,paid_on,invoice_id) VALUES('invoice_payment',?,?,?,?,?,?)", `Fatura ${card.name} · ${invoice.month}`, invoice.total_cents, paid, invoice.due_on, paid, invoice.id);
    return invoice.id;
  }
  backup(destination) { this.db.prepare('VACUUM INTO ?').run(destination); }
}

module.exports = { Finance, FinanceError, localToday, addMonths, dayInMonth };
