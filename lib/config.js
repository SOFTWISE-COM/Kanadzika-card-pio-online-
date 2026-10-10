module.exports = {
  NOME: 'Kanandzika',
  TAXA: 50, // taxa mínima de delivery em MT (até 2 km)
  TARIFA: { BASE: 50, KM_BASE: 2, POR_KM: 10, MAX: 150 }, // 50 MT até 2 km, +10 MT por km extra, máx. 150 MT
  GANHO_ENTREGA: 50, // ganho mínimo do entregador; o real é a taxa paga pelo cliente (entre 50 e 150)
  LOJA: { lat: -25.993563, lng: 32.423748 }, // lanchonete
  RAIO_KM: 5, // só avisa entregadores online que estejam a menos de X km da lanchonete
  BAIRROS: [
    'Matola rio', 'Thandavanto', 'Km 16', 'Campoane (Xidiminguana)',
    'Belo Horizonte', 'Bloco 2', 'Mazambanine', 'Tedeco',
    'Secundária de Boane', 'Escola Joaquim Chissano', 'Cruzamento', 'Vila de Boane',
  ],
};
