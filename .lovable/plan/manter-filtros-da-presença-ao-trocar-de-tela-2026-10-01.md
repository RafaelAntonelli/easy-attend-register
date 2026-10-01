# Manter filtros da Presença ao trocar de tela

## Objetivo
Preservar os filtros escolhidos na tela de Presença quando o usuário navegar para outra área e restaurá-los ao retornar.

## Alterações
- Guardar no endereço da página a data, turno, modalidade, dias, faixas etárias e turmas selecionadas.
- Restaurar automaticamente essas escolhas ao voltar para Presença, inclusive pelos botões de navegação do navegador.
- Manter a busca da lista manual, o texto de observação e a câmera fora dessa persistência para não conservar dados temporários.
- Ignorar opções antigas ou indisponíveis sem impedir a abertura da tela.

## Validação
- Escolher filtros, trocar de tela e voltar para Presença.
- Confirmar que os filtros continuam selecionados e a lista permanece filtrada.
- Conferir o comportamento em tela grande e celular, sem erros.
