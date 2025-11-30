// SafeGain v2.1 Fixed Logic

// 1. 初始化数据库
const db = new Dexie('SafeGainDB');
db.version(1).stores({
    meals: '++id, timestamp, foodName, calories, riskCheck, advice, stomachFeeling, notes, imageBlob',
    workouts: '++id, timestamp, exerciseType, sets, reps, weight, notes',
    weights: '++id, date, weight'
});

// 2. 常量定义
const STORAGE_KEYS = {
    API_KEY: 'safegain_api_key',
    ENDPOINT_ID: 'safegain_endpoint_id',
    USER_PROMPT: 'safegain_user_prompt'
};
const DEFAULT_USER_PROMPT = `用户是一位28岁男性，身高173cm，体重57.5kg（偏瘦，需增重），患有【轻微肺气肿】和【巴雷特食管】（Barrett's Esophagus）。`;
const SYSTEM_INSTRUCTION = `
你是一位专业的临床营养师。
请分析上传的食物图片，输出简短的 JSON 格式（严禁使用Markdown代码块），包含以下字段：
1. food_name: 食物名称 (String)
2. calories: 预估总热量(数字，单位kcal)
3. risk_check: 针对用户健康状况的风险评估（String, 重点评估是否过油、过酸、辛辣、难消化）。
4. advice: 简短的饮食建议（String, 针对增重和护胃）。
回答要非常简洁。
`;

// 3. 应用状态
const appState = {
    currentImage: null,
    charts: { weight: null, stomach: null },
    config: { apiKey: '', endpointId: '', userPrompt: '' }
};

// 4. DOM 元素
const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    contents: document.querySelectorAll('.tab-content'),
    // 饮食
    fileInput: document.getElementById('file-input'),
    captureBtn: document.getElementById('capture-btn'),
    previewImg: document.getElementById('preview-img'),
    imagePreviewContainer: document.getElementById('image-preview'),
    analyzeBtn: document.getElementById('analyze-btn'),
    analysisResult: document.getElementById('analysis-result'),
    mealTime: document.getElementById('meal-time'),
    saveMealBtn: document.getElementById('save-meal-btn'),
    mealNotes: document.getElementById('meal-notes'),
    // 运动
    saveWorkoutBtn: document.getElementById('save-workout-btn'),
    workoutTime: document.getElementById('workout-time'),
    // 统计
    weightInput: document.getElementById('weight-input'),
    weightDate: document.getElementById('weight-date'),
    saveWeightBtn: document.getElementById('save-weight-btn'),
    calendarGrid: document.getElementById('workout-calendar'),
    // 设置
    apiKeyInput: document.getElementById('api-key-input'),
    endpointInput: document.getElementById('endpoint-input'),
    userPromptInput: document.getElementById('user-prompt-input'),
    saveProfileBtn: document.getElementById('save-profile-btn'),
    resetPromptBtn: document.getElementById('reset-prompt-btn'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    // 弹窗
    notification: document.getElementById('notification'),
    riskAlert: document.getElementById('risk-alert'),
    refluxReminder: document.getElementById('reflux-reminder')
};

// 5. 初始化
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log('SafeGain v2.1 Fixed Initializing...');
    loadConfig();

    // 修复：强制设置时间，确保输入框不为空
    setBeijingTimeInputs();

    setupEventListeners();
    await loadStatsData();

    if (!appState.config.apiKey) {
        showTab('profile');
        showNotification('请先在"我的"页面配置 API Key');
    }
}

// --- 核心修复：时间计算 (UTC Offset) ---
function setBeijingTimeInputs() {
    try {
        const d = new Date();
        // 1. 获取当前 UTC 时间戳
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        // 2. 加上北京时间偏移 (UTC+8 = 3600000 * 8 毫秒)
        const beijingDate = new Date(utc + (3600000 * 8));

        // 3. 格式化为 input 需要的字符串
        const year = beijingDate.getFullYear();
        const month = String(beijingDate.getMonth() + 1).padStart(2, '0');
        const day = String(beijingDate.getDate()).padStart(2, '0');
        const hours = String(beijingDate.getHours()).padStart(2, '0');
        const minutes = String(beijingDate.getMinutes()).padStart(2, '0');

        const dateTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
        const dateStr = `${year}-${month}-${day}`;

        // 4. 赋值
        if (elements.mealTime) elements.mealTime.value = dateTimeStr;
        if (elements.workoutTime) elements.workoutTime.value = dateTimeStr;
        if (elements.weightDate) elements.weightDate.value = dateStr;

    } catch (e) {
        console.error("Time set error:", e);
    }
}

