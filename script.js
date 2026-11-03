import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// ==========================================
// 1. КОНФИГУРАЦИЯ
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDu5YRUIZ1kAbKH11PFJq3cp4U0RLjAMVs",
    authDomain: "schedule-626r.firebaseapp.com",
    projectId: "schedule-626r",
    storageBucket: "schedule-626r.firebasestorage.app",
    messagingSenderId: "917408207242",
    appId: "1:917408207242:web:277a19729e47067542f873"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Состояние приложения: какую неделю мы сейчас просматриваем
let viewDate = new Date();

const TEACHERS = {
    "Математика": "Рауф мэллим", "Английский": "Гюльнар ханым", "Физика": "Севиндж ханым",
    "АДИАК": "Гюльшен ханым", "Программирование": "Физули мэллим", "Информационные технологии": "Милана ханым"
};

const UPPER_CLASSES = [
    ["Лекция", "Семинар", "Лекция"], ["Семинар", "Лабораторная", null],
    ["Лекция", "Семинар", "Лабораторная"], [null, "Лекция", null], [null, "Семинар", null]
];
const LOWER_CLASSES = [
    ["Лекция", "Семинар", "Лекция"], ["Лабораторная", "Семинар", null],
    ["Лекция", "Семинар", null], [null, "Лекция", null], [null, "Семинар", null]
];

const UPPER_CABINET = [
    ["5-504", "3-206", "5-318"], ["1-201", "6-406", "2-310"],
    ["1-520", "6-506", "6-406"], [null, "6-506", null], [null, "3-206", null]
];
const LOWER_CABINET = [
    ["5-504", "3-206", "5-318"], ["5-205", "5-208", "2-310"],
    ["1-520", "6-506", "2-310"], [null, "6-506", null], [null, "3-206", null]
];

const LOWER_WEEK = [
    ["Математика", "Английский", "Физика"], ["Физика", "Физика", "АДИАК"],
    ["Программирование", "Программирование", "АДИАК"], [null, "Информационные технологии", null], [null, "Английский", null]
];
const UPPER_WEEK = [
    ["Математика", "Английский", "Физика"], ["Математика", "Программирование", "АДИАК"],
    ["Программирование", "Информационные технологии", "Информационные технологии"], [null, "Информационные технологии", null], [null, "Английский", null]
];

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
const DAY_CLASSES = ["day-0", "day-1", "day-2", "day-3", "day-4"];
const MONTH_NAMES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

let currentHomeworkKey = "";

