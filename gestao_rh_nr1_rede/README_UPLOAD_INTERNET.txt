GESTÃO RH CONSULTORIA - VERSÃO ONLINE CORRIGIDA V2

Correções:
- Tela branca corrigida (função de rota e login incluídas).
- Logo embutida no HTML para carregar tanto localmente quanto online.
- Página inicial institucional de RH geral: recrutamento, seleção, treinamentos, clima, desempenho, organização de RH e NR-1 como uma solução.
- /admin pede senha do administrador.
- /f/codigo mostra apenas formulário do funcionário.
- /d/codigo mostra apenas dashboard da empresa.

No Render mantenha:
Root Directory: gestao_rh_nr1_rede
Build Command: npm install
Start Command: npm start
Variáveis: ADMIN_PASSWORD, NODE_VERSION=22, PUBLIC_BASE_URL=https://gestaorhconsultoria.com.br


OBSERVAÇÃO PARA TESTE LOCAL:
- Se abrir index.html direto pelo Chrome como arquivo, a página inicial aparece normalmente.
- O botão Entrar no sistema abre uma prévia do login, mas cadastro, perguntas e dashboard precisam do servidor Node.js.
- Para testar tudo no computador antes de subir, abra o terminal dentro desta pasta e rode:
  npm install
  npm start
- Depois acesse: http://localhost:3000
- Online no Render, use: https://gestaorhconsultoria.com.br/admin
