// 获取DOM元素
const tabs = document.querySelectorAll('[data-tab]');
const tabContents = document.querySelectorAll('.tab-content');
const currentTimeEl = document.getElementById('current-time');
const stopwatchDisplayEl = document.getElementById('stopwatch-display');
const stopwatchStartBtn = document.getElementById('start-stopwatch');
const stopwatchPauseBtn = document.getElementById('pause-stopwatch');
const stopwatchResetBtn = document.getElementById('reset-stopwatch');
const stopwatchLapBtn = document.getElementById('lap-stopwatch');
const stopwatchLapsEl = document.getElementById('stopwatch-laps');
const timerInputEl = document.getElementById('timer-input');
const timerValueEl = document.getElementById('timer-value');
const timerDisplayEl = document.getElementById('timer-display');
const timerAdjustmentEl = document.getElementById('timer-adjustment');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const adjustmentInputEl = document.getElementById('adjustment-input');
const adjustTimerBtn = document.getElementById('adjust-timer');
const adjustmentHistoryEl = document.getElementById('adjustment-history');
const notificationEl = document.getElementById('notification');
const themeOptions = document.querySelectorAll('[data-theme]');
const colorOptions = document.querySelectorAll('[data-color]');
const fontSizeSmallBtn = document.getElementById('font-size-small');
const fontSizeMediumBtn = document.getElementById('font-size-medium');
const fontSizeLargeBtn = document.getElementById('font-size-large');
const fontTypeBtns = document.querySelectorAll('.font-type');
const fullscreenBtn = document.getElementById('fullscreen-toggle');

// 评估系统元素
const evaluationModal = document.getElementById('evaluation-modal');
const evaluationResult = document.getElementById('evaluation-result');
const originalTimeEl = document.getElementById('original-time');
const adjustmentTimeEl = document.getElementById('adjustment-time');
const adjustmentCountEl = document.getElementById('adjustment-count');
const evaluationCloseBtn = document.getElementById('evaluation-close');

// 状态变量
let stopwatchInterval = null;
let stopwatchTime = 0;
let stopwatchState = 'stopped'; // stopped, running, paused
let timerInterval = null;
let timerTime = 0;
let initialTimerTime = 0;
let timerState = 'stopped'; // stopped, running, paused
let timerAdjustment = 0;
let adjustmentHistory = [];
let laps = [];

// 初始化
function init() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    updateLunarSecond(); // 初始化农历计数法秒数
    setupEventListeners();

    // 使用Web Worker确保计时器在后台运行
    initBackgroundTimers();
}

// 更新农历计数法秒数
function updateLunarSecond() {
    const lunarDateEl = document.getElementById('lunar-date');
    if (lunarDateEl) {
        // 将毫秒转换为秒数
        const seconds = Math.floor(timerTime / 1000);
        const lunarText = getLunarSecond(seconds);
        // 用方框框起农历计数法
        lunarDateEl.textContent = `【${lunarText}】`;
    }
}

