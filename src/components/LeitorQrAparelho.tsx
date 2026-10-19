import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lerQrAparelho } from "@/lib/aparelho-qr";

export function LeitorQrAparelho({ onLido }: { onLido: (codigo: string) => void }) {
  const id = `qr-aparelho-${useId().replace(/:/g, "")}`;
  const [estado, setEstado] = useState<"parado" | "iniciando" | "lendo">("parado");
  const [erro, setErro] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const montado = useRef(true);
  const recebido = useRef(false);

  async function parar() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } catch { /* already stopped */ }
    }
    if (montado.current) setEstado("parado");
  }

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; void parar(); };
  }, []);

  async function iniciar() {
    setErro(""); setEstado("iniciando"); recebido.current = false;
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!montado.current) return;
      const scanner = new Html5Qrcode(id, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h, 240) * 0.8, height: Math.min(w, h, 240) * 0.8 }) }, (texto) => {
        if (recebido.current || !montado.current) return;
        const codigo = lerQrAparelho(texto);
        if (!codigo) { setErro("Este QR Code não é uma solicitação de liberação de aparelho."); return; }
        recebido.current = true;
        onLido(codigo);
        void parar();
      }, () => {});
      if (!montado.current) { if (scanner.isScanning) await scanner.stop(); scanner.clear(); return; }
      if (!recebido.current) setEstado("lendo");
    } catch {
      await parar();
      if (montado.current) setErro("Não foi possível acessar a câmera. Permita o acesso nas configurações do navegador e tente novamente.");
    }
  }

  return <div className="space-y-3">
    <Button type="button" variant="outline" className="w-full" disabled={estado === "iniciando"} onClick={() => estado === "parado" ? void iniciar() : void parar()}>
      {estado === "parado" ? <Camera className="mr-2 size-4" /> : <CameraOff className="mr-2 size-4" />}
      {estado === "parado" ? "Ler QR Code com a câmera" : estado === "iniciando" ? "Abrindo câmera…" : "Parar câmera"}
    </Button>
    <div id={id} className={estado === "parado" ? "hidden" : "min-h-48 w-full overflow-hidden rounded-md border border-border"} />
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </div>;
}