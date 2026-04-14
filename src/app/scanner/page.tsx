"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { enqueueTradeCard } from '@/lib/flow-bridge';
import { trackEvent } from '@/lib/telemetry';
import { ArrowLeft, Zap, Target, Loader2, Camera, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation'; // <-- Importação corrigida aqui

type CardResult = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  price_history?: { price_avg?: number | null }[];
};

type ScanApiResult = {
  code?: string | null;
  codes?: string[];
  nameHints?: string[];
  variants?: string[];
  fullText?: string;
  error?: string;
};

const SIGNATURE_SIZE = 28;
const MIN_VISUAL_CONFIDENCE = 0.64;
const CARD_ASPECT_RATIO = 63 / 88;

function normalizeCodes(result: ScanApiResult) {
  const codes = Array.isArray(result.codes) ? result.codes : [];
  if (result.code) {
    codes.unshift(result.code);
  }

  return Array.from(
    new Set(
      codes
        .map((code) => String(code || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function getNameHints(result: ScanApiResult) {
  if (!Array.isArray(result.nameHints)) return [];
  return result.nameHints
    .map((hint) => String(hint || '').trim())
    .filter((hint) => hint.length >= 3)
    .slice(0, 3);
}

function getVariantHints(result: ScanApiResult) {
  if (!Array.isArray(result.variants)) return [];
  return result.variants
    .map((hint) => String(hint || '').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

function captureCardCrop(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Vídeo ainda não está pronto para captura.');
  }

  let cropWidth = sourceWidth;
  let cropHeight = Math.round(cropWidth / CARD_ASPECT_RATIO);

  if (cropHeight > sourceHeight) {
    cropHeight = sourceHeight;
    cropWidth = Math.round(cropHeight * CARD_ASPECT_RATIO);
  }

  const cropX = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
  const cropY = Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));

  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas indisponível para captura.');
  }

  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function scoreTextMatch(card: CardResult, hints: string[], variants: string[], codes: string[]) {
  const normalizedName = card.name.toUpperCase();
  const normalizedNumber = String(card.card_number || '').toUpperCase();

  let score = 0;

  for (const hint of hints) {
    const normalizedHint = hint.toUpperCase();
    if (!normalizedHint) continue;

    if (normalizedName === normalizedHint) {
      score += 6;
      continue;
    }

    if (normalizedName.includes(normalizedHint)) {
      score += 3;
    }

    if (normalizedHint.length >= 4) {
      const tokens = normalizedHint.split(/\s+/).filter(Boolean);
      const tokenHits = tokens.filter((token) => normalizedName.includes(token)).length;
      score += tokenHits * 0.75;
    }
  }

  for (const variant of variants) {
    if (normalizedName.includes(variant)) {
      score += 2.5;
    }
  }

  if (codes.some((code) => code === normalizedNumber)) {
    score += 4;
  }

  return score;
}

async function loadCandidatePool(codes: string[], hints: string[], variants: string[]) {
  const candidateMap = new Map<string, CardResult>();

  if (codes.length > 0) {
    const { data: codeCards } = await supabase
      .from('cards')
      .select('id, name, card_number, image_url, price_history(price_avg)')
      .in('card_number', codes)
      .limit(12);

    for (const card of (codeCards ?? []) as CardResult[]) {
      candidateMap.set(card.id, card);
    }
  }

  const searchTerms = Array.from(new Set([...hints, ...variants])).slice(0, 5);

  for (const term of searchTerms) {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) continue;

    const { data: nameCards } = await supabase
      .from('cards')
      .select('id, name, card_number, image_url, price_history(price_avg)')
      .ilike('name', `%${normalizedTerm}%`)
      .limit(8);

    for (const card of (nameCards ?? []) as CardResult[]) {
      candidateMap.set(card.id, card);
    }
  }

  return Array.from(candidateMap.values());
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem para comparação visual.'));
    img.src = src;
  });
}

async function buildSignature(src: string) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas indisponível para assinatura visual.');
  }

  canvas.width = SIGNATURE_SIZE;
  canvas.height = SIGNATURE_SIZE;
  context.drawImage(image, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);

  const { data } = context.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
  const signature = new Float32Array(SIGNATURE_SIZE * SIGNATURE_SIZE);

  for (let i = 0; i < signature.length; i += 1) {
    const base = i * 4;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    signature[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  return signature;
}

function similarityScore(a: Float32Array, b: Float32Array) {
  if (a.length !== b.length) return 0;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff += Math.abs(a[i] - b[i]);
  }

  const avgDiff = diff / a.length;
  return Math.max(0, 1 - avgDiff / 255);
}

