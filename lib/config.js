module.exports = {
  NOME: 'Kanandzika',
  TAXA: 70, // taxa mínima de delivery em MT (até 2 km)
  TARIFA: { BASE: 70, KM_BASE: 2, POR_KM: 10, MAX: 170 }, // 70 MT até 2 km, +10 MT por km extra, máx. 170 MT
  COMISSAO: 20, // comissão fixa da plataforma por entrega, em MT
  GANHO_ENTREGA: 70, // taxa mínima paga pelo cliente; o entregador recebe a taxa menos a comissão
  LOJA: { lat: -25.993563, lng: 32.423748 }, // lanchonete
  RAIO_KM: 5, // só avisa entregadores online que estejam a menos de X km da lanchonete
  BAIRROS: [
    'Matola rio', 'Thandavanto', 'Km 16', 'Campoane (Xidiminguana)',
    'Belo Horizonte', 'Bloco 2', 'Mazambanine', 'Tedeco',
    'Secundária de Boane', 'Escola Joaquim Chissano', 'Cruzamento', 'Vila de Boane',
  ],
};
