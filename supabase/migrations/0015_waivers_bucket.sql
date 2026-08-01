-- Fase 2 — bucket privado para os PDFs de waiver assinados.
-- Privado: só o service_role (server) escreve/lê; famílias/staff acessam via URL
-- assinada gerada no servidor. Limite 5 MB, apenas application/pdf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waivers', 'waivers', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
