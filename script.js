async function sendRequest(url, method, data) {
    url = `https://tg-api.tehnikum.school/tehnikum_course/minesweeper/${url}`;

    const options = {
        method,
        headers: {
            'Accept': 'application/json',
        }
    };

    if (method === "POST") {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    } else if (method === "GET") {
        url += "?" + new URLSearchParams(data);
    }

    const response = await fetch(url, options);
    return await response.json();
}

let username;
let balance;
let points = 1000;
let game_id = localStorage.getItem("game_id") || ""; // Получаем game_id из localStorage, если он есть
const authorizationForm = document.getElementById("authorization");

if (authorizationForm) {
    authorizationForm.addEventListener("submit", authorization);
}

async function authorization(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    username = formData.get('username');

    let response = await sendRequest("user", "GET", { username });
    
    if (response.error) {
        let regResponse = await sendRequest("user", "POST", { username });
        
        if (regResponse.error) {
            alert(regResponse.message);
        } else {
            balance = regResponse.balance;
            showUser();
        }
    } else {
        balance = response.balance;
        showUser();
    }
}

function showUser() {
    const popUpSection = document.querySelector('section');
    popUpSection.style.display = "none";
    const userInfo = document.querySelector("header span");
    userInfo.innerHTML = `[${username}, ${balance}]`;
    localStorage.setItem("username", username);

    const gameButton = document.getElementById("gameButton");
    if (game_id) {
        gameButton.setAttribute("data-game", "stop");
    } else {
        gameButton.setAttribute("data-game", "start");
    }
}

document.querySelector('.exit')?.addEventListener("click", exit);

function exit() {
    const popUpSection = document.querySelector('section');
    popUpSection.style.display = "flex";

    const userInfo = document.querySelector("header span");
    userInfo.innerHTML = `[]`;

    localStorage.removeItem("username");
    localStorage.removeItem("game_id"); // Удаляем game_id при выходе
    game_id = "";
}

async function checkUser() {
    if (localStorage.getItem("username")) {
        username = localStorage.getItem("username");
        let response = await sendRequest("user", "GET", { username });
        if (response.error) {
            alert(response.message);
        } else {
            balance = response.balance;
            showUser();
        }
    } else {
        const popUpSection = document.querySelector('section');
        popUpSection.style.display = "flex";
    }
}

const pointBtns = document.getElementsByName("point");
pointBtns.forEach(elem => {
    elem.addEventListener('input', setPoints);
});

function setPoints() {
    const checkedBtn = document.querySelector("input:checked");
    if (checkedBtn) {
        points = +checkedBtn.value;
    }
}

const gameButton = document.getElementById("gameButton");
if (gameButton) {
    gameButton.addEventListener("click", startOrStopGame);
}

function startOrStopGame() {
    const option = gameButton.getAttribute("data-game");
    if (option === "start") {
        if (points > 0) {
            startGame();
        }
    } else if (option === "stop") {
        stopGame();
    }
}

async function startGame() {
    const response = await sendRequest("new_game", "POST", { username, points });
    if (response.error) {
        alert(response.message);
    } else {
        game_id = response.game_id;
        localStorage.setItem("game_id", game_id); // Сохраняем game_id
        gameButton.setAttribute("data-game", "stop");
        gameButton.innerHTML = "Завершить игру";
        activateArea();
    }
}

// Обработка долгого нажатия для установки флажка
let longPressTimer;

function handleTouchStart(event) {
    longPressTimer = setTimeout(() => {
        setFlag(event);
    }, 500); // Установка флажка после 0.5 секунды удержания
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
}

// Функция для установки или снятия флажка
function setFlag(event) {
    event.preventDefault(); // Отключаем стандартное поведение правой кнопки (меню)
    let cell = event.target;
    cell.classList.toggle("flag"); // Добавляем или убираем флажок
}

// Функция активации ячеек, с добавлением обработчиков событий
function activateArea() {
    let cells = document.querySelectorAll(".cell");

    cells.forEach((cell, i) => {
        setTimeout(() => {
            if (cell) {
                cell.classList.add("active");
                cell.addEventListener("contextmenu", setFlag);
                cell.addEventListener("click", makeStep);
                cell.addEventListener("touchstart", handleTouchStart); 
                cell.addEventListener("touchend", handleTouchEnd); 
            }
        }, 30 * i);
    });
}

async function makeStep(event) {
    const cell = event.target;
    const row = +cell.getAttribute("data-row");
    const column = +cell.getAttribute("data-column");

    if (!game_id) {
        alert("Неправильные данные! Отправьте game_id.");
        return;
    }

    const response = await sendRequest("game_step", "POST", { game_id, row, column });
    if (response.error) {
        alert(response.message);
    } else {
        if (response.status === "Won") {
            updateArea(response.table);
            balance = response.balance;
            showUser();
            alert("Ты выиграл!");
            resetGame();
        } else if (response.status === "Failed") {
            updateArea(response.table);
            balance = response.balance;
            showUser();
            alert("Ты проиграл :(");
            resetGame();
        } else if (response.status === "Ok") {
            updateArea(response.table);
        }
    }
}

function updateArea(table) {
    const cells = document.querySelectorAll(".cell");
    let j = 0;
    for (let row = 0; row < table.length; row++) {
        for (let column = 0; column < table[row].length; column++) {
            const value = table[row][column];
            const cell = cells[j];
            if (value === 0) {
                cell.classList.remove("active", "flag");
                cell.innerHTML = '';
            } else if (value >= 1) {
                cell.classList.remove("active", "flag");
                cell.innerHTML = value;
            } else if (value === "BOMB") {
                cell.classList.remove("active", "flag");
                cell.classList.add("bomb");
            }
            j++;
        }
    }
}

async function stopGame() {
    if (!game_id) {
        alert("Неправильные данные! Отправьте game_id.");
        return;
    }
    
    try {
        const response = await sendRequest("stop_game", "POST", { username, game_id });
        if (response.error) {
            alert(response.message);
        } else {
            balance = response.balance;
            showUser();
            resetGame();
        }
    } catch (error) {
        console.error("Error during stopGame request:", error);
        alert("Произошла ошибка при остановке игры.");
    }
}

function resetGame() {
    game_id = "";
    localStorage.removeItem("game_id"); // Удаляем game_id при завершении
    gameButton.setAttribute("data-game", "start");
    gameButton.innerHTML = "Играть";
    clearArea();
}

function clearArea() {
    const area = document.querySelector(".area");
    area.innerHTML = ""; // Очистка области перед добавлением новых ячеек
    for (let i = 0; i < 80; i++) {
        area.innerHTML += `<div class="cell" data-row="${Math.floor(i / 10)}" data-column="${i % 10}"></div>`;
    }
}
