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
- Keep school options grouped by education network in src/lib/escolas.ts; the enrollment form consumes these lists and preserves unlisted legacy school values so existing records remain editable.
- Keep report school grouping in src/lib/escolas.ts and reuse its network filter so per-school counts match the selected network total.
- Derive export parameters from the selected chart parameters plus the selected school network so CSV and PDF include the same per-school counts shown on screen.