// 初始化后台计时器
function initBackgroundTimers() {
    // 创建倒计时Web Worker
    const timerWorkerCode = `
        let timerIntervalId = null;
        let timerTime = 0;
        let timerState = 'stopped';

        self.addEventListener('message', function(e) {
            const { type, data } = e.data;

            switch(type) {
                case 'start':
                    if (!timerIntervalId && data.time > 0) {
                        timerTime = data.time;
                        timerState = 'running';

                        timerIntervalId = setInterval(() => {
                            timerTime -= 100;

                            if (timerTime <= 0) {
                                timerTime = 0;
                                clearInterval(timerIntervalId);
                                timerIntervalId = null;
                                timerState = 'stopped';

                                self.postMessage({
                                    type: 'finished'
                                });

                                // 显示倒计时评估
                                showTimerEvaluation();
                            }

                            self.postMessage({
                                type: 'update',
                                time: timerTime
                            });
                        }, 100);
                    }
                    break;

                case 'pause':
                    if (timerIntervalId) {
                        clearInterval(timerIntervalId);
                        timerIntervalId = null;
                        timerState = 'paused';
                    }
                    break;

                case 'reset':
                    if (timerIntervalId) {
                        clearInterval(timerIntervalId);
                        timerIntervalId = null;
                    }
                    timerTime = 0;
                    timerState = 'stopped';
                    self.postMessage({
                        type: 'update',
                        time: 0
                    });
                    break;

                case 'adjust':
                    if (timerState === 'running' || timerState === 'paused') {
                        timerTime += data.adjustment;
                        self.postMessage({
                            type: 'update',
                            time: timerTime
                        });
                    }
                    break;
            }
        });
    `;

    const timerWorkerBlob = new Blob([timerWorkerCode], { type: 'application/javascript' });
    const timerWorkerUrl = URL.createObjectURL(timerWorkerBlob);
    window.timerWorker = new Worker(timerWorkerUrl);

    // 处理来自计时器Worker的消息
    window.timerWorker.addEventListener('message', function(e) {
        const { type, time } = e.data;

        switch(type) {
            case 'update':
                timerTime = time;
                timerValueEl.textContent = formatTime(timerTime);
                updateTimerDisplayColor();
                updateLunarSecond(); // 更新农历计数法秒数
                break;

            case 'finished':
                timerState = 'stopped';
                showNotification('倒计时结束！', 5000);

                // 播放提示音
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
                audio.play();
                
                // 显示倒计时评估
                showTimerEvaluation();
                break;
        }
    });

    // 创建秒表Web Worker
    const stopwatchWorkerCode = `
        let stopwatchIntervalId = null;
        let stopwatchTime = 0;
        let stopwatchState = 'stopped';

        self.addEventListener('message', function(e) {
            const { type } = e.data;

            switch(type) {
                case 'start':
                    if (!stopwatchIntervalId) {
                        stopwatchState = 'running';

                        stopwatchIntervalId = setInterval(() => {
                            stopwatchTime += 10;

                            self.postMessage({
                                type: 'update',
                                time: stopwatchTime
                            });
                        }, 10);
                    }
                    break;

                case 'pause':
                    if (stopwatchIntervalId) {
                        clearInterval(stopwatchIntervalId);
                        stopwatchIntervalId = null;
                        stopwatchState = 'paused';
                    }
                    break;

                case 'reset':
                    if (stopwatchIntervalId) {
                        clearInterval(stopwatchIntervalId);
                        stopwatchIntervalId = null;
                    }
                    stopwatchTime = 0;
                    stopwatchState = 'stopped';
                    self.postMessage({
                        type: 'update',
                        time: 0
                    });
                    break;

                case 'lap':
                    if (stopwatchState === 'running') {
                        self.postMessage({
                            type: 'lap',
                            time: stopwatchTime
                        });
                    }
                    break;
            }
        });
    `;

    const stopwatchWorkerBlob = new Blob([stopwatchWorkerCode], { type: 'application/javascript' });
    const stopwatchWorkerUrl = URL.createObjectURL(stopwatchWorkerBlob);
    window.stopwatchWorker = new Worker(stopwatchWorkerUrl);

    // 处理来自秒表Worker的消息
    window.stopwatchWorker.addEventListener('message', function(e) {
        const { type, time } = e.data;

        switch(type) {
            case 'update':
                stopwatchTime = time;
                stopwatchDisplayEl.textContent = formatTime(stopwatchTime);
                break;

            case 'lap':
                addLap(stopwatchTime);
                break;
        }
    });
}

// 更新当前时间
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
}

