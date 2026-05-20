// ==UserScript==
// @name         GGS Tools
// @namespace    http://tampermonkey.net/
// @version      2.7.4.2
// @description  Тулза для сообщений в GGSel
// @author       XaviersDev
// @match        https://seller.ggsel.com/messages*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==



(function() {
    'use strict';

    
    const defaultData = {
        isFirstClickDone: false,
        templates: [
            { id: 1, title: 'Привет', text: 'Здравствуйте, (ник)! Чем могу помочь?' },
            { id: 2, title: 'Выдача', text: 'Ваш товар готов, (ник). Спасибо за покупку, ждём вас снова!' }
        ],
        settings: {
            position: 'top',
            style: 'glass',
            size: 14,
            opacity: 0.7,
            textColor: '#00ffcc',
            bgColor: '#141414',
            autoSend: false 
        }
    };

    let appData = GM_getValue('ggs1_tools_data', defaultData);
    if (appData.settings.autoSend === undefined) appData.settings.autoSend = false;

    const saveData = () => GM_setValue('ggs1_tools_data', appData);

    let currentEditId = null; 

    
    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    
    function setReactInputValue(inputElement, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(inputElement, value);
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function getBuyerName() {
        try {
            const nameEl = document.querySelector('.styles_headerInfo__jj8f0 .styles_username__37KmO');
            if (nameEl) return nameEl.childNodes[0].textContent.trim();
        } catch (e) {}
        return "Покупатель";
    }

    
    const svgNoise = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`;

    
    GM_addStyle(`
        /* Кнопка в хедере (Справа от колокольчика) */
        .ggs-header-btn {
            background: transparent; border: none; font-weight: 900; cursor: pointer;
            font-size: 18px; margin: 0 15px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            letter-spacing: 0.5px; outline: none; z-index: 100; font-family: 'Unbounded', sans-serif;
        }
        .ggs-header-btn.fp-mode { color: #a200ff; text-shadow: 0 0 12px rgba(162,0,255,0.4); }
        .ggs-header-btn.fp-mode:hover { color: #d066ff; text-shadow: 0 0 20px rgba(208,102,255,0.9); transform: scale(1.05); }
        .ggs-header-btn.ggs-mode { color: #00ffcc; text-shadow: 0 0 12px rgba(0,255,204,0.4); }
        .ggs-header-btn.ggs-mode:hover { color: #00ffff; text-shadow: 0 0 20px rgba(0,255,255,0.9); transform: scale(1.05); }

        /* ЭПИЧНЫЕ АНИМАЦИИ */
        @keyframes ggsEpicShake {
            0% { transform: translate(2px, 2px) rotate(0deg) scale(1.2); }
            20% { transform: translate(-3px, -2px) rotate(-3deg) scale(1.3); }
            40% { transform: translate(3px, -4px) rotate(3deg) scale(1.4); }
            60% { transform: translate(-3px, 2px) rotate(-3deg) scale(1.5); }
            80% { transform: translate(2px, 3px) rotate(3deg) scale(1.4); }
            100% { transform: translate(-2px, -2px) rotate(0deg) scale(1.2); }
        }
        @keyframes ggsExplode {
            0% { transform: scale(1); filter: hue-rotate(0deg) brightness(1); }
            50% { transform: scale(1.6); filter: hue-rotate(180deg) brightness(2); text-shadow: 0 0 50px red; color: #ff0055;}
            100% { transform: scale(1); filter: hue-rotate(360deg) brightness(1); }
        }
        .ggs-anim-1 { animation: ggsEpicShake 0.1s infinite; color: #ff0055 !important; text-shadow: 0 0 20px #ff0055 !important; font-size: 20px !important; }
        .ggs-anim-2 { animation: ggsEpicShake 0.05s infinite, ggsExplode 0.4s infinite; color: #ff0000 !important; text-shadow: 0 0 40px #ff0000 !important; font-size: 26px !important; text-transform: uppercase; }

        /* ПЛАВАЮЩЕЕ МОДАЛЬНОЕ ОКНО */
        #ggs-modal-wrapper {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999; display: none; opacity: 0; transition: opacity 0.3s ease;
        }
        #ggs-modal-wrapper.show { opacity: 1; display: block; }

        #ggs-modal {
            width: 850px; height: 580px; background: #141414; border: 1px solid #333;
            border-radius: 16px; display: flex; overflow: hidden; color: #eee;
            box-shadow: 0 25px 60px rgba(0,0,0,0.7); font-family: 'Inter', sans-serif;
            position: relative;
        }

        /* ЗОНА ПЕРЕТАСКИВАНИЯ (Драг-зона) */
        .ggs-drag-zone {
            position: absolute; top: 0; left: 0; width: 100%; height: 30px;
            cursor: move; z-index: 5; background: transparent;
        }
        /* Меняем курсор на краях */
        #ggs-modal::before {
            content: ''; position: absolute; inset: 0; border: 10px solid transparent;
            cursor: move; pointer-events: none; z-index: 100;
        }

        .ggs-close-btn {
            position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.05);
            border: none; color: #888; width: 32px; height: 32px; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: 0.2s; z-index: 20;
        }
        .ggs-close-btn:hover { background: #ff4d4f; color: #fff; transform: rotate(90deg); }
        .ggs-close-btn svg { width: 16px; height: 16px; fill: currentColor; }

        .ggs-sidebar { width: 240px; background: #0f0f0f; border-right: 1px solid #2a2a2a; padding: 35px 0 20px; z-index: 10; position: relative; }
        .ggs-sidebar-header { padding: 0 25px 20px; font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 0.5px; }
        .ggs-sidebar-btn {
            width: 100%; padding: 15px 25px; background: transparent; border: none;
            color: #888; text-align: left; font-size: 15px; font-weight: 500; cursor: pointer; transition: 0.2s;
        }
        .ggs-sidebar-btn:hover { color: #fff; background: rgba(255,255,255,0.02); }
        .ggs-sidebar-btn.active { color: #00ffcc; background: rgba(0,255,204,0.05); border-right: 3px solid #00ffcc; }

        .ggs-content { flex: 1; padding: 40px 30px 30px; overflow-y: auto; position: relative; z-index: 10; }
        .ggs-tab-content { display: none; animation: ggsFadeIn 0.3s ease; }
        .ggs-tab-content.active { display: block; }
        @keyframes ggsFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        h2.ggs-title { margin: 0 0 5px 0; font-size: 24px; color: #fff; font-weight: 800; }
        p.ggs-subtitle { color: #888; font-size: 13px; margin: 0 0 20px 0; }

        .ggs-input, .ggs-textarea {
            width: 100%; background: #0a0a0a; border: 1px solid #333; color: #fff;
            padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; outline: none;
            font-family: inherit; font-size: 14px; transition: 0.2s;
        }
        .ggs-input:focus, .ggs-textarea:focus { border-color: #00ffcc; box-shadow: 0 0 0 2px rgba(0,255,204,0.1); }
        .ggs-textarea { resize: vertical; min-height: 80px; }

        .ggs-btn {
            background: #00ffcc; color: #000; border: none; padding: 12px 20px;
            border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; transition: 0.2s;
        }
        .ggs-btn:hover { background: #00d2ff; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,255,204,0.3); }
        .ggs-btn:active { transform: translateY(0); }
        .ggs-btn-danger { background: rgba(255,77,79,0.1); color: #ff4d4f; padding: 8px 12px; font-size: 12px;}
        .ggs-btn-danger:hover { background: #ff4d4f; color: #fff; }
        .ggs-btn-edit { background: rgba(255,204,0,0.1); color: #ffcc00; padding: 8px 12px; font-size: 12px; margin-right: 5px;}
        .ggs-btn-edit:hover { background: #ffcc00; color: #000; }

        .ggs-tpl-item {
            background: #111; border: 1px solid #2a2a2a; border-radius: 12px;
            padding: 15px 20px; margin-bottom: 12px; display: flex; justify-content: space-between;
            align-items: center; transition: 0.2s;
        }
        .ggs-tpl-item:hover { border-color: #444; }
        .ggs-tpl-info h4 { margin: 0 0 5px 0; color: #fff; font-size: 16px; font-weight: 600; }
        .ggs-tpl-info p { margin: 0; color: #777; font-size: 13px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Элементы настроек */
        .ggs-control-group { margin-bottom: 25px; }
        .ggs-control-label { display: block; font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

        .ggs-radio-row { display: flex; gap: 10px; }
        .ggs-radio-btn {
            flex: 1; padding: 10px; text-align: center; background: #0a0a0a; border: 1px solid #333;
            border-radius: 8px; cursor: pointer; color: #888; font-size: 14px; font-weight: 500; transition: 0.2s;
        }
        .ggs-radio-btn:hover { background: #1a1a1a; border-color: #555; }
        .ggs-radio-btn.active { background: rgba(0,255,204,0.1); border-color: #00ffcc; color: #00ffcc; }

        .ggs-color-row { display: flex; gap: 15px; align-items: center; }
        .ggs-color-picker { -webkit-appearance: none; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; background: none; padding: 0; }
        .ggs-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
        .ggs-color-picker::-webkit-color-swatch { border: 1px solid #444; border-radius: 8px; }

        .ggs-slider-container { display: flex; align-items: center; gap: 15px; }
        .ggs-slider { flex: 1; -webkit-appearance: none; height: 6px; background: #333; border-radius: 3px; outline: none; }
        .ggs-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #00ffcc; cursor: pointer; transition: 0.2s; }
        .ggs-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .ggs-slider-val { width: 40px; text-align: right; color: #00ffcc; font-weight: 700; }

        /* Переключатель Авто-отправки */
        .ggs-switch-wrapper { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 20px; }
        .ggs-switch { position: relative; width: 40px; height: 20px; background: #333; border-radius: 10px; transition: 0.3s; }
        .ggs-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: 0.3s; }
        .ggs-switch.on { background: #00ffcc; }
        .ggs-switch.on::after { left: 22px; background: #000; }

        /* --- БИНДЫ В ЧАТЕ --- */
        .ggs-binds-container { display: flex; gap: 10px; flex-wrap: wrap; z-index: 10; margin: 0 0 10px 0; }
        .ggs-pos-top { margin-bottom: 12px; width: 100%; order: -1; }
        .ggs-pos-bottom { margin-top: 12px; width: 100%; order: 3; }
        .ggs-pos-left { flex-direction: column; margin-right: 12px; margin-bottom: 0; width: auto; order: -1; }
        .ggs-pos-right { flex-direction: column; margin-left: 12px; margin-bottom: 0; width: auto; order: 3; }
        .ggs-flex-row-hack { display: flex !important; flex-direction: row !important; align-items: flex-end; width: 100%; }

        .ggs-chat-bind {
            cursor: pointer; outline: none; white-space: nowrap; font-family: 'Inter', sans-serif;
            transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); position: relative;
        }
        .ggs-chat-bind:hover { transform: translateY(-2px); filter: brightness(1.2); }
        .ggs-chat-bind:active { transform: translateY(1px) scale(0.98); filter: brightness(0.9); }

        /* TOOLTIP (Предпросмотр) */
        .ggs-chat-bind::after {
            content: attr(data-preview);
            position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%) translateY(10px);
            background: rgba(10, 10, 10, 0.9); color: #fff;
            padding: 10px 14px; border-radius: 8px;
            font-size: 13px; font-weight: 300; letter-spacing: 0.3px; line-height: 1.4;
            white-space: pre-wrap; width: max-content; max-width: 320px; text-align: center;
            opacity: 0; pointer-events: none; transition: all 0.2s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 1000;
        }
        .ggs-chat-bind:hover::after { opacity: 1; transform: translateX(-50%) translateY(0); }
    `);

    
    function injectHeaderButton() {
        if (document.getElementById('ggs-main-btn')) return;

        const notifBtn = document.querySelector('a.styles_notification__w0Bwt');
        if (!notifBtn) return;

        const btn = document.createElement('button');
        btn.id = 'ggs-main-btn';
        btn.className = `ggs-header-btn ${appData.isFirstClickDone ? 'ggs-mode' : 'fp-mode'}`;
        btn.innerText = appData.isFirstClickDone ? 'GGS Tools' : 'FP Tools';

        btn.onclick = () => {
            if (!appData.isFirstClickDone) {
                
                btn.style.pointerEvents = 'none';
                btn.classList.add('ggs-anim-1');
                btn.innerText = "какой нахуй фп";

                setTimeout(() => {
                    btn.classList.replace('ggs-anim-1', 'ggs-anim-2');
                    btn.innerText = "ггсел тулс блять";

                    setTimeout(() => {
                        btn.classList.remove('ggs-anim-2');
                        btn.className = 'ggs-header-btn ggs-mode';
                        btn.innerText = "GGS Tools";
                        appData.isFirstClickDone = true;
                        saveData();

                        setTimeout(() => {
                            btn.style.pointerEvents = 'auto';
                            openModal();
                        }, 500);
                    }, 2000);
                }, 2000);
            } else {
                openModal();
            }
        };

        
        if (notifBtn.nextSibling) {
            notifBtn.parentNode.insertBefore(btn, notifBtn.nextSibling);
        } else {
            notifBtn.parentNode.appendChild(btn);
        }
    }

    
    function createModalUI() {
        if (document.getElementById('ggs-modal-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'ggs-modal-wrapper';
        wrapper.innerHTML = `
            <div id="ggs-modal">
                <div class="ggs-drag-zone"></div>
                <button class="ggs-close-btn" id="ggs-close-btn">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
                <div class="ggs-sidebar">
                    <div class="ggs-sidebar-header">GGS Tools</div>
                    <button class="ggs-sidebar-btn active" data-tab="tab-templates">📋 Шаблоны</button>
                    <button class="ggs-sidebar-btn" data-tab="tab-settings">🎨 Настройки вида</button>
                </div>
                <div class="ggs-content">

                    <!-- ВКЛАДКА: ШАБЛОНЫ -->
                    <div id="tab-templates" class="ggs-tab-content active">
                        <h2 class="ggs-title">Шаблоны быстрых ответов</h2>
                        <p class="ggs-subtitle">Используйте <b>(ник)</b> в тексте для автоматической подстановки.</p>

                        <div style="margin-bottom: 25px; background: rgba(255,255,255,0.02); padding: 20px; border-radius: 12px; border: 1px solid #2a2a2a;">
                            <input type="text" id="ggs-new-tpl-title" class="ggs-input" placeholder="Название кнопки (напр. Привет)">
                            <textarea id="ggs-new-tpl-text" class="ggs-textarea" placeholder="Здравствуйте, (ник)!"></textarea>
                            <div style="display:flex; gap:10px;">
                                <button class="ggs-btn" id="ggs-add-tpl-btn" style="flex:1;">+ Добавить шаблон</button>
                                <button class="ggs-btn ggs-btn-danger" id="ggs-cancel-edit-btn" style="display:none;">Отмена</button>
                            </div>
                        </div>
                        <div id="ggs-tpl-list"></div>
                    </div>

                    <!-- ВКЛАДКА: НАСТРОЙКИ ВИДА -->
                    <div id="tab-settings" class="ggs-tab-content">
                        <h2 class="ggs-title">ВНЕШНИЙ ВИД</h2>
                        <p class="ggs-subtitle">Изменения видны сразу</p>

                        <div class="ggs-switch-wrapper" id="ggs-autosend-toggle">
                            <div class="ggs-switch ${appData.settings.autoSend ? 'on' : ''}"></div>
                            <span style="color:#fff; font-weight:600;">Отправлять при нажатии</span>
                        </div>

                        <div class="ggs-control-group">
                            <span class="ggs-control-label">Расположение кнопок</span>
                            <div class="ggs-radio-row" id="group-pos">
                                <div class="ggs-radio-btn ${appData.settings.position === 'top' ? 'active' : ''}" data-val="top">Сверху</div>
                                <div class="ggs-radio-btn ${appData.settings.position === 'bottom' ? 'active' : ''}" data-val="bottom">Снизу</div>
                                <div class="ggs-radio-btn ${appData.settings.position === 'left' ? 'active' : ''}" data-val="left">Слева</div>
                                <div class="ggs-radio-btn ${appData.settings.position === 'right' ? 'active' : ''}" data-val="right">Справа</div>
                            </div>
                        </div>

                        <div class="ggs-control-group">
                            <span class="ggs-control-label">Стиль кнопок</span>
                            <div class="ggs-radio-row" id="group-style">
                                <div class="ggs-radio-btn ${appData.settings.style === 'solid' ? 'active' : ''}" data-val="solid">Заливка</div>
                                <div class="ggs-radio-btn ${appData.settings.style === 'outline' ? 'active' : ''}" data-val="outline">Обводка</div>
                                <div class="ggs-radio-btn ${appData.settings.style === 'glass' ? 'active' : ''}" data-val="glass">Стекло</div>
                            </div>
                        </div>

                        <div class="ggs-control-group">
                            <span class="ggs-control-label">Цвета</span>
                            <div class="ggs-color-row">
                                <input type="color" id="ggs-set-color" class="ggs-color-picker" value="${appData.settings.textColor}">
                                <span style="color:#aaa; font-size:13px; margin-right:15px;">Текст/Рамка</span>

                                <input type="color" id="ggs-set-bg" class="ggs-color-picker" value="${appData.settings.bgColor}">
                                <span style="color:#aaa; font-size:13px;">Фон</span>
                            </div>
                        </div>

                        <div class="ggs-control-group">
                            <span class="ggs-control-label">Прозрачность фона</span>
                            <div class="ggs-slider-container">
                                <input type="range" id="ggs-set-opacity" class="ggs-slider" min="0" max="1" step="0.05" value="${appData.settings.opacity}">
                                <span class="ggs-slider-val" id="val-opacity">${appData.settings.opacity}</span>
                            </div>
                        </div>

                        <div class="ggs-control-group">
                            <span class="ggs-control-label">Размер</span>
                            <div class="ggs-slider-container">
                                <input type="range" id="ggs-set-size" class="ggs-slider" min="10" max="24" step="1" value="${appData.settings.size}">
                                <span class="ggs-slider-val" id="val-size">${appData.settings.size}px</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);

        
        const modal = document.getElementById('ggs-modal');
        let isDragging = false, dragX = 0, dragY = 0;

        modal.addEventListener('mousedown', (e) => {
            
            if (e.target.closest('button, input, textarea, .ggs-radio-btn, .ggs-switch-wrapper')) return;
            isDragging = true;
            
            if (wrapper.style.transform !== 'none') {
                const rect = wrapper.getBoundingClientRect();
                wrapper.style.transform = 'none';
                wrapper.style.left = rect.left + 'px';
                wrapper.style.top = rect.top + 'px';
            }
            dragX = e.clientX - wrapper.offsetLeft;
            dragY = e.clientY - wrapper.offsetTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            wrapper.style.left = (e.clientX - dragX) + 'px';
            wrapper.style.top = (e.clientY - dragY) + 'px';
        });
        document.addEventListener('mouseup', () => isDragging = false);

        
        document.getElementById('ggs-close-btn').onclick = () => {
            wrapper.classList.remove('show');
            setTimeout(() => wrapper.style.display='none', 300);
        };

        
        const shiftModal = (toCorner) => {
            wrapper.style.transform = 'none';
            if (toCorner) {
                wrapper.style.top = '30px';
                wrapper.style.left = 'calc(100vw - 880px)'; 
            } else {
                wrapper.style.top = '50%';
                wrapper.style.left = '50%';
                wrapper.style.transform = 'translate(-50%, -50%)';
            }
        };

        document.querySelectorAll('.ggs-sidebar-btn[data-tab]').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.ggs-sidebar-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ggs-tab-content').forEach(c => c.classList.remove('active'));
                const targetBtn = e.target.closest('.ggs-sidebar-btn');
                targetBtn.classList.add('active');
                const tabId = targetBtn.dataset.tab;
                document.getElementById(tabId).classList.add('active');

                
                shiftModal(tabId === 'tab-settings');
            };
        });

        
        const titleInput = document.getElementById('ggs-new-tpl-title');
        const textInput = document.getElementById('ggs-new-tpl-text');
        const addBtn = document.getElementById('ggs-add-tpl-btn');
        const cancelBtn = document.getElementById('ggs-cancel-edit-btn');

        const resetForm = () => {
            titleInput.value = ''; textInput.value = '';
            currentEditId = null;
            addBtn.innerHTML = '+ Добавить шаблон';
            addBtn.style.background = '#00ffcc';
            cancelBtn.style.display = 'none';
        };

        addBtn.onclick = () => {
            const title = titleInput.value.trim();
            const text = textInput.value.trim();
            if(!title || !text) return;

            if (currentEditId) {
                
                const tpl = appData.templates.find(t => t.id === currentEditId);
                if(tpl) { tpl.title = title; tpl.text = text; }
            } else {
                
                appData.templates.push({ id: Date.now(), title, text });
            }

            saveData();
            resetForm();
            renderTemplatesList();
            renderChatBinds();
        };

        cancelBtn.onclick = resetForm;

        
        const updateSetting = (key, val) => {
            appData.settings[key] = val;
            saveData();
            renderChatBinds();
        };

        
        const autoSendToggle = document.getElementById('ggs-autosend-toggle');
        const switchEl = autoSendToggle.querySelector('.ggs-switch');
        autoSendToggle.onclick = () => {
            const newState = !appData.settings.autoSend;
            appData.settings.autoSend = newState;
            if(newState) switchEl.classList.add('on');
            else switchEl.classList.remove('on');
            saveData();
        };

        
        document.querySelectorAll('.ggs-radio-btn').forEach(btn => {
            btn.onclick = (e) => {
                const target = e.target;
                const parent = target.parentElement;
                parent.querySelectorAll('.ggs-radio-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                if (parent.id === 'group-pos') updateSetting('position', target.dataset.val);
                if (parent.id === 'group-style') updateSetting('style', target.dataset.val);
            };
        });

        
        document.getElementById('ggs-set-color').oninput = (e) => updateSetting('textColor', e.target.value);
        document.getElementById('ggs-set-bg').oninput = (e) => updateSetting('bgColor', e.target.value);

        
        document.getElementById('ggs-set-opacity').oninput = (e) => {
            document.getElementById('val-opacity').innerText = e.target.value;
            updateSetting('opacity', e.target.value);
        };
        document.getElementById('ggs-set-size').oninput = (e) => {
            document.getElementById('val-size').innerText = e.target.value + 'px';
            updateSetting('size', e.target.value);
        };
    }

    function openModal() {
        createModalUI();
        renderTemplatesList();
        const wrapper = document.getElementById('ggs-modal-wrapper');
        wrapper.style.display = 'block';
        
        wrapper.style.top = '50%';
        wrapper.style.left = '50%';
        wrapper.style.transform = 'translate(-50%, -50%)';

        
        document.querySelector('.ggs-sidebar-btn[data-tab="tab-templates"]').click();

        setTimeout(() => wrapper.classList.add('show'), 10);
    }

    
    function renderTemplatesList() {
        const list = document.getElementById('ggs-tpl-list');
        if(!list) return;
        list.innerHTML = '';
        appData.templates.forEach(tpl => {
            const item = document.createElement('div');
            item.className = 'ggs-tpl-item';
            item.innerHTML = `
                <div class="ggs-tpl-info">
                    <h4>${tpl.title}</h4>
                    <p>${tpl.text}</p>
                </div>
                <div>
                    <button class="ggs-btn-edit" data-id="${tpl.id}">✏️</button>
                    <button class="ggs-btn-danger" data-id="${tpl.id}">🗑️</button>
                </div>
            `;
            list.appendChild(item);
        });

        
        document.querySelectorAll('.ggs-tpl-item .ggs-btn-danger').forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                appData.templates = appData.templates.filter(t => t.id !== id);
                saveData();
                renderTemplatesList();
                renderChatBinds();
            };
        });

        
        document.querySelectorAll('.ggs-tpl-item .ggs-btn-edit').forEach(btn => {
            btn.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                const tpl = appData.templates.find(t => t.id === id);
                if(!tpl) return;

                currentEditId = id;
                document.getElementById('ggs-new-tpl-title').value = tpl.title;
                document.getElementById('ggs-new-tpl-text').value = tpl.text;

                const addBtn = document.getElementById('ggs-add-tpl-btn');
                addBtn.innerHTML = '💾 Сохранить изменения';
                addBtn.style.background = '#ffcc00';
                document.getElementById('ggs-cancel-edit-btn').style.display = 'block';
            };
        });
    }

    
    function renderChatBinds() {
        const inputContainer = document.querySelector('.styles_inputContainer__nAC7C');
        const footerContainer = document.querySelector('.styles_footerContainer__E_RfM');

        if (!inputContainer || !footerContainer) return;

        const oldBinds = document.getElementById('ggs-binds-wrapper');
        if (oldBinds) oldBinds.remove();

        inputContainer.classList.remove('ggs-flex-row-hack');
        footerContainer.style.flexDirection = '';

        if (appData.templates.length === 0) return;

        const bindsWrapper = document.createElement('div');
        bindsWrapper.id = 'ggs-binds-wrapper';
        bindsWrapper.className = `ggs-binds-container ggs-pos-${appData.settings.position}`;

        const s = appData.settings;
        let btnCSS = `font-size: ${s.size}px; padding: 8px 14px; border-radius: 8px; font-weight: 600; `;

        
        if (s.style === 'solid') {
            const bg = hexToRgba(s.bgColor, s.opacity);
            btnCSS += `background-color: ${bg}; color: ${s.textColor}; border: 1px solid transparent;`;
        } else if (s.style === 'outline') {
            const bg = hexToRgba(s.bgColor, s.opacity * 0.2);
            btnCSS += `background-color: ${bg}; color: ${s.textColor}; border: 1px solid ${s.textColor};`;
        } else if (s.style === 'glass') {
            const bg = hexToRgba(s.bgColor, s.opacity);
            btnCSS += `
                background-color: ${bg};
                background-image: ${svgNoise};
                color: ${s.textColor};
                border: 1px solid rgba(255,255,255,0.15);
                backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
            `;
        }

        const buyerName = getBuyerName();

        appData.templates.forEach(tpl => {
            const btn = document.createElement('button');
            btn.className = 'ggs-chat-bind';
            btn.style.cssText = btnCSS;
            btn.innerText = tpl.title;

            
            const previewText = tpl.text.replace(/\(ник\)/gi, `@${buyerName}`).replace(/\{ник\}/gi, `@${buyerName}`);
            btn.setAttribute('data-preview', previewText);

            btn.onclick = () => {
                const textarea = inputContainer.querySelector('textarea');
                if (textarea) {
                    const finalMessage = tpl.text.replace(/\(ник\)/gi, buyerName).replace(/\{ник\}/gi, buyerName);

                    const currentVal = textarea.value;
                    const newVal = currentVal ? currentVal + ' ' + finalMessage : finalMessage;

                    setReactInputValue(textarea, newVal);
                    textarea.focus();

                    
                    if (appData.settings.autoSend) {
                        setTimeout(() => {
                            const enterEvent = new KeyboardEvent('keydown', {
                                bubbles: true, cancelable: true,
                                keyCode: 13, key: 'Enter', code: 'Enter'
                            });
                            textarea.dispatchEvent(enterEvent);
                        }, 50);
                    }
                }
            };
            bindsWrapper.appendChild(btn);
        });

        
        if (s.position === 'top' || s.position === 'bottom') {
            footerContainer.style.display = 'flex';
            footerContainer.style.flexDirection = 'column';
            if (s.position === 'top') {
                footerContainer.insertBefore(bindsWrapper, inputContainer);
            } else {
                footerContainer.appendChild(bindsWrapper);
            }
        } else if (s.position === 'left' || s.position === 'right') {
            inputContainer.classList.add('ggs-flex-row-hack');
            if (s.position === 'left') {
                inputContainer.insertBefore(bindsWrapper, inputContainer.firstChild);
            } else {
                inputContainer.appendChild(bindsWrapper);
            }
        }
    }

    
    const observer = new MutationObserver(() => {
        injectHeaderButton();
        const textarea = document.querySelector('.styles_inputContainer__nAC7C textarea');
        const bindsExist = document.getElementById('ggs-binds-wrapper');
        if (textarea && !bindsExist) {
            renderChatBinds();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
