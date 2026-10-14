import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function FotoAmpliavel({ src, nome, className }: { src: string; nome: string; className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-zoom-in rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Ampliar foto de ${nome}`}
        >
          <img src={src} alt={`Foto de ${nome}`} loading="lazy" className={className} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogTitle>{nome}</DialogTitle>
        <img src={src} alt={`Foto de ${nome}`} className="max-h-[75vh] w-full rounded-lg object-contain" />
      </DialogContent>
    </Dialog>
  );
}