// --- 核心修复：渲染逻辑 (V1 样式回归) ---
function renderAnalysisResult(data) {
    const isRisky = data.risk_check && (data.risk_check.includes('高') || data.risk_check.includes('不宜') || data.risk_check.includes('注意'));

    // 使用 V1 风格的 HTML 结构，配合新的 CSS
    elements.analysisResult.innerHTML = `
        <div class="analysis-result-container">
            <div class="food-card">
                <h3><i class="fas fa-utensils"></i> ${data.food_name || '未知食物'}</h3>
                <div class="calories-display">
                    ${data.calories || 0}<span class="calories-unit">kcal</span>
                </div>
            </div>

            <div class="risk-card ${isRisky ? 'high-risk' : ''}">
                <h4><i class="fas fa-shield-alt"></i> 风险评估</h4>
                <p>${data.risk_check || '暂无评估'}</p>
            </div>

            <div class="advice-card">
                <h4><i class="fas fa-leaf"></i> 饮食建议</h4>
                <p>${data.advice || '暂无建议'}</p>
            </div>
        </div>
    `;
    elements.analysisResult.style.display = 'block';
}

// --- 其他逻辑 (保持 V2 不变) ---

function loadConfig() {
    appState.config.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
    appState.config.endpointId = localStorage.getItem(STORAGE_KEYS.ENDPOINT_ID) || '';
    appState.config.userPrompt = localStorage.getItem(STORAGE_KEYS.USER_PROMPT) || DEFAULT_USER_PROMPT;
    elements.apiKeyInput.value = appState.config.apiKey;
    elements.endpointInput.value = appState.config.endpointId;
    elements.userPromptInput.value = appState.config.userPrompt;
}

function saveProfile() {
    const key = elements.apiKeyInput.value.trim();
    const endpoint = elements.endpointInput.value.trim();
    const prompt = elements.userPromptInput.value.trim();
    if (!key || !endpoint) return showNotification('API Key 和 Endpoint 不能为空');
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
    localStorage.setItem(STORAGE_KEYS.ENDPOINT_ID, endpoint);
    localStorage.setItem(STORAGE_KEYS.USER_PROMPT, prompt);
    appState.config.apiKey = key;
    appState.config.endpointId = endpoint;
    appState.config.userPrompt = prompt;
    showNotification('设置已保存');
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1024 });
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.previewImg.src = e.target.result;
            elements.imagePreviewContainer.style.display = 'block';
            appState.currentImage = compressed;
        };
        reader.readAsDataURL(compressed);
    } catch (err) { showNotification('图片处理出错'); }
}

async function analyzeFood() {
    if (!appState.currentImage || !appState.config.apiKey) {
        showNotification(appState.config.apiKey ? '请先选择图片' : '请先配置 API');
        return;
    }
    elements.analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    elements.analyzeBtn.disabled = true;

    try {
        const base64 = await fileToBase64(appState.currentImage);
        const systemContent = SYSTEM_INSTRUCTION;
        const userContent = `【当前用户信息】：\n${appState.config.userPrompt}\n\n请分析这张图片。`;

        const resultJson = await callLLM(base64, systemContent, userContent);
        renderAnalysisResult(resultJson);

        if (resultJson.advice) elements.mealNotes.value = resultJson.advice;
        if (resultJson.risk_check && (resultJson.risk_check.includes('高') || resultJson.risk_check.includes('不宜'))) {
            document.getElementById('risk-message').textContent = resultJson.risk_check;
            elements.riskAlert.style.display = 'flex';
        }
    } catch (err) {
        console.error(err);
        showNotification('分析失败，请检查网络或 Key');
    } finally {
        elements.analyzeBtn.innerHTML = '<i class="fas fa-microscope"></i> 开始 AI 分析';
        elements.analyzeBtn.disabled = false;
    }
}

