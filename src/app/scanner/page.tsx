"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createWorker } from 'tesseract.js';
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
      
      const imageData = canvas.toDataURL('image/png');

      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();

      // Regex para encontrar o código da carta (ex: OP01-120)
      const opCodeRegex = /[A-Z]{2}\d{2}-\d{3}/g;
      const matches = text.toUpperCase().match(opCodeRegex);

      if (matches && matches.length > 0) {
        const cardNumber = matches[0];
        setLastScannedNumber(cardNumber);
        
        const { data } = await supabase
          .from('cards')
          .select('id, name, image_url, price_history(price_avg)')
          .eq('card_number', cardNumber)
          .single();

        if (data) setFoundCard(data);
      } else {
        alert("Código não detectado. Tente focar melhor no código (ex: OP01-001).");
      }
    } catch (err) {
      console.error("Erro no Scanner:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-orange-500 transition-colors">
            <ArrowLeft className="mr-2 w-5 h-5" /> Sair
          </Link>
          <h1 className="flex items-center gap-2 bg-clip-text bg-gradient-to-r from-orange-500 to-amber-300 font-black text-transparent text-2xl">
            Scanner Yonko <Zap className="w-6 h-6 text-orange-500" />
          </h1>
        </header>

        <div className="gap-8 grid grid-cols-1 lg:grid-cols-12">
          <div className="relative lg:col-span-7 bg-slate-900 shadow-2xl p-2 border border-slate-800 rounded-3xl aspect-square lg:aspect-video overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="rounded-2xl w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 flex justify-center items-center p-12">
               <div className="flex justify-center items-center border-2 border-orange-500/50 border-dashed rounded-xl w-full h-full pointer-events-none">
                  <Target className={`w-12 h-12 ${isProcessing ? 'animate-ping text-orange-500' : 'text-orange-500/20'}`} />
               </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="bg-slate-900 shadow-xl p-6 border border-slate-800 rounded-3xl">
               <h2 className="mb-4 font-bold text-slate-500 text-xs uppercase tracking-widest">Resultado da Leitura</h2>
               
               {isProcessing ? (
                 <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                    <p className="text-slate-400 text-sm">Decifrando código...</p>
                 </div>
               ) : foundCard ? (
                 <div className="space-y-4 animate-in duration-300 fade-in zoom-in">
                    <div className="flex items-center gap-4">
                        <img src={foundCard.image_url} className="shadow-lg rounded-lg w-20 h-28 object-cover" alt="" />
                        <div>
                            <p className="font-mono font-bold text-orange-500">{lastScannedNumber}</p>
                            <h3 className="font-black text-white text-xl">{foundCard.name}</h3>
                            <p className="font-bold text-emerald-400">R$ {foundCard.price_history?.[0]?.price_avg?.toFixed(2) || "---"}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => router.push('/calculadora')}
                        className="flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg py-3 rounded-xl w-full font-bold text-white transition-all"
                    >
                        <CheckCircle className="w-5 h-5" />
                        Lançar na Calculadora
                    </button>
                 </div>
               ) : (
                 <div className="py-10 text-center">
                    <p className="text-slate-600 text-sm">Aponte para o código no canto inferior da carta e clique em Scan.</p>
                 </div>
               )}
            </div>

            {!isCameraActive ? (
                <button onClick={startCamera} className="bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-900/20 py-4 rounded-2xl w-full font-black text-lg transition-colors">
                  {isLoading ? 'INICIANDO...' : 'ABRIR CÂMERA'}
                </button>
            ) : (
                <button 
                  onClick={handleScanFrame} 
                  disabled={isProcessing}
                  className="flex justify-center items-center gap-2 bg-white disabled:opacity-50 shadow-xl py-4 rounded-2xl w-full font-black text-slate-950 text-lg active:scale-95 transition-all"
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