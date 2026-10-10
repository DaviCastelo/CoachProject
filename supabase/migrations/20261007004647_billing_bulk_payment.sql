-- Fase 4 (P0) — baixa manual em lote.
--
-- Na semana que abre a inscrição de um camp chegam 60 a 80 pagamentos de
-- Venmo em poucos dias. Dar baixa um por um são horas de conferência, justo
-- quando o cliente está mais ocupado — é o trabalho manual que o projeto foi
-- contratado para eliminar, de outra roupa.
--
-- Uma chamada por fatura seriam 70 idas ao banco. Pior que a lentidão: sem
-- transação, uma falha no meio deixaria metade lançada e ninguém saberia
-- onde parou. Aqui é tudo ou nada.

create or replace function record_offline_payments_bulk(
  p_invoice_ids uuid[],
  p_method      payment_method,
  p_references  text[] default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_invoice   uuid;
  v_index     int := 0;
  v_count     int := 0;
  v_due       int;
  v_reference text;
begin
  if p_invoice_ids is null or array_length(p_invoice_ids, 1) is null then
    return 0;
  end if;

  -- Teto defensivo: a tela trabalha com dezenas. Um array gigante aqui ou é
  -- engano ou é abuso, e nos dois casos é melhor recusar do que escrever.
  if array_length(p_invoice_ids, 1) > 500 then
    raise exception 'lote grande demais: % faturas (máximo 500)', array_length(p_invoice_ids, 1);
  end if;

  foreach v_invoice in array p_invoice_ids loop
    v_index := v_index + 1;
    v_reference := case
      when p_references is null then null
      else p_references[v_index]
    end;

    -- Saldo em aberto no momento da baixa. O lote sempre lança o valor
    -- CHEIO que falta: pagamento parcial é caso a caso e não entra aqui.
    select balance_cents into v_due from invoice_balances where invoice_id = v_invoice;

    if v_due is null then
      raise exception 'fatura % não encontrada', v_invoice;
    end if;

    -- Já quitada entre a tela carregar e o botão ser clicado (outra pessoa
    -- deu baixa, ou o webhook chegou). Pular é o certo: lançar de novo
    -- criaria crédito que alguém teria que devolver na mão.
    if v_due <= 0 then
      continue;
    end if;

    -- Reusa a RPC unitária: a checagem de permissão por organização e o
    -- recálculo do status da fatura são os mesmos, já testados.
    perform record_offline_payment(v_invoice, p_method, v_due, v_reference, now());
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function record_offline_payments_bulk(uuid[], payment_method, text[])
  from public, anon;
grant execute on function record_offline_payments_bulk(uuid[], payment_method, text[])
  to authenticated, service_role;
