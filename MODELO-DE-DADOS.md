# Modelo do banco de dados — aprovado e implementado

O arquivo `schema.sql` define oito tabelas e três consultas reutilizáveis (views). O banco é o arquivo local `financeiro.db`, sem dependência de internet. O esquema e o visual foram aprovados; as regras abaixo estão implementadas em `src/main/finance.cjs`. Consulte o README para execução, detalhes operacionais e empacotamento.

## Tabelas e relacionamentos

| Tabela | Responsabilidade | Relacionamentos |
| --- | --- | --- |
| `categories` | Categorias de receitas e despesas; arquivamento preserva histórico | Uma categoria tem muitas transações, contas fixas e compras |
| `monthly_reserves` | Nome, mês e orçamento de cada envelope | Uma reserva recebe várias despesas diretas e parcelas |
| `recurring_bills` | Modelo de conta fixa, valor, categoria, dia e vigência | Uma conta fixa gera várias transações, uma por competência |
| `credit_cards` | Cartão, limite, dia de fechamento e vencimento | Um cartão tem várias compras e faturas |
| `invoices` | Fatura mensal com datas efetivas e registro do fechamento | Uma fatura reúne várias parcelas e tem no máximo um pagamento |
| `card_purchases` | Compra original, valor total, categoria, data e número de parcelas | Uma compra tem várias parcelas |
| `installments` | Valor de cada parcela, número, fatura e reserva opcional | Cada parcela pertence a uma compra e a uma fatura |
| `transactions` | Receitas, despesas diretas e pagamentos de fatura | Categoria, reserva e conta fixa conforme o tipo; pagamento referencia a fatura |

## Critérios propostos

- Moeda: real brasileiro; todos os valores são inteiros em centavos. R$ 150,00 é armazenado como `15000`.
- Saldo atual: receitas recebidas menos despesas pagas e pagamentos de faturas. Lançamentos pendentes não alteram o caixa. O saldo inicial poderá ser registrado como receita na categoria “Saldo inicial”.
- Gasto mensal: despesas diretas pela data de competência, mesmo pendentes, mais parcelas alocadas à fatura do mês. O pagamento da fatura não entra novamente nesse cálculo. Despesas canceladas são excluídas.
- Reservas: cada mês tem seus próprios envelopes; não há transferência automática de sobra. A reserva pode ficar negativa, permitindo mostrar estouro do orçamento. Parcelas consomem o envelope do mês da respectiva fatura. Sem orçamento definido para um mês futuro, a parcela fica sem reserva até a vinculação.
- Contas fixas: gerar lançamentos ao abrir o aplicativo e ao consultar um mês, recuperando meses passados não processados. A chave única por conta e mês impede duplicidade. Em meses curtos, dias 29–31 são ajustados para o último dia. Editar o modelo afeta novas gerações; lançamentos existentes são editados separadamente. Cancelar uma ocorrência preserva sua chave para evitar que seja recriada. A vigência usa a data de vencimento ajustada.
- Parcelamento: dividir em centavos e distribuir o resto entre as primeiras parcelas. Exemplo: R$ 100,00 em três vezes resulta em R$ 33,34 + R$ 33,33 + R$ 33,33. O valor integral compromete o limite imediatamente, inclusive parcelas de faturas futuras.
- Ciclo do cartão: compras na data de fechamento ou depois seguem para o próximo ciclo. A competência da fatura é o mês do vencimento. O vencimento é a primeira ocorrência do dia configurado após o fechamento, ajustado ao último dia do mês quando necessário. As datas efetivas são gravadas para preservar o histórico se a configuração mudar.
- Faturas: status calculado como `open` (aberta), `closed` (fechada) ou `paid` (paga). O aplicativo fecha faturas vencidas no ciclo ao iniciar, mesmo após um período offline. O pagamento integral cria uma única saída de caixa; a view passa a apresentar “paga” e libera o valor daquela fatura no limite. Parcelas futuras continuam comprometendo o limite.
- Próximos vencimentos: despesas pendentes não canceladas e faturas não pagas entre hoje e hoje + 7 dias, inclusive, usando a data local. Contas atrasadas podem aparecer em uma lista separada.
- Escopo inicial: um saldo consolidado, pagamentos integrais de fatura e contas fixas debitadas diretamente do caixa. Múltiplas contas bancárias, pagamento parcial, juros, estornos parciais e antecipação de parcelas não estão incluídos nesta proposta.

## Integridade no SQLite e na aplicação

O SQLite garante chaves estrangeiras, valores positivos, datas válidas, tipos permitidos, unicidade das competências e dos pagamentos. Exclusões com dependências são bloqueadas. Categoria e cartão usados podem ser arquivados.

As operações abaixo ocorrem em transações SQLite atômicas, na camada principal do Electron. O renderer não acessa o arquivo do banco diretamente.

1. Validar a natureza da categoria e a competência da reserva em despesas e parcelas.
2. Gerar exatamente o número de parcelas da compra, numeradas de 1 a N, cuja soma corresponda ao total, em faturas consecutivas do mesmo cartão.
3. Conferir o limite disponível antes de incluir ou aumentar uma compra; impedir que uma alteração de limite o reduza abaixo do valor comprometido.
4. Impedir inclusões, alterações e exclusões de parcelas em faturas fechadas ou pagas. Permitir reabrir uma fatura fechada sem pagamento, explicitamente, para correções.
5. Pagar somente uma fatura fechada, com total positivo, pelo valor integral calculado, gravando o pagamento e conferindo novamente o total na mesma transação.
6. Corrigir um pagamento por uma operação explícita de desfazer: excluir a saída vinculada, retornando a fatura ao estado fechado e comprometendo novamente o limite. Não permitir editar o pagamento como despesa comum.
7. Excluir compras elegíveis removendo suas parcelas antes da compra na mesma transação. Compras com parcelas fechadas ou pagas permanecem protegidas.

As regras que comparam várias tabelas ou a soma de várias linhas são garantidas pela aplicação e cobertas pelos testes; o SQL isolado não garante essas invariantes. As três views calculam faturas, limites e reservas a partir dos registros, evitando armazenar saldos redundantes.

## Entrega

As etapas de esquema, avaliação visual, integração SQLite e telas funcionais estão concluídas. O comando `npm run dist` valida o projeto e gera o instalador e o executável portátil Windows. A prévia no navegador permanece isolada e demonstrativa.
