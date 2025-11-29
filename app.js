// SafeGain 健康管理应用 - 主应用逻辑

// 请求持久化存储权限，防止浏览器在空间不足时自动清理
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(granted => {
        if (granted) {
            console.log("Storage will not be cleared except by explicit user action");
        } else {
            console.log("Storage may be cleared by the browser under pressure");
        }
    });
}

// 使用 Dexie.js 创建数据库
const db = new Dexie('SafeGainDB');

// 定义数据库表结构
db.version(1).stores({
    meals: '++id, timestamp, foodName, calories, riskCheck, advice, stomachFeeling, notes, imageBlob',
    workouts: '++id, timestamp, exerciseType, sets, reps, weight, notes',
    weights: '++id, date, weight'
});

// 检查必要的库是否加载
if (typeof Dexie === 'undefined') {
    console.error('Dexie.js 未正确加载');
    alert('应用加载失败，请刷新页面重试');
}

if (typeof Chart === 'undefined') {
    console.error('Chart.js 未正确加载');
    alert('图表库加载失败，请刷新页面重试');
}

if (typeof imageCompression === 'undefined') {
    console.error('browser-image-compression 未正确加载');
    alert('图片压缩库加载失败，请刷新页面重试');
}

// 应用状态管理
const appState = {
    currentImage: null,
    currentAnalysis: null,
    charts: {
        weight: null,
        stomach: null
    }
};

// DOM 元素引用
const elements = {
    // 标签导航
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // 饮食管理
    captureBtn: document.getElementById('capture-btn'),
    fileInput: document.getElementById('file-input'),
    imagePreview: document.getElementById('image-preview'),
    previewImg: document.getElementById('preview-img'),
    analyzeBtn: document.getElementById('analyze-btn'),
    analysisResult: document.getElementById('analysis-result'),
    mealTime: document.getElementById('meal-time'),
    mealNotes: document.getElementById('meal-notes'),
    saveMealBtn: document.getElementById('save-meal-btn'),

    // 运动管理
    exerciseType: document.getElementById('exercise-type'),
    workoutSets: document.getElementById('workout-sets'),
    workoutReps: document.getElementById('workout-reps'),
    workoutWeight: document.getElementById('workout-weight'),
    workoutTime: document.getElementById('workout-time'),
    workoutNotes: document.getElementById('workout-notes'),
    saveWorkoutBtn: document.getElementById('save-workout-btn'),

    // 数据统计
    weightInput: document.getElementById('weight-input'),
    weightDate: document.getElementById('weight-date'),
    saveWeightBtn: document.getElementById('save-weight-btn'),

    // 弹窗
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notification-text'),
    closeNotification: document.getElementById('close-notification'),
    riskAlert: document.getElementById('risk-alert'),
    riskMessage: document.getElementById('risk-message'),
    acknowledgeRisk: document.getElementById('acknowledge-risk'),
    refluxReminder: document.getElementById('reflux-reminder'),
    acknowledgeReminder: document.getElementById('acknowledge-reminder')
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    setDefaultDateTime();
    initializeCharts();
    loadStoredData();
}

// 设置事件监听器
function setupEventListeners() {
    // 标签切换
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 饮食管理事件
    elements.captureBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleImageUpload);
    elements.analyzeBtn.addEventListener('click', analyzeImage);
    elements.saveMealBtn.addEventListener('click', saveMealRecord);

    // 运动管理事件
    elements.saveWorkoutBtn.addEventListener('click', saveWorkoutRecord);

    // 数据统计事件
    elements.saveWeightBtn.addEventListener('click', saveWeightRecord);

    // 弹窗关闭事件
    elements.closeNotification.addEventListener('click', hideNotification);
    elements.acknowledgeRisk.addEventListener('click', hideRiskAlert);
    elements.acknowledgeReminder.addEventListener('click', hideRefluxReminder);

    // 胃部感觉变化事件
    document.querySelectorAll('input[name="stomach-feeling"]').forEach(radio => {
        radio.addEventListener('change', handleStomachFeelingChange);
    });
}

// 设置默认日期时间
function setDefaultDateTime() {
    const now = new Date();
    const dateTimeLocal = now.toISOString().slice(0, 16);
    elements.mealTime.value = dateTimeLocal;
    elements.workoutTime.value = dateTimeLocal;
    elements.weightDate.value = now.toISOString().slice(0, 10);
}

// 标签切换功能
function switchTab(tabName) {
    // 更新按钮状态
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 更新内容显示
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // 如果切换到统计标签，更新图表
    if (tabName === 'stats') {
        updateCharts();
    }
}

// 图片上传处理
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // 压缩图片
        const compressedFile = await compressImage(file);

        // 显示预览
        const reader = new FileReader();
        reader.onload = function (e) {
            elements.previewImg.src = e.target.result;
            elements.imagePreview.style.display = 'block';
            appState.currentImage = compressedFile;
        };
        reader.readAsDataURL(compressedFile);

    } catch (error) {
        showNotification('图片处理失败: ' + error.message, 'error');
    }
}

// 图片压缩功能
async function compressImage(file) {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.error('Image compression error:', error);
        throw error;
    }
}

