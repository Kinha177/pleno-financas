# Pleno · Controle financeiro pessoal

Aplicativo desktop Electron, HTML/CSS e SQLite para Windows x64. Funciona localmente, sem conta online, APIs ou CDN. O visual aprovado foi preservado e as telas agora gravam no banco real.

## Executar no desktop

No projeto já preparado, execute `npm start`. Em uma instalação de desenvolvimento nova, use Node.js 22.12 ou superior:

```powershell
npm ci
npx --no-install install-electron
npm start
```

A preparação inicial baixa os pacotes e o runtime oficial do Electron. Depois de instalado, o aplicativo funciona offline. O executável distribuído não exige Node.js na máquina de uso.

## Gerar o executável Windows

Na pasta do projeto, no Windows:

```powershell
npm run dist
```

O comando verifica a sintaxe, executa os testes e usa Electron Builder para criar:

- `dist/Pleno-Setup-1.0.0.exe`: instalador com escolha de diretório e atalho.
- `dist/Pleno-Portable-1.0.0.exe`: aplicativo sem instalação.

Nenhum arquivo é publicado. Os executáveis gerados localmente não possuem certificado de assinatura de código. O Windows poderá identificar o editor como desconhecido.

Para gerar apenas a pasta executável, execute `npm run pack`. O resultado fica em `dist/win-unpacked/Pleno.exe`; essa opção precisa ser distribuída com a pasta inteira.

## Primeiro uso

1. O banco começa sem transações, reservas ou cartões fictícios. Algumas categorias são criadas para facilitar o início.
2. Registre seu saldo inicial em **Nova transação → Receita → Saldo inicial**, preenchendo a data de recebimento. Para um saldo inicial negativo, use uma despesa de ajuste.
3. Em **Reservas**, defina o orçamento de cada envelope no mês selecionado.
4. Cadastre receitas e despesas em **Transações**. Uma data de pagamento vazia deixa o lançamento pendente; preenchê-la dá baixa no caixa. A reserva deve pertencer ao mês da competência.
5. Em **Contas fixas**, cadastre valor, dia de vencimento e vigência. As despesas são geradas ao abrir o aplicativo, consultar períodos ou atualizar a janela.
6. Em **Cartões de crédito**, cadastre limite e datas. Use **Compra** para registrar o total e o número de parcelas.
7. Confira **Faturas do mês**, feche a fatura e registre o pagamento integral. É possível desfazer um pagamento equivocado.

## Regras implementadas

- **Saldo atual:** receitas recebidas menos despesas pagas e pagamentos de faturas, de todos os meses. Pode ficar negativo.
- **Receitas do mês:** recebimentos pela data de baixa, no mês selecionado.
- **Gastos do mês:** despesas diretas pela competência, inclusive pendentes, mais parcelas das faturas daquele mês. Pagamento de fatura não é contado novamente como gasto.
- **Faturas em aberto:** faturas abertas ou fechadas não pagas do mês selecionado. O limite considera também as parcelas futuras.
- **Reservas:** orçamento mensal independente, sem transferência automática de sobras. O orçamento pode ser excedido. Na compra, um nome de reserva pode ser aplicado aos envelopes já existentes em cada mês; as outras parcelas ficam sem vínculo. Para vinculá-las depois, use Transações, no mês da parcela.
- **Recorrências:** chave única por conta/mês evita duplicação; dias 29–31 são ajustados ao último dia do mês. Cancelar uma ocorrência preserva sua chave e impede recriação. Restaurar torna a ocorrência pendente. Modelos com histórico são pausados ao excluir. Pausar não cancela despesas existentes; retomar recupera meses faltantes dentro da vigência. Editar o modelo afeta somente ocorrências ainda não geradas.
- **Ciclo do cartão:** compras no dia do fechamento entram no ciclo seguinte. A competência é o mês do vencimento. Datas de faturas existentes são preservadas; datas do cartão só podem mudar sem limite comprometido.
- **Parcelamento:** centavos restantes são distribuídos pelas primeiras parcelas. Todas as parcelas comprometem o limite; pagar uma fatura libera somente o total daquela fatura.
- **Faturas:** fecham automaticamente na data definida, inclusive após períodos sem abrir o app. Reabrir uma fatura vencida no ciclo permite correções até o próximo dia ou reinício. Fechamento manual permite pagamento antecipado, mas não anterior às compras.
- **Proteções:** compras com parcelas em faturas fechadas/pagas não podem ser editadas ou excluídas. Pagamentos só são alterados pela tela de faturas. Desfazer pagamento devolve o dinheiro ao caixa e compromete novamente o limite; uma correção pode deixá-lo negativo se o crédito já foi reutilizado.
- **Agenda:** hoje até hoje + 7 dias, inclusive, com atrasados separados. Saldo e agenda são globais; indicadores mensais seguem o seletor de mês.
- **Escopo:** real brasileiro, um caixa consolidado, até 360 parcelas por compra e datas entre 2000 e 2099. Sem juros, pagamento parcial, antecipação de parcelas, integração bancária ou múltiplas contas bancárias.

