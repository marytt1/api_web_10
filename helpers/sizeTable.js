// Tabela do guia de tamanhos (Provador)
const SIZE_TABLE = [
  { size: 'P',  bust: [78, 84], waist: [58, 64], hip: [85, 91] },
  { size: 'M',  bust: [84, 90], waist: [64, 70], hip: [91, 97] },
  { size: 'G',  bust: [90, 96], waist: [70, 76], hip: [97, 103] },
  { size: 'GG', bust: [96, 104], waist: [76, 84], hip: [103, 111] },
];

// Posição do tamanho para uma medida; -1 = acima do maior tamanho
function findSizeIndex(value, key) {
  const last = SIZE_TABLE.length - 1;
  for (let i = 0; i < last; i++) {
    if (value < SIZE_TABLE[i][key][1]) return i;
  }
  return value <= SIZE_TABLE[last][key][1] ? last : -1;
}

function computeSize(bust, waist, hip) {
  const indexes = [
    findSizeIndex(bust, 'bust'),
    findSizeIndex(waist, 'waist'),
    findSizeIndex(hip, 'hip'),
  ];
  if (indexes.includes(-1)) return { status: 'above' };

  const values = [bust, waist, hip];
  const labels = ['Busto', 'Cintura', 'Quadril'];

  return {
    status: 'ok',
    size: SIZE_TABLE[Math.max(...indexes)].size, // o maior, para não ficar apertado
    details: labels.map((label, i) => ({ label, value: values[i], size: SIZE_TABLE[indexes[i]].size })),
    mixed: new Set(indexes).size > 1,
  };
}

module.exports = { computeSize };
