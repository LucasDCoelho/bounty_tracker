"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { enqueueTradeCard } from '@/lib/flow-bridge';
import { ArrowLeft, Zap, Target, Loader2, Camera, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation'; // <-- Importação corrigida aqui

export default function CardScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedNumber, setLastScannedNumber] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [foundCard, setFoundCard] = useState<any>(null);

  const handleLaunchToCalculator = () => {
    if (!foundCard) return;

    enqueueTradeCard({
      id: foundCard.id,
      name: foundCard.name,
      card_number: lastScannedNumber,
      image_url: foundCard.image_url,
      price: foundCard.price_history?.[0]?.price_avg || 0,
      side: 'A',
      discount: 20,
    });

    router.push('/calculadora?source=scanner');
  };

  const startCamera = async () => {
    setIsLoading(true);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleScanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    setFoundCard(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // DICA DE PERFORMANCE: Use 'image/jpeg' e qualidade 0.8 para reduzir 
      // brutalmente o tamanho do payload enviado para sua API.
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Envia a imagem para nossa rota Next.js
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      const result = await response.json();

      if (response.ok && result.code) {
        const cardNumber = result.code;
        setLastScannedNumber(cardNumber);
        
        // Mantém a sua lógica de buscar no Supabase
        const { data } = await supabase
          .from('cards')
          .select('id, name, image_url, price_history(price_avg)')
          .eq('card_number', cardNumber)
          .single();

        if (data) {
            setFoundCard(data);
        } else {
            alert(`Código ${cardNumber} encontrado, mas não está no banco de dados.`);
        }
      } else {
        alert("Código não detectado. " + (result.error || "Tente novamente."));
      }
    } catch (err) {
      console.error("Erro no Scanner:", err);
      alert("Erro ao conectar com o servidor de escaneamento.");
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Sair
          </Link>
          <h1 className="flex items-center gap-2 bg-clip-text bg-linear-to-r from-primary to-secondary font-black text-transparent text-2xl">
            Scanner Yonko <Zap className="w-6 h-6 text-primary" />
          </h1>
        </header>

        <div className="gap-8 grid grid-cols-1 lg:grid-cols-12">
          <div className="relative lg:col-span-7 bg-surface shadow-2xl shadow-black/10 p-2 border border-border rounded-3xl aspect-square lg:aspect-video overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="rounded-2xl w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 flex justify-center items-center p-12">
               <div className="flex justify-center items-center border-2 border-primary/50 border-dashed rounded-xl w-full h-full pointer-events-none">
                  <Target className={`w-12 h-12 ${isProcessing ? 'animate-ping text-primary' : 'text-primary/25'}`} />
               </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="bg-surface shadow-black/10 shadow-xl p-6 border border-border rounded-3xl">
               <h2 className="mb-4 font-bold text-muted-foreground text-xs uppercase tracking-widest">Resultado da Leitura</h2>
               
               {isProcessing ? (
                 <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-muted-foreground text-sm">Decifrando código...</p>
                 </div>
               ) : foundCard ? (
                 <div className="space-y-4 animate-in duration-300 fade-in zoom-in">
                    <div className="flex items-center gap-4">
                        <img src={foundCard.image_url} className="shadow-lg rounded-lg w-20 h-28 object-cover" alt="" />
                        <div>
                            <p className="font-mono font-bold text-primary">{lastScannedNumber}</p>
                            <h3 className="font-black text-foreground text-xl">{foundCard.name}</h3>
                            <p className="font-bold text-success">R$ {foundCard.price_history?.[0]?.price_avg?.toFixed(2) || "---"}</p>
                        </div>
                    </div>
                    <button 
                      onClick={handleLaunchToCalculator}
                        className="flex justify-center items-center gap-2 bg-success hover:bg-success/90 shadow-lg py-3 rounded-xl w-full font-bold text-success-foreground transition-all"
                    >
                        <CheckCircle className="w-5 h-5" />
                        Lançar na Calculadora
                    </button>
                 </div>
               ) : (
                 <div className="py-10 text-center">
                    <p className="text-muted-foreground text-sm">Aponte para o código no canto inferior da carta e clique em Scan.</p>
                 </div>
               )}
            </div>

            {!isCameraActive ? (
                <button onClick={startCamera} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 py-4 rounded-2xl w-full font-black text-primary-foreground text-lg transition-colors">
                  {isLoading ? 'INICIANDO...' : 'ABRIR CÂMERA'}
                </button>
            ) : (
                <button 
                  onClick={handleScanFrame} 
                  disabled={isProcessing}
                  className="flex justify-center items-center gap-2 bg-foreground disabled:opacity-50 shadow-xl py-4 rounded-2xl w-full font-black text-background text-lg active:scale-95 transition-all"
                >
                  <Camera className="w-6 h-6" />
                  ESCANEAR AGORA
                </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}