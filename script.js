// ======================= MODULE IMPORTS =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ======================= FIREBASE CONFIG =======================
const firebaseConfig = {
    apiKey: "AIzaSyAB8sqasKb-HPTAmyw7OuN4ePMWq1eRynw",
    authDomain: "zyra-ai-e13e7.firebaseapp.com",
    projectId: "zyra-ai-e13e7",
    storageBucket: "zyra-ai-e13e7.firebasestorage.app",
    messagingSenderId: "808181148702",
    appId: "1:808181148702:web:389cff95a9efb4a728120f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ======================= GLOBAL VARIABLES =======================
let user, userName = "there", currentChatId = null, chatMessages = [];
let recognition = null, isRecording = false;

const greetings = [
    "Ready to dive in? 😎",
    "What’s on your mind today? 🤔",
    "Let’s build something amazing! 🚀",
    "Ask me anything! 💡"
];

const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatList = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");
const profileCircle = document.getElementById("profileCircle");
const profilePanel = document.getElementById("profilePanel");
const userProfileInput = document.getElementById("userProfileInput");
const saveProfile = document.getElementById("saveProfile");
const micBtn = document.getElementById("micBtn");
const sidebar = document.getElementById("sidebar");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const userInfo = document.getElementById("userInfo");
const darkModeTogglePanel = document.getElementById("darkModeTogglePanel");
const searchChats = document.getElementById("searchChats");
const langSelect = document.getElementById("language") || { value: "en-US" };

// ======================= DARK MODE =======================
if (darkModeTogglePanel) {
    darkModeTogglePanel.onclick = () => {
        document.body.classList.toggle("dark-mode");
        sidebar.classList.toggle("dark-mode");
        chatBox.classList.toggle("dark-mode");
    };
}

// ======================= AI TEXT FORMATTER =======================
function formatAIText(text, forVoice = false) {
    // sanitize
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // bold and italic formatting
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    safeText = safeText.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // headings
    safeText = safeText.replace(/^###\s*(.*)$/gm, '<h4>$1</h4>');
    safeText = safeText.replace(/^##\s*(.*)$/gm, '<h3>$1</h3>');

    // remove formatting for voice
    if (forVoice) safeText = safeText.replace(/(\*|<[^>]*>)/g, '');

    // split into lines
    const lines = safeText.split("\n");
    let html = "", inUL = false;

    lines.forEach(line => {
        line = line.trim();
        if (line.match(/^(\-|\*|\•)\s+/)) {
            if (!inUL) { html += "<ul>"; inUL = true; }
            html += `<li>${line.replace(/^(\-|\*|\•)\s+/, '')}</li>`;
        } else if (line.match(/^\d+\.\s+/)) {
            if (!inUL) { html += "<ol>"; inUL = true; }
            html += `<li>${line.replace(/^\d+\.\s+/, '')}</li>`;
        } else {
            if (inUL) { html += inUL ? "</ul>" : ""; inUL = false; }
            if (line) html += `<p>${line}</p>`;
        }
    });

    if (inUL) html += "</ul>";

    // emojis replacement
    return html.replace(/:smile:/g, '😊')
               .replace(/:sad:/g, '😢')
               .replace(/:laugh:/g, '😂')
               .replace(/:angry:/g, '😡')
               .replace(/:love:/g, '❤️')
               .replace(/:think:/g, '🤔');
}

// ======================= WELCOME SCREEN =======================
function showWelcomeScreen() {
    chatBox.innerHTML = `<div id="welcomeScreen">
        <h3>Hey ${userName} 👋</h3>
        <p>${greetings[Math.floor(Math.random() * greetings.length)]}</p>
    </div>`;
}

// ======================= ADD MESSAGE =======================
function addMessage(role, text, isCode = false, forVoice = false) {
    const div = document.createElement("div");
    div.className = "message " + role;

    if (isCode) {
        const parts = text.split(/```/);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                if (parts[i].trim()) parts[i].split(/\n\n+/).forEach(p => {
                    div.innerHTML += `<p>${p.replace(/\n/g, '<br>')}</p>`;
                });
            } else {
                const codeHtml = `<pre class="aiCode"><code>${parts[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>
                <button class="copyCodeBtn">Copy</button></pre>`;
                div.innerHTML += codeHtml;
            }
        }
    } else {
        let emoji = role === "assistant" ? "🤖" : "👤";
        div.innerHTML = `<span class="messageIcon">${emoji}</span>${formatAIText(text, forVoice)}`;
    }

    chatBox.prepend(div);

    // copy code buttons
    div.querySelectorAll(".copyCodeBtn").forEach(btn => {
        btn.onclick = () => {
            const code = btn.previousElementSibling?.textContent || btn.parentElement.textContent;
            navigator.clipboard.writeText(code.trim());
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 1500);
        };
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

// ======================= AUTH =======================
onAuthStateChanged(auth, async u => {
    if (!u) location.replace("sign.html");
    user = u;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        if (snap.data().name) userName = snap.data().name;
        if (snap.data().profile) userProfileInput.value = snap.data().profile;
        if (snap.data().dob) userInfo.innerHTML = `Name: ${snap.data().name}<br>DOB: ${snap.data().dob}`;
        else userInfo.innerHTML = `Name: ${snap.data().name}<br>DOB: Not set`;
    }
    if (profileCircle) profileCircle.textContent = userName.charAt(0).toUpperCase();
    showWelcomeScreen();
    loadChats();
});

// ======================= EVENTS =======================
if (newChatBtn) newChatBtn.onclick = () => { currentChatId = null; chatMessages = []; showWelcomeScreen(); };
if (profileCircle) profileCircle.onclick = () => { profilePanel.style.display = profilePanel.style.display === "flex" ? "none" : "flex"; };
if (editProfileBtn) editProfileBtn.onclick = () => {
    const parts = userInfo.innerText.split("\n");
    const namePart = parts[0].replace("Name: ", "").trim();
    const dobPart = parts[1].replace("DOB: ", "").trim();
    const newName = prompt("Edit Name:", namePart);
    const newDOB = prompt("Edit DOB:", dobPart);
    if (newName && newDOB) {
        userInfo.innerHTML = `Name: ${newName}<br>DOB: ${newDOB}`;
        userName = newName;
        profileCircle.textContent = userName.charAt(0).toUpperCase();
        updateDoc(doc(db, "users", user.uid), { name: newName, dob: newDOB });
    }
};
if (saveProfile) saveProfile.onclick = async () => {
    await updateDoc(doc(db, "users", user.uid), { profile: userProfileInput.value });
    alert("Profile saved! ✅");
};
if (hamburgerBtn && sidebar) hamburgerBtn.onclick = () => { sidebar.classList.toggle("active"); };

// ======================= SEARCH CHATS =======================
if (searchChats) {
    searchChats.addEventListener("input", () => {
        const query = searchChats.value.toLowerCase();
        document.querySelectorAll("#chatList .chatItem").forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(query) ? "flex" : "none";
        });
    });
}

// ======================= LOAD CHATS =======================
async function loadChats() {
    if (!chatList) return;
    chatList.innerHTML = "";
    const snap = await getDocs(query(collection(db, "users", user.uid, "chats"), orderBy("createdAt", "desc")));
    snap.forEach(d => {
        const div = document.createElement("div");
        div.className = "chatItem";
        div.innerHTML = `<span><i class="bi bi-chat-dots-fill"></i> ${d.data().title || "New Chat"}</span>
        <span class="chatOptions"><i class="bi bi-three-dots"></i></span>
        <div class="chatPopup">
            <input type="text" placeholder="Rename chat..." class="renameInput"/>
            <button class="renameChat"><i class="bi bi-check-lg"></i> Save</button>
            <button class="deleteChat"><i class="bi bi-trash-fill"></i> Delete</button>
            <button class="closeMenu"><i class="bi bi-x-circle-fill"></i> Close</button>
        </div>`;
        const popup = div.querySelector(".chatPopup");
        div.querySelector(".chatOptions").onclick = e => {
            e.stopPropagation();
            document.querySelectorAll(".chatPopup").forEach(p => p.style.display = "none");
            popup.style.display = popup.style.display === "flex" ? "none" : "flex";
            popup.style.flexDirection = "column";
        };
        popup.querySelector(".deleteChat").onclick = async e => {
            e.stopPropagation();
            if (confirm("Delete this chat?")) {
                await deleteDoc(doc(db, "users", user.uid, "chats", d.id));
                loadChats();
                if (currentChatId === d.id) { chatBox.innerHTML = ""; currentChatId = null; chatMessages = []; }
            }
        };
        popup.querySelector(".renameChat").onclick = async e => {
            e.stopPropagation();
            const val = popup.querySelector(".renameInput").value.trim();
            if (val) { await updateDoc(doc(db, "users", user.uid, "chats", d.id), { title: val }); loadChats(); }
        };
        popup.querySelector(".closeMenu").onclick = e => { e.stopPropagation(); popup.style.display = "none"; };
        div.onclick = () => openChat(d.id);
        chatList.appendChild(div);
    });
}

// ======================= OPEN CHAT =======================
async function openChat(chatId) {
    currentChatId = chatId; chatMessages = []; chatBox.innerHTML = "";
    const snap = await getDocs(query(collection(db, "users", user.uid, "chats", chatId, "messages"), orderBy("createdAt")));
    snap.forEach(d => {
        addMessage(d.data().role, d.data().content);
        chatMessages.push({ role: d.data().role, content: d.data().content });
    });
}

// ======================= SEND MESSAGE =======================
const API_KEY = "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";
const creatorQuestions = ["who made you","who created you","creator","who is your creator","who developed you","who built you",
    "who programmed you","who designed you","your maker","your developer","made by","created by","developed by","who is behind you",
    "who's your creator","who's your maker","who coded you","who wrote you","origin","author","author of you","programmer",
    "designer","who invented you","who is your inventor","who is your programmer","who is your designer","who is your author"];

async function sendMessage(textOverride = null, fromVoice = false) {
    const text = textOverride || userInput.value.trim(); if (!text) return; userInput.value = "";
    if (document.getElementById("welcomeScreen")) chatBox.innerHTML = "";
    addMessage("user", text); chatMessages.push({ role: "user", content: text });

    if (!currentChatId) {
        const chatRef = await addDoc(collection(db, "users", user.uid, "chats"), { title: text.slice(0, 20) + "...", createdAt: serverTimestamp() });
        currentChatId = chatRef.id; loadChats();
    }

    const msgCol = collection(db, "users", user.uid, "chats", currentChatId, "messages");
    await addDoc(msgCol, { role: "user", content: text, createdAt: serverTimestamp() });

    let reply = "", isCode = false;
    const lcText = text.toLowerCase();

    if (creatorQuestions.some(q => lcText.includes(q))) { reply = "I am Zyra AI 🤖 made by Bhavya Tamboli!"; }
    else {
        try {
            const messages = [{ role: "system", content: "Professional AI assistant with profile: " + userProfileInput.value }, ...chatMessages];
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": "Bearer " + API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages })
            });
            const data = await res.json();
            reply = data?.choices?.[0]?.message?.content || "Something went wrong! 😓";
            if (reply.includes("```")) isCode = true;
        } catch (e) { console.error(e); reply = "Oops! I ran into an error 😢"; }
    }

    addMessage("assistant", reply, isCode, fromVoice);
    chatMessages.push({ role: "assistant", content: reply });
    await addDoc(msgCol, { role: "assistant", content: reply, createdAt: serverTimestamp() });

    if (fromVoice) {
        const u = new SpeechSynthesisUtterance(reply.replace(/<[^>]*>/g, ""));
        u.lang = langSelect.value || "en-US";
        speechSynthesis.speak(u);
    }
}

if (sendBtn) sendBtn.onclick = () => sendMessage();
if (userInput) userInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

// ======================= VOICE CHAT =======================
function initSpeechRecognition() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) { alert("Use Chrome/Edge for voice 😎"); return null; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = langSelect.value; r.interimResults = true; r.continuous = false;

    r.onstart = () => { userInput.placeholder = "Listening... speak now 🎙️"; };
    r.onresult = event => { userInput.value = Array.from(event.results).map(res => res[0].transcript).join(""); };
    r.onerror = err => { if (err.error !== "no-speech") console.error("Speech error:", err.error); };
    r.onend = () => { isRecording = false; micBtn.style.background = "#1a73e8"; if (userInput.value.trim() != "") sendMessage(userInput.value, true); };
    return r;
}

if (micBtn) {
    micBtn.onclick = () => {
        speechSynthesis.cancel();
        if (!recognition) recognition = initSpeechRecognition(); if (!recognition) return;
        if (!isRecording) { recognition.start(); isRecording = true; micBtn.style.background = "#e73370"; }
        else recognition.stop();
    };
}
