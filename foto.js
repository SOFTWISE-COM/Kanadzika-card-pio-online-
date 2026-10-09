/* Foto de perfil: recorta, comprime e envia para o Supabase Storage */
(function () {
  // Recorta ao centro em quadrado e reduz para 256x256 (JPEG leve)
  function preparar(file) {
    return new Promise(function (ok, erro) {
      if (!file || !/^image\//.test(file.type)) return erro(new Error('Escolha uma imagem.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var lado = Math.min(img.width, img.height), T = 256;
          var c = document.createElement('canvas'); c.width = T; c.height = T;
          var x = c.getContext('2d');
          x.fillStyle = '#0a4248'; x.fillRect(0, 0, T, T);
          x.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, T, T);
          var dataUrl = c.toDataURL('image/jpeg', 0.85);
          c.toBlob(function (blob) { URL.revokeObjectURL(url); blob ? ok({ blob: blob, dataUrl: dataUrl }) : erro(new Error('Não foi possível ler a imagem.')); }, 'image/jpeg', 0.85);
        } catch (e) { erro(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error('Imagem inválida.')); };
      img.src = url;
    });
  }
  // Envia para avatars/<id-do-utilizador>/foto.jpg e guarda o endereço na conta
  async function enviar(sb, blob) {
    var s = await sb.auth.getSession();
    var u = s && s.data && s.data.session && s.data.session.user;
    if (!u) throw new Error('sem sessão');
    var caminho = u.id + '/foto.jpg';
    var up = await sb.storage.from('avatars').upload(caminho, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (up.error) throw up.error;
    var pub = sb.storage.from('avatars').getPublicUrl(caminho).data.publicUrl + '?v=' + Date.now();
    var r = await sb.auth.updateUser({ data: { avatar_url: pub } });
    if (r.error) throw r.error;
    return pub;
  }
  window.Foto = { preparar: preparar, enviar: enviar };
})();
