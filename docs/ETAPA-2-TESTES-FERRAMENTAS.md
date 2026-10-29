# Etapa 2 — Plano de testes das ferramentas e cálculos

Data: 29/10/2026  
Escopo: calculadora de adição, transposição de receita e calculadora dimensional da armação. Os resultados são referências didáticas e devem ser conferidos por profissional habilitado; não substituem receita, medidas de montagem ou validação do laboratório.

## 1. Calculadora de adição para perto

Regra implementada: esfera para longe + ADD.

| ID | Entrada | Resultado esperado | Tipo |
|---|---|---|---|
| ADD-01 | Esfera -2,00 D; ADD +2,00 D | 0,00 D | Caso padrão |
| ADD-02 | Esfera -2,25 D; ADD +2,00 D | -0,25 D | Limite próximo de zero |
| ADD-03 | Esfera +1,50 D; ADD +2,50 D | +4,00 D | Valores positivos |
| ADD-04 | Campo de esfera vazio | Mensagem para preencher os campos | Entrada inválida |
| ADD-05 | ADD -0,25 D | Rejeitar e mostrar mensagem de valor inválido | Entrada inválida |
| ADD-06 | Esfera -2,10 D | Rejeitar: dioptria fora de incrementos de 0,25 D | Entrada inválida |
| ADD-07 | ADD 0,00 D | Aceitar; resultado igual à esfera informada | Limite inferior de ADD |

## 2. Transposição de receita

Regra: nova esfera = esfera + cilindro; novo cilindro = sinal oposto; novo eixo = eixo transposto em 90° (normalizado entre 1° e 180°). Se cilindro for zero, o eixo não se aplica.

| ID | Entrada | Resultado esperado | Tipo |
|---|---|---|---|
| TR-01 | ESF -2,00; CIL -1,00; eixo 90° | ESF -3,00; CIL +1,00; eixo 180° | Caso padrão |
| TR-02 | ESF +1,50; CIL +0,50; eixo 180° | ESF +2,00; CIL -0,50; eixo 90° | Cilindro positivo |
| TR-03 | ESF 0,00; CIL -0,25; eixo 1° | ESF -0,25; CIL +0,25; eixo 91° | Limite inferior do eixo |
| TR-04 | ESF -1,00; CIL 0,00; eixo 0° | ESF -1,00; CIL 0,00; eixo não aplicável | Cilindro zero |
| TR-05 | Cilindro diferente de zero; eixo 0° | Rejeitar e explicar eixo entre 1° e 180° | Entrada inválida |
| TR-06 | Eixo 181° | Rejeitar | Entrada inválida |
| TR-07 | Eixo 90,5° | Rejeitar: eixo deve ser inteiro | Entrada inválida |
| TR-08 | ESF -2,10 D ou CIL +0,10 D | Rejeitar: usar incrementos de 0,25 D | Entrada inválida |
| TR-09 | Um ou mais campos vazios | Solicitar preenchimento | Entrada inválida |

## 3. Calculadora dimensional da armação

Fórmula: distância entre centros geométricos da armação = A + DBL. Diferença estimada por lente = (A + DBL − DP binocular medida) / 2. Resultado positivo significa posição pupilar para dentro em relação ao centro geométrico; negativo, para fora. É uma estimativa geométrica, não uma recomendação automática de montagem.

| ID | Entrada | Resultado esperado | Tipo |
|---|---|---|---|
| AR-01 | A 52 mm; DBL 18 mm; DP 64 mm | Distância entre centros 70 mm; diferença 3 mm para dentro por lente | Caso padrão |
| AR-02 | A 52 mm; DBL 18 mm; DP 70 mm | Distância entre centros 70 mm; diferença 0 mm | Limite de alinhamento |
| AR-03 | A 52 mm; DBL 18 mm; DP 72 mm | Distância entre centros 70 mm; diferença 1 mm para fora por lente | Diferença negativa |
| AR-04 | A 1 mm; DBL 1 mm; DP 2 mm | Distância entre centros 2 mm; diferença 0 mm | Limite mínimo aceito |
| AR-05 | A, DBL ou DP vazio | Solicitar preenchimento | Entrada inválida |
| AR-06 | A, DBL ou DP igual a zero/negativo | Rejeitar | Entrada inválida |
| AR-07 | Medida 52,2 mm | Rejeitar: usar incrementos de 0,5 mm | Entrada inválida |

## 4. Verificações funcionais complementares

- [ ] Cada botão atualiza somente o resultado da ferramenta correspondente.
- [ ] Uma entrada inválida mostra mensagem clara e não exibe resultado enganoso.
- [ ] Após corrigir uma entrada inválida, o cálculo volta a funcionar sem recarregar a página.
- [ ] Resultados exibem unidades (D, mm e graus) quando aplicável.
- [ ] Conferir no navegador em desktop e celular.
- [ ] Confirmar a versão publicada após o deploy e testar com atualização forçada (Ctrl+F5).

## 5. Estado da homologação

Este documento define casos e resultados esperados. A alteração de validações e a correção da fórmula da armação foram registradas no GitHub, mas os testes interativos no navegador ainda precisam ser executados para marcar os casos como aprovados.
