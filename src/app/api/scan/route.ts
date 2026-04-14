import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';

// Instancia o cliente usando as variáveis de ambiente de forma segura
const client = new vision.ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const opCodeRegex = /[A-Z]{2}\d{2}-\d{3}/g;
const opCodeLineRegex = /[A-Z]{2}\d{2}-\d{3}/;

const visualGarbageRegex = /(SAMPLE|DON!!|SMARTPHONE|MOBILE|DEVICE|MONITOR|DISPLAY|TELEPHONE|ATTACKING|TRASH)/i;

// 2. As palavras que definem que a carta é cara/diferente
const variantKeywordsRegex = /(WINNER|PROMO|PRE-RELEASE|MANGA|PARALLEL)/i;

function extractVariants(hints: string[]) {
  return hints
    .filter(hint => variantKeywordsRegex.test(hint))
    // Padroniza para maiúsculo para facilitar a busca
    .map(hint => hint.toUpperCase().trim());
}

function extractNameHints(fullText: string) {
  const normalized = fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3) 
    .filter((line) => !/^[\d\W_]+$/.test(line)) 
    .filter((line) => !opCodeLineRegex.test(line.toUpperCase())) 
    .filter((line) => !/(BANDAI|ONE\s*PIECE|CARD\s*GAME|ENGLISH|JAPANESE|MADE\s*IN)/i.test(line))
    .filter((line) => !visualGarbageRegex.test(line))
    .filter((line) => !variantKeywordsRegex.test(line)) // Tira a variante daqui pra não sujar a busca de nome
    .filter((line) => line.split(/\s+/).length <= 4);

  const uniqueHints = Array.from(new Set(normalized.map((line) => line.replace(/\s+/g, ' '))));
  return uniqueHints.slice(0, 5);
}

function extractCodes(fullText: string) {
  const matches = fullText.toUpperCase().match(opCodeRegex) || [];
  return Array.from(new Set(matches));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 });
    }

    // O Google Vision espera a base64 pura, sem o prefixo "data:image/jpeg;base64,"
    const base64Data = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // Chama o Google Vision para detectar texto
    const [result] = await client.annotateImage({
      image: { content: base64Data },
      features: [
        { type: 'TEXT_DETECTION' },
        { type: 'DOCUMENT_TEXT_DETECTION' },
        { type: 'WEB_DETECTION' } // <-- A mágica do Lens está aqui
      ]
    });

    const detections = result.textAnnotations;
    const fullText = result.fullTextAnnotation?.text || (detections && detections.length > 0 ? detections[0]?.description || '' : '');

    const webEntities = result.webDetection?.webEntities || [];
    const lensHints = webEntities
      .map(entity => entity.description)
      .filter(desc => desc && desc.length > 3) as string[]; 
      
    const rawNameHints = extractNameHints(fullText);

    const allVisualHints = Array.from(new Set([
      ...lensHints,
      ...rawNameHints,
    ]));

    // Agora a MÁGICA: separa o que é Variante do que é Nome
    const detectedVariants = Array.from(new Set(extractVariants(allVisualHints)));
    const cleanNameHints = Array.from(new Set([
      ...extractNameHints(fullText),
      ...extractNameHints(allVisualHints.join('\n')),
    ])).slice(0, 8);

    const codes = extractCodes(fullText);

    return NextResponse.json({
      code: codes[0] || null,
      codes,
      nameHints: cleanNameHints, 
      variants: detectedVariants, // <-- Enviamos as tags de luxo para o Frontend!
      fullText,
    });

  } catch (error) {
    console.error('Erro na API de Scan:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a imagem' }, { status: 500 });
  }
}