// ==========================================
// 2. УТИЛИТЫ
// ==========================================
function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isUpperWeek(date) {
    const anchor = new Date(2026, 8, 15);
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    anchor.setHours(0, 0, 0, 0); current.setHours(0, 0, 0, 0);
    return Math.floor((current - anchor) / (1000 * 60 * 60 * 24 * 7)) % 2 === 0;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function isCurrentWeek(date) {
    const today = new Date();
    const mondayView = getMondayOfWeek(date);
    const mondayToday = getMondayOfWeek(today);
    return mondayView.getTime() === mondayToday.getTime();
}

// ==========================================
// 3. ОТРИСОВКА РАСПИСАНИЯ
// ==========================================
function renderSchedule() {
    const monday = getMondayOfWeek(viewDate);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const isUpper = isUpperWeek(monday);

    const weekData = isUpper ? UPPER_WEEK : LOWER_WEEK;
    const classData = isUpper ? UPPER_CLASSES : LOWER_CLASSES;
    const cabinetData = isUpper ? UPPER_CABINET : LOWER_CABINET;

    // Обновляем заголовок с диапазоном недели
    const rangeText = `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
    document.getElementById("dateRange").textContent = rangeText;

    const weekLabel = document.getElementById("currentWeekLabel");
    if (isCurrentWeek(viewDate)) {
        weekLabel.textContent = "Текущая неделя";
        weekLabel.style.color = "#91b5ff";
    } else {
        weekLabel.textContent = "Выбранная неделя";
        weekLabel.style.color = "#aab5c8";
    }

    document.getElementById("weekTypeDisplay").textContent = isUpper ? "ВЕРХНЯЯ НЕДЕЛЯ" : "НИЖНЯЯ НЕДЕЛЯ";

    // Обновляем состояние кнопки "Сегодня"
    const goTodayBtn = document.getElementById("goToday");
    goTodayBtn.style.opacity = isCurrentWeek(viewDate) ? "0.5" : "1";
    goTodayBtn.style.pointerEvents = isCurrentWeek(viewDate) ? "none" : "auto";

    const scheduleBody = document.getElementById("scheduleBody");
    scheduleBody.innerHTML = "";
    const cellsToFetch = [];

    for (let i = 0; i < 5; i++) {
        const row = document.createElement("tr");
        const dayDate = new Date(monday.getTime() + i * 86400000);

        const dayCell = document.createElement("td");
        dayCell.className = `day-cell ${DAY_CLASSES[i]}`;
        dayCell.innerHTML = `<div class="day-number">${dayDate.getDate()}</div><div class="day-name">${DAY_NAMES[i]}</div>`;
        row.appendChild(dayCell);

        for (let lesson = 0; lesson < 3; lesson++) {
            const subject = weekData[i][lesson];
            const classes = classData[i][lesson];
            const cabinet = cabinetData[i][lesson];
            const cell = document.createElement("td");

            if (subject) {
                const key = `${getDateKey(dayDate)}_${lesson}`;
                cell.innerHTML = `
                    <button class="subject" data-key="${key}" data-subject="${subject}">
                        <span class="subject-name">${subject}</span>
                        ${classes ? `<span class="classes">${classes}</span>` : ""} 
                        <span class="teacher">${TEACHERS[subject]}</span>
                        ${cabinet ? `<span class="cabinet">Каб. ${cabinet}</span>` : ""}
                        <span class="homework-mark">Есть ДЗ</span>
                    </button>`;
                row.appendChild(cell);
                cellsToFetch.push({ key, subject, button: cell.querySelector('.subject'), mark: cell.querySelector('.homework-mark') });
            } else {
                cell.className = "empty"; cell.textContent = "--"; row.appendChild(cell);
            }
        }
        scheduleBody.appendChild(row);
    }
    loadHomeworkData(cellsToFetch);
}

async function loadHomeworkData(cells) {
    if (cells.length === 0) return;
    const promises = cells.map(async (item) => {
        try {
            const docSnap = await getDoc(doc(db, "homework", item.key));
            return { ...item, homework: docSnap.exists() ? docSnap.data().text : "" };
        } catch { return { ...item, homework: "" }; }
    });
    const results = await Promise.all(promises);
    results.forEach(item => {
        if (item.homework) item.mark.style.display = "block";
        item.button.addEventListener("click", () => openHomeworkDialog(item.key, item.subject, item.homework));
    });
}

// ==========================================
// 4. ЛОГИКА ПРЕДУПРЕЖДЕНИЙ
// ==========================================
async function loadWarnings() {
    const container = document.getElementById("warningsContainer");
    container.innerHTML = "Загрузка...";
    try {
        const querySnapshot = await getDocs(collection(db, "warnings"));
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="empty-warnings">Нет активных предупреждений.<br>Нажмите на кнопку ниже, чтобы добавить первое.</div>
            <button class="add-thread-btn" onclick="document.getElementById('warningDialog').showModal()">+ Добавить предупреждение</button>`;
            return;
        }

        container.innerHTML = `<button class="add-thread-btn" onclick="document.getElementById('warningDialog').showModal()">+ Добавить новое предупреждение</button>`;

        querySnapshot.forEach((docSnap) => {
            const studentName = docSnap.id;
            const data = docSnap.data();
            const threads = data.threads || [];

            const block = document.createElement("div");
            block.className = "student-block";

            const header = document.createElement("div");
            header.className = "student-header";
            header.innerHTML = `<span>${studentName}</span><span class="arrow">▼</span>`;

            const content = document.createElement("div");
            content.className = "student-content";

            header.addEventListener("click", () => {
                header.classList.toggle("expanded");
                content.classList.toggle("expanded");
            });

            threads.forEach(thread => {
                const threadDiv = document.createElement("div");
                threadDiv.className = "comment-thread";

                const mainDiv = document.createElement("div");
                mainDiv.className = "comment-main";
                mainDiv.innerHTML = `
                    <div class="comment-text">${escapeHtml(thread.text)}</div>
                    <button class="delete-btn" data-thread-id="${thread.id}">✕</button>
                `;
                threadDiv.appendChild(mainDiv);

                if (thread.replies && thread.replies.length > 0) {
                    thread.replies.forEach(reply => {
                        const replyDiv = document.createElement("div");
                        replyDiv.className = "comment-reply";
                        replyDiv.innerHTML = `
                            <div class="comment-text">${escapeHtml(reply.text)}</div>
                            <button class="delete-btn" data-reply-id="${reply.id}" data-thread-id="${thread.id}">✕</button>
                        `;
                        threadDiv.appendChild(replyDiv);
                    });
                }

                const replyArea = document.createElement("div");
                replyArea.className = "reply-input-area";
                replyArea.innerHTML = `
                    <input type="text" placeholder="Написать ответ..." class="reply-input" data-thread-id="${thread.id}">
                    <button class="reply-send-btn" data-thread-id="${thread.id}">Ответить</button>
                `;
                threadDiv.appendChild(replyArea);
                content.appendChild(threadDiv);
            });

            block.appendChild(header);
            block.appendChild(content);
            container.appendChild(block);
        });

        attachWarningEventListeners();
    } catch (error) {
        console.error("Ошибка загрузки предупреждений:", error);
        container.textContent = "Ошибка загрузки данных.";
    }
}

