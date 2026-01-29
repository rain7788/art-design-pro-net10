/**
 * ArtSwagger - Art-Design-Pro Style Swagger UI
 * A beautiful, modern Swagger UI skin with knife4j-like features
 * 
 * @author SeaCode
 * @license MIT
 * @version 1.0.0
 */

(function () {
    'use strict';

    // ============================================
    // Global State
    // ============================================
    const state = {
        currentSpec: null,
        currentGroup: null,
        currentOperation: null,
        operations: [],
        tags: [],
        bearerToken: '',
        theme: 'auto',
        searchIndex: [],
        selectedSearchIndex: -1,
        // Tab management
        openTabs: [],       // Array of { id, path, method, title, operation }
        activeTabId: null,
        tabsByGroup: {}     // { groupName: { tabs: [], activeTabId: null } }
    };

    // ============================================
    // Configuration
    // ============================================
    const config = window.ArtSwaggerConfig || {
        urls: [],
        primaryColor: '#5D87FF',
        defaultTheme: 'auto',
        documentTitle: 'API Documentation',
        enableSearch: true,
        enableCodeCopy: true
    };

    // ============================================
    // DOM Elements Cache
    // ============================================
    const elements = {};

    // ============================================
    // Initialization
    // ============================================
    function init() {
        cacheElements();
        initTheme();
        initSidebarState();
        initEventListeners();
        initHashListener();
        loadGroups();
        loadGlobalParams();
    }

    function cacheElements() {
        elements.groupSelector = document.getElementById('groupSelector');
        elements.groupToggle = document.getElementById('groupToggle');
        elements.groupDropdown = document.getElementById('groupDropdown');
        elements.currentGroupName = document.getElementById('currentGroupName');
        elements.searchBtn = document.getElementById('searchBtn');
        elements.themeToggle = document.getElementById('themeToggle');
        elements.sidebar = document.getElementById('sidebar');
        elements.sidebarSearch = document.getElementById('sidebarSearch');
        elements.apiNav = document.getElementById('apiNav');
        elements.content = document.getElementById('content');
        elements.welcomePanel = document.getElementById('welcomePanel');
        elements.welcomeStats = document.getElementById('welcomeStats');
        elements.tabsBar = document.getElementById('tabsBar');
        elements.tabPanels = document.getElementById('tabPanels');
        elements.searchModal = document.getElementById('searchModal');
        elements.globalSearchInput = document.getElementById('globalSearchInput');
        elements.searchResults = document.getElementById('searchResults');
        elements.toastContainer = document.getElementById('toastContainer');
    }

    // ============================================
    // Theme Management
    // ============================================
    function initTheme() {
        const savedTheme = localStorage.getItem('art-swagger-theme') || config.defaultTheme;
        state.theme = savedTheme;
        applyTheme(savedTheme);

        // Apply custom primary color
        if (config.primaryColor) {
            document.documentElement.style.setProperty('--art-primary', config.primaryColor);
        }
    }

    function applyTheme(theme) {
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', prefersDark);
        } else {
            document.documentElement.classList.toggle('dark', theme === 'dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        state.theme = isDark ? 'light' : 'dark';
        localStorage.setItem('art-swagger-theme', state.theme);
        applyTheme(state.theme);
    }

    // ============================================
    // Sidebar Toggle
    // ============================================
    function toggleSidebar() {
        elements.sidebar.classList.toggle('collapsed');
        // Save state
        localStorage.setItem('art-swagger-sidebar', elements.sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    }

    function initSidebarState() {
        const savedState = localStorage.getItem('art-swagger-sidebar');
        if (savedState === 'collapsed') {
            elements.sidebar.classList.add('collapsed');
        }
    }

    // ============================================
    // Refresh Current Group
    // ============================================
    function refreshCurrentGroup() {
        if (state.currentGroup) {
            selectGroup(state.currentGroup.url, state.currentGroup.name);
        }
    }

    // ============================================
    // Event Listeners
    // ============================================
    function initEventListeners() {
        // Theme toggle
        elements.themeToggle.addEventListener('click', toggleTheme);

        // Group selector
        elements.groupToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.groupSelector.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            elements.groupSelector.classList.remove('open');
        });

        // Search
        elements.searchBtn.addEventListener('click', () => openSearch());

        // Sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', refreshCurrentGroup);

        // Global Params (both sidebar and header buttons)
        document.getElementById('globalParamsBtn')?.addEventListener('click', () => openGlobalParams());
        document.getElementById('globalParamsBtnHeader')?.addEventListener('click', () => openGlobalParams());

        // Sidebar filter
        elements.sidebarSearch.addEventListener('input', debounce(filterSidebar, 200));

        // Global search input
        elements.globalSearchInput.addEventListener('input', debounce(handleGlobalSearch, 200));
        elements.globalSearchInput.addEventListener('keydown', handleSearchKeydown);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleGlobalKeydown);

        // System theme change
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (state.theme === 'auto') {
                applyTheme('auto');
            }
        });
    }

    function handleGlobalKeydown(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            closeSearch();
            closeAuth();
        }
    }

    function handleSearchKeydown(e) {
        const results = elements.searchResults.querySelectorAll('.art-search-result');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            state.selectedSearchIndex = Math.min(state.selectedSearchIndex + 1, results.length - 1);
            updateSearchSelection(results);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            state.selectedSearchIndex = Math.max(state.selectedSearchIndex - 1, 0);
            updateSearchSelection(results);
        } else if (e.key === 'Enter' && state.selectedSearchIndex >= 0) {
            e.preventDefault();
            const selected = results[state.selectedSearchIndex];
            if (selected) {
                const path = selected.dataset.path;
                const method = selected.dataset.method;
                selectOperation(path, method);
                closeSearch();
            }
        }
    }

    function updateSearchSelection(results) {
        results.forEach((r, i) => {
            r.classList.toggle('selected', i === state.selectedSearchIndex);
        });

        // Scroll into view
        const selected = results[state.selectedSearchIndex];
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    // ============================================
    // API Groups / Specs Loading
    // ============================================
    function loadGroups() {
        const urls = config.urls;

        if (!urls || urls.length === 0) {
            showToast('未配置 API 文档地址', 'error');
            return;
        }

        // Render group dropdown
        elements.groupDropdown.innerHTML = urls.map((item, index) => `
            <div class="art-group-item${index === 0 ? ' active' : ''}" data-url="${item.url}" data-name="${item.name}">
                ${item.name}
            </div>
        `).join('');

        // Add click handlers
        elements.groupDropdown.querySelectorAll('.art-group-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = item.dataset.url;
                const name = item.dataset.name;
                selectGroup(url, name);
                elements.groupSelector.classList.remove('open');
            });
        });

        // Load first group
        const first = urls[0];
        selectGroup(first.url, first.name);
    }

    async function selectGroup(url, name) {
        // Save current group's tabs before switching
        if (state.currentGroup) {
            const oldGroupKey = state.currentGroup.name;
            state.tabsByGroup[oldGroupKey] = {
                tabs: [...state.openTabs],
                activeTabId: state.activeTabId
            };
        }

        state.currentGroup = { url, name };
        elements.currentGroupName.textContent = name;

        // Restore tabs for new group (or start fresh)
        const savedState = state.tabsByGroup[name];
        if (savedState) {
            state.openTabs = [...savedState.tabs];
            state.activeTabId = savedState.activeTabId;
        } else {
            state.openTabs = [];
            state.activeTabId = null;
        }

        // Switch global params for this group
        switchGroupParams();

        // Update active state in dropdown
        elements.groupDropdown.querySelectorAll('.art-group-item').forEach(item => {
            item.classList.toggle('active', item.dataset.url === url);
        });

        // Show loading
        elements.apiNav.innerHTML = `
            <div class="art-nav-loading">
                <div class="art-spinner"></div>
                <span>加载中...</span>
            </div>
        `;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const spec = await response.json();
            state.currentSpec = spec;

            parseSpec(spec);
            renderSidebar();
            renderWelcomeStats();

            // Check URL hash first, then try to restore saved tab state
            if (!restoreFromHash()) {
                // Try to restore saved tab state for this group
                if (state.openTabs.length > 0 && state.activeTabId) {
                    // Re-link operations to tabs (operations were re-parsed)
                    state.openTabs = state.openTabs.map(tab => {
                        const op = state.operations.find(o => o.path === tab.path && o.method === tab.method);
                        return op ? { ...tab, operation: op } : null;
                    }).filter(Boolean);

                    if (state.openTabs.length > 0) {
                        const activeTab = state.openTabs.find(t => t.id === state.activeTabId);
                        if (activeTab) {
                            renderTabs();
                            activateTab(state.activeTabId);
                        } else {
                            state.activeTabId = null;
                            showWelcome();
                        }
                    } else {
                        state.activeTabId = null;
                        showWelcome();
                    }
                } else {
                    showWelcome();
                }
            }
        } catch (error) {
            console.error('Failed to load spec:', error);
            elements.apiNav.innerHTML = `
                <div class="art-empty">
                    <svg class="art-empty-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>
                    <p class="art-empty-text">加载失败: ${error.message}</p>
                </div>
            `;
            showToast(`加载 API 文档失败: ${error.message}`, 'error');
        }
    }

    // ============================================
    // OpenAPI Spec Parsing
    // ============================================
    function parseSpec(spec) {
        state.operations = [];
        state.tags = [];
        state.searchIndex = [];

        const paths = spec.paths || {};
        const tagMap = new Map();

        // Collect all operations
        Object.entries(paths).forEach(([path, pathItem]) => {
            const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

            methods.forEach(method => {
                const operation = pathItem[method];
                if (!operation) return;

                const tags = operation.tags || ['default'];
                const op = {
                    path,
                    method,
                    operationId: operation.operationId || `${method}_${path}`,
                    summary: operation.summary || '',
                    description: operation.description || '',
                    tags,
                    deprecated: operation.deprecated || false,
                    parameters: operation.parameters || [],
                    requestBody: operation.requestBody,
                    responses: operation.responses || {},
                    security: operation.security
                };

                state.operations.push(op);

                // Build search index
                state.searchIndex.push({
                    path,
                    method,
                    summary: op.summary,
                    text: `${method} ${path} ${op.summary} ${op.description}`.toLowerCase()
                });

                // Group by tags
                tags.forEach(tag => {
                    if (!tagMap.has(tag)) {
                        tagMap.set(tag, []);
                    }
                    tagMap.get(tag).push(op);
                });
            });
        });

        // Build tags array with operations
        state.tags = Array.from(tagMap.entries()).map(([name, ops]) => ({
            name,
            description: getTagDescription(spec, name),
            operations: ops
        }));
    }

    function getTagDescription(spec, tagName) {
        const tags = spec.tags || [];
        const tag = tags.find(t => t.name === tagName);
        return tag ? tag.description : '';
    }

    // ============================================
    // Sidebar Rendering
    // ============================================
    function renderSidebar() {
        if (state.tags.length === 0) {
            elements.apiNav.innerHTML = `
                <div class="art-empty">
                    <svg class="art-empty-icon" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="currentColor"/></svg>
                    <p class="art-empty-text">暂无接口</p>
                </div>
            `;
            return;
        }

        elements.apiNav.innerHTML = state.tags.map(tag => `
            <div class="art-nav-tag collapsed" data-tag="${escapeHtml(tag.name)}">
                <div class="art-nav-tag-header">
                    <svg class="art-nav-tag-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7z" fill="currentColor"/></svg>
                    <span class="art-nav-tag-name">${escapeHtml(tag.name)}</span>
                    <span class="art-nav-tag-count">${tag.operations.length}</span>
                </div>
                <div class="art-nav-tag-items" style="max-height: ${tag.operations.length * 40}px;">
                    ${tag.operations.map(op => {
            // 优先显示 summary，其次 operationId，最后显示路径
            const displayName = op.summary || op.operationId || op.path;
            return `
                        <div class="art-nav-item${op.deprecated ? ' art-deprecated' : ''}" 
                             data-path="${escapeHtml(op.path)}" 
                             data-method="${op.method}">
                            <span class="art-method-badge ${op.method}">${op.method}</span>
                            <span class="art-nav-item-path" title="${escapeHtml(op.path)}">${escapeHtml(displayName)}</span>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `).join('');

        // Add click handlers for tags
        elements.apiNav.querySelectorAll('.art-nav-tag-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });

        // Add click handlers for operations
        elements.apiNav.querySelectorAll('.art-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                const method = item.dataset.method;
                selectOperation(path, method);
            });
        });
    }

    function filterSidebar(e) {
        const query = (e?.target?.value || '').toLowerCase().trim();
        const tags = elements.apiNav.querySelectorAll('.art-nav-tag');

        tags.forEach(tag => {
            const items = tag.querySelectorAll('.art-nav-item');
            let visibleCount = 0;

            items.forEach(item => {
                const path = item.dataset.path.toLowerCase();
                const method = item.dataset.method.toLowerCase();
                const displayName = item.querySelector('.art-nav-item-path')?.textContent?.toLowerCase() || '';
                const matches = !query || path.includes(query) || method.includes(query) || displayName.includes(query);
                item.style.display = matches ? '' : 'none';
                if (matches) visibleCount++;
            });

            tag.style.display = visibleCount > 0 ? '' : 'none';
            tag.querySelector('.art-nav-tag-count').textContent = visibleCount;

            // Expand tags when searching
            if (query && visibleCount > 0) {
                tag.classList.remove('collapsed');
            }
        });
    }

    // ============================================
    // Welcome Panel
    // ============================================
    function renderWelcomeStats() {
        const methodCounts = {
            get: 0, post: 0, put: 0, delete: 0, other: 0
        };

        state.operations.forEach(op => {
            if (methodCounts.hasOwnProperty(op.method)) {
                methodCounts[op.method]++;
            } else {
                methodCounts.other++;
            }
        });

        elements.welcomeStats.innerHTML = `
            <div class="art-stat-item">
                <span class="art-stat-value">${state.operations.length}</span>
                <span class="art-stat-label">总接口数</span>
            </div>
            <div class="art-stat-item">
                <span class="art-stat-value" style="color: var(--art-method-get)">${methodCounts.get}</span>
                <span class="art-stat-label">GET</span>
            </div>
            <div class="art-stat-item">
                <span class="art-stat-value" style="color: var(--art-method-post)">${methodCounts.post}</span>
                <span class="art-stat-label">POST</span>
            </div>
            <div class="art-stat-item">
                <span class="art-stat-value" style="color: var(--art-method-put)">${methodCounts.put}</span>
                <span class="art-stat-label">PUT</span>
            </div>
            <div class="art-stat-item">
                <span class="art-stat-value" style="color: var(--art-method-delete)">${methodCounts.delete}</span>
                <span class="art-stat-label">DELETE</span>
            </div>
        `;
    }

    function showWelcome() {
        elements.welcomePanel.style.display = '';
        elements.tabPanels.classList.remove('active');
        state.currentOperation = null;
        state.activeTabId = null; // 不清空 openTabs，保留已打开的标签
        renderTabs();
        updateHeaderTitle(null); // 更新标题为默认

        // Remove active state from nav items
        elements.apiNav.querySelectorAll('.art-nav-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // ============================================
    // Tab Management
    // ============================================
    const MAX_TABS = 10; // Maximum number of open tabs

    function generateTabId(path, method) {
        return `tab_${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    function openTab(path, method) {
        const operation = state.operations.find(op => op.path === path && op.method === method);
        if (!operation) return;

        const tabId = generateTabId(path, method);

        // Check if tab already exists
        const existingTab = state.openTabs.find(t => t.id === tabId);
        if (existingTab) {
            renderTabs(); // Ensure tabs are rendered (important for group switching)
            activateTab(tabId);
            return;
        }

        // If too many tabs, close the oldest one (not the active one)
        while (state.openTabs.length >= MAX_TABS) {
            const oldestTab = state.openTabs.find(t => t.id !== state.activeTabId);
            if (oldestTab) {
                closeTab(oldestTab.id);
            } else {
                // All tabs are active? Close the first one
                closeTab(state.openTabs[0].id);
            }
        }

        // Create new tab
        const newTab = {
            id: tabId,
            path,
            method,
            title: operation.summary || path,
            operation
        };
        state.openTabs.push(newTab);

        renderTabs();
        activateTab(tabId);

        // Update nav active state
        updateNavActiveState(path, method);
    }

    function closeTab(tabId, event) {
        if (event) {
            event.stopPropagation();
        }

        const tabIndex = state.openTabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        state.openTabs.splice(tabIndex, 1);

        // Remove tab panel
        const panel = document.getElementById(`panel_${tabId}`);
        if (panel) panel.remove();

        // If closing active tab, activate another
        if (state.activeTabId === tabId) {
            if (state.openTabs.length > 0) {
                // Activate previous tab or first tab
                const newIndex = Math.min(tabIndex, state.openTabs.length - 1);
                activateTab(state.openTabs[newIndex].id);
            } else {
                // No tabs left, show welcome
                state.activeTabId = null;
                state.currentOperation = null;
                elements.welcomePanel.style.display = '';
                elements.tabPanels.classList.remove('active');
                clearNavActiveState();
                clearUrlHash();
            }
        }

        renderTabs();
    }

    function activateTab(tabId) {
        const tab = state.openTabs.find(t => t.id === tabId);
        if (!tab) return;

        state.activeTabId = tabId;
        state.currentOperation = tab.operation;

        // Update URL hash (without triggering hashchange handler)
        updateUrlHash(tab.method, tab.path);

        // Update tab button states
        elements.tabsBar.querySelectorAll('.art-tab-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tabId === tabId);
        });

        // Show/hide panels
        elements.welcomePanel.style.display = 'none';
        elements.tabPanels.classList.add('active');

        // Render or show panel
        let panel = document.getElementById(`panel_${tabId}`);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = `panel_${tabId}`;
            panel.className = 'art-tab-panel art-api-detail';
            panel.innerHTML = renderOperationContent(tab.operation);
            elements.tabPanels.appendChild(panel);
            initMainTabEvents(panel);
        }

        // Activate this panel, hide others
        elements.tabPanels.querySelectorAll('.art-tab-panel').forEach(p => {
            p.classList.toggle('active', p.id === `panel_${tabId}`);
        });

        // Update nav
        updateNavActiveState(tab.path, tab.method);

        // Update header title
        updateHeaderTitle(tab.operation);
    }

    function updateHeaderTitle(operation) {
        const titleEl = document.querySelector('.art-header-title');
        if (titleEl) {
            if (operation) {
                const methodClass = operation.method.toLowerCase();
                titleEl.innerHTML = `<span class="art-header-method ${methodClass}">${operation.method.toUpperCase()}</span> ${escapeHtml(operation.summary || operation.path)}`;
            } else {
                titleEl.textContent = '接口概览';
            }
        }
    }

    function renderTabs() {
        // 固定的概览标签 - 始终显示
        const homeTab = `
            <div class="art-tab-item home ${!state.activeTabId ? 'active' : ''}" 
                 data-tab-id="home" 
                 onclick="ArtSwagger.showWelcome()">
                <svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink:0"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor"/></svg>
                <span class="art-tab-title">概览</span>
            </div>
        `;

        const apiTabs = state.openTabs.map(tab => `
            <div class="art-tab-item ${tab.id === state.activeTabId ? 'active' : ''}" 
                 data-tab-id="${tab.id}" 
                 onclick="ArtSwagger.activateTab('${tab.id}')">
                <span class="art-tab-method ${tab.method}">${tab.method.toUpperCase()}</span>
                <span class="art-tab-title">${escapeHtml(tab.title)}</span>
                <span class="art-tab-close" onclick="ArtSwagger.closeTab('${tab.id}', event)">
                    <svg viewBox="0 0 24 24" width="12" height="12"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/></svg>
                </span>
            </div>
        `).join('');

        elements.tabsBar.innerHTML = homeTab + apiTabs;
    }

    function updateNavActiveState(path, method) {
        elements.apiNav.querySelectorAll('.art-nav-item').forEach(item => {
            const isActive = item.dataset.path === path && item.dataset.method === method;
            item.classList.toggle('active', isActive);
        });
    }

    function clearNavActiveState() {
        elements.apiNav.querySelectorAll('.art-nav-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // ============================================
    // URL Hash Routing
    // ============================================
    function updateUrlHash(method, path) {
        const hash = `#${method.toUpperCase()}${path}`;
        if (window.location.hash !== hash) {
            history.replaceState(null, '', hash);
        }
    }

    function clearUrlHash() {
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }
    }

    function restoreFromHash() {
        const hash = window.location.hash;
        if (!hash || hash.length < 2) return false;

        // Parse hash: #GET/path or #POST/path
        const content = hash.substring(1);  // Remove #
        const methodMatch = content.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)/i);
        if (!methodMatch) return false;

        const method = methodMatch[1].toLowerCase();
        const path = content.substring(methodMatch[1].length);

        // Find operation
        const operation = state.operations.find(op => op.path === path && op.method === method);
        if (operation) {
            openTab(path, method);
            return true;
        }
        return false;
    }

    function initHashListener() {
        window.addEventListener('hashchange', () => {
            restoreFromHash();
        });
    }

    // ============================================
    // Operation Detail (legacy wrapper)
    // ============================================
    function selectOperation(path, method) {
        openTab(path, method);
    }

    function renderOperationContent(op) {
        const parameters = resolveParameters(op);
        const requestBody = resolveRequestBody(op);
        const responses = resolveResponses(op);

        return `
            <!-- Header -->
            <div class="art-api-header">
                <span class="art-api-method ${op.method}">${op.method.toUpperCase()}</span>
                <div class="art-api-info">
                    <div class="art-api-path-row">
                        <span class="art-api-path">${escapeHtml(op.path)}</span>
                        ${op.summary ? `<span class="art-api-summary">${escapeHtml(op.summary)}</span>` : ''}
                    </div>
                </div>
                <div class="art-api-actions">
                    <span class="art-api-tags">
                        ${op.tags.map(t => `<span class="art-api-tag">${escapeHtml(t)}</span>`).join('')}
                        ${op.deprecated ? '<span class="art-deprecated-badge">已废弃</span>' : ''}
                    </span>
                    <button class="art-btn art-btn-secondary art-btn-icon" onclick="ArtSwagger.copyAsCurl()" title="复制 cURL">
                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>

            <!-- Main Tabs: Document vs Debug -->
            <div class="art-main-tabs" id="mainTabs">
                <button class="art-main-tab active" data-tab="document">
                    <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>
                    文档
                </button>
                <button class="art-main-tab" data-tab="debug">
                    <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" fill="currentColor"/></svg>
                    调试
                </button>
            </div>

            <!-- Document Tab Content -->
            <div class="art-main-tab-content active" id="tabDocument">
                ${op.description ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/></svg>
                            接口描述
                        </span>
                    </div>
                    <div class="art-card-body">
                        <p class="art-description-text">${escapeHtml(op.description)}</p>
                    </div>
                </div>
                ` : ''}

                <!-- Request Parameters Documentation -->
                ${parameters.length > 0 ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" fill="currentColor"/></svg>
                            请求参数
                        </span>
                        <span class="art-card-badge">${parameters.length}</span>
                    </div>
                    <div class="art-card-body" style="padding: 0;">
                        <table class="art-params-table art-doc-table">
                            <thead>
                                <tr>
                                    <th style="width: 20%;">参数名</th>
                                    <th style="width: 10%;">位置</th>
                                    <th style="width: 15%;">类型</th>
                                    <th style="width: 8%;">必填</th>
                                    <th style="width: 47%;">说明</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parameters.map(p => `
                                    <tr>
                                        <td><code class="art-param-name">${escapeHtml(p.name)}</code></td>
                                        <td><span class="art-param-in ${p.in}">${p.in}</span></td>
                                        <td><span class="art-param-type">${escapeHtml(p.type)}${p.format ? ` <small>(${p.format})</small>` : ''}</span></td>
                                        <td>${p.required ? '<span class="art-param-required">是</span>' : '<span class="art-param-optional">否</span>'}</td>
                                        <td>
                                            ${escapeHtml(p.description || '-')}
                                            ${p.default !== undefined ? `<br><small class="art-default-value">默认: ${p.default}</small>` : ''}
                                            ${p.example !== undefined ? `<br><small class="art-example-value">示例: ${p.example}</small>` : ''}
                                            ${p.enum ? `<br><small class="art-enum-values">枚举: ${p.enum.join(' | ')}</small>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <!-- Request Body Schema Documentation -->
                ${requestBody && requestBody.schema ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/></svg>
                            请求体结构
                        </span>
                        <span class="art-card-subtitle">${requestBody.contentType}${requestBody.required ? ' · 必填' : ''}</span>
                    </div>
                    <div class="art-card-body" style="padding: 0;">
                        ${requestBody.schema.properties ? `
                        <table class="art-params-table art-doc-table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">字段名</th>
                                    <th style="width: 18%;">类型</th>
                                    <th style="width: 10%;">必填</th>
                                    <th style="width: 47%;">说明</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderSchemaProperties(requestBody.schema)}
                            </tbody>
                        </table>
                        ` : '<div class="art-empty-schema">无结构化字段定义</div>'}
                    </div>
                </div>
                ` : ''}

                <!-- Response Schema Documentation -->
                ${Object.keys(responses).length > 0 ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" fill="currentColor"/></svg>
                            响应结构
                        </span>
                    </div>
                    <div class="art-card-body" style="padding: 0;">
                        ${Object.entries(responses).map(([code, resp]) => {
            // Check if schema has properties (directly or in array items)
            const hasProperties = resp.schema && (
                resp.schema.properties ||
                (resp.schema.type === 'array' && resp.schema.items) ||
                resp.schema._isArray
            );
            const isArray = resp.schema && (resp.schema._isArray || resp.schema.type === 'array');

            return `
                            <div class="art-response-section">
                                <div class="art-response-section-header">
                                    <span class="art-status-code ${code.startsWith('2') ? 'success' : code.startsWith('4') ? 'warning' : 'error'}">${code}</span>
                                    <span class="art-response-desc">${escapeHtml(resp.description || '无描述')}${isArray ? ' <small class="art-array-badge">数组</small>' : ''}</span>
                                </div>
                                ${hasProperties ? `
                                <table class="art-params-table art-doc-table art-nested-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 25%;">字段名</th>
                                            <th style="width: 18%;">类型</th>
                                            <th style="width: 10%;">可空</th>
                                            <th style="width: 47%;">说明</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${renderSchemaProperties(resp.schema, true)}
                                    </tbody>
                                </table>
                                ` : '<div class="art-empty-schema">无结构化响应定义</div>'}
                            </div>
                        `}).join('')}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Debug Tab Content -->
            <div class="art-main-tab-content" id="tabDebug">
                <!-- Execute Actions Bar (Top) -->
                <div class="art-action-bar art-action-bar-top">
                    <button class="art-btn art-btn-primary art-btn-execute" onclick="ArtSwagger.executeRequest()">
                        <svg class="art-icon" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path d="M8 5v14l11-7L8 5z" fill="currentColor"/></svg>
                        发送请求
                    </button>
                    <button class="art-btn art-btn-secondary" onclick="ArtSwagger.clearInputs()">
                        <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor"/></svg>
                        重置
                    </button>
                </div>

                <!-- Global Params (if any) -->
                ${renderGlobalParamsForDebug()}

                <!-- Parameters Input -->
                ${parameters.length > 0 ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>
                            请求参数
                        </span>
                        <span class="art-card-badge">${parameters.length}</span>
                    </div>
                    <div class="art-card-body" style="padding: 0;">
                        <table class="art-params-table">
                            <thead>
                                <tr>
                                    <th style="width: 20%;">参数名</th>
                                    <th style="width: 10%;">位置</th>
                                    <th style="width: 15%;">类型</th>
                                    <th style="width: 8%;">必填</th>
                                    <th style="width: 47%;">值</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parameters.map(p => `
                                    <tr>
                                        <td><code class="art-param-name">${escapeHtml(p.name)}</code></td>
                                        <td><span class="art-param-in ${p.in}">${p.in}</span></td>
                                        <td><span class="art-param-type">${escapeHtml(p.type)}</span></td>
                                        <td>${p.required ? '<span class="art-param-required">*</span>' : '-'}</td>
                                        <td>
                                            <input type="text" class="art-input art-param-input" 
                                                   data-param="${escapeHtml(p.name)}" 
                                                   data-in="${p.in}"
                                                   placeholder="${escapeHtml(p.example || p.default || p.description || '')}"
                                                   value="${escapeHtml(p.default || '')}">
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <!-- Request Body Editor -->
                ${requestBody ? `
                <div class="art-card">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="currentColor"/></svg>
                            请求体
                        </span>
                        <div class="art-card-actions">
                            <span class="art-card-subtitle">${requestBody.contentType}</span>
                            <button class="art-btn art-btn-text" onclick="ArtSwagger.formatRequestBody()">
                                <svg class="art-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z" fill="currentColor"/></svg>
                                格式化
                            </button>
                        </div>
                    </div>
                    <div class="art-card-body">
                        <textarea class="art-input art-textarea art-code-editor" id="requestBodyInput" placeholder="输入 JSON 请求体...">${escapeHtml(requestBody.example || '')}</textarea>
                    </div>
                </div>
                ` : ''}

                <!-- Response Section -->
                <div class="art-card" id="responseCard" style="display: none;">
                    <div class="art-card-header">
                        <span class="art-card-title">
                            <svg class="art-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 6px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" fill="currentColor"/></svg>
                            响应结果
                        </span>
                        <div class="art-response-status" id="responseStatus"></div>
                    </div>
                    <div class="art-card-body">
                        <div class="art-tabs" id="responseTabs">
                            <button class="art-tab active" data-tab="body">Body</button>
                            <button class="art-tab" data-tab="headers">Headers</button>
                            <button class="art-tab" data-tab="curl">cURL</button>
                        </div>
                        <div class="art-tab-content active" id="tabBody" style="margin-top: 12px;">
                            <div class="art-code-block">
                                <div class="art-code-header">
                                    <span class="art-code-lang">JSON</span>
                                    <button class="art-code-copy" onclick="ArtSwagger.copyResponse()">
                                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
                                        复制
                                    </button>
                                </div>
                                <div class="art-code-content">
                                    <pre id="responseBody"></pre>
                                </div>
                            </div>
                        </div>
                        <div class="art-tab-content" id="tabHeaders" style="margin-top: 12px;">
                            <div class="art-code-block">
                                <div class="art-code-content">
                                    <pre id="responseHeaders"></pre>
                                </div>
                            </div>
                        </div>
                        <div class="art-tab-content" id="tabCurl" style="margin-top: 12px;">
                            <div class="art-code-block">
                                <div class="art-code-header">
                                    <span class="art-code-lang">Shell</span>
                                    <button class="art-code-copy" onclick="ArtSwagger.copyCurlCommand()">
                                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
                                        复制
                                    </button>
                                </div>
                                <div class="art-code-content">
                                    <pre id="curlCommand"></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function initMainTabEvents(container) {
        const tabs = container.querySelectorAll('.art-main-tabs .art-main-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                tabs.forEach(t => t.classList.toggle('active', t === tab));

                // Update tab content
                container.querySelector('#tabDocument')?.classList.toggle('active', tabName === 'document');
                container.querySelector('#tabDebug')?.classList.toggle('active', tabName === 'debug');
            });
        });

        // Init response tabs
        const responseTabs = container.querySelectorAll('.art-tabs .art-tab');
        responseTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                responseTabs.forEach(t => t.classList.toggle('active', t === tab));

                // Update content
                container.querySelectorAll('.art-tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
                });
            });
        });
    }

    // Keep legacy functions for backwards compatibility
    function initMainTabs() {
        const tabs = document.querySelectorAll('#mainTabs .art-main-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                tabs.forEach(t => t.classList.toggle('active', t === tab));

                // Update tab content
                document.getElementById('tabDocument').classList.toggle('active', tabName === 'document');
                document.getElementById('tabDebug').classList.toggle('active', tabName === 'debug');
            });
        });
    }

    function initResponseTabs() {
        const tabs = document.querySelectorAll('#responseTabs .art-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Update tab buttons
                tabs.forEach(t => t.classList.toggle('active', t === tab));

                // Update tab content
                document.querySelectorAll('#responseCard .art-tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === `tab${capitalize(tabName)}`);
                });
            });
        });
    }

    // ============================================
    // Parameter Resolution
    // ============================================
    function resolveParameters(op) {
        const params = [];

        // Path, query, header parameters
        (op.parameters || []).forEach(p => {
            const param = resolveRef(p);
            const schema = param.schema || {};

            params.push({
                name: param.name,
                in: param.in,
                required: param.required || false,
                description: param.description,
                type: schema.type || 'string',
                format: schema.format,
                default: schema.default,
                example: schema.example || param.example,
                enum: schema.enum
            });
        });

        return params;
    }

    function resolveRequestBody(op) {
        if (!op.requestBody) return null;

        const body = resolveRef(op.requestBody);
        const content = body.content || {};

        // Prefer JSON
        const jsonContent = content['application/json'];
        if (jsonContent) {
            const schema = resolveRef(jsonContent.schema || {});
            return {
                contentType: 'application/json',
                required: body.required || false,
                schema: schema,
                example: jsonContent.example ? JSON.stringify(jsonContent.example, null, 2) : generateExample(schema)
            };
        }

        // Fallback to first content type
        const firstKey = Object.keys(content)[0];
        if (firstKey) {
            return {
                contentType: firstKey,
                required: body.required || false,
                schema: content[firstKey].schema,
                example: ''
            };
        }

        return null;
    }

    function resolveResponses(op) {
        const responses = {};

        Object.entries(op.responses || {}).forEach(([code, resp]) => {
            const resolved = resolveRef(resp);
            let schema = null;

            // Get schema from content
            if (resolved.content) {
                const jsonContent = resolved.content['application/json'];
                if (jsonContent && jsonContent.schema) {
                    schema = resolveRef(jsonContent.schema);

                    // If schema is an array, get the items schema
                    if (schema.type === 'array' && schema.items) {
                        schema = {
                            ...resolveRef(schema.items),
                            _isArray: true,
                            _originalSchema: schema
                        };
                    }
                }
            }

            responses[code] = {
                description: resolved.description,
                schema: schema
            };
        });

        return responses;
    }

    // Render schema properties as table rows
    function renderSchemaProperties(schema, isResponse = false, depth = 0, parentKey = '') {
        if (!schema) return '';

        // Handle array type - get properties from items
        let targetSchema = schema;
        if (schema.type === 'array' && schema.items) {
            targetSchema = resolveRef(schema.items);
        }

        if (!targetSchema.properties) return '';

        const required = targetSchema.required || [];
        let html = '';

        Object.entries(targetSchema.properties).forEach(([key, prop]) => {
            const resolved = resolveRef(prop);
            const fullKey = parentKey ? `${parentKey}.${key}` : key;
            const indent = depth * 20;
            const isRequired = required.includes(key);
            const isNullable = resolved.nullable === true;

            // Determine type display
            let typeDisplay = resolved.type || 'object';
            if (resolved.format) {
                typeDisplay += ` (${resolved.format})`;
            }
            if (resolved.type === 'array' && resolved.items) {
                const itemType = resolveRef(resolved.items);
                typeDisplay = `array<${itemType.type || 'object'}>`;
            }

            html += `
                <tr>
                    <td style="padding-left: ${16 + indent}px;">
                        ${depth > 0 ? '<span class="art-tree-line">└─</span>' : ''}
                        <span class="art-param-name">${escapeHtml(key)}</span>
                    </td>
                    <td><span class="art-param-type">${escapeHtml(typeDisplay)}</span></td>
                    <td>${isResponse ? (isNullable ? '<span class="art-nullable">是</span>' : '-') : (isRequired ? '<span class="art-param-required">*</span>' : '-')}</td>
                    <td>${escapeHtml(resolved.description || resolved.title || '-')}${resolved.enum ? `<br><small class="art-enum-values">枚举: ${resolved.enum.join(', ')}</small>` : ''}</td>
                </tr>
            `;

            // Recursively render nested objects (limit depth to 3)
            if (resolved.type === 'object' && resolved.properties && depth < 3) {
                html += renderSchemaProperties(resolved, isResponse, depth + 1, fullKey);
            }

            // Render array item properties
            if (resolved.type === 'array' && resolved.items && depth < 3) {
                const itemSchema = resolveRef(resolved.items);
                if (itemSchema.type === 'object' && itemSchema.properties) {
                    html += renderSchemaProperties(itemSchema, isResponse, depth + 1, `${fullKey}[]`);
                }
            }
        });

        return html;
    }

    function resolveRef(obj) {
        if (!obj || !obj.$ref) return obj;

        const refPath = obj.$ref.replace('#/', '').split('/');
        let result = state.currentSpec;

        for (const key of refPath) {
            result = result[key];
            if (!result) return obj;
        }

        return result;
    }

    function generateExample(schema) {
        if (!schema) return '';

        if (schema.example) {
            return typeof schema.example === 'string'
                ? schema.example
                : JSON.stringify(schema.example, null, 2);
        }

        if (schema.type === 'object' && schema.properties) {
            const example = {};
            Object.entries(schema.properties).forEach(([key, prop]) => {
                const resolved = resolveRef(prop);
                example[key] = getDefaultValue(resolved);
            });
            return JSON.stringify(example, null, 2);
        }

        return '';
    }

    function getDefaultValue(schema) {
        if (schema.example !== undefined) return schema.example;
        if (schema.default !== undefined) return schema.default;

        switch (schema.type) {
            case 'string': return schema.format === 'date-time' ? new Date().toISOString() : '';
            case 'integer':
            case 'number': return 0;
            case 'boolean': return false;
            case 'array': return [];
            case 'object': return {};
            default: return null;
        }
    }

    // ============================================
    // Request Execution
    // ============================================
    async function executeRequest() {
        const op = state.currentOperation;
        if (!op) return;

        // Find active panel
        const activePanel = document.querySelector('.art-tab-panel.active');
        if (!activePanel) return;

        const { url, headers, body } = buildRequest(op, activePanel);
        const startTime = performance.now();

        // Show response card
        const responseCard = activePanel.querySelector('#responseCard');
        if (responseCard) responseCard.style.display = '';

        try {
            const response = await fetch(url, {
                method: op.method.toUpperCase(),
                headers,
                body: body
            });

            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            // Get response body
            let responseText = '';
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const json = await response.json();
                responseText = JSON.stringify(json, null, 2);
            } else {
                responseText = await response.text();
            }

            // Update UI
            const responseStatus = activePanel.querySelector('#responseStatus');
            if (responseStatus) {
                responseStatus.innerHTML = `
                    <span class="art-status-badge ${response.ok ? 'success' : 'error'}">
                        ${response.status} ${response.statusText}
                    </span>
                    <span class="art-response-time">${duration}ms</span>
                `;
            }

            const responseBody = activePanel.querySelector('#responseBody');
            if (responseBody) responseBody.textContent = responseText;

            // Response headers
            const headerLines = [];
            response.headers.forEach((value, key) => {
                headerLines.push(`${key}: ${value}`);
            });
            const responseHeaders = activePanel.querySelector('#responseHeaders');
            if (responseHeaders) responseHeaders.textContent = headerLines.join('\n');

            // Generate cURL
            const curlCommand = activePanel.querySelector('#curlCommand');
            if (curlCommand) curlCommand.textContent = generateCurl(op, url, headers, body);

            state.lastResponse = responseText;
            state.lastCurl = generateCurl(op, url, headers, body);

        } catch (error) {
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            const responseStatus = activePanel.querySelector('#responseStatus');
            if (responseStatus) {
                responseStatus.innerHTML = `
                    <span class="art-status-badge error">Error</span>
                    <span class="art-response-time">${duration}ms</span>
                `;
            }

            const responseBody = activePanel.querySelector('#responseBody');
            if (responseBody) responseBody.textContent = error.message;

            const responseHeaders = activePanel.querySelector('#responseHeaders');
            if (responseHeaders) responseHeaders.textContent = '';

            const curlCommand = activePanel.querySelector('#curlCommand');
            if (curlCommand) curlCommand.textContent = generateCurl(op, url, headers, body);

            showToast(`请求失败: ${error.message}`, 'error');
        }
    }

    function buildRequest(op, panel) {
        let url = new URL(op.path, window.location.origin);
        const headers = {
            'Accept': 'application/json'
        };

        // Add auth header
        if (state.bearerToken) {
            headers['Authorization'] = `Bearer ${state.bearerToken}`;
        }

        // Add global params (from inputs in debug panel if available, else from stored values)
        // Only if global params are enabled
        if (globalParamsEnabled) {
            const globalInputs = panel ? panel.querySelectorAll('[data-global-param]') : [];
            if (globalInputs.length > 0) {
                globalInputs.forEach(input => {
                    const name = input.dataset.paramName;
                    const type = input.dataset.paramType;
                    const value = input.value.trim();
                    if (!value) return;

                    if (type === 'header') {
                        headers[name] = value;
                    } else if (type === 'query') {
                        url.searchParams.set(name, value);
                    }
                });
            } else {
                // Fallback to stored global params
                globalParams.forEach(p => {
                    if (p.type === 'header') {
                        headers[p.name] = p.value;
                    } else if (p.type === 'query') {
                        url.searchParams.set(p.name, p.value);
                    }
                });
            }
        }

        // Collect parameter values from inputs within the panel
        const paramInputs = panel ? panel.querySelectorAll('[data-param]') : document.querySelectorAll('[data-param]');
        paramInputs.forEach(input => {
            const name = input.dataset.param;
            const paramIn = input.dataset.in;
            const value = input.value.trim();

            if (!value) return;

            if (paramIn === 'path') {
                url = new URL(url.pathname.replace(`{${name}}`, encodeURIComponent(value)), url.origin);
            } else if (paramIn === 'query') {
                url.searchParams.set(name, value);
            } else if (paramIn === 'header') {
                headers[name] = value;
            }
        });

        // Request body
        let body = null;
        const bodyInput = panel ? panel.querySelector('#requestBodyInput') : document.getElementById('requestBodyInput');
        if (bodyInput && bodyInput.value.trim()) {
            body = bodyInput.value.trim();
            headers['Content-Type'] = 'application/json';
        }

        return { url: url.toString(), headers, body };
    }

    function generateCurl(op, url, headers, body) {
        let curl = `curl -X ${op.method.toUpperCase()} '${url}'`;

        Object.entries(headers).forEach(([key, value]) => {
            curl += ` \\\n  -H '${key}: ${value}'`;
        });

        if (body) {
            curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
        }

        return curl;
    }

    function clearInputs() {
        // 找到当前激活的标签页面板
        const activePanel = document.querySelector('.art-tab-panel.active');
        if (!activePanel) return;

        // 重置参数输入框为默认值（placeholder 或空）
        activePanel.querySelectorAll('.art-param-input').forEach(input => {
            input.value = '';
        });

        // 重置请求体为默认示例
        const requestBodyInput = activePanel.querySelector('#requestBodyInput');
        if (requestBodyInput && state.currentOperation) {
            const requestBody = resolveRequestBody(state.currentOperation);
            requestBodyInput.value = requestBody?.example || '';
        }

        const responseCard = activePanel.querySelector('#responseCard');
        if (responseCard) {
            responseCard.style.display = 'none';
        }

        showToast('已重置为默认值', 'info');
    }

    function formatRequestBody() {
        const activePanel = document.querySelector('.art-tab-panel.active');
        const textarea = activePanel ? activePanel.querySelector('#requestBodyInput') : document.getElementById('requestBodyInput');
        if (!textarea) return;

        try {
            const json = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(json, null, 2);
            showToast('格式化成功', 'success');
        } catch (e) {
            showToast('JSON 格式错误: ' + e.message, 'error');
        }
    }

    // ============================================
    // Search
    // ============================================
    function openSearch() {
        elements.searchModal.classList.add('open');
        elements.globalSearchInput.value = '';
        elements.globalSearchInput.focus();
        state.selectedSearchIndex = -1;
        elements.searchResults.innerHTML = '<div class="art-search-empty">输入关键词搜索接口</div>';
    }

    function closeSearch() {
        elements.searchModal.classList.remove('open');
    }

    function handleGlobalSearch() {
        const query = elements.globalSearchInput.value.toLowerCase().trim();

        if (!query) {
            elements.searchResults.innerHTML = '<div class="art-search-empty">输入关键词搜索接口</div>';
            state.selectedSearchIndex = -1;
            return;
        }

        const results = state.searchIndex.filter(item => item.text.includes(query)).slice(0, 20);

        if (results.length === 0) {
            elements.searchResults.innerHTML = '<div class="art-search-empty">未找到匹配的接口</div>';
            state.selectedSearchIndex = -1;
            return;
        }

        elements.searchResults.innerHTML = results.map((item, index) => `
            <div class="art-search-result${index === 0 ? ' selected' : ''}" 
                 data-path="${escapeHtml(item.path)}" 
                 data-method="${item.method}">
                <span class="art-method-badge ${item.method}">${item.method}</span>
                <div style="flex: 1; min-width: 0;">
                    <div class="art-search-result-path">${escapeHtml(item.path)}</div>
                    ${item.summary ? `<div class="art-search-result-summary">${escapeHtml(item.summary)}</div>` : ''}
                </div>
            </div>
        `).join('');

        state.selectedSearchIndex = 0;

        // Add click handlers
        elements.searchResults.querySelectorAll('.art-search-result').forEach(result => {
            result.addEventListener('click', () => {
                selectOperation(result.dataset.path, result.dataset.method);
                closeSearch();
            });
        });
    }

    // ============================================
    // Global Params (per group)
    // ============================================
    let allGroupParams = {};  // { groupName: [...params] }
    let globalParams = [];    // current group's params
    let editingParamIndex = -1;

    function loadGlobalParams() {
        const saved = localStorage.getItem('art-swagger-global-params-v2');
        allGroupParams = saved ? JSON.parse(saved) : {};
        switchGroupParams();
    }

    function switchGroupParams() {
        const groupKey = state.currentGroup?.name || 'default';
        globalParams = allGroupParams[groupKey] || [];
        updateGlobalParamsCount();
    }

    function saveGlobalParams() {
        const groupKey = state.currentGroup?.name || 'default';
        allGroupParams[groupKey] = globalParams;
        localStorage.setItem('art-swagger-global-params-v2', JSON.stringify(allGroupParams));
        updateGlobalParamsCount();
    }

    function updateGlobalParamsCount() {
        const countEl = document.getElementById('globalParamsCount');
        if (countEl) {
            const count = globalParams.length;
            countEl.textContent = count;
            countEl.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    function openGlobalParams() {
        const modal = document.getElementById('globalParamsModal');
        modal.classList.add('open');
        renderGlobalParamsList();
    }

    function closeGlobalParams() {
        document.getElementById('globalParamsModal').classList.remove('open');
    }

    function renderGlobalParamsList() {
        const listEl = document.getElementById('globalParamsList');
        if (globalParams.length === 0) {
            listEl.innerHTML = '<div class="art-params-empty">暂无全局参数，点击上方按钮添加</div>';
            return;
        }

        listEl.innerHTML = `
            <table class="art-params-table">
                <thead>
                    <tr>
                        <th style="width: 30%;">参数名</th>
                        <th style="width: 35%;">参数值</th>
                        <th style="width: 15%;">类型</th>
                        <th style="width: 20%;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${globalParams.map((p, i) => `
                        <tr>
                            <td><span class="art-param-name">${escapeHtml(p.name)}</span></td>
                            <td><span class="art-param-value" title="${escapeHtml(p.value)}">${escapeHtml(p.value)}</span></td>
                            <td><span class="art-param-type ${p.type}">${p.type}</span></td>
                            <td>
                                <div class="art-param-actions">
                                    <button onclick="ArtSwagger.editParam(${i})" title="编辑">
                                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
                                    </button>
                                    <button class="delete" onclick="ArtSwagger.deleteParam(${i})" title="删除">
                                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function showAddParam() {
        editingParamIndex = -1;
        document.getElementById('paramFormTitle').textContent = '新增参数';
        document.getElementById('paramName').value = '';
        document.getElementById('paramValue').value = '';
        document.getElementById('paramType').value = 'header';
        document.getElementById('paramFormModal').classList.add('open');
        document.getElementById('paramName').focus();
    }

    function editParam(index) {
        editingParamIndex = index;
        const param = globalParams[index];
        document.getElementById('paramFormTitle').textContent = '编辑参数';
        document.getElementById('paramName').value = param.name;
        document.getElementById('paramValue').value = param.value;
        document.getElementById('paramType').value = param.type;
        document.getElementById('paramFormModal').classList.add('open');
        document.getElementById('paramName').focus();
    }

    function deleteParam(index) {
        globalParams.splice(index, 1);
        saveGlobalParams();
        renderGlobalParamsList();
        showToast('参数已删除', 'success');
    }

    function closeParamForm() {
        document.getElementById('paramFormModal').classList.remove('open');
    }

    function saveParam() {
        const name = document.getElementById('paramName').value.trim();
        const value = document.getElementById('paramValue').value.trim();
        const type = document.getElementById('paramType').value;

        if (!name) {
            showToast('请输入参数名称', 'warning');
            document.getElementById('paramName').focus();
            return;
        }
        if (!value) {
            showToast('请输入参数值', 'warning');
            document.getElementById('paramValue').focus();
            return;
        }

        const param = { name, value, type };

        if (editingParamIndex >= 0) {
            globalParams[editingParamIndex] = param;
            showToast('参数已更新', 'success');
        } else {
            // Check for duplicate
            const exists = globalParams.some(p => p.name === name && p.type === type);
            if (exists) {
                showToast('该参数已存在', 'warning');
                return;
            }
            globalParams.push(param);
            showToast('参数已添加', 'success');
        }

        saveGlobalParams();
        closeParamForm();
        renderGlobalParamsList();
    }

    function getGlobalParams() {
        return globalParams;
    }

    // 全局参数启用状态
    let globalParamsEnabled = true;

    function renderGlobalParamsForDebug() {
        if (globalParams.length === 0) return '';

        const checkboxClass = globalParamsEnabled ? 'art-global-params-checkbox checked' : 'art-global-params-checkbox';

        return `
            <div class="art-global-params-section" id="globalParamsSection">
                <div class="art-global-params-header" onclick="window.ArtSwagger.toggleGlobalParamsSection(event)">
                    <svg class="art-icon art-global-params-toggle" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
                    <div class="${checkboxClass}" onclick="window.ArtSwagger.toggleGlobalParamsEnabled(event)">
                        <svg class="art-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
                    </div>
                    <span class="art-global-params-title">全局参数（可临时修改）</span>
                    <span class="art-global-params-badge">${globalParams.length}</span>
                </div>
                <div class="art-global-params-table">
                    <table class="art-params-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">参数名</th>
                                <th style="width: 15%;">类型</th>
                                <th style="width: 60%;">值</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${globalParams.map((p, i) => `
                                <tr>
                                    <td><code class="art-param-name">${escapeHtml(p.name)}</code></td>
                                    <td><span class="art-param-type ${p.type}">${p.type}</span></td>
                                    <td>
                                        <input type="text" class="art-global-input" 
                                               data-global-param="${i}"
                                               data-param-name="${escapeHtml(p.name)}"
                                               data-param-type="${p.type}"
                                               value="${escapeHtml(p.value)}">
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function toggleGlobalParamsSection(e) {
        // 如果点击的是 checkbox 区域，不展开/折叠
        if (e.target.closest('.art-global-params-checkbox')) return;

        const section = document.getElementById('globalParamsSection');
        if (section) {
            section.classList.toggle('expanded');
        }
    }

    function toggleGlobalParamsEnabled(e) {
        e.stopPropagation();
        globalParamsEnabled = !globalParamsEnabled;

        const checkbox = e.target.closest('.art-global-params-checkbox');
        if (checkbox) {
            checkbox.classList.toggle('checked', globalParamsEnabled);
        }
    }

    function isGlobalParamsEnabled() {
        return globalParamsEnabled;
    }

    // ============================================
    // Copy Functions
    // ============================================
    function copyAsCurl() {
        const op = state.currentOperation;
        if (!op) return;

        const activePanel = document.querySelector('.art-tab-panel.active');
        const { url, headers, body } = buildRequest(op, activePanel);
        const curl = generateCurl(op, url, headers, body);

        copyToClipboard(curl);
        showToast('cURL 命令已复制', 'success');
    }

    function copyResponse() {
        if (state.lastResponse) {
            copyToClipboard(state.lastResponse);
            showToast('响应内容已复制', 'success');
        }
    }

    function copyCurlCommand() {
        if (state.lastCurl) {
            copyToClipboard(state.lastCurl);
            showToast('cURL 命令已复制', 'success');
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }

    // ============================================
    // Toast Notifications
    // ============================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `art-toast ${type}`;

        const icons = {
            success: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>',
            error: '<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="currentColor"/>',
            warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>',
            info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>'
        };

        toast.innerHTML = `
            <svg class="art-toast-icon" viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
            <span class="art-toast-message">${escapeHtml(message)}</span>
        `;

        elements.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============================================
    // Utility Functions
    // ============================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ============================================
    // Public API
    // ============================================
    window.ArtSwagger = {
        // Core
        init,

        // Tabs
        openTab,
        closeTab,
        activateTab,
        showWelcome,

        // Search
        openSearch,
        closeSearch,

        // Global Params
        openGlobalParams,
        closeGlobalParams,
        showAddParam,
        editParam,
        deleteParam,
        closeParamForm,
        saveParam,
        toggleGlobalParamsSection,
        toggleGlobalParamsEnabled,

        // Request
        executeRequest,
        clearInputs,
        formatRequestBody,

        // Copy
        copyAsCurl,
        copyResponse,
        copyCurlCommand,

        // Toast
        showToast,

        // State (for debugging)
        getState: () => state,
        getGlobalParams,
        isGlobalParamsEnabled
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
