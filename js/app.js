(function() {
    'use strict';

    const state = {
        currentTemplate: 'line',
        currentMode: 'text',
        decorations: [],
        drawingData: null,
        selectedDecoration: null,
        letterContent: '',
        fontFamily: 'handwriting1',
        fontSize: 20,
        inkColor: '#3d3530',
        wobble: 2,
        brushColor: '#3d3530',
        brushSize: 3,
        drawWobble: 1.5,
        receiverName: '',
        receiverAddress: '',
        senderName: '',
        senderAddress: '',
        transparentBg: false,
        exportScale: 2
    };

    const fonts = {
        handwriting1: '"Kaiti", "STKaiti", "楷体", cursive',
        handwriting2: '"Xingkai", "STXingkai", "行楷", cursive',
        handwriting3: '"SimSun", "STSong", "宋体", serif'
    };

    const letterCanvas = document.getElementById('letter-canvas');
    const letterCtx = letterCanvas.getContext('2d');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const drawingCtx = drawingCanvas.getContext('2d');
    const envelopeCanvas = document.getElementById('envelope-canvas');
    const envelopeCtx = envelopeCanvas.getContext('2d');
    const decorationLayer = document.getElementById('decoration-layer');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let drawingPaths = [];
    let currentPath = [];

    const decorationTemplates = {
        flower: { emoji: '🌸', name: '干花', defaultSize: 80 },
        ribbon: { emoji: '🎀', name: '丝带', defaultSize: 90 },
        wax: { emoji: '🔮', name: '火漆印章', defaultSize: 70 },
        stamp: { emoji: '📮', name: '邮票', defaultSize: 75 }
    };

    function init() {
        bindEvents();
        loadFromCache();
        renderLetter();
        renderEnvelope();
        updateDecorationList();
        updatePageInfo();
    }

    function bindEvents() {
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentTemplate = btn.dataset.template;
                renderLetter();
                saveToCache();
            });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentMode = btn.dataset.mode;
                document.getElementById('text-panel').style.display = state.currentMode === 'text' ? 'block' : 'none';
                document.getElementById('draw-panel').style.display = state.currentMode === 'draw' ? 'block' : 'none';
                drawingCanvas.style.pointerEvents = state.currentMode === 'draw' ? 'auto' : 'none';
                saveToCache();
            });
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.canvas-container').forEach(c => c.style.display = 'none');
                document.getElementById(btn.dataset.tab + '-tab').style.display = 'flex';
                if (btn.dataset.tab === 'envelope') {
                    renderEnvelope();
                }
                if (btn.dataset.tab === 'decorations') {
                    updateDecorationList();
                }
            });
        });

        const contentInput = document.getElementById('letter-content');
        contentInput.addEventListener('input', () => {
            state.letterContent = contentInput.value;
            renderLetter();
            saveToCache();
        });

        document.getElementById('font-family').addEventListener('change', (e) => {
            state.fontFamily = e.target.value;
            renderLetter();
            saveToCache();
        });

        document.getElementById('font-size').addEventListener('input', (e) => {
            state.fontSize = parseInt(e.target.value);
            document.getElementById('font-size-value').textContent = state.fontSize + 'px';
            renderLetter();
            saveToCache();
        });

        document.getElementById('ink-color').addEventListener('input', (e) => {
            state.inkColor = e.target.value;
            renderLetter();
            saveToCache();
        });

        document.getElementById('wobble').addEventListener('input', (e) => {
            state.wobble = parseFloat(e.target.value);
            document.getElementById('wobble-value').textContent = state.wobble;
            renderLetter();
            saveToCache();
        });

        document.getElementById('brush-color').addEventListener('input', (e) => {
            state.brushColor = e.target.value;
            saveToCache();
        });

        document.getElementById('brush-size').addEventListener('input', (e) => {
            state.brushSize = parseInt(e.target.value);
            document.getElementById('brush-size-value').textContent = state.brushSize + 'px';
            saveToCache();
        });

        document.getElementById('draw-wobble').addEventListener('input', (e) => {
            state.drawWobble = parseFloat(e.target.value);
            document.getElementById('draw-wobble-value').textContent = state.drawWobble;
            saveToCache();
        });

        document.getElementById('clear-drawing').addEventListener('click', () => {
            drawingPaths = [];
            currentPath = [];
            drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            saveToCache();
        });

        document.querySelectorAll('.deco-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                addDecoration(btn.dataset.deco);
            });
        });

        document.getElementById('clear-decorations').addEventListener('click', () => {
            state.decorations = [];
            renderDecorations();
            updateDecorationList();
            saveToCache();
        });

        ['receiver-name', 'receiver-address', 'sender-name', 'sender-address'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const key = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                state[key] = e.target.value;
                renderEnvelope();
                saveToCache();
            });
        });

        document.getElementById('transparent-bg').addEventListener('change', (e) => {
            state.transparentBg = e.target.checked;
            renderLetter();
            saveToCache();
        });

        document.getElementById('export-scale').addEventListener('change', (e) => {
            state.exportScale = parseInt(e.target.value);
            saveToCache();
        });

        document.getElementById('export-letter').addEventListener('click', exportLetter);
        document.getElementById('export-envelope').addEventListener('click', exportEnvelope);
        document.getElementById('save-draft').addEventListener('click', () => {
            saveToCache();
            alert('草稿已保存！');
        });
        document.getElementById('load-draft').addEventListener('click', () => {
            loadFromCache();
            renderLetter();
            renderEnvelope();
            alert('草稿已恢复！');
        });
        document.getElementById('clear-cache').addEventListener('click', () => {
            if (confirm('确定要清除所有本地缓存吗？')) {
                localStorage.removeItem('letterDraft');
                location.reload();
            }
        });

        drawingCanvas.style.pointerEvents = 'none';
        setupDrawingEvents();
    }

    function setupDrawingEvents() {
        function getPos(e) {
            const rect = drawingCanvas.getBoundingClientRect();
            const scaleX = drawingCanvas.width / rect.width;
            const scaleY = drawingCanvas.height / rect.height;
            
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function startDraw(e) {
            if (state.currentMode !== 'draw') return;
            e.preventDefault();
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
            currentPath = [{
                x: pos.x,
                y: pos.y,
                color: state.brushColor,
                size: state.brushSize
            }];
        }

        function draw(e) {
            if (!isDrawing || state.currentMode !== 'draw') return;
            e.preventDefault();
            const pos = getPos(e);
            
            drawingCtx.strokeStyle = state.brushColor;
            drawingCtx.lineWidth = state.brushSize;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            
            const wobbleX = (Math.random() - 0.5) * state.drawWobble;
            const wobbleY = (Math.random() - 0.5) * state.drawWobble;
            
            drawingCtx.beginPath();
            drawingCtx.moveTo(lastX + wobbleX, lastY + wobbleY);
            drawingCtx.lineTo(pos.x + wobbleX, pos.y + wobbleY);
            drawingCtx.stroke();
            
            currentPath.push({
                x: pos.x,
                y: pos.y,
                color: state.brushColor,
                size: state.brushSize
            });
            
            lastX = pos.x;
            lastY = pos.y;
        }

        function endDraw(e) {
            if (!isDrawing) return;
            e.preventDefault();
            isDrawing = false;
            if (currentPath.length > 0) {
                drawingPaths.push([...currentPath]);
                saveToCache();
            }
            currentPath = [];
        }

        drawingCanvas.addEventListener('mousedown', startDraw);
        drawingCanvas.addEventListener('mousemove', draw);
        drawingCanvas.addEventListener('mouseup', endDraw);
        drawingCanvas.addEventListener('mouseleave', endDraw);

        drawingCanvas.addEventListener('touchstart', startDraw, { passive: false });
        drawingCanvas.addEventListener('touchmove', draw, { passive: false });
        drawingCanvas.addEventListener('touchend', endDraw);
    }

    function renderLetter() {
        letterCtx.clearRect(0, 0, letterCanvas.width, letterCanvas.height);
        
        drawPaperBackground();
        if (state.currentMode === 'text' && state.letterContent) {
            drawHandwrittenText();
        }
        updatePageInfo();
    }

    function updatePageInfo() {
        const pages = calculatePages();
        const pageInfoEl = document.getElementById('page-info');
        if (pageInfoEl) {
            if (pages.length > 1) {
                pageInfoEl.textContent = `📄 当前内容共 ${pages.length} 页，导出时将自动生成 ${pages.length} 张图片`;
            } else {
                pageInfoEl.textContent = '📄 当前内容共 1 页';
            }
        }
    }

    function drawPaperBackground() {
        const w = letterCanvas.width;
        const h = letterCanvas.height;

        if (!state.transparentBg) {
            letterCtx.fillStyle = '#fffef8';
            letterCtx.fillRect(0, 0, w, h);
        }

        switch (state.currentTemplate) {
            case 'line':
                drawLinePaper(w, h);
                break;
            case 'grid':
                drawGridPaper(w, h);
                break;
            case 'vintage':
                drawVintagePaper(w, h);
                break;
            case 'vertical':
                drawVerticalPaper(w, h);
                break;
        }
    }

    function drawLinePaper(w, h) {
        const lineHeight = 34;
        const marginLeft = 80;
        const marginTop = 80;
        const marginRight = 60;

        letterCtx.strokeStyle = '#b8d4e8';
        letterCtx.lineWidth = 1;
        
        for (let y = marginTop; y < h - 60; y += lineHeight) {
            letterCtx.beginPath();
            letterCtx.moveTo(marginLeft, y);
            letterCtx.lineTo(w - marginRight, y);
            letterCtx.stroke();
        }

        letterCtx.strokeStyle = '#e8a0a0';
        letterCtx.lineWidth = 2;
        letterCtx.beginPath();
        letterCtx.moveTo(marginLeft - 20, marginTop - 20);
        letterCtx.lineTo(marginLeft - 20, h - 60);
        letterCtx.stroke();
    }

    function drawGridPaper(w, h) {
        const gridSize = 36;
        const marginLeft = 60;
        const marginTop = 60;

        letterCtx.strokeStyle = '#c8dcc8';
        letterCtx.lineWidth = 0.5;

        for (let x = marginLeft; x < w - 60; x += gridSize) {
            letterCtx.beginPath();
            letterCtx.moveTo(x, marginTop);
            letterCtx.lineTo(x, h - 60);
            letterCtx.stroke();
        }

        for (let y = marginTop; y < h - 60; y += gridSize) {
            letterCtx.beginPath();
            letterCtx.moveTo(marginLeft, y);
            letterCtx.lineTo(w - 60, y);
            letterCtx.stroke();
        }

        letterCtx.strokeStyle = '#a8c8a8';
        letterCtx.lineWidth = 1;
        letterCtx.strokeRect(marginLeft, marginTop, w - marginLeft - 60, h - marginTop - 60);
    }

    function drawVintagePaper(w, h) {
        const gradient = letterCtx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, Math.max(w, h));
        gradient.addColorStop(0, '#fdf4e8');
        gradient.addColorStop(0.7, '#f8e8d0');
        gradient.addColorStop(1, '#e8d4b8');
        
        if (state.transparentBg) {
            letterCtx.globalAlpha = 0.9;
        }
        letterCtx.fillStyle = gradient;
        letterCtx.fillRect(0, 0, w, h);
        letterCtx.globalAlpha = 1;

        letterCtx.strokeStyle = '#8b7355';
        letterCtx.lineWidth = 3;
        letterCtx.strokeRect(25, 25, w - 50, h - 50);

        letterCtx.setLineDash([5, 5]);
        letterCtx.strokeStyle = '#a89070';
        letterCtx.lineWidth = 1;
        letterCtx.strokeRect(45, 45, w - 90, h - 90);
        letterCtx.setLineDash([]);

        letterCtx.fillStyle = '#8b7355';
        letterCtx.font = '14px serif';
        letterCtx.textAlign = 'center';
        letterCtx.fillText('❦', w / 2, 75);

        for (let i = 0; i < 50; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            letterCtx.fillStyle = `rgba(139, 115, 85, ${Math.random() * 0.03})`;
            letterCtx.beginPath();
            letterCtx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
            letterCtx.fill();
        }
    }

    function drawVerticalPaper(w, h) {
        const colWidth = 56;
        const marginLeft = 50;
        const marginTop = 80;

        if (!state.transparentBg) {
            const gradient = letterCtx.createLinearGradient(0, 0, w, 0);
            gradient.addColorStop(0, '#f5e0e0');
            gradient.addColorStop(0.5, '#fff8f0');
            gradient.addColorStop(1, '#f5e0e0');
            letterCtx.fillStyle = gradient;
            letterCtx.fillRect(0, 0, w, h);
        }

        letterCtx.strokeStyle = '#d4a0a0';
        letterCtx.lineWidth = 1.5;

        const cols = Math.floor((w - marginLeft - 50) / colWidth);
        for (let i = 0; i <= cols; i++) {
            const x = marginLeft + i * colWidth;
            letterCtx.beginPath();
            letterCtx.moveTo(x, marginTop);
            letterCtx.lineTo(x, h - 80);
            letterCtx.stroke();
        }

        letterCtx.strokeStyle = '#c49090';
        letterCtx.lineWidth = 2;
        letterCtx.beginPath();
        letterCtx.moveTo(marginLeft - 15, marginTop - 20);
        letterCtx.lineTo(marginLeft - 15, h - 60);
        letterCtx.stroke();
        letterCtx.beginPath();
        letterCtx.moveTo(marginLeft + cols * colWidth + 15, marginTop - 20);
        letterCtx.lineTo(marginLeft + cols * colWidth + 15, h - 60);
        letterCtx.stroke();
    }

    function drawHandwrittenText() {
        const w = letterCanvas.width;
        const h = letterCanvas.height;
        const lines = state.letterContent.split('\n');
        
        letterCtx.font = `${state.fontSize}px ${fonts[state.fontFamily]}`;
        letterCtx.fillStyle = state.inkColor;
        letterCtx.textBaseline = 'top';

        let startX, startY, lineHeight, isVertical;

        switch (state.currentTemplate) {
            case 'line':
                startX = 90;
                startY = 85;
                lineHeight = 34;
                isVertical = false;
                break;
            case 'grid':
                startX = 70;
                startY = 68;
                lineHeight = 36;
                isVertical = false;
                break;
            case 'vintage':
                startX = 80;
                startY = 100;
                lineHeight = state.fontSize * 1.8;
                isVertical = false;
                break;
            case 'vertical':
                startX = w - 75;
                startY = 90;
                lineHeight = 56;
                isVertical = true;
                break;
            default:
                startX = 80;
                startY = 80;
                lineHeight = 32;
                isVertical = false;
        }

        if (isVertical) {
            drawVerticalText(lines, startX, startY, lineHeight);
        } else {
            drawHorizontalText(lines, startX, startY, lineHeight, w - 120);
        }
    }

    function drawHorizontalText(lines, startX, startY, lineHeight, maxWidth) {
        let y = startY;
        
        lines.forEach(line => {
            if (line.trim() === '') {
                y += lineHeight;
                return;
            }

            let x = startX;
            let firstLine = (y === startY);
            if (firstLine && state.currentTemplate !== 'vintage') {
                x += state.fontSize * 2;
            }

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const wobbleX = (Math.random() - 0.5) * state.wobble;
                const wobbleY = (Math.random() - 0.5) * state.wobble;
                const rotation = (Math.random() - 0.5) * (state.wobble * 0.05);

                const charWidth = letterCtx.measureText(char).width;
                
                if (x + charWidth > letterCanvas.width - 80) {
                    x = startX;
                    y += lineHeight;
                }

                letterCtx.save();
                letterCtx.translate(x + wobbleX + charWidth / 2, y + wobbleY + state.fontSize / 2);
                letterCtx.rotate(rotation);
                letterCtx.fillText(char, -charWidth / 2, -state.fontSize / 2);
                letterCtx.restore();

                x += charWidth + 1;
            }
            y += lineHeight;
        });
    }

    function drawVerticalText(lines, startX, startY, colWidth) {
        let x = startX;
        const maxY = letterCanvas.height - 100;

        lines.forEach(line => {
            if (line.trim() === '') {
                x -= colWidth;
                return;
            }

            let y = startY;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === ' ') {
                    y += state.fontSize * 0.8;
                    continue;
                }

                const wobbleX = (Math.random() - 0.5) * state.wobble;
                const wobbleY = (Math.random() - 0.5) * state.wobble;
                const rotation = (Math.random() - 0.5) * (state.wobble * 0.05);

                if (y + state.fontSize > maxY) {
                    y = startY;
                    x -= colWidth;
                }

                letterCtx.save();
                letterCtx.translate(x + wobbleX, y + wobbleY);
                letterCtx.rotate(rotation);
                letterCtx.textAlign = 'center';
                letterCtx.fillText(char, 0, 0);
                letterCtx.restore();

                y += state.fontSize * 1.1;
            }
            x -= colWidth;
        });
    }

    function addDecoration(type) {
        const template = decorationTemplates[type];
        const deco = {
            id: Date.now(),
            type: type,
            emoji: template.emoji,
            name: template.name,
            x: letterCanvas.width / 2 - template.defaultSize / 2,
            y: letterCanvas.height / 2 - template.defaultSize / 2,
            size: template.defaultSize,
            opacity: 1,
            rotation: 0
        };
        state.decorations.push(deco);
        renderDecorations();
        updateDecorationList();
        saveToCache();
    }

    function renderDecorations() {
        decorationLayer.innerHTML = '';
        
        state.decorations.forEach(deco => {
            const el = document.createElement('div');
            el.className = 'decoration' + (state.selectedDecoration === deco.id ? ' selected' : '');
            el.dataset.id = deco.id;
            el.style.left = deco.x + 'px';
            el.style.top = deco.y + 'px';
            el.style.width = deco.size + 'px';
            el.style.height = deco.size + 'px';
            el.style.fontSize = (deco.size * 0.9) + 'px';
            el.style.opacity = deco.opacity;
            el.style.transform = `rotate(${deco.rotation}deg)`;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.textAlign = 'center';
            el.textContent = deco.emoji;

            setupDecorationDrag(el, deco);
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                state.selectedDecoration = deco.id;
                renderDecorations();
                updateDecorationList();
            });

            decorationLayer.appendChild(el);
        });
    }

    function setupDecorationDrag(el, deco) {
        let isDragging = false;
        let startX, startY, startDecoX, startDecoY;

        el.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startDecoX = deco.x;
            startDecoY = deco.y;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const rect = letterCanvas.getBoundingClientRect();
            const scaleX = letterCanvas.width / rect.width;
            const scaleY = letterCanvas.height / rect.height;
            
            deco.x = Math.max(0, Math.min(letterCanvas.width - deco.size, 
                startDecoX + (e.clientX - startX) * scaleX));
            deco.y = Math.max(0, Math.min(letterCanvas.height - deco.size, 
                startDecoY + (e.clientY - startY) * scaleY));
            
            el.style.left = deco.x + 'px';
            el.style.top = deco.y + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                saveToCache();
                updateDecorationList();
            }
        });

        el.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startDecoX = deco.x;
                startDecoY = deco.y;
                e.preventDefault();
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length !== 1) return;
            const rect = letterCanvas.getBoundingClientRect();
            const scaleX = letterCanvas.width / rect.width;
            const scaleY = letterCanvas.height / rect.height;
            
            deco.x = Math.max(0, Math.min(letterCanvas.width - deco.size, 
                startDecoX + (e.touches[0].clientX - startX) * scaleX));
            deco.y = Math.max(0, Math.min(letterCanvas.height - deco.size, 
                startDecoY + (e.touches[0].clientY - startY) * scaleY));
            
            el.style.left = deco.x + 'px';
            el.style.top = deco.y + 'px';
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                saveToCache();
                updateDecorationList();
            }
        });
    }

    function updateDecorationList() {
        const list = document.getElementById('decoration-list');
        
        if (state.decorations.length === 0) {
            list.innerHTML = '<div class="empty-state">还没有添加装饰，点击左侧装饰按钮添加干花、丝带、火漆印章或邮票吧~</div>';
            return;
        }

        list.innerHTML = '';
        
        state.decorations.forEach(deco => {
            const item = document.createElement('div');
            item.className = 'decoration-item';
            item.innerHTML = `
                <div class="deco-preview">${deco.emoji}</div>
                <div class="deco-controls">
                    <div class="control-row">
                        <label style="min-width:50px">透明度</label>
                        <input type="range" min="0.1" max="1" step="0.1" value="${deco.opacity}" 
                               data-id="${deco.id}" data-prop="opacity">
                        <span>${deco.opacity.toFixed(1)}</span>
                    </div>
                    <div class="control-row">
                        <label style="min-width:50px">大小</label>
                        <input type="range" min="30" max="200" step="5" value="${deco.size}" 
                               data-id="${deco.id}" data-prop="size">
                        <span>${deco.size}px</span>
                    </div>
                    <div class="control-row">
                        <label style="min-width:50px">旋转</label>
                        <input type="range" min="-180" max="180" step="5" value="${deco.rotation}" 
                               data-id="${deco.id}" data-prop="rotation">
                        <span>${deco.rotation}°</span>
                    </div>
                </div>
                <div class="deco-actions">
                    <button class="btn-delete" data-id="${deco.id}">删除</button>
                </div>
            `;
            list.appendChild(item);
        });

        list.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseInt(e.target.dataset.id);
                const prop = e.target.dataset.prop;
                const deco = state.decorations.find(d => d.id === id);
                if (deco) {
                    deco[prop] = parseFloat(e.target.value);
                    e.target.parentElement.querySelector('span').textContent = 
                        prop === 'opacity' ? deco.opacity.toFixed(1) : 
                        prop === 'size' ? deco.size + 'px' : deco.rotation + '°';
                    renderDecorations();
                    saveToCache();
                }
            });
        });

        list.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                state.decorations = state.decorations.filter(d => d.id !== id);
                if (state.selectedDecoration === id) {
                    state.selectedDecoration = null;
                }
                renderDecorations();
                updateDecorationList();
                saveToCache();
            });
        });
    }

    function renderEnvelope() {
        const w = envelopeCanvas.width;
        const h = envelopeCanvas.height;
        
        envelopeCtx.clearRect(0, 0, w, h);

        if (!state.transparentBg) {
            const gradient = envelopeCtx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, '#fdf4e8');
            gradient.addColorStop(1, '#f5e6d0');
            envelopeCtx.fillStyle = gradient;
            envelopeCtx.fillRect(0, 0, w, h);
        }

        envelopeCtx.strokeStyle = '#8b7355';
        envelopeCtx.lineWidth = 3;
        envelopeCtx.strokeRect(20, 20, w - 40, h - 40);

        envelopeCtx.setLineDash([6, 4]);
        envelopeCtx.strokeStyle = '#a89070';
        envelopeCtx.lineWidth = 1;
        envelopeCtx.strokeRect(40, 40, w - 80, h - 80);
        envelopeCtx.setLineDash([]);

        const flapPoints = [
            { x: 40, y: 40 },
            { x: w / 2, y: h / 2 - 80 },
            { x: w - 40, y: 40 }
        ];
        envelopeCtx.beginPath();
        envelopeCtx.moveTo(flapPoints[0].x, flapPoints[0].y);
        envelopeCtx.lineTo(flapPoints[1].x, flapPoints[1].y);
        envelopeCtx.lineTo(flapPoints[2].x, flapPoints[2].y);
        envelopeCtx.strokeStyle = '#a89070';
        envelopeCtx.lineWidth = 2;
        envelopeCtx.stroke();

        envelopeCtx.fillStyle = '#c8a070';
        envelopeCtx.globalAlpha = 0.3;
        envelopeCtx.beginPath();
        envelopeCtx.moveTo(flapPoints[0].x, flapPoints[0].y);
        envelopeCtx.lineTo(flapPoints[1].x, flapPoints[1].y);
        envelopeCtx.lineTo(flapPoints[2].x, flapPoints[2].y);
        envelopeCtx.lineTo(flapPoints[2].x, flapPoints[0].y);
        envelopeCtx.closePath();
        envelopeCtx.fill();
        envelopeCtx.globalAlpha = 1;

        const stampX = w - 130;
        const stampY = 70;
        envelopeCtx.fillStyle = '#f5e0d0';
        envelopeCtx.fillRect(stampX, stampY, 80, 100);
        envelopeCtx.strokeStyle = '#8b7355';
        envelopeCtx.lineWidth = 2;
        envelopeCtx.strokeRect(stampX, stampY, 80, 100);
        
        envelopeCtx.font = '36px serif';
        envelopeCtx.textAlign = 'center';
        envelopeCtx.fillStyle = '#8b7355';
        envelopeCtx.fillText('📮', stampX + 40, stampY + 50);
        envelopeCtx.font = '12px serif';
        envelopeCtx.fillText('STAMP', stampX + 40, stampY + 80);

        envelopeCtx.font = 'bold 22px "Kaiti", "STKaiti", serif';
        envelopeCtx.fillStyle = '#3d3530';
        envelopeCtx.textAlign = 'left';
        
        const labelY = h / 2 + 20;
        
        envelopeCtx.font = '14px serif';
        envelopeCtx.fillStyle = '#8b7355';
        envelopeCtx.fillText('收信人：', 100, labelY);
        envelopeCtx.font = 'bold 22px "Kaiti", "STKaiti", serif';
        envelopeCtx.fillStyle = '#3d3530';
        envelopeCtx.fillText(state.receiverName || '___________', 180, labelY);
        
        envelopeCtx.font = '14px serif';
        envelopeCtx.fillStyle = '#8b7355';
        envelopeCtx.fillText('地  址：', 100, labelY + 45);
        envelopeCtx.font = '18px "Kaiti", "STKaiti", serif';
        envelopeCtx.fillStyle = '#3d3530';
        envelopeCtx.fillText(state.receiverAddress || '_______________________________', 180, labelY + 45);

        envelopeCtx.font = '14px serif';
        envelopeCtx.fillStyle = '#8b7355';
        envelopeCtx.fillText('寄信人：', 100, labelY + 100);
        envelopeCtx.font = '18px "Kaiti", "STKaiti", serif';
        envelopeCtx.fillStyle = '#5a4a42';
        envelopeCtx.fillText(state.senderName || '___________', 180, labelY + 100);
        
        envelopeCtx.font = '14px serif';
        envelopeCtx.fillStyle = '#8b7355';
        envelopeCtx.fillText('地  址：', 100, labelY + 135);
        envelopeCtx.font = '16px "Kaiti", "STKaiti", serif';
        envelopeCtx.fillStyle = '#5a4a42';
        envelopeCtx.fillText(state.senderAddress || '_______________________________', 180, labelY + 135);

        envelopeCtx.font = '48px serif';
        envelopeCtx.textAlign = 'center';
        envelopeCtx.fillStyle = 'rgba(139, 115, 85, 0.15)';
        envelopeCtx.fillText('✉️', w / 2, h - 70);
    }

    function calculatePages() {
        const pages = [];
        if (!state.letterContent) {
            pages.push({ startChar: 0, endChar: 0 });
            return pages;
        }

        const w = letterCanvas.width;
        const lines = state.letterContent.split('\n');
        const ctx = letterCtx;
        
        ctx.font = `${state.fontSize}px ${fonts[state.fontFamily]}`;
        ctx.textBaseline = 'top';

        let startX, startY, lineHeight, isVertical, maxWidth;

        switch (state.currentTemplate) {
            case 'line':
                startX = 90;
                startY = 85;
                lineHeight = 34;
                isVertical = false;
                maxWidth = w - 120;
                break;
            case 'grid':
                startX = 70;
                startY = 68;
                lineHeight = 36;
                isVertical = false;
                maxWidth = w - 120;
                break;
            case 'vintage':
                startX = 80;
                startY = 100;
                lineHeight = state.fontSize * 1.8;
                isVertical = false;
                maxWidth = w - 120;
                break;
            case 'vertical':
                startX = w - 75;
                startY = 90;
                lineHeight = 56;
                isVertical = true;
                break;
            default:
                startX = 80;
                startY = 80;
                lineHeight = 32;
                isVertical = false;
                maxWidth = w - 120;
        }

        if (isVertical) {
            return calculateVerticalPages(lines, startX, startY, lineHeight);
        } else {
            return calculateHorizontalPages(lines, startX, startY, lineHeight, maxWidth);
        }
    }

    function calculateHorizontalPages(lines, startX, startY, lineHeight, maxWidth) {
        const pages = [];
        const maxY = letterCanvas.height - 80;
        let charIndex = 0;
        let currentPageStart = 0;
        let y = startY;

        lines.forEach((line, lineIndex) => {
            if (line.trim() === '') {
                y += lineHeight;
                charIndex++;
                if (y > maxY) {
                    pages.push({ startChar: currentPageStart, endChar: charIndex - 1 });
                    currentPageStart = charIndex - 1;
                    y = startY + lineHeight;
                }
                return;
            }

            let x = startX;
            let firstLine = (y === startY);
            if (firstLine && state.currentTemplate !== 'vintage') {
                x += state.fontSize * 2;
            }

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const charWidth = letterCtx.measureText(char).width;
                
                if (x + charWidth > letterCanvas.width - 80) {
                    x = startX;
                    y += lineHeight;
                    if (y > maxY) {
                        pages.push({ startChar: currentPageStart, endChar: charIndex });
                        currentPageStart = charIndex;
                        y = startY;
                        firstLine = true;
                        if (firstLine && state.currentTemplate !== 'vintage') {
                            x += state.fontSize * 2;
                        }
                    }
                }

                x += charWidth + 1;
                charIndex++;
            }
            y += lineHeight;
            charIndex++;

            if (y > maxY && lineIndex < lines.length - 1) {
                pages.push({ startChar: currentPageStart, endChar: charIndex - 1 });
                currentPageStart = charIndex - 1;
                y = startY;
            }
        });

        pages.push({ startChar: currentPageStart, endChar: charIndex });
        return pages;
    }

    function calculateVerticalPages(lines, startX, startY, colWidth) {
        const pages = [];
        const maxY = letterCanvas.height - 100;
        const minX = 50;
        let charIndex = 0;
        let currentPageStart = 0;
        let x = startX;

        lines.forEach((line, lineIndex) => {
            if (line.trim() === '') {
                x -= colWidth;
                charIndex++;
                if (x < minX) {
                    pages.push({ startChar: currentPageStart, endChar: charIndex - 1 });
                    currentPageStart = charIndex - 1;
                    x = startX - colWidth;
                }
                return;
            }

            let y = startY;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === ' ') {
                    y += state.fontSize * 0.8;
                    charIndex++;
                    continue;
                }

                if (y + state.fontSize > maxY) {
                    y = startY;
                    x -= colWidth;
                    if (x < minX) {
                        pages.push({ startChar: currentPageStart, endChar: charIndex });
                        currentPageStart = charIndex;
                        x = startX;
                    }
                }

                y += state.fontSize * 1.1;
                charIndex++;
            }
            x -= colWidth;
            charIndex++;

            if (x < minX && lineIndex < lines.length - 1) {
                pages.push({ startChar: currentPageStart, endChar: charIndex - 1 });
                currentPageStart = charIndex - 1;
                x = startX;
            }
        });

        pages.push({ startChar: currentPageStart, endChar: charIndex });
        return pages;
    }

    function exportLetter() {
        const pages = calculatePages();
        const scale = state.exportScale;

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = letterCanvas.width * scale;
            exportCanvas.height = letterCanvas.height * scale;
            const ctx = exportCanvas.getContext('2d');
            ctx.scale(scale, scale);

            if (!state.transparentBg) {
                ctx.fillStyle = '#fffef8';
                ctx.fillRect(0, 0, letterCanvas.width, letterCanvas.height);
            }

            drawPaperBackgroundForExport(ctx);
            if (state.currentMode === 'text' && state.letterContent) {
                drawHandwrittenTextForExport(ctx, pages[pageIndex]);
            }

            if (pageIndex === 0) {
                ctx.drawImage(drawingCanvas, 0, 0);

                state.decorations.forEach(deco => {
                    ctx.save();
                    ctx.globalAlpha = deco.opacity;
                    ctx.translate(deco.x + deco.size / 2, deco.y + deco.size / 2);
                    ctx.rotate(deco.rotation * Math.PI / 180);
                    ctx.font = (deco.size * 0.9) + 'px serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(deco.emoji, 0, 0);
                    ctx.restore();
                });
            }

            const link = document.createElement('a');
            link.download = `letter_${Date.now()}_page${pageIndex + 1}.png`;
            link.href = exportCanvas.toDataURL('image/png');
            link.click();
        }
    }

    function drawPaperBackgroundForExport(ctx) {
        const w = letterCanvas.width;
        const h = letterCanvas.height;

        switch (state.currentTemplate) {
            case 'line':
                drawLinePaperOnCtx(ctx, w, h);
                break;
            case 'grid':
                drawGridPaperOnCtx(ctx, w, h);
                break;
            case 'vintage':
                drawVintagePaperOnCtx(ctx, w, h);
                break;
            case 'vertical':
                drawVerticalPaperOnCtx(ctx, w, h);
                break;
        }
    }

    function drawLinePaperOnCtx(ctx, w, h) {
        const lineHeight = 34;
        const marginLeft = 80;
        const marginTop = 80;
        const marginRight = 60;

        ctx.strokeStyle = '#b8d4e8';
        ctx.lineWidth = 1;
        
        for (let y = marginTop; y < h - 60; y += lineHeight) {
            ctx.beginPath();
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(w - marginRight, y);
            ctx.stroke();
        }

        ctx.strokeStyle = '#e8a0a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginLeft - 20, marginTop - 20);
        ctx.lineTo(marginLeft - 20, h - 60);
        ctx.stroke();
    }

    function drawGridPaperOnCtx(ctx, w, h) {
        const gridSize = 36;
        const marginLeft = 60;
        const marginTop = 60;

        ctx.strokeStyle = '#c8dcc8';
        ctx.lineWidth = 0.5;

        for (let x = marginLeft; x < w - 60; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, h - 60);
            ctx.stroke();
        }

        for (let y = marginTop; y < h - 60; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(w - 60, y);
            ctx.stroke();
        }

        ctx.strokeStyle = '#a8c8a8';
        ctx.lineWidth = 1;
        ctx.strokeRect(marginLeft, marginTop, w - marginLeft - 60, h - marginTop - 60);
    }

    function drawVintagePaperOnCtx(ctx, w, h) {
        if (!state.transparentBg) {
            const gradient = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, Math.max(w, h));
            gradient.addColorStop(0, '#fdf4e8');
            gradient.addColorStop(0.7, '#f8e8d0');
            gradient.addColorStop(1, '#e8d4b8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }

        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 3;
        ctx.strokeRect(25, 25, w - 50, h - 50);

        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#a89070';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 45, w - 90, h - 90);
        ctx.setLineDash([]);

        ctx.fillStyle = '#8b7355';
        ctx.font = '14px serif';
        ctx.textAlign = 'center';
        ctx.fillText('❦', w / 2, 75);
    }

    function drawVerticalPaperOnCtx(ctx, w, h) {
        const colWidth = 56;
        const marginLeft = 50;
        const marginTop = 80;

        if (!state.transparentBg) {
            const gradient = ctx.createLinearGradient(0, 0, w, 0);
            gradient.addColorStop(0, '#f5e0e0');
            gradient.addColorStop(0.5, '#fff8f0');
            gradient.addColorStop(1, '#f5e0e0');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }

        ctx.strokeStyle = '#d4a0a0';
        ctx.lineWidth = 1.5;

        const cols = Math.floor((w - marginLeft - 50) / colWidth);
        for (let i = 0; i <= cols; i++) {
            const x = marginLeft + i * colWidth;
            ctx.beginPath();
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, h - 80);
            ctx.stroke();
        }

        ctx.strokeStyle = '#c49090';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginLeft - 15, marginTop - 20);
        ctx.lineTo(marginLeft - 15, h - 60);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(marginLeft + cols * colWidth + 15, marginTop - 20);
        ctx.lineTo(marginLeft + cols * colWidth + 15, h - 60);
        ctx.stroke();
    }

    function drawHandwrittenTextForExport(ctx, pageInfo) {
        const w = letterCanvas.width;
        const content = state.letterContent;
        const pageContent = content.substring(pageInfo.startChar, pageInfo.endChar);
        const lines = pageContent.split('\n');
        
        ctx.font = `${state.fontSize}px ${fonts[state.fontFamily]}`;
        ctx.fillStyle = state.inkColor;
        ctx.textBaseline = 'top';

        let startX, startY, lineHeight, isVertical;

        switch (state.currentTemplate) {
            case 'line':
                startX = 90;
                startY = 85;
                lineHeight = 34;
                isVertical = false;
                break;
            case 'grid':
                startX = 70;
                startY = 68;
                lineHeight = 36;
                isVertical = false;
                break;
            case 'vintage':
                startX = 80;
                startY = 100;
                lineHeight = state.fontSize * 1.8;
                isVertical = false;
                break;
            case 'vertical':
                startX = w - 75;
                startY = 90;
                lineHeight = 56;
                isVertical = true;
                break;
            default:
                startX = 80;
                startY = 80;
                lineHeight = 32;
                isVertical = false;
        }

        if (isVertical) {
            drawVerticalTextOnCtx(ctx, lines, startX, startY, lineHeight, pageInfo.startChar);
        } else {
            drawHorizontalTextOnCtx(ctx, lines, startX, startY, lineHeight, w - 120, pageInfo.startChar);
        }
    }

    function drawHorizontalTextOnCtx(ctx, lines, startX, startY, lineHeight, maxWidth, globalStartChar) {
        let y = startY;
        let isNewPage = globalStartChar > 0;
        
        lines.forEach((line, lineIndex) => {
            if (line.trim() === '') {
                y += lineHeight;
                return;
            }

            let x = startX;
            let firstLine = (y === startY) && (lineIndex === 0 || isNewPage);
            if (firstLine && state.currentTemplate !== 'vintage') {
                x += state.fontSize * 2;
            }

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const wobbleX = (Math.random() - 0.5) * state.wobble;
                const wobbleY = (Math.random() - 0.5) * state.wobble;
                const rotation = (Math.random() - 0.5) * (state.wobble * 0.05);

                const charWidth = ctx.measureText(char).width;
                
                if (x + charWidth > letterCanvas.width - 80) {
                    x = startX;
                    y += lineHeight;
                }

                ctx.save();
                ctx.translate(x + wobbleX + charWidth / 2, y + wobbleY + state.fontSize / 2);
                ctx.rotate(rotation);
                ctx.fillText(char, -charWidth / 2, -state.fontSize / 2);
                ctx.restore();

                x += charWidth + 1;
            }
            y += lineHeight;
        });
    }

    function drawVerticalTextOnCtx(ctx, lines, startX, startY, colWidth, globalStartChar) {
        let x = startX;
        const maxY = letterCanvas.height - 100;

        lines.forEach(line => {
            if (line.trim() === '') {
                x -= colWidth;
                return;
            }

            let y = startY;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === ' ') {
                    y += state.fontSize * 0.8;
                    continue;
                }

                const wobbleX = (Math.random() - 0.5) * state.wobble;
                const wobbleY = (Math.random() - 0.5) * state.wobble;
                const rotation = (Math.random() - 0.5) * (state.wobble * 0.05);

                if (y + state.fontSize > maxY) {
                    y = startY;
                    x -= colWidth;
                }

                ctx.save();
                ctx.translate(x + wobbleX, y + wobbleY);
                ctx.rotate(rotation);
                ctx.textAlign = 'center';
                ctx.fillText(char, 0, 0);
                ctx.restore();

                y += state.fontSize * 1.1;
            }
            x -= colWidth;
        });
    }

    function exportEnvelope() {
        const scale = state.exportScale;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = envelopeCanvas.width * scale;
        exportCanvas.height = envelopeCanvas.height * scale;
        const ctx = exportCanvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(envelopeCanvas, 0, 0);

        const link = document.createElement('a');
        link.download = `envelope_${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    function saveToCache() {
        const saveData = {
            ...state,
            drawingPaths: drawingPaths,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('letterDraft', JSON.stringify(saveData));
        } catch (e) {
            console.warn('无法保存到本地存储:', e);
        }
    }

    function loadFromCache() {
        try {
            const cached = localStorage.getItem('letterDraft');
            if (cached) {
                const data = JSON.parse(cached);
                
                state.currentTemplate = data.currentTemplate || 'line';
                state.currentMode = data.currentMode || 'text';
                state.decorations = data.decorations || [];
                state.letterContent = data.letterContent || '';
                state.fontFamily = data.fontFamily || 'handwriting1';
                state.fontSize = data.fontSize || 20;
                state.inkColor = data.inkColor || '#3d3530';
                state.wobble = data.wobble || 2;
                state.brushColor = data.brushColor || '#3d3530';
                state.brushSize = data.brushSize || 3;
                state.drawWobble = data.drawWobble || 1.5;
                state.receiverName = data.receiverName || '';
                state.receiverAddress = data.receiverAddress || '';
                state.senderName = data.senderName || '';
                state.senderAddress = data.senderAddress || '';
                state.transparentBg = data.transparentBg || false;
                state.exportScale = data.exportScale || 2;
                
                if (data.drawingPaths && data.drawingPaths.length > 0) {
                    drawingPaths = data.drawingPaths;
                    redrawPaths();
                }

                document.querySelectorAll('.template-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.template === state.currentTemplate);
                });
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === state.currentMode);
                });
                document.getElementById('text-panel').style.display = state.currentMode === 'text' ? 'block' : 'none';
                document.getElementById('draw-panel').style.display = state.currentMode === 'draw' ? 'block' : 'none';
                drawingCanvas.style.pointerEvents = state.currentMode === 'draw' ? 'auto' : 'none';

                document.getElementById('letter-content').value = state.letterContent;
                document.getElementById('font-family').value = state.fontFamily;
                document.getElementById('font-size').value = state.fontSize;
                document.getElementById('font-size-value').textContent = state.fontSize + 'px';
                document.getElementById('ink-color').value = state.inkColor;
                document.getElementById('wobble').value = state.wobble;
                document.getElementById('wobble-value').textContent = state.wobble;
                document.getElementById('brush-color').value = state.brushColor;
                document.getElementById('brush-size').value = state.brushSize;
                document.getElementById('brush-size-value').textContent = state.brushSize + 'px';
                document.getElementById('draw-wobble').value = state.drawWobble;
                document.getElementById('draw-wobble-value').textContent = state.drawWobble;
                document.getElementById('receiver-name').value = state.receiverName;
                document.getElementById('receiver-address').value = state.receiverAddress;
                document.getElementById('sender-name').value = state.senderName;
                document.getElementById('sender-address').value = state.senderAddress;
                document.getElementById('transparent-bg').checked = state.transparentBg;
                document.getElementById('export-scale').value = state.exportScale;

                renderDecorations();
            }
        } catch (e) {
            console.warn('无法从本地存储恢复:', e);
        }
    }

    function redrawPaths() {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        drawingPaths.forEach(path => {
            if (path.length < 2) return;
            drawingCtx.strokeStyle = path[0].color;
            drawingCtx.lineWidth = path[0].size;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            drawingCtx.beginPath();
            drawingCtx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                drawingCtx.lineTo(path[i].x, path[i].y);
            }
            drawingCtx.stroke();
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.decoration') && !e.target.closest('.decoration-item')) {
            state.selectedDecoration = null;
            renderDecorations();
        }
    });

    document.addEventListener('DOMContentLoaded', init);
})();
