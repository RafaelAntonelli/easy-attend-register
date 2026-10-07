import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkConversaWhatsApp } from "@/lib/whatsapp";

export function ConversarWhatsApp({ telefone }: { telefone: string | null | undefined }) {
  const link = linkConversaWhatsApp(telefone);
  if (!link) {
    return (
      <Button type="button" variant="outline" size="sm" disabled title="Informe um celular completo com DDD">
        <MessageCircle aria-hidden="true" />
        Conversar no WhatsApp
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <a href={link} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" />
        Conversar no WhatsApp
      </a>
    </Button>
  );
}