// --- DOM要素の取得 ---
// 画面コンテナ
const viewHome = document.getElementById('view-home');
const viewResults = document.getElementById('view-search-results');

// 入力・ボタン類
const homeInput = document.getElementById('home-input');
const homeSearchBtn = document.getElementById('home-search-btn');
const backBtn = document.getElementById('back-btn');
const resultInput = document.getElementById('result-input');
const resetSearchBtn = document.getElementById('reset-search-btn');

// リスト類
const listContainer = document.getElementById('result-list');
const noResultMsg = document.getElementById('no-result');
const resultCountSpan = document.getElementById('result-count');
const categoryChips = document.querySelectorAll('.chip'); // 結果画面のチップ
const homeCatCards = document.querySelectorAll('.cat-card'); // ホーム画面のカード

// --- データ管理 ---
let termsData = [];
let currentCategory = 'all';
let currentQuery = '';

// --- 初期化 ---
async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
    } catch (error) {
        console.error('Data Load Error:', error);
        listContainer.innerHTML = '<li style="color:red">データの読み込みに失敗しました</li>';
    }
}

// --- 画面遷移関数 ---
function goToResults(query, category = 'all') {
    // 状態を同期
    currentQuery = query;
    currentCategory = category;
    
    // 入力欄に値をセット
    resultInput.value = query;
    homeInput.value = query;

    // カテゴリーチップの見た目を更新
    updateCategoryChips(category);

    // 検索実行 & 描画
    renderList();

    // 画面切り替え (クラス操作)
    viewHome.classList.remove('active');
    viewHome.classList.add('hidden');
    
    viewResults.classList.remove('hidden');
    viewResults.classList.add('active');
}

function goToHome() {
    // 入力リセット（任意）
    homeInput.value = '';
    resultInput.value = '';
    
    viewResults.classList.remove('active');
    viewResults.classList.add('hidden');
    
    viewHome.classList.remove('hidden');
    viewHome.classList.add('active');
}


function renderList() {
    listContainer.innerHTML = '';
    
    const filtered = termsData.filter(item => {
        
        const isCatMatch = (currentCategory === 'all') || (item.tags && item.tags.includes(currentCategory));
        
        const q = currentQuery.toLowerCase().trim();
        const isTextMatch = !q || 
            item.term.toLowerCase().includes(q) || 
            item.reading.includes(q) || 
            item.keywords.toLowerCase().includes(q);
        
        return isCatMatch && isTextMatch;
    });

    // 件数更新
    resultCountSpan.textContent = filtered.length;

    if (filtered.length === 0) {
        noResultMsg.style.display = 'block';
    } else {
        noResultMsg.style.display = 'none';
        filtered.forEach(item => {
            // tags配列をmapして、個別のspanタグHTMLを作成し結合する
            const tagsHtml = item.tags.map(tag => `<span class="category-badge">${tag}</span>`).join('');

            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
                <div class="item-header-row">
                    <span class="term">${highlight(item.term, currentQuery)}<span class="reading">(${item.reading})</span></span>
                    <div class="badges-wrapper">${tagsHtml}</div>
                </div>
                <div class="description">${highlight(item.description, currentQuery)}</div>
            `;
            // アラート表示もタグ対応
            li.onclick = () => alert(`${item.term}\n[${item.tags.join(', ')}]\n\n${item.description}`);
            listContainer.appendChild(li);
        });
    }
}

// チップのアクティブ状態を更新するヘルパー
function updateCategoryChips(activeCat) {
    categoryChips.forEach(chip => {
        if (chip.dataset.cat === activeCat) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function highlight(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="highlight-text">$1</mark>');
}

// --- イベントリスナー ---

// 1. ホーム画面で検索（Enterキー）
homeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && homeInput.value.trim() !== "") {
        goToResults(homeInput.value);
    }
});

// 2. ホーム画面の検索ボタン
homeSearchBtn.addEventListener('click', () => {
    if (homeInput.value.trim() !== "") {
        goToResults(homeInput.value);
    }
});

// 3. ホーム画面のカテゴリカードクリック
homeCatCards.forEach(card => {
    card.addEventListener('click', () => {
        goToResults("", card.dataset.cat); // キーワードなし、カテゴリ指定で遷移
    });
});

// 4. 結果画面での戻るボタン
backBtn.addEventListener('click', goToHome);

// 5. 結果画面でのリアルタイム検索
resultInput.addEventListener('input', (e) => {
    currentQuery = e.target.value;
    renderList();
});

// 6. 結果画面でのカテゴリ切り替え
categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
        currentCategory = chip.dataset.cat;
        updateCategoryChips(currentCategory);
        renderList();
    });
});

// 7. リセットボタン
resetSearchBtn.addEventListener('click', () => {
    goToResults("", "all");
});

// アプリ開始
init();