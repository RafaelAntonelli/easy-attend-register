import {describe,it,expect} from 'vitest';
import {contatoPortalSchema} from './portal-extras';
import {portalAlunoSchema} from './portal-aluno';
describe('perfil do próprio aluno',()=>{
 it('permite contato mas rejeita alteração de nome pelo aluno',()=>{expect(contatoPortalSchema.safeParse({telefone:'71999999999',telefone2:'',email:'aluno@example.com'}).success).toBe(true);expect(contatoPortalSchema.safeParse({telefone:'',telefone2:'',email:'',nome:'Nome alterado'}).success).toBe(false);});
 it('não permite alterar nascimento nem documentos no contato',()=>{for(const campo of ['data_nascimento','cpf','rg'])expect(contatoPortalSchema.safeParse({telefone:'',telefone2:'',email:'',[campo]:'alterado'}).success).toBe(false);});
 it('preserva a situação inativa para exibir o aviso sem revogar o acesso',()=>{const result=portalAlunoSchema.parse({id:'00000000-0000-4000-8000-000000000001',nome:'Aluno',codigo:'AB12CD3',ativo:false,foto_path:null,atestado_entregue:false,atestado_data:null,turmas:[]});expect(result.ativo).toBe(false);});
});
