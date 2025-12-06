document.addEventListener('DOMContentLoaded', () => {
    init();
    loadFavorites();
    setupEventListeners();
});

// --- 要素取得 ---
const viewHome = document.getElementById('view-home');
const viewResults = document.getElementById('view-search-results');
const homeInput = document.getElementById('home-input');
const resultInput = document.getElementById('result-input');
const listContainer = document.getElementById('result-list');
const noResultMsg = document.getElementById('no-result');
const resultCountSpan = document.getElementById('result-count');

// モーダル関連
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTerm = document.getElementById('modal-term');
const modalBadges = document.getElementById('modal-badges');
const modalDescription = document.getElementById('modal-description');
const modalFavBtn = document.getElementById('modal-fav-btn');

// --- データ管理 ---
let termsData = [];
let selectedTags = new Set(); 
let currentQuery = '';
let favoriteIds = [];

// --- 1. 初期化 ---
async function init() {
    try {
        // キャッシュ回避
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
        console.log("データ読み込み成功:", termsData.length + "件");
    } catch (e) {
        console.error(e);
        if(listContainer) listContainer.innerHTML = '<li style="color:red;padding:20px">データ読込エラー</li>';
    }
}

// --- 2. イベント設定 ---
function setupEventListeners() {
    // 検索入力 (ホーム & 結果画面)
    [homeInput, resultInput].forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => {
                if(input === resultInput) { currentQuery = e.target.value; renderList(); }
            });
            input.addEventListener('keydown', (e) => {
                if(e.key === 'Enter' && input.value.trim()) goToResults(input.value);
            });
        }
    });

    // 検索ボタン (ホーム)
    const homeSearchBtn = document.getElementById('home-search-btn');
    if(homeSearchBtn) homeSearchBtn.addEventListener('click', () => {
        if(homeInput.value.trim()) goToResults(homeInput.value);
    });

    // タグエリアの開閉ボタン
    const expandBtn = document.getElementById('filter-expand-btn');
    const tagContainer = document.getElementById('tag-container');
    if(expandBtn && tagContainer) {
        expandBtn.addEventListener('click', () => {
            tagContainer.classList.toggle('expanded');
        });
    }

    // タグ選択 (ホームショートカット & フィルターバー)
    const allTagContainers = document.querySelectorAll('.categories-scroll, .cat-grid');
    allTagContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            // クリック禁止要素(no-select)なら無視
            if (e.target.closest('.no-select')) return;

            const chip = e.target.closest('.chip, .cat-card');
            if (chip) {
                const tag = chip.dataset.cat;
                
                // ホームのカードなら、そのタグで一発検索
                if (chip.classList.contains('cat-card')) {
                    selectedTags.clear(); selectedTags.add(tag);
                    goToResults("");
                    return;
                }

                // フィルターチップのロジック
                if (tag === 'all') {
                    selectedTags.clear();
                } else {
                    if (selectedTags.has(tag)) selectedTags.delete(tag);
                    else selectedTags.add(tag);
                }

                if (viewHome.classList.contains('active')) goToResults("");
                else { updateCategoryChips(); renderList(); }
            }
        });
    });

    // 戻る・リセット
    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.addEventListener('click', goToHome);
    const resetBtn = document.getElementById('reset-search-btn');
    if(resetBtn) resetBtn.addEventListener('click', () => { selectedTags.clear(); goToResults("", "all"); });

    // モーダル閉じる
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if(modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(); });
}

// --- 3. 画面遷移 ---
function goToResults(query) {
    if (typeof query === 'string') {
        currentQuery = query;
        if(resultInput) resultInput.value = query;
        if(homeInput) homeInput.value = query;
    }
    updateCategoryChips();
    renderList();
    
    viewHome.classList.remove('active'); viewHome.classList.add('hidden');
    viewResults.classList.remove('hidden'); viewResults.classList.add('active');
    
    // 画面遷移時はタグエリアを閉じる
    const tagContainer = document.getElementById('tag-container');
    if(tagContainer) tagContainer.classList.remove('expanded');
    
    window.scrollTo(0, 0);
}

function goToHome() {
    if(homeInput) homeInput.value = '';
    if(resultInput) resultInput.value = '';
    selectedTags.clear();
    
    viewResults.classList.remove('active'); viewResults.classList.add('hidden');
    viewHome.classList.remove('hidden'); viewHome.classList.add('active');
}