## Banco e cópias de segurança

O arquivo `financeiro.db` fica na pasta de dados do usuário do Electron, normalmente `%APPDATA%/Pleno/financeiro.db`. O botão **Banco local**, no topo, mostra o caminho exato e oferece **Salvar cópia de segurança**. A cópia usa `VACUUM INTO` para produzir um arquivo SQLite consistente mesmo com o app aberto. Escolha um nome novo: bancos existentes não são sobrescritos.

O executável portátil também usa a pasta de dados do usuário. “Portátil” significa sem instalador; o banco não fica ao lado do `.exe` nem é incluído na distribuição.

Para restaurar manualmente:

1. Anote o caminho em **Banco local** e feche completamente o Pleno.
2. Preserve o banco atual em outra pasta. Se ainda existirem arquivos `financeiro.db-wal` e `financeiro.db-shm`, preserve-os junto do original e retire-os da pasta ativa.
3. Copie o backup para o caminho indicado, com o nome `financeiro.db`.
4. Abra o Pleno e confira os registros.

## Prévia sem instalar dependências

```powershell
npm run preview
```

Abra http://127.0.0.1:4173 no navegador. Essa prévia antiga continua demonstrativa e não acessa o banco. Para as funcionalidades reais, use `npm start` ou o `.exe`. Encerre o servidor com Ctrl+C.

## Estrutura

```text
src/
  main/
    main.cjs                Janela, validação da origem IPC e backup
    preload.cjs             Ponte restrita para operações financeiras
    finance.cjs             SQLite, validações e gravações atômicas
  renderer/
    index.html              Estrutura e componentes do dashboard
    styles.css              Design, estados e responsividade
    app.js                  Navegação, formulários e dados reais
    icons.js                Ícones SVG locais
    demo-app.js             Prévia isolada, fora do executável
    demo-data.js            Dados fictícios, fora do executável
tests/                      Testes de domínio, persistência e formulários
build/                      Ícones do aplicativo
scripts/preview.cjs          Servidor de prévia local
schema.sql                  Esquema aprovado, versão 1
MODELO-DE-DADOS.md           Regras de negócio aprovadas
```

## Verificação

```powershell
npm run check
npm test
```

Os testes cobrem CRUD, categorias, reservas, datas, recorrências, cancelamentos, parcelamento, limite, fechamento/pagamento/desfazimento, rollback, persistência e backup. Testes de formulário usam DOM simulado com o serviço SQLite real; não substituem inspeção visual na janela nativa.

O banco usa [node:sqlite](https://nodejs.org/api/sqlite.html), incluído no runtime do Electron. Não há dependência nativa externa para recompilar. São utilizados chaves estrangeiras, transações `BEGIN IMMEDIATE`, WAL e migração por `user_version`.

O renderer executa sem Node.js, com isolamento de contexto, sandbox e política de conteúdo local, conforme a [documentação de segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security). A ponte valida a origem e permite apenas operações de domínio; não expõe SQL ou filesystem. Empacotamento conforme a [documentação Windows do Electron Builder](https://www.electron.build/v26/docs/win/).
