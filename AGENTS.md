<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Enrollment codes: 7 unique alphanumerics (letter+digit) generated in the DB; local generation mirrors the format for offline sign-ups.
- Server backup spreadsheet uses SheetJS; ExcelJS only in browser exports (incompatible with the published runtime).
- Certificate notification eligibility lives in atestado.ts, reused by lists and filters so they cannot diverge.
- WhatsApp URL normalization lives in whatsapp.ts; reuse ConversarWhatsApp everywhere for consistent contact.
- School options/totals come from escolas.ts; additions persist as per-network configuracoes rows (escolas-personalizadas.ts) to avoid concurrent overwrites.
- Report intersections live in relatorio-cruzado.ts (same active enrollment, students counted once), reused by chart, lists, totals and CSV/PDF; GraficoAlunos only presents that result.
- DOCUMENTOS_PLANILHA drives enrollment/profile document lists so uploads, previews and exports match.
- Professor action keys/defaults in permissoes.ts stay aligned with public.pode and policies; guard every button and mutation.
- Student status transitions are validated in a DB trigger apart from other edits; deletion cascades, keeping permissions independent.
- Professor permissions change only via an admin server function after password confirmation (hashed, expiring, admin-bound); direct writes revoked.
- Runtime guard stays in src/lib/worker-runtime.ts (build/ is dropped on deploy); it guards the `_runtime.mjs` URL lacking `import.meta.url`.
- AI goes through authenticated ai.functions.ts with existing permissions and server-only streaming; enrollment/column proposals stay reviewed, never direct writes; the ficha reader uses the attached enrollment file.
- Report AI receives only server-computed aggregates (typed filters, unique-student stats from paginated reads); WhatsApp drafts exclude identifiers/medical data and are never auto-sent.
- Terminal provider denial is persisted and checked before AI calls; cleared only after an admin resumes.
- Student portal: accounts link separately to enrollments with auth.uid-scoped minimal reads; mutations and push validate the device server-side; reminders via pausable SQL cron calling /api/public/lembretes-aulas only for pushable rows, reserved once.
- Student devices: admin physical approval, hashed tokens, partitioned HttpOnly cookie plus aparelho-local.ts copy, per-IP/device rate limits; requests need an exact active student match. Approval QR (aparelho-qr.ts) carries only the public code.
- Profile camera/gallery share the validated photo mutation; notices query lives at the student route level and silently re-registers push.
- Notices are saved to the in-app center before any push; push failures never fail the send.
- Backup Drive names come only from backup-nomes.ts (`[CODIGO]_[TIPO].ext`) and restoration parses with it, matching by code; the backup spreadsheet has no links. Restoration recreates only missing students and restores files in small client-driven admin batches.
- Offline queue sends one action at a time by UTC timestamp + device sequence, stopping at the first failure; presencas.executado_em keeps stale offline actions from overwriting newer rows.
- Export links are signed in links-arquivos.server.ts with the configured validity clamped by configuracoes-chaves.ts, staff-only; screens use short-lived links.
- Images are optimized with imagem.ts at selection so previews, AI and uploads share the reduced file; PDFs unchanged.