// --- 4. 描画ロジック ---
function renderList() {
    listContainer.innerHTML = '';
    
    const filtered = termsData.filter(item => {
        // A. タグ判定 (AND検索 + お気に入り特殊判定)
        let isTagMatch = true;
        
        if (selectedTags.size > 0) {
            const itemTags = item.tags || [];
            
            for (let tag of selectedTags) {
                // 特殊タグ: お気に入り (favorites)
                if (tag === 'favorites') {
                    if (!favoriteIds.includes(item.id)) {
                        isTagMatch = false; 
                        break;
                    }
                } 
                // 通常タグ
                else {
                    if (!itemTags.includes(tag)) {
                        isTagMatch = false;
                        break;
                    }
                }
            }
        }

        // B. キーワード判定
        const q = currentQuery.toLowerCase().trim();
        const term = item.term || '';
        const reading = item.reading || '';
        const keywords = item.keywords || '';
        let isKeyInTag = (item.tags || []).some(t => t.toLowerCase().includes(q));
        
        const isTextMatch = !q || term.includes(q) || reading.includes(q) || keywords.includes(q) || isKeyInTag;
        return isTagMatch && isTextMatch;
    });

    if(resultCountSpan) resultCountSpan.textContent = filtered.length;
    noResultMsg.style.display = filtered.length === 0 ? 'block' : 'none';

    // リスト生成
    filtered.forEach((item, i) => {
        const isFav = favoriteIds.includes(item.id);
        
        // カード内タグ: クリックでそのタグ検索へ
        const badgesHtml = (item.tags || []).map(tag => 
            `<span class="category-badge" data-tag="${tag}" onclick="searchByTag(event, '${tag}')">${tag}</span>`
        ).join('');

        const li = document.createElement('li');
        li.className = 'item';
        // アニメーション遅延 (0.05秒ずつずらす)
        li.style.animationDelay = `${i * 0.05}s`;

        li.innerHTML = `
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(event, ${item.id})">
                ${isFav ? '★' : '☆'}
            </button>
            <div class="item-header-row">
                <span class="term">${highlight(item.term, currentQuery)}
                    <span class="reading">(${item.reading})</span>
                </span>
                <div class="badges-wrapper no-select">${badgesHtml}</div>
            </div>
            <div class="description">${highlight(item.description, currentQuery)}</div>
        `;
        li.onclick = () => openModal(item);
        listContainer.appendChild(li);
    });
}

// --- グローバルヘルパー関数 ---

// カード内タグクリック検索
window.searchByTag = function(e, tag) {
    e.stopPropagation(); // モーダル開かない
    
    selectedTags.clear();
    selectedTags.add(tag);
    
    // キーワードリセット
    currentQuery = ""; 
    if(resultInput) resultInput.value = "";
    
    updateCategoryChips();
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// お気に入り切り替え
window.toggleFav = function(e, id) {
    e.stopPropagation();
    
    id = parseInt(id);
    if (favoriteIds.includes(id)) {
        favoriteIds = favoriteIds.filter(f => f !== id);
    } else {
        favoriteIds.push(id);
    }
    
    // 保存
    localStorage.setItem('shirasagi_favs', JSON.stringify(favoriteIds));
    
    // リスト再描画
    // (お気に入りフィルタ中の場合は即座にリストから消す必要があるため)
    if (selectedTags.has('favorites')) {
        renderList();
    } else {
        // 全再描画 (簡易実装)
        renderList();
    }
};

// お気に入り読み込み
function loadFavorites() {
    const saved = localStorage.getItem('shirasagi_favs');
    if (saved) favoriteIds = JSON.parse(saved);
}

// チップの見た目更新
function updateCategoryChips() {
    document.querySelectorAll('.categories-scroll .chip').forEach(chip => {
        const tag = chip.dataset.cat;
        if(tag === 'all') chip.classList.toggle('active', selectedTags.size === 0);
        else chip.classList.toggle('active', selectedTags.has(tag));
    });
}

// ハイライト処理
function highlight(text, query) {
    if (!query || !text) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="highlight-text">$1</mark>');
}

// --- モーダル制御 ---
function openModal(item) {
    document.getElementById('modal-term').textContent = item.term;
    document.getElementById('modal-description').innerHTML = item.description.replace(/\n/g, '<br>');
    document.getElementById('modal-badges').innerHTML = (item.tags || []).map(t => `<span class="category-badge" data-tag="${t}">${t}</span>`).join('');
    
    // モーダル内の☆ボタン設定
    updateModalFavBtn(item.id);
    modalFavBtn.onclick = (e) => {
        // グローバルのtoggleFavを呼んでデータ更新
        toggleFav(e, item.id);
        // モーダルのボタン見た目も更新
        updateModalFavBtn(item.id);
    };

    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

function updateModalFavBtn(id) {
    if (favoriteIds.includes(id)) {
        modalFavBtn.classList.add('active');
        modalFavBtn.textContent = '★';
    } else {
        modalFavBtn.classList.remove('active');
        modalFavBtn.textContent = '☆';
    }
}