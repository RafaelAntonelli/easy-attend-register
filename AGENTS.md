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

- Os códigos de matrícula são gerados no banco como 7 caracteres alfanuméricos, com letra e número, e são únicos; a geração local replica o formato para cadastros offline.
- A planilha do backup no servidor usa SheetJS; ExcelJS permanece apenas nas exportações do navegador porque não é compatível com o ambiente publicado.
- Keep expired and soon-expiring certificate notification eligibility in src/lib/atestado.ts and reuse it for both notification lists and filters, so they cannot diverge.
- Keep WhatsApp contact URL normalization in src/lib/whatsapp.ts and reuse ConversarWhatsApp across student forms and profiles to avoid divergent contact behavior.
- Use escolas.ts for network-grouped school options and report totals; the focused searchable selector preserves stored and legacy names. Persist additions as individual network-scoped configuracoes rows via escolas-personalizadas.ts to avoid concurrent overwrites.
- Keep report intersections and chart grouping in src/lib/relatorio-cruzado.ts; evaluate class filters on the same active enrollment and count students once, reusing its result for the chart, detailed lists, school totals and CSV/PDF.
- Keep report chart presentation in GraficoAlunos, consuming the existing grouped result without refiltering; this preserves consistent totals and the SVG used by PDF export.
- Reuse DOCUMENTOS_PLANILHA for enrollment and profile document lists so uploads, previews and spreadsheet links support the same document fields.
- Keep professor action keys and defaults in src/lib/permissoes.ts aligned with public.pode and table policies; guard each button and mutation so the UI matches enforced access.
- Validate student status transitions separately from other edits in a database trigger, and delete students through their cascading relations; this keeps inactivation, reactivation and deletion permissions independent.
- Change professor permissions only through an authenticated admin server function after password confirmation; persist only a hashed, expiring confirmation bound to the admin, and revoke direct authenticated writes so the password gate cannot be bypassed.
- Keep the build-time runtime guard in `src/lib/worker-runtime.ts` (not `build/`, which deploys drop); it guards the `_runtime.mjs` module URL because dynamic Worker modules may lack `import.meta.url` and crash `createRequire`.
- Route AI assistance through authenticated `ai.functions.ts` with existing action permissions and request-local, server-only streaming Responses helpers; this prevents browser secrets and unauthorized AI calls.
- AI enrollment and column mapping must remain reviewed proposals passed through existing form/import validation, never direct writes; this preserves enrollment rules and human confirmation.
- The ficha reader consumes the enrollment document attachment state and resets when that attachment changes; this keeps the analyzed image identical to the file saved with enrollment.
- Give the report AI only server-computed aggregates; WhatsApp drafts exclude student identifiers and medical details and are never sent automatically.
- Complex AI reports translate questions to typed filters, reuse report intersections, then calculate unique-student age statistics locally from paginated authorized reads; only aggregate results reach the answering model so comparisons remain reproducible.
- Persist terminal provider denial in the application configuration and check it before AI calls; clear it only after provider access is restored and an administrator explicitly resumes use.
- Student accounts link separately to enrollments, exclude staff roles and use auth.uid-scoped minimal reads, never broad student-table policies. Keep overview, badge and notices in tabs on the student route without changing authorization.
- Portal mutations and push registration validate the device server-side; delivery rechecks device/account authorization to exclude revoked access. Class reminders: SQL cron (pausable) generates rows for students whose access opts in, calling /api/public/lembretes-aulas (DB-only secret) only when pushable rows exist; delivery reserves rows once.
- Student devices: admin-only physical approval, hashed tokens only, sessions after device+birth date+identifier checks. Token via partitioned HttpOnly cookie plus browser copy (aparelho-local.ts), since previews drop cookies. Rate-limit per IP, and per device when a token exists. Device requests require an exact active student match (else no code is issued) and feed the admin waiting list.
- Device approval QR uses the versioned aparelho-qr.ts parser with only the public device code; reading fills the existing form without bypassing admin authorization or physical confirmation.
- Profile camera and gallery share the validated photo mutation; native front-camera capture updates the enrollment photo through the existing storage path.
- Student notice alerts read the shared avisos query at the student route level and silently re-register push when permission is already granted; this keeps unread badges across tabs and device tokens fresh.
