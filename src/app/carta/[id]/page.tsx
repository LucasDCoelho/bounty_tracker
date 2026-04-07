"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { enqueueTradeCard, savePendingDeckCard } from '@/lib/flow-bridge';
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


// Componente Interno para desenhar a "Vela" (SVG Customizado)
const CandlestickShape = (props: any) => {
    const { x, y, width, height, low, high, open, close } = props;
    const isUp = close >= open;
    const color = isUp ? '#10b981' : '#ef4444'; // Verde para alta, Vermelho para baixa

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
            }
            setIsLoading(false);
        }
        if (cardId) fetchCard();
    }, [cardId]);


    // Dentro do componente CardDetails
    const [targetPrice, setTargetPrice] = useState("");

    const createAlert = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

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
                current_price_at_creation: precoAtual
            }
        ]);

        if (!error) alert("Bounty definido! Te avisaremos no Telegram.");
    };

    const sendToCalculator = () => {
        if (!card) return;

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
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            console.error("Erro completo do Supabase:", error);
            alert("Erro ao salvar: " + error.message);
        }
        setIsAdding(false);
    };

    if (isLoading) return <div className="flex justify-center items-center bg-slate-950 min-h-screen"><div className="border-orange-500 border-t-2 rounded-full w-12 h-12 animate-spin"></div></div>;
    if (!card) return <div className="flex flex-col justify-center items-center bg-slate-950 min-h-screen text-white"><AlertCircle className="mb-4 w-16 h-16 text-red-500" /><h1 className="font-bold text-2xl">Carta não encontrada</h1></div>;

    const precoAtual = card.price_history[card.price_history.length - 1]?.price_avg || 0;
    const parsedTargetPrice = Number(targetPrice);
    const hasTargetInput = targetPrice.trim().length > 0;
    const isTargetPriceValid = Number.isFinite(parsedTargetPrice) && parsedTargetPrice > 0;
    const targetPriceError = hasTargetInput && !isTargetPriceValid
        ? 'Informe um preço-alvo válido maior que zero.'
        : '';

    // Transformar o histórico de preços para o formato de Trading (Candlestick)
    const chartData = card.price_history.map((ph: any, index: number) => {
        // O preço de abertura é o preço médio do dia anterior (ou o atual, se for o primeiro dia)
        const prevPrice = card.price_history[index - 1]?.price_avg || ph.price_avg;
        return {
            date: new Date(ph.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            open: prevPrice,
            close: ph.price_avg,
            low: ph.price_min,
            high: ph.price_max,
            displayPrice: [prevPrice, ph.price_avg] // O Recharts precisa de um array para a altura da barra
        };
    });

    return (
        <main className="bg-slate-950 p-4 md:p-8 min-h-screen text-slate-100">
            <div className="mx-auto max-w-6xl">
                <Link href="/" className="inline-flex items-center mb-8 text-slate-400 hover:text-orange-500 transition-colors">
                    <ArrowLeft className="mr-2 w-5 h-5" /> Voltar
                </Link>

                <div className="gap-8 grid grid-cols-1 md:grid-cols-3">
                    {/* Coluna Imagem */}
                    <div className="md:col-span-1">
                        <img src={card.image_url} alt={card.name} className="shadow-2xl border border-slate-800 rounded-2xl w-full" />
                    </div>

                    {/* Coluna Dados */}
                    <div className="space-y-6 md:col-span-2">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-slate-800 px-3 py-1 border border-slate-700 rounded-full font-mono text-slate-300 text-xs">{card.card_number}</span>
                                <span className="bg-amber-500/10 px-3 py-1 border border-amber-500/20 rounded-full font-bold text-amber-500 text-xs">{card.rarity}</span>
                            </div>
                            <h1 className="font-black text-white text-4xl">{card.name}</h1>
                            <p className="text-slate-400">{card.set?.name}</p>

                            <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                    onClick={sendToCalculator}
                                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg font-bold text-white text-xs transition-all"
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Levar para Calculadora
                                </button>
                                <button
                                    onClick={sendToDeckbuilder}
                                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg font-bold text-white text-xs transition-all"
                                >
                                    <Layers className="w-4 h-4" />
                                    Levar para Deckbuilder
                                </button>
                            </div>
                        </div>

                        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                            <div className="bg-slate-900 p-6 border border-slate-800 rounded-2xl">
                                <p className="mb-1 text-slate-400 text-xs uppercase tracking-wider">Preço Médio</p>
                                <p className="font-black text-emerald-400 text-3xl">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoAtual)}
                                </p>
                                <div className="bg-slate-950 mt-4 p-4 border border-slate-800 rounded-xl">
                                    <label className="block mb-2 font-bold text-[10px] text-slate-500 uppercase">Definir Bounty (Preço Alvo)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="R$ 0,00"
                                            value={targetPrice}
                                            onChange={(e) => setTargetPrice(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                            className="flex-1 bg-slate-900 px-3 py-2 border border-slate-700 focus:border-orange-500 rounded-lg outline-none text-white text-sm"
                                        />
                                        <button
                                            onClick={createAlert}
                                            disabled={!isTargetPriceValid}
                                            className="bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-white text-sm transition-all disabled:cursor-not-allowed"
                                        >
                                            Ativar Alerta
                                        </button>
                                    </div>
                                    {targetPriceError && (
                                        <p className="mt-2 text-[11px] text-red-400">{targetPriceError}</p>
                                    )}
                                </div>
                            </div>

                            {/* BOTÃO ADICIONAR À CARTEIRA */}
                            <button
                                onClick={addToCollection}
                                disabled={isAdding || showSuccess}
                                className={`flex items-center justify-center gap-3 rounded-2xl font-bold transition-all px-6 py-4 border ${showSuccess
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                                    : 'bg-orange-600 hover:bg-orange-500 border-orange-500 text-white'
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
                        <div className="bg-slate-900 shadow-2xl p-6 border border-slate-800 rounded-3xl">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="font-bold text-white text-xl">Análise de Volatilidade</h3>
                                    <p className="mt-1 text-slate-500 text-xs uppercase tracking-widest">Candlestick (Diário)</p>
                                </div>
                                <div className="flex gap-4 font-bold text-[10px]">
                                    <div className="flex items-center gap-1"><div className="bg-emerald-500 rounded-full w-2 h-2"></div> ALTA</div>
                                    <div className="flex items-center gap-1"><div className="bg-red-500 rounded-full w-2 h-2"></div> BAIXA</div>
                                </div>
                            </div>

                            <div className="w-full h-75">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#475569"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            stroke="#475569"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => `R$${v}`}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                                            itemStyle={{ fontSize: '12px' }}
                                            formatter={(value: any, name: any, props: any) => {
                                                const { low, high, open, close } = props.payload;
                                                return [
                                                    <div key={name} className="space-y-1 mt-2 text-slate-300">
                                                        <div className="flex justify-between gap-4"><span>Máx:</span> <span className="font-mono text-white">R${high?.toFixed(2)}</span></div>
                                                        <div className="flex justify-between gap-4"><span>Méd (Close):</span> <span className="font-mono text-white">R${close?.toFixed(2)}</span></div>
                                                        <div className="flex justify-between gap-4"><span>Mín:</span> <span className="font-mono text-white">R${low?.toFixed(2)}</span></div>
                                                    </div>,
                                                    ""
                                                ];
                                            }}
                                        />
                                        {/* A Barra que "hackeia" o gráfico para virar vela */}
                                        <Bar
                                            dataKey="displayPrice"
                                            shape={<CandlestickShape />}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-slate-950/50 mt-6 p-4 border border-slate-800 rounded-xl">
                                <p className="text-[11px] text-slate-500 italic leading-relaxed">
                                    O corpo da vela representa a variação entre o preço médio de ontem e hoje. O pavio (linha) indica a dispersão total entre o menor e o maior preço encontrado no mercado.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}