// 获取农历计数法秒数
function getLunarSecond(seconds) {
    // 定义数字对应的汉字
    const digits = {
        0: '零',
        1: '一',
        2: '二',
        3: '三',
        4: '四',
        5: '五',
        6: '六',
        7: '七',
        8: '八',
        9: '九',
        10: '十'
    };
    
    // 定义十位数的特殊表示
    const tens = {
        1: '十',
        2: '廿',
        3: '卅',
        4: '卌',
        5: '圩',
        6: '圆',
        7: '进',
        8: '枯',
        9: '枠'
    };
    
    // 定义整十的特殊表示
    const exactTens = {
        1: '十',
        2: '二十',
        3: '三十',
        4: '四十',
        5: '五十',
        6: '六十',
        7: '七十',
        8: '八十',
        9: '九十'
    };
    
    // 定义百位数的特殊表示
    const hundreds = {
        1: '百',
        2: '皕',
        3: '藠',
        4: '肆',
        5: '伍',
        6: '陆',
        7: '柒',
        8: '捌',
        9: '玖'
    };
    
    if (seconds === 0) return digits[0];
    
    let result = '';
    
    // 对于大数字使用科学计数法表示
    if (seconds >= 1000) {
        // 检查是否超过时间上限 (1x10^8s)
        if (seconds > 1e8) {
            return "NAN:NAN:NAN";
        }
        
        let exponent = 0;
        let mantissa = seconds;

        // 计算指数和尾数
        while (mantissa >= 10) {
            mantissa /= 10;
            exponent++;
        }
        
        // 保存原始指数用于余数计算
        const originalExponent = exponent;

        // 科学计数法表示
        let scientificNotation = '';

        // 处理尾数部分
        if (mantissa >= 1 && mantissa < 10) {
            const integerPart = Math.floor(mantissa);
            // 不保留小数部分，只使用整数部分
            scientificNotation = integerPart + 'x10^' + exponent;
            
            // 计算余数：总秒数减去科学计数法表示的部分
            const scientificValue = integerPart * Math.pow(10, exponent);
            remainder = seconds - scientificValue;
        }

        // 处理小数部分
        // 余数已经在上面计算过了
        if (remainder === 0) {
            scientificNotation += '+零'; // 整数情况
        } else if (remainder < 10) {
            // 如果余数小于10，使用数字映射
            scientificNotation += '+' + digits[remainder];
        } else {
            // 处理小数部分
            let fractionStr = '';

            // 获取小数部分的位数
            const fractionDigits = exponent;
            let fraction = remainder;

            // 处理千位数及以上
            if (fraction >= 1000) {
                const thousandsDigit = Math.floor(fraction / 1000);
                fractionStr += thousandsDigit + 'k';
                fraction %= 1000;
                
                // 处理完千位数后，如果还有余数，不需要额外添加"零"
                // 继续处理百位、十位和个位数
            }

            // 处理百位数
            if (fraction >= 100) {
                const hundredsDigit = Math.floor(fraction / 100);
                // 使用特殊字符表示百位数
                if (hundreds[hundredsDigit]) {
                    fractionStr += hundreds[hundredsDigit];
                } else {
                    fractionStr += digits[hundredsDigit] + '百';
                }
                fraction %= 100;

                // 如果有余数且不是整百数，需要添加"零"
                if (fraction > 0 && fraction < 10) {
                    fractionStr += digits[0];
                }
                
                // 如果余数为0，但不是整千，添加"零"
                if (fraction === 0 && fractionStr !== '' && !fractionStr.endsWith('k')) {
                    fractionStr += digits[0];
                } else if (fraction === 0 && fractionStr.endsWith('k')) {
                    // 如果余数为0，且是整千，不添加"零"
                    // 例如：2000显示为"2k"而不是"2k零"
                }
            }

            // 处理十位数
            if (fraction >= 10) {
                const tensDigit = Math.floor(fraction / 10);
                const unitsDigit = fraction % 10;

                // 如果是整十（如20、30等），使用exactTens
                if (unitsDigit === 0) {
                    fractionStr += exactTens[tensDigit] || digits[tensDigit] + '十';
                } else {
                    // 非整十，使用tens
                    fractionStr += tens[tensDigit] || digits[tensDigit] + '十';
                }
                fraction %= 10;
            }

            // 处理个位数
            if (fraction > 0) {
                // 如果结果为空（即只有个位数），则使用"初"前缀
                if (fractionStr === '') {
                    fractionStr = '初' + digits[fraction];
                } else {
                    // 如果前面有千位数表示（如"2k"），直接添加个位数
                    fractionStr += digits[fraction];
                }
            }

            // 特殊处理某些数字
            if (remainder === 10) {  // 当余数为10时，表示农历中的"初十"
                fractionStr = '初十';
            } else if (remainder === 100) {  // 当余数为100时，表示农历中的"百"
                fractionStr = '百';
            } else if (remainder === 1000) {  // 当余数为1000时，表示农历中的"零"
                fractionStr = '零';
            }

            scientificNotation += '+' + fractionStr;
        }

        return scientificNotation;
    }
    
    // 处理百位数
    if (seconds >= 100) {
        const hundredsDigit = Math.floor(seconds / 100);
        if (hundreds[hundredsDigit]) {
            result += hundreds[hundredsDigit];
        } else {
            result += digits[hundredsDigit] + '百';
        }
        seconds %= 100;
        
        // 如果有余数且不是整百数，需要添加"零"
        if (seconds > 0 && seconds < 10) {
            result += digits[0];
        }
    }
    
    // 处理十位数
    if (seconds >= 10) {
        const tensDigit = Math.floor(seconds / 10);
        const unitsDigit = seconds % 10;
        
        // 如果是整十（如20、30等），使用exactTens
        if (unitsDigit === 0) {
            if (exactTens[tensDigit]) {
                result += exactTens[tensDigit];
            } else {
                result += digits[tensDigit] + '十';
            }
        } else {
            // 非整十，使用tens
            if (tens[tensDigit]) {
                result += tens[tensDigit];
            } else {
                result += digits[tensDigit] + '十';
            }
        }
        seconds %= 10;
    }
    
    // 处理个位数
    if (seconds > 0) {
        // 如果结果为空（即只有个位数），则使用"初"前缀
        if (result === '') {
            result = '初' + digits[seconds];
        } else {
            result += digits[seconds];
        }
    }
    
    return result || digits[0];
}

