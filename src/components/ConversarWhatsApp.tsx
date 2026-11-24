import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkConversaWhatsApp } from "@/lib/whatsapp";

export function ConversarWhatsApp({ telefone, compacto = false }: { telefone: string | null | undefined; compacto?: boolean }) {
  const link = linkConversaWhatsApp(telefone);
  if (!link) {
    return (
      <Button type="button" variant={compacto ? "ghost" : "outline"} size={compacto ? "icon" : "sm"} disabled title="Informe um celular completo com DDD" aria-label="Conversar no WhatsApp">
        <MessageCircle aria-hidden="true" />
        {!compacto && "Conversar no WhatsApp"}
      </Button>
    );
  }
  return (
    <Button asChild variant={compacto ? "ghost" : "outline"} size={compacto ? "icon" : "sm"}>
      <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Conversar no WhatsApp" title="Conversar no WhatsApp">
        <MessageCircle aria-hidden="true" />
        {!compacto && "Conversar no WhatsApp"}
      </a>
    </Button>
  );
}