// ========== CONFIGURAÇÃO INICIAL DO MAPA ==========
const mapaDenuncias = L.map("mapa").setView([-10.2, -48.3], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Map data © <a href='https://openstreetmap.org'>OpenStreetMap</a> contributors"
}).addTo(mapaDenuncias);

L.control.scale().addTo(mapaDenuncias);
L.control.layers(null, null, { collapsed: false }).addTo(mapaDenuncias);

// ========== ÍCONE PADRÃO ==========
const iconePadrao = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let marcadorSelecionado = null;
let coordenadasSelecionadas = { lat: null, lng: null };

// ========== SERVIÇO DE DENÚNCIAS ==========
const denunciaService = {
  getDenuncias: () => JSON.parse(localStorage.getItem("denuncias")) || [],

  addDenuncia: (denuncia) => {
    const denuncias = denunciaService.getDenuncias();
    const novaDenuncia = {
      ...denuncia,
      id: Date.now(),
      status: "Pendente"
    };
    denuncias.push(novaDenuncia);
    localStorage.setItem("denuncias", JSON.stringify(denuncias));
    return novaDenuncia;
  },

  getDenunciaById: (id) => denunciaService.getDenuncias().find(d => d.id === id)
};

// ========== EXIBIÇÃO DAS DENÚNCIAS NO MAPA ==========
function carregarDenuncias() {
  const denuncias = denunciaService.getDenuncias();
  denuncias.forEach(d => {
    const popupContent = `
      <strong>${d.titulo}</strong><br>
      ${d.endereco}<br>
      Status: ${d.status}<br>
      Data: ${new Date(d.data).toLocaleDateString()}<br><br>
      <button onclick="verDetalhes(${d.id})">Ver detalhes</button>
    `;
    L.marker([d.lat, d.lng], { icon: iconePadrao })
      .addTo(mapaDenuncias)
      .bindPopup(popupContent);
  });
}

// ========== EXIBIÇÃO DA LISTA DE DENÚNCIAS RECENTES ==========
function carregarListaRecentes() {
  const listaRecentes = document.querySelector('#recentes .cards');
  const denuncias = denunciaService.getDenuncias().slice().reverse(); // copia e inverte
  listaRecentes.innerHTML = "";

  denuncias.forEach(d => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.innerHTML = `
      <h3>${d.titulo}</h3>
      <p class="local">📍 ${d.endereco}</p>
      <p class="data">📅 ${new Date(d.data).toLocaleDateString()}</p>
      <span class="status ${d.status}">${d.status}</span>
      <p>${d.descricao}</p>
      <a href="#" onclick="verDetalhes(${d.id})">Ver detalhes</a>
    `;
    listaRecentes.appendChild(card);
  });
}

// ========== EXIBIÇÃO DE DETALHES ==========
function verDetalhes(id) {
  const d = denunciaService.getDenunciaById(id);
  if (!d) return;
  alert(`
    Título: ${d.titulo}
    Endereço: ${d.endereco}
    Status: ${d.status}
    Data: ${new Date(d.data).toLocaleDateString()}
    Descrição: ${d.descricao}
    Coordenadas: ${d.lat}, ${d.lng}
  `);
}

// ========== AUTOCOMPLETE DE ENDEREÇO ==========
const inputLocal = document.getElementById("local");
const sugestoes = document.getElementById("sugestoes-endereco");
const enderecoCompleto = document.getElementById("endereco-completo");

let timeoutBusca = null;

inputLocal.addEventListener("input", function () {
  clearTimeout(timeoutBusca);
  const termo = inputLocal.value.trim();

  if (termo.length < 3) {
    sugestoes.innerHTML = "";
    return;
  }

  timeoutBusca = setTimeout(() => buscarSugestoes(termo), 500);
});

async function buscarSugestoes(termo) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(termo)}&addressdetails=1&limit=5&countrycodes=BR&viewbox=-48.45,-10.1,-48.2,-10.35&bounded=1`;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error("Falha na requisição");

    const dados = await resposta.json();
    sugestoes.innerHTML = "";

    if (!dados.length) {
      sugestoes.innerHTML = "<li>Nenhum resultado encontrado</li>";
      return;
    }

    dados.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.display_name;
      li.addEventListener("click", () => selecionarEndereco(item));
      sugestoes.appendChild(li);
    });
  } catch (erro) {
    console.error("Erro ao buscar sugestões:", erro);
    sugestoes.innerHTML = "<li>Erro ao buscar endereços. Tente novamente.</li>";
  }
}

function selecionarEndereco(item) {
  inputLocal.value = item.display_name;
  enderecoCompleto.value = item.display_name;
  coordenadasSelecionadas = {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  };

  if (marcadorSelecionado) {
    mapaDenuncias.removeLayer(marcadorSelecionado);
  }

  marcadorSelecionado = L.marker([item.lat, item.lon], { icon: iconePadrao })
    .addTo(mapaDenuncias)
    .bindPopup("Local selecionado")
    .openPopup();

  mapaDenuncias.setView([item.lat, item.lon], 17);
  sugestoes.innerHTML = "";
}

// ========== CLIQUE NO MAPA ==========
mapaDenuncias.on("click", async (e) => {
  if (marcadorSelecionado) {
    mapaDenuncias.removeLayer(marcadorSelecionado);
  }

  marcadorSelecionado = L.marker(e.latlng, { icon: iconePadrao })
    .addTo(mapaDenuncias)
    .bindPopup("Local selecionado")
    .openPopup();

  coordenadasSelecionadas = {
    lat: e.latlng.lat,
    lng: e.latlng.lng,
  };

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`;
    const resposta = await fetch(url);
    const data = await resposta.json();

    if (data.display_name) {
      inputLocal.value = data.display_name;
      enderecoCompleto.value = data.display_name;
    }
  } catch (erro) {
    console.error("Erro na busca reversa:", erro);
  }
});

// ========== FECHAR SUGESTÕES AO CLICAR FORA ==========
document.addEventListener("click", (e) => {
  if (!inputLocal.contains(e.target) && !sugestoes.contains(e.target)) {
    sugestoes.innerHTML = "";
  }
});

// ========== ENVIO DO FORMULÁRIO ==========
const formulario = document.getElementById("form-denuncia");

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();

  const titulo = document.getElementById("titulo").value.trim();
  const data = document.getElementById("data").value;
  const descricao = document.getElementById("descricao").value.trim();
  const foto = document.getElementById("foto").files[0];

  if (!titulo || !data || !descricao) {
    alert("Por favor, preencha todos os campos obrigatórios.");
    return;
  }

  if (!coordenadasSelecionadas.lat || !coordenadasSelecionadas.lng) {
    alert("Você precisa selecionar um local no mapa.");
    return;
  }

  const novaDenuncia = {
    titulo,
    endereco: enderecoCompleto.value || inputLocal.value,
    data,
    descricao,
    lat: coordenadasSelecionadas.lat,
    lng: coordenadasSelecionadas.lng,
    foto: foto ? await lerArquivoComoBase64(foto) : null,
  };

  denunciaService.addDenuncia(novaDenuncia);

  alert("✅ Denúncia registrada com sucesso!");
  formulario.reset();
  marcadorSelecionado && mapaDenuncias.removeLayer(marcadorSelecionado);
  coordenadasSelecionadas = { lat: null, lng: null };

  carregarDenuncias();
  carregarListaRecentes();
});

// ========== UTILITÁRIO: LER IMAGEM COMO BASE64 ==========
function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ========== INICIALIZAÇÃO ==========
carregarDenuncias();
carregarListaRecentes();
