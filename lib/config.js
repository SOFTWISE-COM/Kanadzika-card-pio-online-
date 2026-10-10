module.exports = {
  NOME: 'Kanandzika',
  TAXA: 50, // taxa de delivery em MT
  GANHO_ENTREGA: 50, // ganho do entregador por entrega, em MT (igual a entregador_ganho() no entregador.sql)
  LOJA: { lat: -25.993563, lng: 32.423748 }, // lanchonete
  RAIO_KM: 5, // só avisa entregadores online que estejam a menos de X km da lanchonete
  BAIRROS: [
    'Matola rio', 'Thandavanto', 'Km 16', 'Campoane (Xidiminguana)',
    'Belo Horizonte', 'Bloco 2', 'Mazambanine', 'Tedeco',
    'Secundária de Boane', 'Escola Joaquim Chissano', 'Cruzamento', 'Vila de Boane',
  ],
};