async function callLLM(base64, systemPrompt, userText) {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.config.apiKey}` },
        body: JSON.stringify({
            model: appState.config.endpointId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }] }
            ]
        })
    });
    if (!response.ok) throw new Error(`API Error ${response.status}`);
    const data = await response.json();
    const content = data.choices[0].message.content;
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
}

// 数据库操作
async function saveMeal() {
    const feeling = document.querySelector('input[name="stomach-feeling"]:checked');
    if (!feeling) return showNotification('请选择胃部感觉');
    await db.meals.add({
        timestamp: new Date(elements.mealTime.value).toISOString(),
        foodName: appState.currentImage ? 'AI分析餐食' : '手动记录',
        stomachFeeling: feeling.value,
        notes: elements.mealNotes.value
    });
    showNotification('记录已保存');
    resetForm('diet');
    if (feeling.value === 'reflux') elements.refluxReminder.style.display = 'flex';
}

async function saveWorkout() {
    const type = document.getElementById('exercise-type').value;
    if (!type) return showNotification('请选择运动类型');
    await db.workouts.add({
        timestamp: new Date(elements.workoutTime.value).toISOString(),
        exerciseType: type,
        sets: document.getElementById('workout-sets').value,
        notes: document.getElementById('workout-notes').value
    });
    showNotification('打卡成功！');
    resetForm('workout');
    loadStatsData();
}

async function saveWeight() {
    const val = elements.weightInput.value;
    if (!val) return;
    await db.weights.add({ date: elements.weightDate.value, weight: parseFloat(val) });
    showNotification('体重已记录');
    loadStatsData();
}

// 统计与日历
async function loadStatsData() {
    // 日历
    const now = new Date();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
    const startOfMonth = new Date(now.getFullYear(), currentMonth, 1).toISOString();
    const workouts = await db.workouts.where('timestamp').above(startOfMonth).toArray();
    const workoutDays = new Set(workouts.map(w => new Date(w.timestamp).getDate()));

    let calendarHtml = '';
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === now.getDate();
        const hasWorkout = workoutDays.has(i);
        calendarHtml += `<div class="calendar-day ${isToday ? 'today' : ''} ${hasWorkout ? 'has-workout' : ''}">${i}</div>`;
    }
    if (elements.calendarGrid) elements.calendarGrid.innerHTML = calendarHtml;

    // 图表
    const weights = await db.weights.orderBy('date').reverse().limit(7).toArray();
    weights.reverse();
    if (appState.charts.weight) appState.charts.weight.destroy();
    if (document.getElementById('weight-chart')) {
        const ctx = document.getElementById('weight-chart').getContext('2d');
        appState.charts.weight = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weights.map(w => w.date.slice(5)),
                datasets: [{ label: '体重 (kg)', data: weights.map(w => w.weight), borderColor: '#536dfe', tension: 0.4 }]
            }
        });
    }
}

// 工具
function setupEventListeners() {
    elements.tabs.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
    elements.captureBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleImageUpload);
    elements.analyzeBtn.addEventListener('click', analyzeFood);
    elements.saveMealBtn.addEventListener('click', saveMeal);
    elements.saveWorkoutBtn.addEventListener('click', saveWorkout);
    elements.saveWeightBtn.addEventListener('click', saveWeight);
    elements.saveProfileBtn.addEventListener('click', saveProfile);
    elements.resetPromptBtn.addEventListener('click', () => elements.userPromptInput.value = DEFAULT_USER_PROMPT);
    elements.toggleApiKey.addEventListener('click', () => {
        elements.apiKeyInput.type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('risk-alert').addEventListener('click', (e) => {
        if (e.target.id === 'risk-alert' || e.target.id === 'acknowledge-risk') document.getElementById('risk-alert').style.display = 'none';
    });
    document.getElementById('reflux-reminder').addEventListener('click', () => document.getElementById('reflux-reminder').style.display = 'none');
}

function showTab(tabId) {
    elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    elements.contents.forEach(c => c.classList.toggle('active', c.id === `${tabId}-tab`));
    if (tabId === 'stats') loadStatsData();
}

function showNotification(msg, time = 3000) {
    document.getElementById('notification-text').textContent = msg;
    elements.notification.style.display = 'block';
    setTimeout(() => elements.notification.style.display = 'none', time);
}

function resetForm(type) {
    if (type === 'diet') {
        elements.imagePreviewContainer.style.display = 'none';
        elements.analysisResult.style.display = 'none';
        elements.fileInput.value = '';
        elements.mealNotes.value = '';
        appState.currentImage = null;
    }
    setBeijingTimeInputs();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}