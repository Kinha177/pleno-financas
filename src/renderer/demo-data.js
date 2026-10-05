// Cenário fixo para uma avaliação visual reproduzível. Todos os valores em centavos.
window.DEMO = {
  today: '2026-09-18',
  openingBalance: 284000,
  transactions: [
    { id: 1, description: 'Salário', category: 'Trabalho', date: '2026-09-05', amount: 650000, kind: 'income', icon: 'briefcase' },
    { id: 2, description: 'Projeto freelance', category: 'Trabalho', date: '2026-09-12', amount: 120000, kind: 'income', icon: 'briefcase' },
    { id: 3, description: 'Aluguel', category: 'Moradia', date: '2026-09-08', amount: 180000, kind: 'expense', icon: 'home' },
    { id: 4, description: 'Supermercado', category: 'Alimentação', date: '2026-09-17', amount: 28690, kind: 'expense', icon: 'basket' },
    { id: 5, description: 'Posto de combustível', category: 'Transporte', date: '2026-09-16', amount: 10500, kind: 'expense', icon: 'car', reserve: 'Gasolina' },
    { id: 6, description: 'Cinema com amigos', category: 'Lazer', date: '2026-09-15', amount: 6800, kind: 'expense', icon: 'play', reserve: 'Lazer' },
    { id: 7, description: 'Farmácia', category: 'Saúde', date: '2026-09-14', amount: 8200, kind: 'expense', icon: 'heart', reserve: 'Saúde' },
    { id: 8, description: 'Restaurante', category: 'Alimentação', date: '2026-09-18', amount: 8490, kind: 'expense', icon: 'utensils' }
  ],
  reserves: [
    { name: 'Gasolina', budget: 15000, icon: 'car', tone: 'green' },
    { name: 'Lazer', budget: 10000, icon: 'play', tone: 'purple' },
    { name: 'Alimentação', budget: 80000, icon: 'basket', tone: 'orange' },
    { name: 'Saúde', budget: 20000, icon: 'heart', tone: 'blue' }
  ],
  // A soma das parcelas de setembro coincide com os totais das duas faturas.
  installments: [
    { card: 'Nubank', month: '2026-09', amount: 32000, description: 'Notebook · 3/10' },
    { card: 'Nubank', month: '2026-09', amount: 18000, reserve: 'Alimentação', description: 'Mercado' },
    { card: 'Nubank', month: '2026-09', amount: 7500, description: 'Assinaturas' },
    { card: 'Inter', month: '2026-09', amount: 24000, description: 'Passagens · 2/4' },
    { card: 'Inter', month: '2026-09', amount: 14000, reserve: 'Alimentação', description: 'Mercado' },
    { card: 'Nubank', month: '2026-10', amount: 32000, description: 'Notebook · 4/10' },
    { card: 'Inter', month: '2026-10', amount: 24000, description: 'Passagens · 3/4' },
    { card: 'Inter', month: '2026-11', amount: 24000, description: 'Passagens · 4/4' },
    ...['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'].map(month => ({ card: 'Nubank', month, amount: 32000, description: 'Notebook' }))
  ],
  cards: [
    { name: 'Nubank', lastDigits: '4582', limit: 800000, due: '2026-09-22', status: 'Fechada' },
    { name: 'Inter', lastDigits: '9016', limit: 500000, due: '2026-09-25', status: 'Aberta' }
  ],
  bills: [
    { description: 'Internet', category: 'Conta fixa', due: '2026-09-20', amount: 11990, icon: 'wifi' },
    { description: 'Energia elétrica', category: 'Conta fixa', due: '2026-09-24', amount: 16480, icon: 'bolt' }
  ]
};
