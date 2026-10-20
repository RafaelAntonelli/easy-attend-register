import { useCallback, useEffect, useState } from "react";
import { assinarFila, descartarDaFila, estaOnline, listarFila, sincronizar, type OperacaoFila } from "@/lib/offline";

export function useOffline() {
  const [online, setOnline] = useState(() => estaOnline());
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [bloqueada, setBloqueada] = useState<OperacaoFila | null>(null);

  const atualizar = useCallback(async () => {
    const fila = await listarFila();
    setPendentes(fila.length);
    setBloqueada(fila[0]?.erro ? fila[0] : null);
  }, []);

  const descartar = useCallback(async (id: string) => {
    await descartarDaFila(id);
    await atualizar();
  }, [atualizar]);

  const sincronizarAgora = useCallback(async () => {
    setSincronizando(true);
    const r = await sincronizar();
    await atualizar();
    setSincronizando(false);
    return r;
  }, [atualizar]);

  useEffect(() => {
    void atualizar();
    const desassinar = assinarFila(() => void atualizar());
    const aoConectar = () => {
      setOnline(true);
      void sincronizarAgora();
    };
    const aoDesconectar = () => setOnline(false);
    window.addEventListener("online", aoConectar);
    window.addEventListener("offline", aoDesconectar);
    return () => {
      desassinar();
      window.removeEventListener("online", aoConectar);
      window.removeEventListener("offline", aoDesconectar);
    };
  }, [atualizar, sincronizarAgora]);

  return { online, pendentes, sincronizando, sincronizarAgora, atualizar, bloqueada, descartar };
}
