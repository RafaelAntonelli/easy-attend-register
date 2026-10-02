# Corrigir a falha do backup

## Objetivo
Fazer o backup voltar a concluir normalmente, preservando a planilha, os links e o envio das fotos e documentos.

## Alterações
- Substituir, apenas na geração executada pelo servidor, a biblioteca incompatível que causa o erro `superCtor.prototype` por uma geração de XLSX compatível com o ambiente publicado.
- Manter as mesmas colunas, ordem dos alunos, links clicáveis e nome do arquivo.
- Preservar as exportações manuais já usadas nas telas de Alunos e Relatórios.
- Melhorar o registro da etapa que falhar para futuras verificações.

## Validação
- Gerar uma planilha de teste com dados e links.
- Verificar a compilação automática e os registros de execução.
- Confirmar que o arquivo produzido abre como XLSX válido.