function attachWarningEventListeners() {
    document.querySelectorAll(".comment-main .delete-btn, .comment-reply .delete-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const isReply = e.target.dataset.replyId !== undefined;
            const threadId = e.target.dataset.threadId;
            const studentName = e.target.closest(".student-block").querySelector(".student-header span").textContent;

            if (!confirm(isReply ? "Удалить этот ответ?" : "Удалить этот тред и все ответы в нем?")) return;

            if (isReply) await deleteReply(studentName, threadId, e.target.dataset.replyId);
            else await deleteThread(studentName, threadId);
        });
    });

    document.querySelectorAll(".reply-send-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const threadId = e.target.dataset.threadId;
            const input = e.target.previousElementSibling;
            const text = input.value.trim();
            if (!text) return;
            const studentName = e.target.closest(".student-block").querySelector(".student-header span").textContent;
            await addReply(studentName, threadId, text);
            input.value = "";
        });
    });

    document.querySelectorAll(".reply-input").forEach(input => {
        input.addEventListener("keypress", async (e) => {
            if (e.key === "Enter") {
                const threadId = e.target.dataset.threadId;
                const text = e.target.value.trim();
                if (!text) return;
                const studentName = e.target.closest(".student-block").querySelector(".student-header span").textContent;
                await addReply(studentName, threadId, text);
                e.target.value = "";
            }
        });
    });
}

async function addReply(studentName, threadId, text) {
    const docRef = doc(db, "warnings", studentName);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const threads = data.threads || [];
        const threadIndex = threads.findIndex(t => t.id === threadId);
        if (threadIndex !== -1) {
            if (!threads[threadIndex].replies) threads[threadIndex].replies = [];
            threads[threadIndex].replies.push({ id: generateId(), text: text });
            await updateDoc(docRef, { threads: threads });
            loadWarnings();
        }
    } catch (error) { alert("Ошибка: " + error.message); }
}

async function deleteThread(studentName, threadId) {
    const docRef = doc(db, "warnings", studentName);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const threads = (data.threads || []).filter(t => t.id !== threadId);
        if (threads.length === 0) await deleteDoc(docRef);
        else await updateDoc(docRef, { threads: threads });
        loadWarnings();
    } catch (error) { alert("Ошибка: " + error.message); }
}

async function deleteReply(studentName, threadId, replyId) {
    const docRef = doc(db, "warnings", studentName);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const threads = data.threads || [];
        const threadIndex = threads.findIndex(t => t.id === threadId);
        if (threadIndex !== -1) {
            threads[threadIndex].replies = (threads[threadIndex].replies || []).filter(r => r.id !== replyId);
            await updateDoc(docRef, { threads: threads });
            loadWarnings();
        }
    } catch (error) { alert("Ошибка: " + error.message); }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 5. ОБРАБОТЧИКИ ДИАЛОГОВ И НАВИГАЦИИ
// ==========================================
function openHomeworkDialog(key, subject, homework) {
    currentHomeworkKey = key;
    document.getElementById("dialogTitle").textContent = `Домашнее задание: ${subject}`;
    document.getElementById("homeworkInput").value = homework;
    document.getElementById("homeworkDialog").showModal();
}

document.getElementById("saveHomework").addEventListener("click", async () => {
    const value = document.getElementById("homeworkInput").value.trim();
    const docRef = doc(db, "homework", currentHomeworkKey);
    try {
        if (value) await setDoc(docRef, { text: value });
        else await deleteDoc(docRef);
        document.getElementById("homeworkDialog").close();
        renderSchedule();
    } catch (error) { alert("Ошибка: " + error.message); }
});

document.getElementById("deleteHomework").addEventListener("click", async () => {
    try {
        await deleteDoc(doc(db, "homework", currentHomeworkKey));
        document.getElementById("homeworkDialog").close();
        renderSchedule();
    } catch (error) { alert("Ошибка: " + error.message); }
});

document.getElementById("closeHomeworkDialog").addEventListener("click", () => {
    document.getElementById("homeworkDialog").close();
});

document.getElementById("saveWarning").addEventListener("click", async () => {
    const name = document.getElementById("studentNameInput").value.trim();
    const text = document.getElementById("warningInput").value.trim();
    if (!name || !text) { alert("Заполните имя и текст!"); return; }

    const docRef = doc(db, "warnings", name);
    try {
        const docSnap = await getDoc(docRef);
        let threads = docSnap.exists() ? (docSnap.data().threads || []) : [];
        threads.unshift({ id: generateId(), text: text, replies: [] });
        await setDoc(docRef, { threads: threads });
        document.getElementById("studentNameInput").value = "";
        document.getElementById("warningInput").value = "";
        document.getElementById("warningDialog").close();
        loadWarnings();
    } catch (error) { alert("Ошибка: " + error.message); }
});

document.getElementById("closeWarningDialog").addEventListener("click", () => {
    document.getElementById("warningDialog").close();
});

// === ЛОГИКА НАВИГАЦИИ ===
document.getElementById("prevWeek").addEventListener("click", () => {
    viewDate.setDate(viewDate.getDate() - 7);
    renderSchedule();
});

document.getElementById("nextWeek").addEventListener("click", () => {
    viewDate.setDate(viewDate.getDate() + 7);
    renderSchedule();
});

document.getElementById("goToday").addEventListener("click", () => {
    viewDate = new Date();
    renderSchedule();
});

// Запуск
loadWarnings();
renderSchedule();