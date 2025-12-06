// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});

// --- DOM要素 ---
const viewHome = document.getElementById('view-home');
const viewResults = document.getElementById('view-search-results');
const homeInput = document.getElementById('home-input');
const resultInput = document.getElementById('result-input');
const listContainer = document.getElementById('result-list');
const noResultMsg = document.getElementById('no-result');
const resultCountSpan = document.getElementById('result-count');
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTerm = document.getElementById('modal-term');
const modalBadges = document.getElementById('modal-badges');
const modalDescription = document.getElementById('modal-description');

// --- データ管理 ---
let termsData = [];
let selectedTags = new Set(); 
let currentQuery = '';

// --- 1. データ読み込み ---
async function init() {
    try {
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
        console.log("データ読み込み成功:", termsData.length + "件");
    } catch (error) {
        console.error('Data Load Error:', error);
        if(listContainer) {
            listContainer.innerHTML = '<li style="color:red; padding:20px;">データの読み込みに失敗しました。</li>';
        }
    }
}

// --- 2. イベントリスナー ---
function setupEventListeners() {
    
    // ▼ ホーム画面: 検索
    if(homeInput) {
        homeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && homeInput.value.trim() !== "") {
                goToResults(homeInput.value);
            }
        });
    }
    const homeSearchBtn = document.getElementById('home-search-btn');
    if(homeSearchBtn) {
        homeSearchBtn.addEventListener('click', () => {
            if (homeInput && homeInput.value.trim() !== "") {
                goToResults(homeInput.value);
            }
        });
    }

    // ▼ ホーム画面: カテゴリカード (クリックしたらそのタグ1つだけで検索開始)
    const homeGrid = document.querySelector('.cat-grid');
    if(homeGrid) {
        homeGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.cat-card');
            if (card) {
                // ホームから飛ぶ場合は、それまでの選択をリセットして、そのタグだけを選択
                selectedTags.clear();
                selectedTags.add(card.dataset.cat);
                goToResults(""); // クエリなしで遷移
            }
        });
    }

    // ▼ ★重要: タグの複数選択ロジック
    const allTagContainers = document.querySelectorAll('.categories-scroll');
    allTagContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) {
                const tag = chip.dataset.cat;

                // A. 「すべて」が押された場合 -> 全解除
                if (tag === 'all') {
                    selectedTags.clear();
                } 
                // B. それ以外が押された場合 -> ON/OFF切り替え
                else {
                    if (selectedTags.has(tag)) {
                        selectedTags.delete(tag); // 選択解除
                    } else {
                        selectedTags.add(tag);    // 選択追加
                    }
                }

                // ホーム画面にいるなら結果画面へ移動
                if (viewHome.classList.contains('active')) {
                    goToResults(""); 
                } else {
                    // すでに結果画面なら再描画のみ
                    updateCategoryChips();
                    renderList();
                }
            }
        });
    });

    // ▼ その他ボタン
    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.addEventListener('click', goToHome);

    if(resultInput) {
        resultInput.addEventListener('input', (e) => {
            currentQuery = e.target.value;
            renderList();
        });
    }

    const resetSearchBtn = document.getElementById('reset-search-btn');
    if(resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            selectedTags.clear();
            goToResults("");
        });
    }

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if(modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            // 背景（オーバーレイ）をクリックした時だけ閉じる
            if (e.target === modalOverlay) closeModal();
        });
    }
}

// --- 3. 画面遷移 ---
function goToResults(query) {
    // クエリがある場合は更新(空文字なら維持しない、今回は上書き)
    if (typeof query === 'string') {
        currentQuery = query;
        if(resultInput) resultInput.value = query;
        if(homeInput) homeInput.value = query;
    }

    // UI更新
    updateCategoryChips();
    renderList();

    // 画面切り替え
    if(viewHome) {
        viewHome.classList.remove('active');
        viewHome.classList.add('hidden');
    }
    if(viewResults) {
        viewResults.classList.remove('hidden');
        viewResults.classList.add('active');
    }
}

