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
- Keep expired-certificate notification eligibility in src/lib/atestado.ts and reuse it for both notification lists and filters, so they cannot diverge.
