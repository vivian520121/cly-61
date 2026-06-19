(function() {
    'use strict';

    const state = {
        currentTemplate: 'line',
        currentMode: 'text',
        currentPage: 0,
        pageDecorations: { '0': [] },
        pageDrawingPaths: { '0': [] },
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
        exportScale: 2,
        drafts: [],
        currentDraftId: null,
        showArchived: false,
        keepDraftsOnClear: true,
        customMaterials: []
    };

    let pendingRenameDraftId = null;

    const fonts = {
        handwriting1: '"Kaiti", "STKaiti", "楷体", cursive',
        handwriting2: '"Xingkai", "STXingkai", "行楷", cursive',
        handwriting3: '"SimSun", "STSong", "宋体", serif'
    };

    function generateDraftId() {
        return 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        
        return date.toLocaleDateString('zh-CN', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getDraftContentFromState() {
        return {
            currentTemplate: state.currentTemplate,
            currentMode: state.currentMode,
            currentPage: state.currentPage,
            pageDecorations: { ...state.pageDecorations },
            pageDrawingPaths: { ...state.pageDrawingPaths },
            selectedDecoration: state.selectedDecoration,
            letterContent: state.letterContent,
            fontFamily: state.fontFamily,
            fontSize: state.fontSize,
            inkColor: state.inkColor,
            wobble: state.wobble,
            brushColor: state.brushColor,
            brushSize: state.brushSize,
            drawWobble: state.drawWobble,
            receiverName: state.receiverName,
            receiverAddress: state.receiverAddress,
            senderName: state.senderName,
            senderAddress: state.senderAddress,
            transparentBg: state.transparentBg,
            exportScale: state.exportScale
        };
    }

    function applyDraftContentToState(content) {
        state.currentTemplate = content.currentTemplate || 'line';
        state.currentMode = content.currentMode || 'text';
        state.currentPage = content.currentPage || 0;
        state.pageDecorations = content.pageDecorations || { '0': [] };
        state.pageDrawingPaths = content.pageDrawingPaths || { '0': [] };
        state.selectedDecoration = content.selectedDecoration || null;
        state.letterContent = content.letterContent || '';
        state.fontFamily = content.fontFamily || 'handwriting1';
        state.fontSize = content.fontSize || 20;
        state.inkColor = content.inkColor || '#3d3530';
        state.wobble = content.wobble || 2;
        state.brushColor = content.brushColor || '#3d3530';
        state.brushSize = content.brushSize || 3;
        state.drawWobble = content.drawWobble || 1.5;
        state.receiverName = content.receiverName || '';
        state.receiverAddress = content.receiverAddress || '';
        state.senderName = content.senderName || '';
        state.senderAddress = content.senderAddress || '';
        state.transparentBg = content.transparentBg || false;
        state.exportScale = content.exportScale || 2;
    }

    function generateThumbnail() {
        try {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = 200;
            exportCanvas.height = 275;
            const ctx = exportCanvas.getContext('2d');
            ctx.scale(0.25, 0.25);

            ctx.fillStyle = '#fffef8';
            ctx.fillRect(0, 0, letterCanvas.width, letterCanvas.height);
            drawPaperBackgroundForExport(ctx);

            if (state.currentMode === 'text' && state.letterContent) {
                const pages = calculatePages();
                if (pages.length > 0) {
                    drawHandwrittenTextForExport(ctx, pages[0]);
                }
            }

            const pageDrawings = state.pageDrawingPaths['0'] || [];
            pageDrawings.forEach(path => {
                if (path.length < 2) return;
                ctx.strokeStyle = path[0].color;
                ctx.lineWidth = path[0].size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.stroke();
            });

            const pageDecos = state.pageDecorations['0'] || [];
            pageDecos.forEach(deco => {
                ctx.save();
                ctx.globalAlpha = deco.opacity;
                ctx.translate(deco.x + deco.size / 2, deco.y + deco.size / 2);
                ctx.rotate(deco.rotation * Math.PI / 180);
                if (deco.type === 'custom' && deco.imageData) {
                    const img = new Image();
                    img.src = deco.imageData;
                    if (img.complete && img.naturalWidth > 0) {
                        ctx.drawImage(img, -deco.size / 2, -deco.size / 2, deco.size, deco.size);
                    }
                } else {
                    ctx.font = (deco.size * 0.9) + 'px serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(deco.emoji, 0, 0);
                }
                ctx.restore();
            });

            return exportCanvas.toDataURL('image/png');
        } catch (e) {
            console.warn('生成缩略图失败:', e);
            return null;
        }
    }

    function saveCurrentDraft() {
        if (!state.currentDraftId) return;

        const draftIndex = state.drafts.findIndex(d => d.id === state.currentDraftId);
        if (draftIndex === -1) return;

        const draft = state.drafts[draftIndex];
        draft.content = getDraftContentFromState();
        draft.updatedAt = Date.now();
        draft.thumbnail = generateThumbnail();

        saveDraftsToStorage();
    }

    function createDraft() {
        saveCurrentDraft();

        const newDraft = {
            id: generateDraftId(),
            name: `书信 ${state.drafts.length + 1}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isArchived: false,
            thumbnail: null,
            content: {
                currentTemplate: 'line',
                currentMode: 'text',
                currentPage: 0,
                pageDecorations: { '0': [] },
                pageDrawingPaths: { '0': [] },
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
            }
        };

        state.drafts.unshift(newDraft);
        state.currentDraftId = newDraft.id;

        applyDraftContentToState(newDraft.content);
        updateUIForState();
        renderLetter();
        renderEnvelope();
        renderDecorations();
        redrawCurrentPagePaths();
        updatePageInfo();
        updateDecorationList();
        renderDraftList();
        saveDraftsToStorage();
    }

    function loadDraft(draftId) {
        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        applyDraftContentToState(draft.content);
        state.currentDraftId = draftId;

        updateUIForState();
        renderLetter();
        renderEnvelope();
        renderDecorations();
        redrawCurrentPagePaths();
        updatePageInfo();
        updateDecorationList();
        renderDraftList();
    }

    function switchDraft(draftId) {
        if (draftId === state.currentDraftId) return;

        saveCurrentDraft();
        loadDraft(draftId);
    }

    function renameDraft(draftId, newName) {
        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        draft.name = newName.trim() || draft.name;
        draft.updatedAt = Date.now();
        renderDraftList();
        saveDraftsToStorage();
    }

    function archiveDraft(draftId) {
        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        draft.isArchived = !draft.isArchived;
        draft.updatedAt = Date.now();
        renderDraftList();
        saveDraftsToStorage();

        if (draftId === state.currentDraftId && draft.isArchived && !state.showArchived) {
            const firstActiveDraft = state.drafts.find(d => !d.isArchived);
            if (firstActiveDraft) {
                switchDraft(firstActiveDraft.id);
            } else {
                createDraft();
            }
        }
    }

    function copyDraft(draftId) {
        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        saveCurrentDraft();

        const newDraft = {
            id: generateDraftId(),
            name: `${draft.name} 副本`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isArchived: false,
            thumbnail: draft.thumbnail,
            content: JSON.parse(JSON.stringify(draft.content))
        };

        const draftIndex = state.drafts.findIndex(d => d.id === draftId);
        state.drafts.splice(draftIndex + 1, 0, newDraft);
        state.currentDraftId = newDraft.id;

        applyDraftContentToState(newDraft.content);
        updateUIForState();
        renderLetter();
        renderEnvelope();
        renderDecorations();
        redrawCurrentPagePaths();
        updatePageInfo();
        updateDecorationList();
        renderDraftList();
        saveDraftsToStorage();
    }

    function deleteDraft(draftId) {
        const draftIndex = state.drafts.findIndex(d => d.id === draftId);
        if (draftIndex === -1) return;

        state.drafts.splice(draftIndex, 1);

        if (draftId === state.currentDraftId) {
            if (state.drafts.length > 0) {
                const nextDraft = state.drafts[Math.min(draftIndex, state.drafts.length - 1)];
                loadDraft(nextDraft.id);
            } else {
                createDraft();
            }
        } else {
            renderDraftList();
            saveDraftsToStorage();
        }
    }

    function clearAllDrafts(includeArchived = true) {
        if (includeArchived) {
            state.drafts = [];
        } else {
            state.drafts = state.drafts.filter(d => d.isArchived);
        }

        if (state.drafts.length === 0) {
            createDraft();
        } else {
            const firstDraft = state.drafts.find(d => !d.isArchived) || state.drafts[0];
            loadDraft(firstDraft.id);
        }
    }

    function renderDraftList() {
        const draftListEl = document.getElementById('draft-list');
        if (!draftListEl) return;

        let filteredDrafts = state.drafts;
        if (!state.showArchived) {
            filteredDrafts = state.drafts.filter(d => !d.isArchived);
        }

        if (filteredDrafts.length === 0) {
            draftListEl.innerHTML = `
                <div class="draft-empty">
                    ${state.showArchived ? '暂无草稿，点击上方按钮新建' : '暂无草稿，点击上方按钮新建<br>或勾选"显示已归档"查看归档草稿'}
                </div>
            `;
            return;
        }

        draftListEl.innerHTML = filteredDrafts.map(draft => `
            <div class="draft-item ${draft.id === state.currentDraftId ? 'active' : ''} ${draft.isArchived ? 'archived' : ''}" 
                 data-id="${draft.id}">
                <div class="draft-thumbnail">
                    ${draft.thumbnail 
                        ? `<img src="${draft.thumbnail}" alt="${draft.name}">`
                        : '<div class="draft-thumbnail-placeholder">💌</div>'
                    }
                </div>
                <div class="draft-info">
                    <div class="draft-name">${escapeHtml(draft.name)}${draft.isArchived ? ' 📦' : ''}</div>
                    <div class="draft-date">${formatDate(draft.updatedAt)}</div>
                </div>
                <div class="draft-item-actions">
                    <button class="btn-rename" data-action="rename" data-id="${draft.id}" title="重命名">✏️</button>
                    <button class="btn-archive" data-action="archive" data-id="${draft.id}" title="${draft.isArchived ? '取消归档' : '归档'}">
                        ${draft.isArchived ? '📤' : '📦'}
                    </button>
                    <button class="btn-copy" data-action="copy" data-id="${draft.id}" title="复制">📋</button>
                    <button class="btn-delete" data-action="delete" data-id="${draft.id}" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');

        draftListEl.querySelectorAll('.draft-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.draft-item-actions button')) {
                    const draftId = item.dataset.id;
                    switchDraft(draftId);
                }
            });
        });

        draftListEl.querySelectorAll('.draft-item-actions button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const draftId = btn.dataset.id;

                switch (action) {
                    case 'rename':
                        showRenameModal(draftId);
                        break;
                    case 'archive':
                        archiveDraft(draftId);
                        break;
                    case 'copy':
                        copyDraft(draftId);
                        break;
                    case 'delete':
                        showConfirmModal({
                            title: '删除草稿',
                            message: '确定要删除这个草稿吗？此操作无法撤销。',
                            confirmText: '删除',
                            onConfirm: () => deleteDraft(draftId)
                        });
                        break;
                }
            });
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showConfirmModal(options) {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const extraEl = document.getElementById('modal-extra');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        titleEl.textContent = options.title || '确认操作';
        messageEl.textContent = options.message || '确定要执行此操作吗？';
        confirmBtn.textContent = options.confirmText || '确定';
        confirmBtn.className = options.confirmClass || 'btn-danger';
        extraEl.innerHTML = options.extraHtml || '';

        modal.classList.add('active');

        const handleConfirm = () => {
            modal.classList.remove('active');
            cleanup();
            if (options.onConfirm) options.onConfirm();
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
            if (options.onCancel) options.onCancel();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter') handleConfirm();
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    }

    function showRenameModal(draftId) {
        const modal = document.getElementById('rename-modal');
        const input = document.getElementById('rename-input');
        const confirmBtn = document.getElementById('rename-confirm');
        const cancelBtn = document.getElementById('rename-cancel');

        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        input.value = draft.name;
        pendingRenameDraftId = draftId;

        modal.classList.add('active');
        setTimeout(() => input.focus(), 100);

        const handleConfirm = () => {
            const newName = input.value.trim();
            if (newName && pendingRenameDraftId) {
                renameDraft(pendingRenameDraftId, newName);
            }
            closeModal();
        };

        const handleCancel = () => {
            closeModal();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter') handleConfirm();
        };

        const closeModal = () => {
            modal.classList.remove('active');
            pendingRenameDraftId = null;
            cleanup();
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    }

    function saveDraftsToStorage() {
        try {
            localStorage.setItem('letterDrafts', JSON.stringify(state.drafts));
            localStorage.setItem('currentDraftId', state.currentDraftId);
            localStorage.setItem('keepDraftsOnClear', state.keepDraftsOnClear);
        } catch (e) {
            console.warn('无法保存草稿到本地存储:', e);
        }
    }

    function loadDraftsFromStorage() {
        try {
            const savedDrafts = localStorage.getItem('letterDrafts');
            const savedCurrentDraftId = localStorage.getItem('currentDraftId');
            const savedKeepDrafts = localStorage.getItem('keepDraftsOnClear');

            if (savedKeepDrafts !== null) {
                state.keepDraftsOnClear = savedKeepDrafts === 'true';
            }

            if (savedDrafts) {
                state.drafts = JSON.parse(savedDrafts);
                
                if (state.drafts.length > 0) {
                    let targetDraftId = savedCurrentDraftId;
                    if (!targetDraftId || !state.drafts.find(d => d.id === targetDraftId)) {
                        const firstActive = state.drafts.find(d => !d.isArchived);
                        targetDraftId = firstActive ? firstActive.id : state.drafts[0].id;
                    }
                    
                    loadDraft(targetDraftId);
                    return true;
                }
            }

            const legacyDraft = localStorage.getItem('letterDraft');
            if (legacyDraft) {
                const legacyData = JSON.parse(legacyDraft);
                const migratedDraft = {
                    id: generateDraftId(),
                    name: '迁移的草稿',
                    createdAt: legacyData.timestamp || Date.now(),
                    updatedAt: legacyData.timestamp || Date.now(),
                    isArchived: false,
                    thumbnail: null,
                    content: {
                        currentTemplate: legacyData.currentTemplate || 'line',
                        currentMode: legacyData.currentMode || 'text',
                        currentPage: legacyData.currentPage || 0,
                        pageDecorations: legacyData.pageDecorations || { '0': [] },
                        pageDrawingPaths: legacyData.pageDrawingPaths || { '0': [] },
                        selectedDecoration: legacyData.selectedDecoration || null,
                        letterContent: legacyData.letterContent || '',
                        fontFamily: legacyData.fontFamily || 'handwriting1',
                        fontSize: legacyData.fontSize || 20,
                        inkColor: legacyData.inkColor || '#3d3530',
                        wobble: legacyData.wobble || 2,
                        brushColor: legacyData.brushColor || '#3d3530',
                        brushSize: legacyData.brushSize || 3,
                        drawWobble: legacyData.drawWobble || 1.5,
                        receiverName: legacyData.receiverName || '',
                        receiverAddress: legacyData.receiverAddress || '',
                        senderName: legacyData.senderName || '',
                        senderAddress: legacyData.senderAddress || '',
                        transparentBg: legacyData.transparentBg || false,
                        exportScale: legacyData.exportScale || 2
                    }
                };
                state.drafts = [migratedDraft];
                loadDraft(migratedDraft.id);
                saveDraftsToStorage();
                localStorage.removeItem('letterDraft');
                return true;
            }

            return false;
        } catch (e) {
            console.warn('无法从本地存储加载草稿:', e);
            return false;
        }
    }

    function updateUIForState() {
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
        document.getElementById('keep-drafts').checked = state.keepDraftsOnClear;
        document.getElementById('show-archived').checked = state.showArchived;
    }

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
    let currentPath = [];

    function getCurrentPageDecorations() {
        const pageKey = String(state.currentPage);
        if (!state.pageDecorations[pageKey]) {
            state.pageDecorations[pageKey] = [];
        }
        return state.pageDecorations[pageKey];
    }

    function setCurrentPageDecorations(decorations) {
        const pageKey = String(state.currentPage);
        state.pageDecorations[pageKey] = decorations;
    }

    function getCurrentPageDrawingPaths() {
        const pageKey = String(state.currentPage);
        if (!state.pageDrawingPaths[pageKey]) {
            state.pageDrawingPaths[pageKey] = [];
        }
        return state.pageDrawingPaths[pageKey];
    }

    function setCurrentPageDrawingPaths(paths) {
        const pageKey = String(state.currentPage);
        state.pageDrawingPaths[pageKey] = paths;
    }

    function getTotalPages() {
        const pages = calculatePages();
        return pages.length;
    }

    function ensurePageDataExists(pageIndex) {
        const pageKey = String(pageIndex);
        if (!state.pageDecorations[pageKey]) {
            state.pageDecorations[pageKey] = [];
        }
        if (!state.pageDrawingPaths[pageKey]) {
            state.pageDrawingPaths[pageKey] = [];
        }
    }

    const decorationTemplates = {
        flower: { emoji: '🌸', name: '干花', defaultSize: 80 },
        ribbon: { emoji: '🎀', name: '丝带', defaultSize: 90 },
        wax: { emoji: '🔮', name: '火漆印章', defaultSize: 70 },
        stamp: { emoji: '📮', name: '邮票', defaultSize: 75 }
    };

    function generateMaterialId() {
        return 'mat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function applyLowSaturation(imageDataUrl, saturationLevel = 0.4) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    const gray = r * 0.299 + g * 0.587 + b * 0.114;

                    data[i] = gray + (r - gray) * saturationLevel;
                    data[i + 1] = gray + (g - gray) * saturationLevel;
                    data[i + 2] = gray + (b - gray) * saturationLevel;
                    data[i + 3] = a;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = imageDataUrl;
        });
    }

    function resizeImage(imageDataUrl, maxSize = 512) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = imageDataUrl;
        });
    }

    function loadCustomMaterials() {
        try {
            const saved = localStorage.getItem('customMaterials');
            if (saved) {
                state.customMaterials = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('无法加载自定义素材:', e);
            state.customMaterials = [];
        }
    }

    function saveCustomMaterials() {
        try {
            localStorage.setItem('customMaterials', JSON.stringify(state.customMaterials));
        } catch (e) {
            console.warn('无法保存自定义素材:', e);
            alert('素材保存失败，可能是存储空间不足');
        }
    }

    async function handleMaterialUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('请上传图片文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let imageDataUrl = e.target.result;

                imageDataUrl = await resizeImage(imageDataUrl, 512);

                const lowSatImage = await applyLowSaturation(imageDataUrl, 0.4);

                const material = {
                    id: generateMaterialId(),
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    originalData: imageDataUrl,
                    processedData: lowSatImage,
                    createdAt: Date.now()
                };

                state.customMaterials.unshift(material);
                saveCustomMaterials();
                renderCustomMaterials();
            } catch (err) {
                console.error('处理图片失败:', err);
                alert('图片处理失败，请重试');
            }
        };
        reader.readAsDataURL(file);
    }

    function addCustomDecoration(materialId) {
        const material = state.customMaterials.find(m => m.id === materialId);
        if (!material) return;

        const deco = {
            id: Date.now(),
            type: 'custom',
            materialId: materialId,
            imageData: material.processedData,
            name: material.name,
            x: letterCanvas.width / 2 - 60,
            y: letterCanvas.height / 2 - 60,
            size: 120,
            opacity: 1,
            rotation: 0
        };

        const currentDecos = getCurrentPageDecorations();
        currentDecos.push(deco);
        setCurrentPageDecorations(currentDecos);
        renderDecorations();
        updateDecorationList();
        saveToCache();
    }

    function deleteCustomMaterial(materialId) {
        state.customMaterials = state.customMaterials.filter(m => m.id !== materialId);
        saveCustomMaterials();
        renderCustomMaterials();
    }

    function renderCustomMaterials() {
        const grid = document.getElementById('custom-materials-grid');
        if (!grid) return;

        if (state.customMaterials.length === 0) {
            grid.innerHTML = '<div class="custom-materials-empty">暂无素材，点击上方按钮上传</div>';
            return;
        }

        grid.innerHTML = state.customMaterials.map(mat => `
            <div class="custom-material-item" data-id="${mat.id}" title="${escapeHtml(mat.name)}">
                <img src="${mat.processedData}" alt="${escapeHtml(mat.name)}">
                <button class="material-delete" data-id="${mat.id}" title="删除素材">✕</button>
            </div>
        `).join('');

        grid.querySelectorAll('.custom-material-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('material-delete')) {
                    addCustomDecoration(item.dataset.id);
                }
            });
        });

        grid.querySelectorAll('.material-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                showConfirmModal({
                    title: '删除素材',
                    message: '确定要删除这个素材吗？已添加到画布的素材不会被删除。',
                    confirmText: '删除',
                    onConfirm: () => deleteCustomMaterial(id)
                });
            });
        });
    }

    function init() {
        bindEvents();
        
        loadCustomMaterials();
        
        const hasDrafts = loadDraftsFromStorage();
        if (!hasDrafts) {
            createDraft();
        }
        
        renderDraftList();
        renderLetter();
        renderEnvelope();
        updateDecorationList();
        updatePageInfo();
        renderCustomMaterials();
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
            setCurrentPageDrawingPaths([]);
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
            setCurrentPageDecorations([]);
            renderDecorations();
            updateDecorationList();
            saveToCache();
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-nav-btn')) {
                const action = e.target.dataset.action;
                const totalPages = getTotalPages();
                if (action === 'prev' && state.currentPage > 0) {
                    goToPage(state.currentPage - 1);
                } else if (action === 'next' && state.currentPage < totalPages - 1) {
                    goToPage(state.currentPage + 1);
                } else if (action === 'first') {
                    goToPage(0);
                } else if (action === 'last') {
                    goToPage(totalPages - 1);
                }
            }
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
        document.getElementById('new-draft').addEventListener('click', () => {
            createDraft();
        });

        document.getElementById('clear-all-drafts').addEventListener('click', () => {
            const hasArchived = state.drafts.some(d => d.isArchived);
            let extraHtml = '';
            if (hasArchived) {
                extraHtml = `
                    <label>
                        <input type="checkbox" id="include-archived" checked> 
                        同时清除已归档的草稿
                    </label>
                `;
            }
            
            showConfirmModal({
                title: '清空全部草稿',
                message: '确定要清空所有草稿吗？此操作无法撤销。',
                confirmText: '清空全部',
                extraHtml: extraHtml,
                onConfirm: () => {
                    const includeArchivedEl = document.getElementById('include-archived');
                    const includeArchived = includeArchivedEl ? includeArchivedEl.checked : true;
                    clearAllDrafts(includeArchived);
                }
            });
        });

        document.getElementById('show-archived').addEventListener('change', (e) => {
            state.showArchived = e.target.checked;
            renderDraftList();
            saveDraftsToStorage();
        });

        document.getElementById('keep-drafts').addEventListener('change', (e) => {
            state.keepDraftsOnClear = e.target.checked;
            saveDraftsToStorage();
        });

        document.getElementById('save-draft').addEventListener('click', () => {
            saveCurrentDraft();
            renderDraftList();
            alert('草稿已保存！');
        });

        document.getElementById('load-draft').addEventListener('click', () => {
            if (state.currentDraftId) {
                const draft = state.drafts.find(d => d.id === state.currentDraftId);
                if (draft) {
                    loadDraft(draft.id);
                    alert('草稿已恢复！');
                }
            }
        });

        document.getElementById('clear-cache').addEventListener('click', () => {
            if (state.keepDraftsOnClear) {
                showConfirmModal({
                    title: '清除缓存',
                    message: '将清除临时设置，但保留所有草稿和自定义素材。确定继续吗？',
                    confirmText: '清除缓存',
                    confirmClass: 'btn-danger',
                    onConfirm: () => {
                        const keysToKeep = ['letterDrafts', 'currentDraftId', 'keepDraftsOnClear', 'customMaterials'];
                        Object.keys(localStorage).forEach(key => {
                            if (!keysToKeep.includes(key)) {
                                localStorage.removeItem(key);
                            }
                        });
                        alert('缓存已清除，草稿和素材已保留！');
                        location.reload();
                    }
                });
            } else {
                showConfirmModal({
                    title: '清除所有数据',
                    message: '将清除所有数据，包括草稿和自定义素材。确定继续吗？此操作无法撤销！',
                    confirmText: '清除全部',
                    confirmClass: 'btn-danger',
                    onConfirm: () => {
                        localStorage.clear();
                        location.reload();
                    }
                });
            }
        });

        document.getElementById('custom-material-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleMaterialUpload(file);
                e.target.value = '';
            }
        });

        drawingCanvas.style.pointerEvents = 'none';
        setupDrawingEvents();
    }

    function goToPage(pageIndex) {
        const totalPages = getTotalPages();
        if (pageIndex < 0 || pageIndex >= totalPages) return;
        
        ensurePageDataExists(pageIndex);
        state.currentPage = pageIndex;
        state.selectedDecoration = null;
        
        renderLetter();
        renderDecorations();
        updatePageInfo();
        updateDecorationList();
        redrawCurrentPagePaths();
        saveToCache();
    }

    function redrawCurrentPagePaths() {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        const currentPaths = getCurrentPageDrawingPaths();
        currentPaths.forEach(path => {
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
                const currentPaths = getCurrentPageDrawingPaths();
                currentPaths.push([...currentPath]);
                setCurrentPageDrawingPaths(currentPaths);
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
            const pages = calculatePages();
            if (state.currentPage >= pages.length) {
                state.currentPage = Math.max(0, pages.length - 1);
                redrawCurrentPagePaths();
                renderDecorations();
            }
            drawHandwrittenText();
        }
        updatePageInfo();
    }

    function updatePageInfo() {
        const pages = calculatePages();
        const totalPages = pages.length;
        const pageInfoEl = document.getElementById('page-info');
        if (pageInfoEl) {
            const currentDisplay = state.currentPage + 1;
            if (totalPages > 1) {
                pageInfoEl.innerHTML = `
                    <div class="pagination-container">
                        <span class="page-count">📄 第 ${currentDisplay} / ${totalPages} 页</span>
                        <div class="pagination-controls">
                            <button class="page-nav-btn" data-action="first" title="第一页" ${state.currentPage === 0 ? 'disabled' : ''}>⏮</button>
                            <button class="page-nav-btn" data-action="prev" title="上一页" ${state.currentPage === 0 ? 'disabled' : ''}>◀ 上一页</button>
                            <button class="page-nav-btn" data-action="next" title="下一页" ${state.currentPage >= totalPages - 1 ? 'disabled' : ''}>下一页 ▶</button>
                            <button class="page-nav-btn" data-action="last" title="最后一页" ${state.currentPage >= totalPages - 1 ? 'disabled' : ''}>⏭</button>
                        </div>
                    </div>
                `;
            } else {
                pageInfoEl.innerHTML = `
                    <div class="pagination-container">
                        <span class="page-count">📄 当前内容共 1 页</span>
                    </div>
                `;
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
        const pages = calculatePages();
        const pageInfo = pages[state.currentPage] || pages[0];
        const pageContent = state.letterContent.substring(pageInfo.startChar, pageInfo.endChar);
        const lines = pageContent.split('\n');
        
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
            drawVerticalText(lines, startX, startY, lineHeight, pageInfo.startChar);
        } else {
            drawHorizontalText(lines, startX, startY, lineHeight, w - 120, pageInfo.startChar);
        }
    }

    function drawHorizontalText(lines, startX, startY, lineHeight, maxWidth, globalStartChar = 0) {
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

    function drawVerticalText(lines, startX, startY, colWidth, globalStartChar = 0) {
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
        const currentDecos = getCurrentPageDecorations();
        currentDecos.push(deco);
        setCurrentPageDecorations(currentDecos);
        renderDecorations();
        updateDecorationList();
        saveToCache();
    }

    function renderDecorations() {
        decorationLayer.innerHTML = '';
        const currentDecos = getCurrentPageDecorations();
        
        currentDecos.forEach(deco => {
            const el = document.createElement('div');
            el.className = 'decoration' + (state.selectedDecoration === deco.id ? ' selected' : '');
            el.dataset.id = deco.id;
            el.style.left = deco.x + 'px';
            el.style.top = deco.y + 'px';
            el.style.width = deco.size + 'px';
            el.style.height = deco.size + 'px';
            el.style.opacity = deco.opacity;
            el.style.transform = `rotate(${deco.rotation}deg)`;
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.textAlign = 'center';

            if (deco.type === 'custom' && deco.imageData) {
                const img = document.createElement('img');
                img.src = deco.imageData;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.pointerEvents = 'none';
                el.appendChild(img);
            } else {
                el.style.fontSize = (deco.size * 0.9) + 'px';
                el.textContent = deco.emoji;
            }

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
        const currentDecos = getCurrentPageDecorations();
        const totalPages = getTotalPages();
        
        let pageSelectorHtml = '';
        if (totalPages > 1) {
            pageSelectorHtml = `
                <div class="page-decoration-header">
                    <span style="font-weight:600; margin-right:10px;">当前页面：</span>
                    <div class="page-tabs">
                        ${Array.from({ length: totalPages }, (_, i) => 
                            `<button class="page-tab-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">第 ${i + 1} 页</button>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        if (currentDecos.length === 0) {
            list.innerHTML = `
                ${pageSelectorHtml}
                <div class="empty-state">第 ${state.currentPage + 1} 页还没有添加装饰，点击左侧装饰按钮添加干花、丝带、火漆印章或邮票吧~</div>
            `;
            
            list.querySelectorAll('.page-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    goToPage(parseInt(btn.dataset.page));
                });
            });
            return;
        }

        list.innerHTML = pageSelectorHtml;
        
        currentDecos.forEach(deco => {
            const item = document.createElement('div');
            item.className = 'decoration-item';

            const previewHtml = (deco.type === 'custom' && deco.imageData)
                ? `<div class="deco-preview"><img src="${deco.imageData}" style="width:100%;height:100%;object-fit:contain;"></div>`
                : `<div class="deco-preview">${deco.emoji}</div>`;

            item.innerHTML = `
                ${previewHtml}
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

        list.querySelectorAll('.page-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                goToPage(parseInt(btn.dataset.page));
            });
        });

        list.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseInt(e.target.dataset.id);
                const prop = e.target.dataset.prop;
                const decos = getCurrentPageDecorations();
                const deco = decos.find(d => d.id === id);
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
                const decos = getCurrentPageDecorations();
                const newDecos = decos.filter(d => d.id !== id);
                setCurrentPageDecorations(newDecos);
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

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async function exportLetter() {
        const pages = calculatePages();
        const scale = state.exportScale;
        const timestamp = Date.now();

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

            ensurePageDataExists(pageIndex);
            const pageDecos = state.pageDecorations[String(pageIndex)] || [];
            const pageDrawings = state.pageDrawingPaths[String(pageIndex)] || [];

            pageDrawings.forEach(path => {
                if (path.length < 2) return;
                ctx.strokeStyle = path[0].color;
                ctx.lineWidth = path[0].size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.stroke();
            });

            for (const deco of pageDecos) {
                ctx.save();
                ctx.globalAlpha = deco.opacity;
                ctx.translate(deco.x + deco.size / 2, deco.y + deco.size / 2);
                ctx.rotate(deco.rotation * Math.PI / 180);
                if (deco.type === 'custom' && deco.imageData) {
                    try {
                        const img = await loadImage(deco.imageData);
                        ctx.drawImage(img, -deco.size / 2, -deco.size / 2, deco.size, deco.size);
                    } catch (e) {
                        console.warn('加载装饰图片失败:', e);
                    }
                } else {
                    ctx.font = (deco.size * 0.9) + 'px serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(deco.emoji, 0, 0);
                }
                ctx.restore();
            }

            const link = document.createElement('a');
            link.download = `letter_${timestamp}_page${pageIndex + 1}.png`;
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

    let autoSaveTimeout = null;

    function saveToCache() {
        const saveData = {
            currentTemplate: state.currentTemplate,
            currentMode: state.currentMode,
            currentPage: state.currentPage,
            pageDecorations: state.pageDecorations,
            pageDrawingPaths: state.pageDrawingPaths,
            selectedDecoration: state.selectedDecoration,
            letterContent: state.letterContent,
            fontFamily: state.fontFamily,
            fontSize: state.fontSize,
            inkColor: state.inkColor,
            wobble: state.wobble,
            brushColor: state.brushColor,
            brushSize: state.brushSize,
            drawWobble: state.drawWobble,
            receiverName: state.receiverName,
            receiverAddress: state.receiverAddress,
            senderName: state.senderName,
            senderAddress: state.senderAddress,
            transparentBg: state.transparentBg,
            exportScale: state.exportScale,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('letterDraft', JSON.stringify(saveData));
        } catch (e) {
            console.warn('无法保存到本地存储:', e);
        }

        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        autoSaveTimeout = setTimeout(() => {
            if (state.currentDraftId) {
                const draftIndex = state.drafts.findIndex(d => d.id === state.currentDraftId);
                if (draftIndex !== -1) {
                    const draft = state.drafts[draftIndex];
                    draft.content = getDraftContentFromState();
                    draft.updatedAt = Date.now();
                    saveDraftsToStorage();
                    renderDraftList();
                }
            }
        }, 1000);
    }

    function loadFromCache() {
        try {
            const cached = localStorage.getItem('letterDraft');
            if (cached) {
                const data = JSON.parse(cached);
                
                state.currentTemplate = data.currentTemplate || 'line';
                state.currentMode = data.currentMode || 'text';
                state.currentPage = data.currentPage || 0;
                state.selectedDecoration = data.selectedDecoration || null;
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

                if (data.pageDecorations) {
                    state.pageDecorations = data.pageDecorations;
                } else if (data.decorations && data.decorations.length > 0) {
                    state.pageDecorations = { '0': data.decorations };
                } else {
                    state.pageDecorations = { '0': [] };
                }

                if (data.pageDrawingPaths) {
                    state.pageDrawingPaths = data.pageDrawingPaths;
                } else if (data.drawingPaths && data.drawingPaths.length > 0) {
                    state.pageDrawingPaths = { '0': data.drawingPaths };
                } else {
                    state.pageDrawingPaths = { '0': [] };
                }
                
                redrawCurrentPagePaths();

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

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.decoration') && !e.target.closest('.decoration-item')) {
            state.selectedDecoration = null;
            renderDecorations();
        }
    });

    document.addEventListener('DOMContentLoaded', init);
})();
