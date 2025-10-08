document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = {
    apiKey: "AIzaSyBYipyAgyqGMBQltJgikxgFtki2A1p0qWY",
    authDomain: "lista-2b1cd.firebaseapp.com",
    projectId: "lista-2b1cd",
    storageBucket: "lista-2b1cd.appspot.com",
    messagingSenderId: "83264968603",
    appId: "1:83264968603:web:e97456e5e52c4f982b733e",
    measurementId: "G-1KHTMFGJMX",
  };

  firebase.initializeApp(firebaseConfig);
  firebase.analytics();

  const db = firebase.firestore();
  const MAX_MAIN_PLAYERS = 18;

  const mainPlayerInput = document.getElementById("mainPlayerName");
  const addMainPlayerBtn = document.getElementById("addMainPlayerBtn");
  const mainPlayersList = document.getElementById("mainPlayersList");

  const suplentesPlayerInput = document.getElementById("suplentesPlayerName");
  const addSuplentesPlayerBtn = document.getElementById(
    "addSuplentesPlayerBtn"
  );
  const suplentesPlayersList = document.getElementById("suplentesPlayersList");

  const convidadosPlayerInput = document.getElementById("convidadosPlayerName");
  const addConvidadosPlayerBtn = document.getElementById(
    "addConvidadosPlayerBtn"
  );
  const convidadosPlayersList = document.getElementById(
    "convidadosPlayersList"
  );

  const getUserId = () => {
    let userId = localStorage.getItem("userId");
    if (!userId) {
      userId =
        "user-" + Date.now() + "-" + Math.random().toString(16).substr(2, 8);
      localStorage.setItem("userId", userId);
    }
    return userId;
  };

  const userId = getUserId();

  const renderListFromFirestore = (
    listType,
    listElement,
    isMainList = false
  ) => {
    db.collection("players")
      .orderBy("timestamp", "asc")
      .onSnapshot((snapshot) => {
        const filtered = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((player) => player.listType === listType);

        listElement.innerHTML = "";
        filtered.forEach((player, index) => {
          appendPlayerToList(
            player,
            listElement,
            isMainList,
            listType,
            player.id,
            index + 1
          );
        });
        checkAddButtonStatus();
      });
  };

  const appendPlayerToList = (
    player,
    listElement,
    isMainList,
    listType,
    playerId,
    index
  ) => {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = index
      ? (nameSpan.textContent = `${index}. ${player.name}`)
      : player.name;
    li.appendChild(nameSpan);

    if (player.timestamp) {
      const timeSpan = document.createElement("span");
      const date = new Date(player.timestamp);
      const timeText = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Formata o texto dependendo da lista
      if (isMainList) {
        timeSpan.textContent = ` (entrou às ${timeText})`;
      } else {
        timeSpan.textContent = ` (às ${timeText})`;
      }

      timeSpan.classList.add("timestamp");
      li.appendChild(timeSpan);
    }

    const btn = document.createElement("button");
    btn.classList.add("remove-btn");
    btn.textContent = "Remover";
    btn.onclick = () => removePlayerFromFirestore(playerId, player.name);
    li.appendChild(btn);

    listElement.appendChild(li);
  };

  const addPlayerToFirestore = async (listType, name, inputElement) => {
    if (name.trim() === "") return;

    try {
      if (listType === "main") {
        const totalMainSnapshot = await db
          .collection("players")
          .where("listType", "==", "main")
          .get();

        if (totalMainSnapshot.size >= MAX_MAIN_PLAYERS) {
          alert("A lista principal já está cheia (18 jogadores).");
          return;
        }
      }

      const userSnapshot = await db
        .collection("players")
        .where("listType", "==", listType)
        .where("userId", "==", userId)
        .get();

      if (userSnapshot.size >= 3) {
        alert("Você já adicionou dois nomes nesta lista.");
        return;
      }

      await db.collection("players").add({
        name: name,
        userId: userId,
        timestamp: Date.now(),
        listType: listType,
      });

      inputElement.value = "";
    } catch (error) {
      console.error("Erro ao adicionar jogador:", error);
    }
  };

  const removePlayerFromFirestore = async (playerId, playerName) => {
    const confirmDelete = confirm(
      `Tem certeza que deseja remover ${playerName}?`
    );
    if (!confirmDelete) return; // se o usuário cancelar, não faz nada

    try {
      await db.collection("players").doc(playerId).delete();
      console.log("Jogador removido com sucesso!");
    } catch (error) {
      console.error("Erro ao remover jogador:", error);
      alert("Ocorreu um erro ao remover o jogador. Tente novamente.");
    }
    checkAndPromotePlayers();
  };

  const checkAddButtonStatus = () => {
    const lists = ["main", "suplentes", "convidados"];
    lists.forEach(async (listType) => {
      const btn = {
        main: addMainPlayerBtn,
        suplentes: addSuplentesPlayerBtn,
        convidados: addConvidadosPlayerBtn,
      }[listType];

      const input = {
        main: mainPlayerInput,
        suplentes: suplentesPlayerInput,
        convidados: convidadosPlayerInput,
      }[listType];

      const totalSnapshot = await db
        .collection("players")
        .where("listType", "==", listType)
        .get();

      const userSnapshot = await db
        .collection("players")
        .where("listType", "==", listType)
        .where("userId", "==", userId)
        .get();

      const totalCount = totalSnapshot.size;
      const userCount = userSnapshot.size;

      if (listType === "main") {
        const isFull = totalCount >= MAX_MAIN_PLAYERS;
        btn.disabled = isFull || userCount >= 3;
        input.disabled = isFull;

        input.placeholder = isFull
          ? "Lista principal cheia (18/18)"
          : userCount >= 3
          ? "Limite de 3 nomes"
          : "Nome do Jogador";
      } else {
        btn.disabled = userCount >= 3;
        input.disabled = false;
        input.placeholder =
          userCount >= 3
            ? "Limite de 3 nomes"
            : listType === "suplentes"
            ? "Nome do Suplente"
            : "Nome do Convidado";
      }
    });
  };

  const checkAndPromotePlayers = async () => {
    console.log("Verificando posição de jogadores...");
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    try {
      const snapshot = await db.collection("players").get();
      const allPlayers = [];
      snapshot.forEach((doc) => {
        allPlayers.push({ id: doc.id, ...doc.data() });
      });

      const mainList = allPlayers.filter((p) => p.listType === "main");
      const suplentesList = allPlayers.filter(
        (p) => p.listType === "suplentes"
      );
      const convidadosList = allPlayers.filter(
        (p) => p.listType === "convidados"
      );

      const availableSpots = MAX_MAIN_PLAYERS - mainList.length;
      if (availableSpots <= 0) {
        console.log("Lista principal cheia.");
        return;
      }

      let waitingList = [];

      if (hour >= 14 && minute >= 0) {
        waitingList = [...suplentesList, ...convidadosList].sort(
          (a, b) => a.timestamp - b.timestamp
        );
      } else {
        waitingList = [...suplentesList].sort(
          (a, b) => a.timestamp - b.timestamp
        );
      }

      const toPromote = waitingList.slice(0, availableSpots);
      const batch = db.batch();

      toPromote.forEach((player) => {
        const docRef = db.collection("players").doc(player.id);
        batch.update(docRef, { listType: "main" });
      });

      await batch.commit();
      console.log("Promoção concluída.");
    } catch (error) {
      console.error("Erro ao promover jogadores:", error);
    }
  };

  // Eventos para botões
  addMainPlayerBtn.addEventListener("click", () =>
    addPlayerToFirestore("main", mainPlayerInput.value, mainPlayerInput)
  );
  addSuplentesPlayerBtn.addEventListener("click", () =>
    addPlayerToFirestore(
      "suplentes",
      suplentesPlayerInput.value,
      suplentesPlayerInput
    )
  );
  addConvidadosPlayerBtn.addEventListener("click", () =>
    addPlayerToFirestore(
      "convidados",
      convidadosPlayerInput.value,
      convidadosPlayerInput
    )
  );

  // Enter no input adiciona jogador
  mainPlayerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !addMainPlayerBtn.disabled)
      addPlayerToFirestore("main", mainPlayerInput.value, mainPlayerInput);
  });
  suplentesPlayerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !addSuplentesPlayerBtn.disabled)
      addPlayerToFirestore(
        "suplentes",
        suplentesPlayerInput.value,
        suplentesPlayerInput
      );
  });
  convidadosPlayerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !addConvidadosPlayerBtn.disabled)
      addPlayerToFirestore(
        "convidados",
        convidadosPlayerInput.value,
        convidadosPlayerInput
      );
  });

  // Iniciar renderização e promoções
  renderListFromFirestore("main", mainPlayersList, true);
  renderListFromFirestore("suplentes", suplentesPlayersList, false);
  renderListFromFirestore("convidados", convidadosPlayersList, false);

  // setInterval(checkAndPromotePlayers, 60000); // verifica a cada minuto

  const sendListToPortariaBtn = document.getElementById(
    "sendListToPortariaBtn"
  );

  sendListToPortariaBtn.addEventListener("click", async () => {
    try {
      const snapshot = await db
        .collection("players")
        .where("listType", "==", "main")
        .get();

      if (snapshot.empty) {
        alert("A lista principal está vazia!");
        return;
      }

      // ordena os jogadores pela ordem de cadastro
      const players = snapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((data, index) => `${index + 1} - ${data.name}`);

      const message = `Segue a lista do vôlei:\n${players.join("\n")}`;

      // copia para a área de transferência
      await navigator.clipboard.writeText(message);

      alert("✅ Lista copiada com sucesso! Cole no WhatsApp ou onde quiser.");
    } catch (error) {
      console.error("Erro ao copiar a lista:", error);
      alert("Não foi possível copiar a lista. Tente novamente.");
    }
  });
});
