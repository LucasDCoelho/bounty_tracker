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

    // Aplica a sua Regex de One Piece no texto retornado pelo Google
    const opCodeRegex = /[A-Z]{2}\d{2}-\d{3}/g;
    const matches = fullText.toUpperCase().match(opCodeRegex);

    if (matches && matches.length > 0) {
      // Retorna o primeiro código encontrado
      return NextResponse.json({ code: matches });
    } else {
      return NextResponse.json({ error: 'Código da carta não encontrado na imagem' }, { status: 404 });
    }

  } catch (error) {
    console.error('Erro na API de Scan:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a imagem' }, { status: 500 });
  }
}