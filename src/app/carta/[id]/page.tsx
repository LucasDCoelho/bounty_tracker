"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { enqueueTradeCard, savePendingDeckCard } from '@/lib/flow-bridge';
import { trackEvent } from '@/lib/telemetry';
import { HolographicCard } from '@/components/holographic-card';
import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { ArrowLeft, AlertCircle, CheckCircle2, PlusCircle, ArrowRightLeft, Layers } from 'lucide-react';


const chartTheme = {
    up: 'var(--success)',
    down: 'var(--danger)',
    grid: 'var(--border)',
    axis: 'var(--muted-foreground)',
    tooltipBackground: 'var(--surface)',
    tooltipBorder: 'var(--border)',
    tooltipLabel: 'var(--muted-foreground)',
    tooltipText: 'var(--foreground)',
};


// Componente Interno para desenhar a "Vela" (SVG Customizado)
const CandlestickShape = (props: any) => {
    const { x, y, width, height, low, high, open, close } = props;
    const isUp = close >= open;
    const color = isUp ? chartTheme.up : chartTheme.down;

    // Cálculo das posições do pavio (wick)
    const ratio = height / Math.abs(open - close || 0.01);
    const wickTop = y - (high - Math.max(open, close)) * ratio;
    const wickBottom = y + height + (Math.min(open, close) - low) * ratio;

    return (
        <g>
            {/* Pavio (Wick) - A linha fina que mostra Min e Max */}
            <line
                x1={x + width / 2}
                y1={wickTop}
                x2={x + width / 2}
                y2={wickBottom}
                stroke={color}
                strokeWidth={2}
            />
            {/* Corpo da Vela - Mostra a abertura e o fechamento */}
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
            />
        </g>
    );
};

type CardDetail = {
    id: string;
    name: string;
    card_number: string;
    image_url: string;
    rarity: string;
    game_attributes: any;
    set: { name: string; code: string };
    price_history: {
        price_min: number;
        price_avg: number;
        price_max: number;
        created_at: string
    }[];
};

