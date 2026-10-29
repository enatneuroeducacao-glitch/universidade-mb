# Guia de manutenção — Universidade MB

## Estrutura estática

- `index.html`: estrutura da página, cabeçalho, áreas de navegação e referências aos arquivos.
- `styles.css`: estilos visuais, layout responsivo, foco de teclado e preferências de movimento.
- `app.js`: catálogo, conteúdo e sequência das unidades, navegação, ferramentas, avaliações e progresso local.
- `admin.js`: funcionalidades administrativas existentes. Foi mantido separado.
- `favicon.svg`: ícone da página.

A publicação continua estática pelo GitHub Pages. Não é necessário servidor de aplicação nem banco de dados para servir a página pública. O progresso salvo no navegador fica local ao dispositivo/navegador e não sincroniza automaticamente entre dispositivos.

## Como atualizar o conteúdo de um curso

1. Abra `app.js` e localize `const courses = [`.
2. Localize o curso pelo campo `id` e revise `title`, `desc`, `time` e `units`.
3. Cada unidade é um par formado por título e conteúdo HTML. Preserve a ordem das unidades e mantenha o conteúdo educacional alinhado ao objetivo do curso.
4. Confira o teste correspondente em `const moduleQuestionBank`, usando exatamente o mesmo `id` do curso.
5. Cada questão deve ter: enunciado, opções, índice da resposta correta (começando em zero) e feedback explicativo. Verifique se o índice aponta para a opção correta e se há apenas uma resposta correta inequívoca.
6. Teste o curso desde a primeira unidade, navegue até o final, responda todas as questões, confira nota/feedback, reprovação, nova tentativa e aprovação.
7. Confirme se o próximo curso fica bloqueado antes da aprovação e liberado após aprovação. Verifique também o painel de progresso.
8. Faça commit no branch principal e aguarde a execução do GitHub Actions antes de validar o site publicado.

## Regra atual da avaliação

O código calcula a nota como percentual de respostas corretas e considera aprovado quem obtém pelo menos 70%. Como testes de cinco questões só produzem 0%, 20%, 40%, 60%, 80% ou 100%, na prática são necessários quatro acertos (80%). Para uma aplicação exata de 70%, use dez questões por curso ou uma quantidade que permita representar o limite desejado.

## Lista de verificação antes de publicar

- [ ] Todos os cursos têm conteúdo e teste com IDs correspondentes.
- [ ] A sequência das unidades faz sentido e não há conteúdo repetido ou fora do objetivo.
- [ ] Cada pergunta tem resposta correta e feedback útil.
- [ ] Teste incompleto mostra mensagem clara e não calcula aprovação.
- [ ] Reprovação permite revisão e nova tentativa.
- [ ] Aprovação conclui o curso e libera somente o próximo.
- [ ] Nota, progresso e último resultado ficam consistentes após atualizar a página.
- [ ] Navegação funciona por teclado e o foco é visível.
- [ ] A interface é conferida em celular, tablet e desktop.
- [ ] GitHub Actions concluiu com sucesso e a página publicada foi conferida.

## Limitações conhecidas

- A persistência de progresso depende do armazenamento local do navegador.
- Alterações feitas no repositório não significam publicação imediata; aguarde o fluxo de implantação.
- A revisão automática de HTML/CSS/JS não substitui testes visuais reais em diferentes navegadores e tamanhos de tela.
