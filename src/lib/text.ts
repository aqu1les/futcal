// Normaliza texto pra busca: minúsculo, sem acento, espaços colapsados.
// Ex.: "Grêmio  FBPA" → "gremio fbpa". Usado no populate (coluna search_name)
// e na busca, pra casar independente de acento/caixa.
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento (combining diacritics)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