export default function CardDetails() {
    const params = useParams();
    const router = useRouter();
    const cardId = params.id as string;

    const [card, setCard] = useState<CardDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false);

    useEffect(() => {
        async function fetchCard() {
            const { data, error } = await supabase
                .from('cards')
                .select(`*, set:sets(name, code), price_history(*)`)
                .eq('id', cardId)
                .single();

            if (!error && data) {
                // Ordena do mais antigo para o mais novo
                data.price_history.sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                setCard(data);
                trackEvent({
                    eventName: 'card_view',
                    properties: {
                        cardId,
                        cardName: data.name,
                        rarity: data.rarity,
                    },
                });
            }
            setIsLoading(false);
        }
        if (cardId) fetchCard();
    }, [cardId]);


    // Dentro do componente CardDetails
    const [targetPrice, setTargetPrice] = useState("");

    const createAlert = async () => {
        if (!card) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

        const currentPrice = card.price_history[card.price_history.length - 1]?.price_avg || 0;
        const parsedTarget = Number(targetPrice);
        if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
            alert('Informe um preço-alvo válido maior que zero.');
            return;
        }

        const { error } = await supabase.from('user_alerts').insert([
            {
                user_id: user.id,
                card_id: cardId,
                target_price: parsedTarget,
                current_price_at_creation: currentPrice,
                telegram_chat_id: user.user_metadata?.telegram_chat_id || null,
            }
        ]);

        if (!error) {
            trackEvent({
                eventName: 'alert_created',
                properties: {
                    cardId,
                    cardName: card.name,
                    targetPrice: parsedTarget,
                },
            });
            alert("Bounty definido! Te avisaremos no Telegram.");
        }
    };

    const sendToCalculator = () => {
        if (!card) return;

        trackEvent({
            eventName: 'send_to_calculator',
            properties: {
                cardId: card.id,
                cardName: card.name,
                source: 'card_detail',
            },
        });

        enqueueTradeCard({
            id: card.id,
            name: card.name,
            card_number: card.card_number,
            image_url: card.image_url,
            price: precoAtual,
            discount: 20,
            side: 'A',
        });

        router.push('/calculadora?source=carta');
    };

    const sendToDeckbuilder = () => {
        if (!card) return;

        trackEvent({
            eventName: 'send_to_deckbuilder',
            properties: {
                cardId: card.id,
                cardName: card.name,
                source: 'card_detail',
            },
        });

        savePendingDeckCard({
            id: card.id,
            name: card.name,
            card_number: card.card_number,
            image_url: card.image_url,
            rarity: card.rarity,
            price: precoAtual,
        });

        router.push('/deckbuilder?source=carta');
    };

    // FUNÇÃO NOVA: Adiciona à Carteira
    const addToCollection = async () => {
        if (!card) return;

        setIsAdding(true);

        // 1. Pega a sessão atual
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push('/login');
            return;
        }

        // 2. Tenta salvar passando o ID do usuário explicitamente
        // Isso evita que a política de RLS falhe por falta de contexto
        const { error } = await supabase
            .from('user_collections')
            .insert([
                {
                    card_id: cardId,
                    quantity: 1,
                    user_id: session.user.id // <-- Forçamos o ID do usuário logado
                }
            ]);

        if (!error) {
            trackEvent({
                eventName: 'collection_add',
                properties: {
                    cardId,
                    cardName: card.name,
                },
            });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            console.error("Erro completo do Supabase:", error);
            alert("Erro ao salvar: " + error.message);
        }
        setIsAdding(false);
    };

    if (isLoading) return <div className="flex justify-center items-center bg-background min-h-screen"><div className="border-primary border-t-2 rounded-full w-12 h-12 animate-spin"></div></div>;
    if (!card) return <div className="flex flex-col justify-center items-center bg-background min-h-screen text-foreground"><AlertCircle className="mb-4 w-16 h-16 text-danger" /><h1 className="font-bold text-2xl">Carta não encontrada</h1></div>;

    const precoAtual = card.price_history[card.price_history.length - 1]?.price_avg || 0;
    const parsedTargetPrice = Number(targetPrice);
    const hasTargetInput = targetPrice.trim().length > 0;
    const isTargetPriceValid = Number.isFinite(parsedTargetPrice) && parsedTargetPrice > 0;
    const targetPriceError = hasTargetInput && !isTargetPriceValid
        ? 'Informe um preço-alvo válido maior que zero.'
        : '';

    // Agrupa por dia para evitar múltiplas velas no mesmo rótulo de data.
    const groupedHistory = card.price_history.reduce((acc, ph: any) => {
        const date = new Date(ph.created_at);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (!acc[dayKey]) {
            acc[dayKey] = [];
        }

        acc[dayKey].push(ph);
        return acc;
    }, {} as Record<string, CardDetail['price_history']>);

    // Cada vela representa 1 dia: open = primeiro preço do dia, close = último,
    // high/low = extremos do dia.
    const chartData = Object.entries(groupedHistory)
        .sort(([dayA], [dayB]) => new Date(dayA).getTime() - new Date(dayB).getTime())
        .map(([dayKey, items]) => {
            const sortedItems = [...items].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const first = sortedItems[0];
            const last = sortedItems[sortedItems.length - 1];

            const open = first?.price_avg ?? 0;
            const close = last?.price_avg ?? open;
            const high = Math.max(...sortedItems.map((item) => item.price_max));
            const low = Math.min(...sortedItems.map((item) => item.price_min));

            return {
                date: new Date(dayKey).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                open,
                close,
                low,
                high,
                displayPrice: [open, close]
            };
        });

    return (
        <main className="bg-background p-4 md:p-8 min-h-screen text-foreground">
            <div className="mx-auto max-w-6xl">
                <Link href="/" className="inline-flex items-center mb-8 text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
                </Link>

                <div className="gap-8 grid grid-cols-1 md:grid-cols-3">
                    {/* Coluna Imagem */}
                    <div className="md:col-span-1">
                        <button
                            type="button"
                            onClick={() => setIsCardPreviewOpen(true)}
                            aria-label="Abrir visualização ampliada da carta"
                            className="block w-full text-left cursor-zoom-in"
                        >
                            <HolographicCard
                                src={card.image_url}
                                alt={card.name}
                                className="shadow-2xl border border-border rounded-2xl w-full"
                            />
                        </button>
                    </div>

                    {/* Coluna Dados */}
                    <div className="space-y-6 md:col-span-2">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-muted px-3 py-1 border border-border rounded-full font-mono text-muted-foreground text-xs">{card.card_number}</span>
                                <span className="bg-primary/10 px-3 py-1 border border-primary/20 rounded-full font-bold text-primary text-xs">{card.rarity}</span>
                            </div>
                            <h1 className="font-black text-foreground text-4xl">{card.name}</h1>
                            <p className="text-muted-foreground">{card.set?.name}</p>

                            <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                    onClick={sendToCalculator}
                                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 px-3 py-2 rounded-lg font-bold text-primary-foreground text-xs transition-all"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Levar para Calculadora
                                </button>
                                <button
                                    onClick={sendToDeckbuilder}
                                    className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/90 px-3 py-2 rounded-lg font-bold text-secondary-foreground text-xs transition-all"
                                >
                                    <Layers className="w-4 h-4" />
                                    Levar para Deckbuilder
                                </button>
                            </div>
                        </div>

                        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                            <div className="bg-surface p-6 border border-border rounded-2xl">
                                <p className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">Preço Médio (Base Liga)</p>
                                <p className="font-black text-success text-3xl">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoAtual)}
                                </p>
                                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                                    Valor de referência calculado com base na liga.
                                </p>
                                <div className="bg-background mt-4 p-4 border border-border rounded-xl">
                                    <label className="block mb-2 font-bold text-[10px] text-muted-foreground uppercase">Definir Bounty (Preço Alvo)</label>
                                    <div className="flex sm:flex-row flex-col gap-2">
                                        <input
                                            type="number"
                                            placeholder="R$ 0,00"
                                            value={targetPrice}
                                            onChange={(e) => setTargetPrice(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                            className="flex-1 bg-background px-3 py-2 border border-border focus:border-primary rounded-lg outline-none w-full text-foreground text-sm"
                                        />
                                        <button
                                            onClick={createAlert}
                                            disabled={!isTargetPriceValid}
                                            className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:hover:bg-muted px-4 py-2 rounded-lg w-full sm:w-auto font-bold text-primary-foreground text-sm whitespace-nowrap transition-all disabled:cursor-not-allowed"
                                        >
                                            Ativar Alerta
                                        </button>
                                    </div>
                                    {targetPriceError && (
                                        <p className="mt-2 text-[11px] text-danger">{targetPriceError}</p>
                                    )}
                                </div>
                            </div>

                            {/* BOTÃO ADICIONAR À CARTEIRA */}
                            <button
                                onClick={addToCollection}
                                disabled={isAdding || showSuccess}
                                className={`flex items-center justify-center gap-3 rounded-2xl font-bold transition-all px-6 py-4 border ${showSuccess
                                    ? 'bg-success/20 border-success text-success'
                                    : 'bg-primary hover:bg-primary/90 border-primary text-primary-foreground'
                                    }`}
                            >
                                {showSuccess ? (
                                    <> <CheckCircle2 className="w-6 h-6" /> Adicionado! </>
                                ) : (
                                    <> <PlusCircle className="w-6 h-6" /> {isAdding ? 'A processar...' : 'Adicionar à Carteira'} </>
                                )}
                            </button>
                        </div>

                        {/* GRÁFICO DE CANDLESTICK */}
                        <div className="bg-surface shadow-2xl shadow-black/10 p-6 border border-border rounded-3xl">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="font-bold text-foreground text-xl">Análise de Volatilidade (Base Liga)</h3>
                                    <p className="mt-1 text-muted-foreground text-xs uppercase tracking-widest">
                                        Candlestick diário ({chartData.length} {chartData.length === 1 ? 'dia' : 'dias'})
                                    </p>
                                </div>
                                <div className="flex gap-4 font-bold text-[10px]">
                                    <div className="flex items-center gap-1"><div className="bg-success rounded-full w-2 h-2"></div> ALTA</div>
                                    <div className="flex items-center gap-1"><div className="bg-danger rounded-full w-2 h-2"></div> BAIXA</div>
                                </div>
                            </div>

                            <div className="w-full h-75">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke={chartTheme.axis}
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={0}
                                            dy={10}
                                        />
                                        <YAxis
                                            stroke={chartTheme.axis}
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => `R$${v}`}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: chartTheme.tooltipBackground, borderRadius: '12px', border: `1px solid ${chartTheme.tooltipBorder}` }}
                                            labelStyle={{ color: chartTheme.tooltipLabel, marginBottom: '4px', fontWeight: 'bold' }}
                                            itemStyle={{ fontSize: '12px' }}
                                            formatter={(value: any, name: any, props: any) => {
                                                const { low, high, open, close } = props.payload;
                                                return [
                                                    <div key={name} className="space-y-1 mt-2 text-foreground">
                                                        <div className="flex justify-between gap-4"><span>Máx:</span> <span className="font-mono text-foreground">R${high?.toFixed(2)}</span></div>
                                                        <div className="flex justify-between gap-4"><span>Méd (Close):</span> <span className="font-mono text-foreground">R${close?.toFixed(2)}</span></div>
                                                        <div className="flex justify-between gap-4"><span>Mín:</span> <span className="font-mono text-foreground">R${low?.toFixed(2)}</span></div>
                                                    </div>,
                                                    ""
                                                ];
                                            }}
                                        />
                                        {/* A Barra que "hackeia" o gráfico para virar vela */}
                                        <Bar
                                            dataKey="displayPrice"
                                            barSize={36}
                                            shape={<CandlestickShape />}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-background/50 mt-6 p-4 border border-border rounded-xl">
                                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                                    O corpo da vela representa a variação entre o preço médio de ontem e hoje na liga. O pavio (linha) indica a dispersão total entre o menor e o maior preço da liga no período. Esses valores são de referência e, no futuro, serão gerados pelo BountyTracker.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {isCardPreviewOpen && (
                <div
                    className="z-50 fixed inset-0 flex justify-center items-center bg-background/85 backdrop-blur-md p-4"
                    onClick={() => setIsCardPreviewOpen(false)}
                >
                    <div
                        className="w-full max-w-65 sm:max-w-75 md:max-w-85"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setIsCardPreviewOpen(false)}
                            className="inline-flex items-center gap-2 bg-surface hover:bg-surface/80 mb-4 px-4 py-2 border border-border rounded-full font-semibold text-foreground text-sm transition-colors"
                        >
                            Fechar
                        </button>
                        <HolographicCard
                            src={card.image_url}
                            alt={card.name}
                            className="shadow-2xl mx-auto border border-border rounded-2xl w-full"
                        />
                    </div>
                </div>
            )}
        </main>
    );
}