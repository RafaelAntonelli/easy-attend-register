# Roadmap

- [x] Fila offline em ordem exata (horário UTC + sequência), parando no primeiro erro; presença mais recente prevalece.
- [x] Links de fotos/documentos nas exportações temporários com validade configurável (padrão 24 h), só para a equipe.
- [x] Avisos garantidos na central da área do aluno mesmo sem notificação no celular.
- [x] Fotos e documentos reduzidos no aparelho antes do envio e da leitura por IA.
- [x] Backup: planilha sem links e arquivos nomeados CODIGO_TIPO.ext.
- [x] Restaurar pelo Drive: prévia lida com dados reais (792 alunos ligados pelo código).
- [ ] Renomear os arquivos já existentes no Drive para o padrão novo — acontece no próximo backup (manual ou automático); não executado agora para não mexer no Drive sem o usuário.

- [x] Criar guia ilustrado dos professores com dados fictícios e instruções alinhadas às permissões.
- [x] Adaptar guias de alunos e professores para WhatsApp: imagens numeradas, PDF e pacotes para download; revisar todas as páginas.

- [x] Login: QR Code de liberação exibido e conferido no celular; sem token ou dados pessoais no QR.
- [x] Equipe / Acessos dos alunos: QR lido por câmera simulada e liberação real validada com administrador, confirmação presencial e entrada de Testealuno; aparelho temporário revogado.
- [x] Perfil do aluno: botão Tirar foto abre captura nativa frontal; envio e leitura da foto no cadastro validados, foto temporária removida. Captura física no Android depende de teste no aparelho após publicar.

- [x] Renovar apresentação da área do aluno com perfil em destaque e abas Meu dia, Crachá e Avisos; visual e navegação conferidos com dados ilustrativos em desktop/celular, sem excesso de largura. Consulta real não revalidada: sessão disponível não possui aparelho autorizado.

- [x] Implementar consentimento de armazenamento e login salvo; restauração validada com Testealuno.
- [x] Adicionar geração de crachá e PDF; geração e download validados.
- [x] Mostrar aviso para comparecer à administração ao entrar como aluno inativo, sem dispensar a autorização do aparelho.
- [x] Adicionar perfil editável e foto sincronizados; salvar contato, enviar foto e ler de volta validados com Testealuno.
- [x] Adicionar tela Avisos para a equipe, individuais e gerais, e recebimento no portal.
- [ ] Validar envio de avisos pela equipe e entrega Firebase — precisa de sessão da equipe e permissão de notificações num aparelho real fora da prévia incorporada.
- [x] Ativar lembretes 30/15 minutos: agendamento a cada 5 min (4h–21h), dias abreviados corrigidos, licença médica excluída, entrega única no celular.
- [x] Lembretes pausados a pedido do usuário (economia de créditos) e botão Ativar/Desativar na aba Avisos do aluno.
- [ ] Reativar lembretes e confirmar chegada no Android — aguarda ordem do usuário, publicação e aluno com notificações ativadas.
- [x] Restaurar backup: usuário escolheu voltar o sistema inteiro (recurso do Lovable Cloud, feito pelo painel); orientação enviada.
- [x] Conectar Firebase Cloud Messaging com notificações web.

- [x] Validar consulta isolada de crachá, turma e atestado, autenticação e bloqueio com conta temporária; dados temporários removidos.
- [x] Implementar CPF/matrícula e nascimento sem senha, com aprovação presencial do aparelho, revogação e testes de isolamento.

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

- [x] Novo visual (5 imagens aprovadas): Alunos com cartões de situação e cores; login com topo azul e ondas; menu do celular com "Mais"; chamada com botões grandes e "Marcar todos"; modo escuro. Cópia do visual anterior em design-backup/2026-10-20.
- [ ] "Marcar todos como presentes" não foi executado com dados reais (evitar registros falsos de hoje) — conferir na próxima aula.

## Melhorias por tela (22/10)
- [x] Área do aluno: frequência do mês (presenças, faltas, justificadas) — consulta conferida no banco; tela não vista com aluno real (sem aparelho autorizado na prévia).
- [x] Área do aluno: aviso de atestado vencendo 30 dias antes.
- [x] Guia dos alunos: nova página 6 "Ative as notificações" (v2 com 7 imagens + PDF).
- [x] Equipe: tela "Meu perfil" (foto, telefone, senha) para professores e administradores.
- [ ] Meu perfil: troca de foto e de senha não testadas de verdade (evitar mexer na conta real) — conferir no primeiro uso.
- [x] Equipe: último acesso (destaque após 30 dias) e turmas de cada professor.
- [x] Avisos: ver quem já leu cada aviso.
- [x] Avisos: agendar aviso para outro dia e horário, com cancelamento (testado agendar e cancelar).
- [ ] Avisos agendados: confirmar notificação no celular no horário — depende do app publicado e de aluno com notificações ativadas.
- [x] Avisos: enviar para uma turma específica.
- [x] Presença: anotação da aula por turma e dia (salvar e apagar testados).
- [x] Login (aba Aluno): data de nascimento digitada dd/mm/aaaa com mensagens claras.
- [x] Alunos: histórico na ficha (quem alterou o quê e quando) — registro conferido no banco.

- [ ] Login: imagem Esporte 360 + SECULJE preenchendo a tela inteira (celular e computador), com transparência.