// 格式化时间显示
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    
    // 检查是否超过时间上限 (1x10^8s)
    if (totalSeconds > 1e8) {
        return "NAN:NAN:NAN";
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `[${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
}

// 解析倒计时输入
function parseTimerInput(input) {
    const regex = /(\d+)\s*(小时|hour|hrs|h|分钟|minute|min|m|秒钟|second|sec|s)/gi;
    let totalMs = 0;
    let match;

    while ((match = regex.exec(input)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        if (unit.includes('h')) {
            totalMs += value * 60 * 60 * 1000;
        } else if (unit.includes('m')) {
            totalMs += value * 60 * 1000;
        } else if (unit.includes('s')) {
            totalMs += value * 1000;
        }
    }

    return totalMs > 0 ? totalMs : null;
}

// 解析时间调整输入
function parseAdjustmentInput(input) {
    // 检查是否以+或-开头
    if (!input.startsWith('+') && !input.startsWith('-')) {
        return null;
    }

    const sign = input.startsWith('+') ? 1 : -1;
    const value = parseTimerInput(input.substring(1));

    return value ? sign * value : null;
}

// 更新倒计时显示颜色
function updateTimerDisplayColor() {
    const percentage = timerTime / initialTimerTime;

    if (percentage <= 0.1) {
        timerDisplayEl.classList.add('danger');
        timerDisplayEl.classList.remove('warning', 'success');
    } else if (percentage <= 0.3) {
        timerDisplayEl.classList.add('warning');
        timerDisplayEl.classList.remove('danger', 'success');
    } else if (percentage <= 0.75) {
        timerDisplayEl.classList.add('success');
        timerDisplayEl.classList.remove('warning', 'danger');
    } else {
        timerDisplayEl.classList.remove('warning', 'danger', 'success');
    }
}

// 更新调整历史
function updateAdjustmentHistory() {
    adjustmentHistoryEl.innerHTML = '';

    adjustmentHistory.slice(0, 5).forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'adjustment-history-item';
        historyItem.innerHTML = `
            <span class="time">${item.time}</span>
            <span class="value ${item.value > 0 ? 'positive' : 'negative'}">${item.display}</span>
        `;
        adjustmentHistoryEl.appendChild(historyItem);
    });
}

// 添加计次
function addLap(time) {
    const lapTime = formatTime(time);
    const lapItem = document.createElement('div');
    lapItem.className = 'lap-item';
    lapItem.textContent = lapTime;
    stopwatchLapsEl.insertBefore(lapItem, stopwatchLapsEl.firstChild);
    laps.unshift(time);
}

// 显示通知
function showNotification(message, duration = 3000) {
    notificationEl.textContent = message;
    notificationEl.classList.add('show');

    setTimeout(() => {
        notificationEl.classList.remove('show');
    }, duration);
}

// 显示倒计时评估
function showTimerEvaluation() {
    // 计算统计数据
    const adjustmentCount = adjustmentHistory.length;
    const adjustmentMs = adjustmentHistory.reduce((total, item) => total + item.value, 0);

    // 格式化时间
    const formatTimeForStats = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // 更新统计数据
    originalTimeEl.textContent = formatTimeForStats(initialTimerTime);
    adjustmentTimeEl.textContent = adjustmentMs >= 0 ? `+${formatTimeForStats(adjustmentMs)}` : formatTimeForStats(adjustmentMs);
    adjustmentCountEl.textContent = adjustmentCount;

    // 根据倒计时时长生成不同的评价
    const durationMinutes = Math.floor(initialTimerTime / 60000);
    const durationHours = Math.floor(initialTimerTime / 3600000);
    const durationDays = Math.floor(initialTimerTime / 86400000);
    
    let durationDescription = '';
    let durationEncouragement = '';
    
    if (initialTimerTime < 60000) {
        durationDescription = "不到一分钟";
        durationEncouragement = "即使是短暂的倒计时也能帮助我们集中注意力！";
    } else if (initialTimerTime < 3600000) {
        durationDescription = `${durationMinutes}分钟`;
        durationEncouragement = "专注的每一分钟都是迈向成功的基石！";
    } else if (initialTimerTime < 86400000) {
        durationDescription = `${durationHours}小时`;
        durationEncouragement = "长时间的专注展现了惊人的毅力，你真了不起！";
    } else {
        durationDescription = `${durationDays}天`;
        durationEncouragement = "如此长久的坚持令人敬佩，你的自律精神值得学习！";
    }
    
    // 随机选择一个结束语
    const endings = [
        "现在是时候稍作休息，然后继续前进！",
        "恭喜完成目标！你值得一个奖励。",
        "任务完成！现在是时候庆祝一下了。",
        "你做到了！这种成就感一定很棒。",
        "目标达成！记住这种感觉，下次也能做到。"
    ];
    
    // 生成评估结果
    let evaluationText = '';
    if (adjustmentCount === 0) {
        evaluationText = `完美！您在${durationDescription}的倒计时中没有进行任何时间调整，时间管理能力出色！${durationEncouragement}`;
    } else if (adjustmentCount <= 2) {
        evaluationText = `很好！您在${durationDescription}的倒计时中进行了少量调整，时间把握较为准确。${durationEncouragement}`;
    } else if (adjustmentCount <= 5) {
        evaluationText = `还不错。您在${durationDescription}的倒计时中进行了一些时间调整，下次可以更精确地预估时间。${durationEncouragement}`;
    } else {
        evaluationText = `需要改进。您在${durationDescription}的倒计时中进行了多次时间调整，建议在设置倒计时前更仔细地规划时间。${durationEncouragement}`;
    }

    // 添加额外评价
    if (Math.abs(adjustmentMs) < initialTimerTime * 0.1) {
        evaluationText += ' 您的时间调整幅度很小，说明您对时间的感知很准确！';
    } else if (Math.abs(adjustmentMs) > initialTimerTime * 0.5) {
        evaluationText += ' 您的时间调整幅度较大，建议在规划时间时留出更多缓冲。';
    }
    
    // 添加随机结束语
    evaluationText += ` ${endings[Math.floor(Math.random() * endings.length)]}`;

    evaluationResult.textContent = evaluationText;

    // 显示评估弹窗
    evaluationModal.classList.add('show');
}

// 关闭评估弹窗
if (evaluationCloseBtn) {
    evaluationCloseBtn.addEventListener('click', () => {
        evaluationModal.classList.remove('show');
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 标签页切换
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');

            // 切换标签页激活状态
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 切换内容显示
            tabContents.forEach(content => {
                if (content.id === tabId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            // 全屏模式下处理标签页切换
            if (document.fullscreenElement) {
                if (tabId === 'timer') {
                    document.body.classList.add('fullscreen-mode');
                } else {
                    document.body.classList.remove('fullscreen-mode');
                }
            }
        });
    });

    // 秒表控制
    stopwatchStartBtn.addEventListener('click', () => {
        if (stopwatchState !== 'running') {
            stopwatchState = 'running';
            window.stopwatchWorker.postMessage({
                type: 'start'
            });
            showNotification('秒表已开始');
        }
    });

    stopwatchPauseBtn.addEventListener('click', () => {
        if (stopwatchState === 'running') {
            stopwatchState = 'paused';
            window.stopwatchWorker.postMessage({
                type: 'pause'
            });
            showNotification('秒表已暂停');
        }
    });

    stopwatchResetBtn.addEventListener('click', () => {
        stopwatchState = 'stopped';
        window.stopwatchWorker.postMessage({
            type: 'reset'
        });
        stopwatchLapsEl.innerHTML = '';
        laps = [];
        showNotification('秒表已重置');
    });

    stopwatchLapBtn.addEventListener('click', () => {
        if (stopwatchState === 'running') {
            window.stopwatchWorker.postMessage({
                type: 'lap'
            });
        }
    });

    // 倒计时控制
    document.getElementById('set-timer').addEventListener('click', () => {
        const timeMs = parseTimerInput(timerInputEl.value);

        if (!timeMs) {
            showNotification('请输入有效的时间格式');
            return;
        }

        timerTime = timeMs;
        initialTimerTime = timeMs;
        timerAdjustment = 0;
        adjustmentHistory = [];

        timerValueEl.textContent = formatTime(timerTime);
        updateTimerDisplayColor();
        timerAdjustmentEl.textContent = '';
        timerAdjustmentEl.className = 'timer-adjustment';
        updateAdjustmentHistory();

        showNotification('倒计时已设置');
    });

    startTimerBtn.addEventListener('click', () => {
        if (timerState === 'running' || timerTime <= 0) return;

        timerState = 'running';
        window.timerWorker.postMessage({
            type: 'start',
            data: {
                time: timerTime
            }
        });

        showNotification('倒计时已开始');
    });

    pauseTimerBtn.addEventListener('click', () => {
        if (timerState !== 'running') return;

        timerState = 'paused';
        window.timerWorker.postMessage({
            type: 'pause'
        });

        showNotification('倒计时已暂停');
    });

    resetTimerBtn.addEventListener('click', () => {
        timerState = 'stopped';
        window.timerWorker.postMessage({
            type: 'reset'
        });

        timerTime = 0;
        timerAdjustmentEl.textContent = '';
        timerAdjustmentEl.className = 'timer-adjustment';

        showNotification('倒计时已重置');
    });

    // 调整时间
    const adjustTimer = () => {
        const adjustmentMs = parseAdjustmentInput(adjustmentInputEl.value);

        if (!adjustmentMs) {
            showNotification('请输入有效的时间调整格式');
            return;
        }

        timerTime += adjustmentMs;
        initialTimerTime += adjustmentMs;
        timerAdjustment += adjustmentMs;

        // 显示调整
        const sign = adjustmentMs > 0 ? '+' : '';
        const absMs = Math.abs(adjustmentMs);
        let displayText = '';

        if (absMs >= 3600000) {
            displayText = `${sign}${absMs / 3600000}h`;
        } else if (absMs >= 60000) {
            displayText = `${sign}${absMs / 60000}min`;
        } else {
            displayText = `${sign}${absMs / 1000}s`;
        }

        timerAdjustmentEl.textContent = displayText;
        timerAdjustmentEl.className = adjustmentMs > 0 ? 'timer-adjustment positive' : 'timer-adjustment negative';

        // 更新显示
        timerValueEl.textContent = formatTime(timerTime);
        updateTimerDisplayColor();

        // 添加到历史记录
        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        adjustmentHistory.unshift({
            time: timeString,
            value: adjustmentMs,
            display: displayText
        });

        updateAdjustmentHistory();

        // 清空输入
        adjustmentInputEl.value = '';

        showNotification(`时间已调整 ${displayText}`);

        // 如果计时器正在运行，向Worker发送调整
        if (timerState === 'running') {
            window.timerWorker.postMessage({
                type: 'adjust',
                data: {
                    adjustment: adjustmentMs
                }
            });
        }
    };

    // 按钮点击事件
    adjustTimerBtn.addEventListener('click', adjustTimer);

    // 回车键事件
    adjustmentInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adjustTimer();
        }
    });

    // 主题设置
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            document.body.setAttribute('data-theme', theme);
            showNotification(`主题已切换为${theme === 'light' ? '浅色' : '深色'}模式`);
        });
    });

    // 颜色设置
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            const color = option.getAttribute('data-color');
            document.body.setAttribute('data-color', color);

            // 更新选中状态
            colorOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            showNotification(`主题颜色已更改`);
        });
    });

    // 字体大小设置
    fontSizeSmallBtn.addEventListener('click', () => {
        currentTimeEl.style.fontSize = '2.5rem';
        stopwatchDisplayEl.style.fontSize = '2.5rem';
        timerValueEl.style.fontSize = '2.5rem';

        showNotification('字体大小已设置为小');
    });

    fontSizeMediumBtn.addEventListener('click', () => {
        currentTimeEl.style.fontSize = '4rem';
        stopwatchDisplayEl.style.fontSize = '4rem';
        timerValueEl.style.fontSize = '4rem';

        showNotification('字体大小已设置为中');
    });

    fontSizeLargeBtn.addEventListener('click', () => {
        currentTimeEl.style.fontSize = '5.5rem';
        stopwatchDisplayEl.style.fontSize = '5.5rem';
        timerValueEl.style.fontSize = '5.5rem';

        showNotification('字体大小已设置为大');
    });

    // 字体类型设置
    fontTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const fontType = btn.getAttribute('data-font');

            // 更新选中状态
            fontTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 应用字体
            if (fontType === 'pixel') {
                document.body.style.fontFamily = '"汉仪像素 11pxU", "Yu Gothic Light", "Yu Gothic Ul Light", sans-serif';
                showNotification('字体已设置为汉仪像素');
            } else {
                document.body.style.fontFamily = '"Yu Gothic Light", "Yu Gothic Ul Light", sans-serif';
                showNotification('字体已设置为默认');
            }
        });
    });

    // 全屏切换
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showNotification(`无法进入全屏模式: ${err.message}`);
            });
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';

            // 如果当前在倒计时标签页，则应用全屏模式样式
            const timerTab = document.querySelector('[data-tab="timer"]');
            if (timerTab && timerTab.classList.contains('active')) {
                document.body.classList.add('fullscreen-mode');
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                document.body.classList.remove('fullscreen-mode');
            }
        }
    });

    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen-mode');
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        } else {
            // 如果当前在倒计时标签页，则应用全屏模式样式
            const timerTab = document.querySelector('[data-tab="timer"]');
            if (timerTab && timerTab.classList.contains('active')) {
                document.body.classList.add('fullscreen-mode');
            }
        }
    });
}

// 启动应用
init();