// AI图片分析
async function analyzeImage() {
    if (!appState.currentImage) {
        showNotification('请先选择图片', 'error');
        return;
    }

    // 显示加载状态
    elements.analyzeBtn.innerHTML = '<span class="loading"></span> 分析中...';
    elements.analyzeBtn.disabled = true;

    try {
        // 转换图片为base64
        const base64Image = await fileToBase64(appState.currentImage);

        // 调用火山引擎API
        const analysisResult = await callVolcanoEngineAPI(base64Image);

        // 解析结果
        const result = JSON.parse(analysisResult);
        appState.currentAnalysis = result;

        // 显示分析结果
        displayAnalysisResult(result);

        // 检查风险
        if (result.risk_check && result.risk_check.includes('高')) {
            showRiskAlert(result.risk_check);
        }

        // 自动填充备注
        if (result.advice) {
            elements.mealNotes.value = result.advice;
        }

    } catch (error) {
        showNotification('分析失败: ' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        elements.analyzeBtn.innerHTML = '<i class="fas fa-microscope"></i> 开始分析';
        elements.analyzeBtn.disabled = false;
    }
}

// 文件转base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// 调用火山引擎API
async function callVolcanoEngineAPI(base64Image) {
    // 检查配置是否已加载
    if (typeof config === 'undefined') {
        throw new Error('配置文件未加载，请检查 config.js 文件是否存在');
    }

    const apiKey = config.volcanoEngine.apiKey;
    const endpointId = config.volcanoEngine.endpointId;
    const url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

    // 验证配置
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error('API密钥未配置，请在 config.js 中设置正确的 apiKey');
    }

    if (!endpointId || endpointId === 'YOUR_ENDPOINT_ID_HERE') {
        throw new Error('接入点ID未配置，请在 config.js 中设置正确的 endpointId');
    }

    const systemPrompt = `
    你是一位专业的临床营养师。用户是一位28岁男性，身高173cm，体重57.5kg（偏瘦，需增重），
    患有【轻微肺气肿】和【巴雷特食管】（Barrett's Esophagus）。
    
    请分析上传的食物图片，输出简短的 JSON 格式（不要Markdown代码块），包含以下字段：
    1. food_name: 食物名称
    2. calories: 预估总热量(kcal)
    3. risk_check: 针对巴雷特食管的风险评估（是否过油、过酸、辛辣、难消化）。
    4. advice: 简短的饮食建议（针对增重和护胃）。
    
    回答要非常简洁，不要废话。
    `;

    const payload = {
        model: endpointId,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '请分析这顿饭。'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                ]
            }
        ],
        stream: false
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// 显示分析结果
function displayAnalysisResult(result) {
    elements.analysisResult.innerHTML = `
        <div class="analysis-content">
            <div class="food-info">
                <h3><i class="fas fa-utensils"></i> ${result.food_name || '未知食物'}</h3>
                <div class="calories-display">
                    <span class="calories-number">${result.calories || 0}</span>
                    <span class="calories-unit">kcal</span>
                </div>
            </div>
            <div class="risk-info ${result.risk_check && result.risk_check.includes('高') ? 'high-risk' : ''}">
                <h4>风险评估</h4>
                <p>${result.risk_check || '暂无风险评估'}</p>
            </div>
            <div class="advice-info">
                <h4>饮食建议</h4>
                <p>${result.advice || '暂无建议'}</p>
            </div>
        </div>
    `;
    elements.analysisResult.style.display = 'block';
}

// 保存饮食记录
async function saveMealRecord() {
    const stomachFeeling = document.querySelector('input[name="stomach-feeling"]:checked');

    if (!stomachFeeling) {
        showNotification('请选择胃部感觉', 'error');
        return;
    }

    const mealRecord = {
        timestamp: new Date(elements.mealTime.value).toISOString(),
        foodName: appState.currentAnalysis?.food_name || '未知食物',
        calories: appState.currentAnalysis?.calories || 0,
        riskCheck: appState.currentAnalysis?.risk_check || '',
        advice: appState.currentAnalysis?.advice || '',
        stomachFeeling: stomachFeeling.value,
        notes: elements.mealNotes.value,
        imageBlob: appState.currentImage
    };

    try {
        await db.meals.add(mealRecord);
        showNotification('饮食记录保存成功', 'success');
        resetMealForm();
    } catch (error) {
        showNotification('保存失败: ' + error.message, 'error');
    }
}

// 胃部感觉变化处理
function handleStomachFeelingChange(event) {
    if (event.target.value === 'reflux') {
        // 如果选择反酸，显示睡眠建议
        setTimeout(() => {
            showRefluxReminder();
        }, 500);
    }
}

// 保存运动记录
async function saveWorkoutRecord() {
    if (!elements.exerciseType.value) {
        showNotification('请选择运动类型', 'error');
        return;
    }

    const workoutRecord = {
        timestamp: new Date(elements.workoutTime.value).toISOString(),
        exerciseType: elements.exerciseType.value,
        sets: parseInt(elements.workoutSets.value),
        reps: parseInt(elements.workoutReps.value),
        weight: parseFloat(elements.workoutWeight.value),
        notes: elements.workoutNotes.value
    };

    try {
        await db.workouts.add(workoutRecord);
        showNotification('运动记录保存成功', 'success');
        resetWorkoutForm();
    } catch (error) {
        showNotification('保存失败: ' + error.message, 'error');
    }
}

