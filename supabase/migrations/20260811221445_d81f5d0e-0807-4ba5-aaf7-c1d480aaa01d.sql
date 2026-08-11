INSERT INTO public.turmas (nome, modalidade, dias_semana, horario, capacidade, ativa)
SELECT d.rotulo || ' - ' || h.faixa, 'Natação', d.dias, h.faixa, 20, true
FROM (VALUES
  ('Terça e Quinta', ARRAY['Ter','Qui']),
  ('Quarta e Sexta', ARRAY['Qua','Sex'])
) AS d(rotulo, dias)
CROSS JOIN (VALUES
  ('08:00 - 08:50'),('09:00 - 09:50'),('10:00 - 10:50'),('11:00 - 11:50'),
  ('14:00 - 14:50'),('15:00 - 15:50'),('16:00 - 16:50'),('17:00 - 17:50'),
  ('18:00 - 18:50'),('19:00 - 19:50')
) AS h(faixa)
WHERE NOT EXISTS (
  SELECT 1 FROM public.turmas t WHERE t.nome = d.rotulo || ' - ' || h.faixa
);