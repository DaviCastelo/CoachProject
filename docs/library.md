# Biblioteca

Arquivos da equipe técnica em `/coach/library`. O acesso é só de `owner`, `admin`, `coach` e `staff`: são fotos e vídeos de menores, e família e atleta não entram.

## Onde cada coisa fica

- **Postgres:** só nome, pasta, tipo e tamanho (`library_folders`, `library_files`).
- **Bucket `library` do Supabase Storage:** os arquivos. Privado, leitura e escrita só por URL assinada.
- **YouTube:** vídeos longos entram como link e não ocupam espaço.

O arquivo vai do navegador direto para o Storage, sem passar pela Vercel.

## Limites

| Limite | Valor padrão | Onde muda |
|---|---|---|
| Tamanho por arquivo | 50 MiB | `library.limits` e `file_size_limit` do bucket |
| Cota total | 900 MB | `library.limits` |

O plano Free do Supabase não aceita arquivo acima de 50 MB. A cota deixa folga no 1 GB do plano para assinaturas e anexos de avisos.

## Ao passar para um plano pago

Sem mudança de código. Aumente o limite global em **Storage > Settings** no painel do Supabase e rode, com os valores desejados:

```sql
update storage.buckets set file_size_limit = 2147483648 where id = 'library';

insert into org_settings (organization_id, key, value)
values ('<id da organização>', 'library.limits',
        '{"quota_bytes": 90000000000, "max_file_bytes": 2147483648}')
on conflict (organization_id, key) do update set value = excluded.value;
```

## Limpeza

Apagar marca a linha como `deleting`, tira o arquivo do bucket e só então remove a linha. O cron `/api/cron/library` roda uma vez por dia, refaz o que falhou e libera a cota de envios abandonados há mais de 24 horas.