// 保存体重记录
async function saveWeightRecord() {
    if (!elements.weightInput.value || !elements.weightDate.value) {
        showNotification('请填写完整的体重信息', 'error');
        return;
    }

    const weightRecord = {
        date: new Date(elements.weightDate.value).toISOString(),
        weight: parseFloat(elements.weightInput.value)
    };

    try {
        await db.weights.add(weightRecord);
        showNotification('体重记录保存成功', 'success');
        resetWeightForm();
        updateCharts();
    } catch (error) {
        showNotification('保存失败: ' + error.message, 'error');
    }
}

// 初始化图表
function initializeCharts() {
    // 体重趋势图
    const weightCtx = document.getElementById('weight-chart').getContext('2d');
    appState.charts.weight = new Chart(weightCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '体重 (kg)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 4
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        callback: function (value) {
                            return value.toFixed(1) + ' kg';
                        }
                    }
                }
            }
        }
    });

    // 胃部感受统计图
    const stomachCtx = document.getElementById('stomach-chart').getContext('2d');
    appState.charts.stomach = new Chart(stomachCtx, {
        type: 'doughnut',
        data: {
            labels: ['舒适', '胀气', '反酸'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 4,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 加载存储的数据
async function loadStoredData() {
    try {
        // 加载体重数据
        const weights = await db.weights.orderBy('date').toArray();
        updateWeightChart(weights);

        // 加载饮食数据
        const meals = await db.meals.toArray();
        updateStomachChart(meals);
    } catch (error) {
        console.error('Error loading stored data:', error);
    }
}

// 更新图表
async function updateCharts() {
    try {
        // 重新加载并更新体重图表
        const weights = await db.weights.orderBy('date').toArray();
        updateWeightChart(weights);

        // 重新加载并更新胃部感受图表
        const meals = await db.meals.toArray();
        updateStomachChart(meals);
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// 更新体重图表
function updateWeightChart(weights) {
    const labels = weights.map(w => {
        const date = new Date(w.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const data = weights.map(w => w.weight);

    // 计算合适的Y轴范围
    let minY = 40;
    let maxY = 80;
    if (data.length > 0) {
        const minWeight = Math.min(...data);
        const maxWeight = Math.max(...data);
        const range = maxWeight - minWeight;
        minY = Math.max(40, minWeight - range * 0.2);
        maxY = minWeight + range * 1.2 + 5;
    }

    appState.charts.weight.data.labels = labels;
    appState.charts.weight.data.datasets[0].data = data;
    appState.charts.weight.options.scales.y.min = minY;
    appState.charts.weight.options.scales.y.max = maxY;
    appState.charts.weight.update();
}

// 更新胃部感受图表
function updateStomachChart(meals) {
    const stomachCounts = {
        comfortable: 0,
        bloating: 0,
        reflux: 0
    };

    meals.forEach(meal => {
        if (stomachCounts.hasOwnProperty(meal.stomachFeeling)) {
            stomachCounts[meal.stomachFeeling]++;
        }
    });

    appState.charts.stomach.data.datasets[0].data = [
        stomachCounts.comfortable,
        stomachCounts.bloating,
        stomachCounts.reflux
    ];
    appState.charts.stomach.update();
}

// 重置表单
function resetMealForm() {
    elements.fileInput.value = '';
    elements.imagePreview.style.display = 'none';
    elements.analysisResult.style.display = 'none';
    elements.mealNotes.value = '';
    document.querySelector('input[name="stomach-feeling"]:checked').checked = false;
    appState.currentImage = null;
    appState.currentAnalysis = null;
    setDefaultDateTime();
}

function resetWorkoutForm() {
    elements.exerciseType.value = '';
    elements.workoutSets.value = '3';
    elements.workoutReps.value = '10';
    elements.workoutWeight.value = '5';
    elements.workoutNotes.value = '';
    setDefaultDateTime();
}

function resetWeightForm() {
    elements.weightInput.value = '';
    elements.weightDate.value = new Date().toISOString().slice(0, 10);
}

// 显示通知
function showNotification(message, type = 'info') {
    elements.notificationText.textContent = message;
    elements.notification.style.display = 'flex';

    // 3秒后自动关闭
    setTimeout(() => {
        hideNotification();
    }, 3000);
}

function hideNotification() {
    elements.notification.style.display = 'none';
}

// 显示风险警告
function showRiskAlert(message) {
    elements.riskMessage.textContent = message;
    elements.riskAlert.style.display = 'flex';
}

function hideRiskAlert() {
    elements.riskAlert.style.display = 'none';
}

// 显示反酸提醒
function showRefluxReminder() {
    elements.refluxReminder.style.display = 'flex';
}

function hideRefluxReminder() {
    elements.refluxReminder.style.display = 'none';
}