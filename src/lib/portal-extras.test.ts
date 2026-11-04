import {describe,it,expect} from 'vitest';
import {perfilPortalSchema,avisoPortalSchema,erroAgendamento} from './portal-extras';
import {portalAlunoSchema} from './portal-aluno';
describe('perfil do próprio aluno',()=>{
 it('perfil traz o cadastro completo para leitura',()=>{const p=perfilPortalSchema.parse({nome:'Aluno',codigo:'AB12CD3',data_nascimento:'2010-05-02',telefone:null,telefone2:null,email:null,responsavel:'Mãe',rg:null,cpf:'12345678901',pcd:true,pcd_condicoes:null,pcd_descricao:null,sexo:'Feminino',faixa_etaria:'Adolescente',escola:'Escola X',rede_ensino:'Pública',ativo:true,cadastrado_em:'2026-01-10T12:00:00Z',atestado_entregue:true,atestado_data:'2026-02-01'});expect(p.escola).toBe('Escola X');expect(p.pcd_condicoes).toEqual([]);});
 it('preserva a situação inativa para exibir o aviso sem revogar o acesso',()=>{const result=portalAlunoSchema.parse({id:'00000000-0000-4000-8000-000000000001',nome:'Aluno',codigo:'AB12CD3',ativo:false,foto_path:null,atestado_entregue:false,atestado_data:null,turmas:[]});expect(result.ativo).toBe(false);});
});

const base={titulo:'Piscina fechada',mensagem:'Sem aula amanhã.',alunoId:null,turmaId:null,agendadoPara:null};
describe('envio de avisos',()=>{
 it('aviso para uma turma exige a turma escolhida',()=>{
  expect(avisoPortalSchema.safeParse({...base,destino:'turma'}).success).toBe(false);
  expect(avisoPortalSchema.safeParse({...base,destino:'turma',turmaId:'00000000-0000-4000-8000-000000000002'}).success).toBe(true);
 });
 it('aviso para um aluno exige o aluno escolhido',()=>{
  expect(avisoPortalSchema.safeParse({...base,destino:'aluno'}).success).toBe(false);
 });
 it('aviso para todos não precisa de aluno nem turma',()=>{
  expect(avisoPortalSchema.safeParse({...base,destino:'todos'}).success).toBe(true);
 });
 it('agendamento precisa ser pelo menos 5 minutos à frente e no máximo 60 dias',()=>{
  const agora=new Date('2026-10-22T20:00:00Z');
  expect(erroAgendamento('2026-10-22T20:03:00Z',agora)).not.toBeNull();
  expect(erroAgendamento('2026-10-22T20:05:00Z',agora)).toBeNull();
  expect(erroAgendamento('2026-12-22T20:00:00Z',agora)).not.toBeNull();
  expect(erroAgendamento(null,agora)).toBeNull();
 });
});
