# Roadmap

- [ ] Implementar login de aluno por matrícula e senha, liberação/recuperação pelo administrador e consulta isolada de crachá, turma e atestado; validar autenticação e isolamento com conta temporária.
- [ ] Revisar pedido de entrada sem senha por CPF/matrícula e nascimento — exige confirmação adicional segura antes de liberar dados pessoais.

- [x] Relatórios IA: perguntas complexas com média e mediana de idade, filtros cruzados e comparação de grupos; cálculos no sistema, idades ausentes contabilizadas e perguntas reais autenticadas validadas.

- [x] IA: ler foto da Ficha com revisão antes de preencher matrícula.
- [x] IA: assistente de relatórios com dados agregados e permissões existentes.
- [x] IA: preparar mensagens de WhatsApp revisáveis, sem diagnóstico e sem envio automático.
- [x] IA: sugerir mapeamento de colunas de planilhas com revisão e validações existentes.
- [x] Validar os quatro fluxos autenticados com chamadas reais da IA, revisão no formulário, resultado da análise da planilha e link WhatsApp sem salvar ou enviar; testar regras de permissão e agregados.

- [x] Bloquear ações de Alunos e Nova matrícula no Painel para professores por padrão; oito permissões separadas adicionadas, proteção alinhada, 14 testes e fluxo com professor/administrador validados; liberação individual persistida e restaurada.

- [x] Ajustar permissões de professores para alunos e quatro ações de turmas; proteger configuração com senha de administrador; 8 testes e fluxo com contas temporárias validados, incluindo alterações persistidas e bloqueios no servidor.

- [x] Matrícula: adicionar foto da Ficha e incluir seu link na planilha exportada; upload, leitura no perfil e link da exportação validados com cadastro temporário removido.

- [x] Relatórios / Alunos por parâmetro: destacar filtros e total, exibir rótulos completos, valores nas barras e percentuais; validar com dados de exemplo e testes dos filtros.

- [x] Relatórios / Alunos por parâmetro: filtrar Ativos e Inativos em conjunto com os demais filtros, listas e exportações; validar com testes.

- [x] Relatórios: escolher valores dos sete filtros e cruzar em um único gráfico, com listas e CSV/PDF correspondentes; validar.

- [x] Corrigir importação da proteção de inicialização: manter o arquivo em src/lib e atualizar configuração e teste.
- [x] Aplicar a proteção contra a falha de inicialização do app publicado; validar com três testes, código gerado e abertura da prévia.
- [ ] Confirmar a abertura no site público — depende de republicar a correção com autorização do usuário.

- [x] Relatórios: reconhecer escolas públicas e privadas como parâmetros nas exportações CSV e PDF; validar.

- [x] Relatórios: mostrar redes de ensino como botões e quantitativo por escola ao selecionar Pública ou Privada; validar.

- [x] Alunos: exibir botão de conversa no WhatsApp para cada aluno em todas as notificações; validar.

- [x] Alunos: adicionar botão de conversa no WhatsApp usando o celular cadastrado, sem afirmar existência de conta; validar.

- [x] Alunos: excluir inativados das notificações e do filtro de atestado vencendo; validar com teste.

- [x] Backup: corrigir falha ao gerar a planilha no servidor.
- [x] Presença: manter filtros ativos ao trocar de tela.
- [x] Alunos e relatórios: exibir e exportar o código de matrícula nas listas.
- [x] Alunos: gerar código de matrícula único, alfanumérico e com 7 caracteres e exibi-lo no perfil.
- [x] Alunos: exigir confirmação de entrega e data ao anexar o atestado médico.
- [x] Alunos: remover alunos inativados ou excluídos da notificação por faltas.
- [x] Alunos: permitir selecionar vários horários simultaneamente no filtro.
- [x] Presença: abrir o perfil do aluno ao clicar no nome na Lista manual.
- [x] Presença: remover horário duplicado nas opções de Turma da aula.
- [x] Presença: permitir múltipla escolha em Turma da aula.
- [x] Alunos: manter as listas de notificações escondidas por padrão.
- [x] Turmas: remover filtro por faixa etária.
- [x] Presença: adicionar filtro múltiplo por faixa etária.
- [x] Presença: adicionar rolagem em Registros do dia.
- [x] Presença: aumentar a lista manual e as fotos dos alunos.
- [x] Alunos: notificar alunos sem atestado médico.
- [x] Alunos: permitir ocultar/exibir cada lista de notificações separadamente.
- [x] Validar as alterações no preview.
- [x] Alunos: remover alunos inativados das notificações e do filtro de atestados vencidos; validar com teste.
- [x] Presença/Lista manual: segundo clique no mesmo botão desmarca e apaga o registro (online e offline).
- [x] Licença médica: vaga preservada, faltas justificadas, aviso na presença e lembrete de retorno.
