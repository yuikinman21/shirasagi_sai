document.addEventListener('DOMContentLoaded', () => {
    init();
    loadFavorites(); // ④ お気に入り読み込み
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
const homeFavoritesList = document.getElementById('home-favorites-list');
const modalFavBtn = document.getElementById('modal-fav-btn');

// --- データ管理 ---
let termsData = [];
let selectedTags = new Set(); 
let currentQuery = '';
let favoriteIds = []; // ④ お気に入りID

// --- 1. 初期化 ---
async function init() {
    try {
        // キャッシュ回避
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
        
        // データ読込後にお気に入りリストを描画
        renderHomeFavorites(); 
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

    // ① タグエリアの開閉ボタン
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
                if (tag === 'all') selectedTags.clear();
                else {
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
    const modalClose = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    if(modalClose) modalClose.addEventListener('click', closeModal);
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
    
    // 画面遷移時はタグエリアを閉じる(スッキリさせる)
    const tagContainer = document.getElementById('tag-container');
    if(tagContainer) tagContainer.classList.remove('expanded');
    
    window.scrollTo(0, 0);
}

function goToHome() {
    if(homeInput) homeInput.value = '';
    if(resultInput) resultInput.value = '';
    selectedTags.clear();
    
    // ホームに戻るたびにお気に入りを再描画
    renderHomeFavorites();
    
    viewResults.classList.remove('active'); viewResults.classList.add('hidden');
    viewHome.classList.remove('hidden'); viewHome.classList.add('active');
}


// --- 4. 描画ロジック ---
function renderList() {
    listContainer.innerHTML = '';
    
    const filtered = termsData.filter(item => {
        // AND検索
        let isTagMatch = true;
        if (selectedTags.size > 0) {
            const itemTags = item.tags || [];
            for (let tag of selectedTags) if (!itemTags.includes(tag)) { isTagMatch = false; break; }
        }
        // キーワード検索
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

    filtered.forEach(item => {
        const isFav = favoriteIds.includes(item.id);
        
        // ② カード内タグ: onclickで searchByTag を呼ぶ
        const badgesHtml = (item.tags || []).map(tag => 
            `<span class="category-badge" data-tag="${tag}" onclick="searchByTag(event, '${tag}')">${tag}</span>`
        ).join('');

        const li = document.createElement('li');
        li.className = 'item';
        
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

// --- ② タグクリック検索 (グローバル関数) ---
window.searchByTag = function(e, tag) {
    e.stopPropagation(); // モーダル開かない
    selectedTags.clear();
    selectedTags.add(tag);
    
    // キーワードはクリアしてタグ検索に集中させる
    currentQuery = ""; 
    if(resultInput) resultInput.value = "";
    
    updateCategoryChips();
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- ④ お気に入り操作 (グローバル関数) ---
window.toggleFav = function(e, id) {
    e.stopPropagation(); // モーダル開かない
    
    id = parseInt(id); // 数値化
    if (favoriteIds.includes(id)) {
        favoriteIds = favoriteIds.filter(f => f !== id);
    } else {
        favoriteIds.push(id);
    }
    
    // 保存
    localStorage.setItem('shirasagi_favs', JSON.stringify(favoriteIds));
    
    // UI更新
    renderList(); // リストの☆を更新
    renderHomeFavorites(); // ホームのリストを更新
};

// お気に入りリスト(ホーム)の描画
function renderHomeFavorites() {
    if(!homeFavoritesList) return;
    homeFavoritesList.innerHTML = '';
    
    if(favoriteIds.length === 0) {
        homeFavoritesList.innerHTML = '<li style="text-align:center;font-size:12px;color:#aaa;padding:10px;">よく見る用語を★登録できます</li>';
        return;
    }
    
    // 最新順に表示
    [...favoriteIds].reverse().forEach(id => {
        const item = termsData.find(d => d.id === id);
        if(item) {
            const li = document.createElement('li');
            li.className = 'fav-item';
            li.innerHTML = `<span>${item.term}</span> <span style="font-size:16px;color:#ccc;">›</span>`;
            li.onclick = () => openModal(item);
            homeFavoritesList.appendChild(li);
        }
    });
}

// --- ④ お気に入り読み込み ---
function loadFavorites() {
    const saved = localStorage.getItem('shirasagi_favs');
    if (saved) favoriteIds = JSON.parse(saved);
}


// --- その他ヘルパー ---
function updateCategoryChips() {
    document.querySelectorAll('.categories-scroll .chip').forEach(chip => {
        const tag = chip.dataset.cat;
        // ホームかどうかは関係なく、選択状態を反映
        if(tag === 'all') chip.classList.toggle('active', selectedTags.size === 0);
        else chip.classList.toggle('active', selectedTags.has(tag));
    });
}
function highlight(text, query) {
    if (!query || !text) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="highlight-text">$1</mark>');
}

// モーダル
function openModal(item) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-term').textContent = item.term;
    document.getElementById('modal-description').innerHTML = item.description.replace(/\n/g, '<br>');
    document.getElementById('modal-badges').innerHTML = (item.tags || []).map(t => `<span class="category-badge" data-tag="${t}">${t}</span>`).join('');
    
    // ▼▼▼ 追加: お気に入りボタンの状態設定 ▼▼▼
    updateModalFavBtn(item.id);

    // ボタンクリック時の挙動設定
    // (無名関数で包んで、現在のitem.idを渡せるようにする)
    modalFavBtn.onclick = (e) => {
        // グローバルのtoggleFavを呼んでデータを更新
        toggleFav(e, item.id);
        
        // モーダル上のボタン見た目を即時更新
        updateModalFavBtn(item.id);
    };
    
    overlay.classList.add('active');
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

function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }