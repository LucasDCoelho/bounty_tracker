import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';

// Instancia o cliente usando as variáveis de ambiente de forma segura
const client = new vision.ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // O replace garante que as quebras de linha sejam lidas corretamente
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const opCodeRegex = /[A-Z]{2}\d{2}-\d{3}/g;
const opCodeLineRegex = /[A-Z]{2}\d{2}-\d{3}/;

function extractNameHints(fullText: string) {
  const normalized = fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4)
    .filter((line) => !/^[\d\W_]+$/.test(line))
    .filter((line) => !opCodeLineRegex.test(line.toUpperCase()))
    .filter((line) => !/(BANDAI|ONE\s*PIECE|CARD\s*GAME|ENGLISH|JAPANESE)/i.test(line));

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
    const [result] = await client.textDetection({
      image: { content: base64Data },
    });

    const detections = result.textAnnotations;
    const fullText = detections && detections.length > 0 ? detections.description : '';

    if (!fullText) {
      return NextResponse.json({ error: 'Nenhum texto detectado' }, { status: 404 });
    }

    const codes = extractCodes(fullText);
    const nameHints = extractNameHints(fullText);

    return NextResponse.json({
      code: codes[0] || null,
      codes,
      nameHints,
      fullText,
    });

  } catch (error) {
    console.error('Erro na API de Scan:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a imagem' }, { status: 500 });
  }
}