import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
export function ConsentimentoAparelho(){const [open,setOpen]=useState(false);useEffect(()=>{try{setOpen(!localStorage.getItem('arena-consentimento'));}catch{setOpen(true);}},[]);
function escolher(valor:string){try{localStorage.setItem('arena-consentimento',valor);}catch{}setOpen(false);}
return <Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby="consentimento-descricao"><DialogHeader><DialogTitle>Armazenamento neste aparelho</DialogTitle></DialogHeader><p id="consentimento-descricao" className="text-sm text-muted-foreground">Podemos guardar sua preferência de login neste aparelho? A identificação do aparelho e a sessão são essenciais para o acesso seguro. Autorizar não substitui a liberação da equipe nem altera os bloqueios do navegador.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>escolher('essenciais')}>Somente essenciais</Button><Button onClick={()=>escolher('permitido')}>Permitir e continuar</Button></div></DialogContent></Dialog>;}