async function findBestVisualMatch(capturedDataUrl: string, candidates: CardResult[]) {
  const capturedSignature = await buildSignature(capturedDataUrl);
  let best: { card: CardResult; score: number } | null = null;

  for (const candidate of candidates) {
    if (!candidate.image_url) continue;

    try {
      const cardSignature = await buildSignature(candidate.image_url);
      const score = similarityScore(capturedSignature, cardSignature);

      if (!best || score > best.score) {
        best = { card: candidate, score };
      }
    } catch {
      // Ignora candidato que não consegue carregar imagem/CORS.
    }
  }

  return best;
}

export default function CardScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedNumber, setLastScannedNumber] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [foundCard, setFoundCard] = useState<CardResult | null>(null);
  const [visualConfidence, setVisualConfidence] = useState<number | null>(null);

  const handleLaunchToCalculator = () => {
    if (!foundCard) return;

    trackEvent({
      eventName: 'scanner_launch_to_calculator',
      properties: {
        cardId: foundCard.id,
        cardName: foundCard.name,
        cardNumber: foundCard.card_number,
      },
    });

    enqueueTradeCard({
      id: foundCard.id,
      name: foundCard.name,
      card_number: foundCard.card_number || lastScannedNumber,
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
    trackEvent({
      eventName: 'scanner_view',
    });
  }, []);

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
      const imageData = captureCardCrop(video);

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      const result = await response.json();
      
      // 🕵️‍♂️ DEBUG IMPORTANTE: Abra o console do navegador e veja a mágica do Lens!
      console.log("Visão do Google:", result);

      if (!response.ok) {
        trackEvent({
          eventName: 'scanner_failure',
          properties: {
            reason: result.error || 'scan_api_error',
          },
        });
        alert("Erro na leitura. " + (result.error || "Tente novamente."));
        setIsProcessing(false);
        return;
      }

      const codes = normalizeCodes(result);
      const nameHints = getNameHints(result);
      const variants = getVariantHints(result);

      const candidatePool = await loadCandidatePool(codes, nameHints, variants);
      const visualMatch = candidatePool.length > 0
        ? await findBestVisualMatch(imageData, candidatePool)
        : null;

      const textFallback = candidatePool
        .slice()
        .sort((a, b) => scoreTextMatch(b, nameHints, variants, codes) - scoreTextMatch(a, nameHints, variants, codes))[0] || null;

      let matchedCard: CardResult | null = null;
      let matchedBy: 'visual' | 'code' | 'text' | null = null;

      if (visualMatch && visualMatch.score >= MIN_VISUAL_CONFIDENCE) {
        matchedCard = visualMatch.card;
        matchedBy = 'visual';
        setVisualConfidence(visualMatch.score);
      } else {
        const exactCode = codes[0] || null;
        if (exactCode) {
          const exactMatch = candidatePool.find((card) => String(card.card_number || '').toUpperCase() === exactCode);
          if (exactMatch) {
            matchedCard = exactMatch;
            matchedBy = 'code';
          }
        }

        if (!matchedCard && textFallback) {
          matchedCard = textFallback;
          matchedBy = 'text';
        }

        if (visualMatch) {
          setVisualConfidence(visualMatch.score);
        }
      }

      if (matchedCard) {
        setFoundCard(matchedCard);
        setLastScannedNumber(result.code || matchedCard.card_number);

        trackEvent({
          eventName: 'scanner_success',
          properties: {
            cardId: matchedCard.id,
            cardName: matchedCard.name,
            cardNumber: matchedCard.card_number,
            matchedBy,
            visualConfidence: visualMatch?.score ?? null,
            candidateCount: candidatePool.length,
          },
        });
      } else {
        setVisualConfidence(visualMatch?.score ?? null);
        trackEvent({
          eventName: 'scanner_no_match',
          properties: {
            scannedNumber: lastScannedNumber || null,
            candidateCount: candidatePool.length,
          },
        });
      }
    } catch (err) {
      console.error("Erro no Scanner:", err);
      trackEvent({
        eventName: 'scanner_failure',
        properties: {
          reason: 'client_exception',
        },
      });
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
                            {visualConfidence !== null && (
                              <p className="text-muted-foreground text-xs">
                                Similaridade visual: {(visualConfidence * 100).toFixed(1)}%
                              </p>
                            )}
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