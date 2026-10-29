# Etapa 3 — Plano de homologação de cursos e avaliação

## Objetivo
Conferir sequência das unidades, conclusão dos cursos, avaliação geral, nota, feedback e persistência local do progresso.

## Correções aplicadas
- O total do progresso e o contador do cabeçalho agora são calculados a partir dos cursos públicos disponíveis, em vez de um total fixo de seis.
- A avaliação geral não calcula nota enquanto houver perguntas sem resposta; mostra quais questões faltam.
- O feedback de cada questão exibe a resposta correta e a explicação.
- O critério de aprovação permanece em 70%.
- A nota geral e a conclusão continuam armazenadas localmente no navegador. Não há sincronização entre dispositivos nem conta de usuário nesta versão.

## Casos de teste

| ID | Procedimento | Resultado esperado |
|---|---|---|
| CUR-01 | Abrir cada curso público pelo catálogo | Curso abre na Unidade 1, com indicador “Unidade 1 de N” |
| CUR-02 | Avançar pelas unidades até a última | Títulos e contador avançam em ordem, sem pular unidades |
| CUR-03 | Voltar uma unidade | Retorna à unidade anterior e atualiza o indicador |
| CUR-04 | Concluir a última unidade | Curso aparece como concluído no catálogo e no progresso |
| CUR-05 | Atualizar a página depois de concluir um curso | Conclusão permanece no mesmo navegador |
| CUR-06 | Abrir novamente um curso concluído | Curso pode ser revisado sem duplicar a conclusão |
| PRO-01 | Conferir total no cabeçalho, dashboard e lista | Todos exibem o mesmo total de cursos públicos |
| PRO-02 | Concluir um curso | Contagem e barra aumentam proporcionalmente ao total disponível |
| PRO-03 | Limpar dados do navegador ou usar outro navegador | Progresso local pode não estar presente; comportamento esperado sem backend |
| QUIZ-01 | Enviar avaliação sem responder nenhuma questão | Não calcula nota; informa que faltam respostas |
| QUIZ-02 | Deixar uma questão em branco | Não calcula nota e informa os números das questões pendentes |
| QUIZ-03 | Responder todas as questões corretamente | Nota 100%; aprovado; feedback e resposta correta aparecem |
| QUIZ-04 | Responder 70% corretamente (quando a quantidade de questões permitir) | Aprovado com média mínima de 70% |
| QUIZ-05 | Responder menos de 70% corretamente | Reprovado na tentativa; orienta revisar o conteúdo |
| QUIZ-06 | Atualizar a página após corrigir a avaliação | Última nota continua exibida no mesmo navegador |
| PED-01 | Comparar conteúdo, exemplos, perguntas e feedback | Respostas corretas coerentes com o conteúdo da unidade |
| PED-02 | Revisar cursos sobre receita, DNP, equipamentos e triagem | Conteúdo diferencia orientação educacional de diagnóstico, prescrição e decisão clínica |
| PED-03 | Revisar termos e unidades técnicas | Siglas, sinais, dioptrias, graus e milímetros usados consistentemente |

## Critério de aprovação da etapa
Marcar como homologada somente depois de executar os casos no navegador publicado e verificar a consistência do conteúdo dos dez cursos públicos. As correções no código não significam que todos os casos foram executados.

## Limitações conhecidas
- O progresso e a nota geral usam armazenamento local do navegador.
- Não existe conta de aluno ou sincronização de progresso entre dispositivos.
- A avaliação geral é uma avaliação introdutória separada dos cursos; a nota não deve ser interpretada como certificação individual de cada curso.
- A conclusão do curso é registrada ao acionar o botão da última unidade; a plataforma não comprova tempo de leitura nem domínio real do conteúdo.