function goToHome() {
    // 状態リセット
    if(homeInput) homeInput.value = '';
    if(resultInput) resultInput.value = '';
    selectedTags.clear(); // ホームに戻る時は選択解除（お好みで）

    if(viewResults) {
        viewResults.classList.remove('active');
        viewResults.classList.add('hidden');
    }
    if(viewHome) {
        viewHome.classList.remove('hidden');
        viewHome.classList.add('active');
    }
}

// --- 4. 描画ロジック (AND検索) ---
function renderList() {
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    const filtered = termsData.filter(item => {
        // A. タグ判定 (ANDロジック: 選択されたタグを「全て」持っているか)
        let isTagMatch = true;
        
        if (selectedTags.size > 0) {
            // アイテムが持っているタグ配列を取得
            const itemTags = item.tags || [];
            // 選択中のタグ(selectedTags)すべてについて、itemTagsに含まれているか確認
            // 一つでも含まれていなければ false になる
            for (let tag of selectedTags) {
                if (!itemTags.includes(tag)) {
                    isTagMatch = false;
                    break; 
                }
            }
        }
        // ※selectedTagsが空(size=0)の場合は true のまま(=全件表示)

        // B. キーワード判定
        const q = currentQuery.toLowerCase().trim();
        const term = item.term || '';
        const reading = item.reading || '';
        const keywords = item.keywords || '';

        // キーワードでタグ検索
        let isKeywordInTag = false;
        if (item.tags && Array.isArray(item.tags)) {
            isKeywordInTag = item.tags.some(tag => tag.toLowerCase().includes(q));
        }

        const isTextMatch = !q || 
            term.toLowerCase().includes(q) || 
            reading.includes(q) || 
            keywords.toLowerCase().includes(q) ||
            isKeywordInTag;
            
        return isTagMatch && isTextMatch;
    });

    // 件数更新
    if(resultCountSpan) resultCountSpan.textContent = filtered.length;

    // 表示処理
    if (filtered.length === 0) {
        if(noResultMsg) noResultMsg.style.display = 'block';
    } else {
        if(noResultMsg) noResultMsg.style.display = 'none';
        
        filtered.forEach(item => {
            let badgesHtml = '';
            if (item.tags && Array.isArray(item.tags)) {
                badgesHtml = item.tags.map(tag => `<span class="category-badge" data-tag="${tag}">${tag}</span>`).join('');
            }

            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
                <div class="item-header-row">
                    <span class="term">${highlight(item.term, currentQuery)}<span class="reading">(${item.reading})</span></span>
                    <div class="badges-wrapper">${badgesHtml}</div>
                </div>
                <div class="description">${highlight(item.description, currentQuery)}</div>
            `;
            
            li.onclick = () => openModal(item);
            
            listContainer.appendChild(li);
        });
    }
}

// --- ヘルパー: チップの見た目更新 ---

// モーダルを開く
function openModal(item) {
    // データを流し込む
    modalTerm.textContent = item.term;
    // 読み仮名もつける場合はこちら: modalTerm.innerHTML = `${item.term} <span style="font-size:0.6em; color:#777;">(${item.reading})</span>`;
    modalDescription.innerHTML = item.description.replace(/\n/g, '<br>'); // 改行対応
    modalBadges.innerHTML = createBadgesHtml(item.tags);

    // 表示クラスを付与（アニメーション開始）
    modalOverlay.classList.add('active');
}

// モーダルを閉じる
function closeModal() {
    modalOverlay.classList.remove('active');
}

// バッジHTML生成
function createBadgesHtml(tags) {
    if (tags && Array.isArray(tags)) {
        return tags.map(tag => `<span class="category-badge" data-tag="${tag}">${tag}</span>`).join('');
    }
    return '';
}

function updateCategoryChips() {
    const allChips = document.querySelectorAll('.chip');
    allChips.forEach(chip => {
        const tag = chip.dataset.cat;
        const isHome = chip.closest('#view-home'); 
        if (tag === 'all') {
            if (isHome) chip.classList.remove('active');
            else {
                if (selectedTags.size === 0) chip.classList.add('active');
                else chip.classList.remove('active');
            }
        } else {
            if (selectedTags.has(tag)) chip.classList.add('active');
            else chip.classList.remove('active');
        }
    });
}

function highlight(text, query) {
    if (!query || !text) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="highlight-text">$1</mark>');
}