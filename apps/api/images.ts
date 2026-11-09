import { logoLimits } from '../../packages/domain/contracts';
import { ApiError } from './errors';

export type ImageInfo = { contentType: (typeof logoLimits.types)[number]; width: number; height: number };

const invalid = (message: string) => new ApiError(422, 'invalid_image', message);

/**
 * Valida um logotipo pelo conteúdo, não pela extensão nem pelo tipo informado pelo navegador:
 * assinatura, estrutura mínima, dimensões e tamanho. SVG e outros formatos são recusados.
 * Limitação: não decodifica os pixels; a imagem é servida com tipo fixo, nosniff e CSP restrita.
 */
export function inspectImage(bytes: Buffer, declaredType: string | undefined): ImageInfo {
 if (bytes.length === 0) throw invalid('Arquivo vazio.');
 if (bytes.length > logoLimits.maxBytes) throw invalid(`Use uma imagem de até ${Math.round(logoLimits.maxBytes / 1024)} KB.`);
 const info = png(bytes) ?? jpeg(bytes) ?? webp(bytes);
 if (!info) throw invalid('Use PNG, JPG ou WebP. O conteúdo do arquivo não corresponde a nenhum desses formatos.');
 if (declaredType && declaredType.split(';')[0].trim().toLowerCase() !== info.contentType) throw invalid('O tipo informado não corresponde ao conteúdo do arquivo.');
 const { minSide, maxSide } = logoLimits;
 if (info.width < minSide || info.height < minSide || info.width > maxSide || info.height > maxSide) {
  throw invalid(`Use uma imagem entre ${minSide} × ${minSide} e ${maxSide} × ${maxSide} pixels (recebido ${info.width} × ${info.height}).`);
 }
 return info;
}

function png(b: Buffer): ImageInfo | null {
 const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
 if (b.length < 45 || !signature.every((v, i) => b[i] === v)) return null;
 if (b.toString('latin1', 12, 16) !== 'IHDR') throw invalid('PNG sem cabeçalho IHDR.');
 // Arquivo truncado ou com conteúdo anexado depois do fim é recusado.
 if (b.toString('latin1', b.length - 8, b.length - 4) !== 'IEND') throw invalid('PNG incompleto ou com dados após o fim.');
 return { contentType: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpeg(b: Buffer): ImageInfo | null {
 if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
 if (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) throw invalid('JPEG incompleto.');
 let i = 2;
 while (i + 9 < b.length) {
  if (b[i] !== 0xff) throw invalid('JPEG com estrutura inválida.');
  const marker = b[i + 1];
  if (marker === 0xff) { i++; continue; }
  if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
  const length = b.readUInt16BE(i + 2);
  if (length < 2) throw invalid('JPEG com estrutura inválida.');
  const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
  if (isFrame) return { contentType: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
  if (marker === 0xda) break;
  i += 2 + length;
 }
 throw invalid('JPEG sem dimensões.');
}

function webp(b: Buffer): ImageInfo | null {
 if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
 if (b.readUInt32LE(4) + 8 !== b.length) throw invalid('WebP incompleto ou com dados após o fim.');
 const chunk = b.toString('latin1', 12, 16);
 if (chunk === 'VP8 ') {
  if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) throw invalid('WebP com quadro inválido.');
  return { contentType: 'image/webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
 }
 if (chunk === 'VP8L') {
  if (b[20] !== 0x2f) throw invalid('WebP sem assinatura VP8L.');
  const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
  return { contentType: 'image/webp', width: 1 + (b0 | ((b1 & 0x3f) << 8)), height: 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) };
 }
 if (chunk === 'VP8X') {
  if (b[20] & 0x02) throw invalid('WebP animado não é aceito como logotipo.');
  return { contentType: 'image/webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
 }
 throw invalid('WebP com formato desconhecido.');
}
