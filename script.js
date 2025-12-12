document.addEventListener('DOMContentLoaded', () => {
    init();
    loadFavorites();
    setupEventListeners();
    // 画面ロード時にタグのあふれチェックを実行
    checkTagOverflow();
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
const multiSelectToggle = document.getElementById('multi-select-toggle');

// モーダル関連
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTerm = document.getElementById('modal-term');
const modalBadges = document.getElementById('modal-badges');
const modalDescription = document.getElementById('modal-description');
const modalFavBtn = document.getElementById('modal-fav-btn');

// お問い合わせ関連
const contactOverlay = document.getElementById('contact-overlay');
const contactCloseBtn = document.getElementById('contact-close-btn');
const openContactBtn = document.getElementById('open-contact-btn');
const contactForm = document.getElementById('contact-form');

// --- データ管理 ---
let termsData = [];
let selectedTags = new Set(); 
let currentQuery = '';
let favoriteIds = [];

// --- 1. 初期化 ---
async function init() {
    try {
        // 先に data.js が公開した Promise を待つ（あれば）
        if (window.sheetPromise && typeof window.sheetPromise.then === 'function') {
            try {
               // タイムアウト（例: 10秒）付きで sheetPromise を待つ
                await Promise.race([
                    window.sheetPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('sheetPromise timeout')), 10000))
                ]);
            } catch (e) {
                console.warn('sheetPromise rejected:', e);
            }
        }

        // sheetPromise の結果で termsData が埋まっていればそれを使う
        if (window.termsData && Array.isArray(window.termsData) && window.termsData.length > 0) {
            termsData = window.termsData;
            renderHomeFavorites();
            return;
        }

        // フォールバック: ローカルの data.json を使用
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
        renderHomeFavorites();
    } catch (e) {
        console.error(e);
        if(listContainer) listContainer.innerHTML = '<li style="color:red;padding:20px">データ読込エラー</li>';
    }
}

// --- 2. イベント設定 ---
function setupEventListeners() {
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
            
            const textSpan = expandBtn.querySelector('.btn-text');
            if(tagContainer.classList.contains('expanded')) {
                textSpan.textContent = '閉じる';
            } else {
                textSpan.textContent = 'タグをすべて見る';
            }
        });
    }
    // リサイズ時にもあふれチェック
    window.addEventListener('resize', checkTagOverflow);

    // タグ選択
const allTagContainers = document.querySelectorAll('.categories-scroll, .cat-grid');
    allTagContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            if (e.target.closest('.no-select')) return;

            const chip = e.target.closest('.chip, .cat-card');
            if (chip) {
                const tag = chip.dataset.cat;
                const isHome = chip.classList.contains('cat-card');
                
                // ホーム画面からの遷移は常に「単一選択」として扱う
                if (isHome) {
                    selectedTags.clear();
                    selectedTags.add(tag);                    
                    goToResults("");
                    return;
                }

                // --- 検索結果画面でのチップ操作 ---
                
                if (tag === 'all') {
                    selectedTags.clear();
                } else {
                    // ★ここが変更点: スイッチの状態を確認
                    const isMultiMode = multiSelectToggle && multiSelectToggle.checked;

                    if (isMultiMode) {
                        // [複数選択モードON] -> 既存の動作 (追加/削除)
                        if (selectedTags.has(tag)) selectedTags.delete(tag);
                        else selectedTags.add(tag);
                    } else {
                        // [複数選択モードOFF] -> 単一選択 (切り替え)
                        // すでに選ばれているタグをもう一度押した場合は解除するか、そのままにするか
                        // ここでは「他のタグを消して、押したタグだけにする」挙動にします
                        if (selectedTags.has(tag) && selectedTags.size === 1) {
                            // 既にそれだけが選ばれている状態で押したら解除（すべて表示）
                            selectedTags.clear();
                        } else {
                            selectedTags.clear();
                            selectedTags.add(tag);
                        }
                    }
                }

                if (viewHome.classList.contains('active')) goToResults("");
                else { updateCategoryChips(); renderList(); }
            }
        });
    });

    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.addEventListener('click', goToHome);
    const resetBtn = document.getElementById('reset-search-btn');
    if(resetBtn) resetBtn.addEventListener('click', () => { selectedTags.clear(); goToResults("", "all"); });

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if(modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(); });

    // お問い合わせ
    if(openContactBtn) openContactBtn.addEventListener('click', () => contactOverlay.classList.add('active'));
    if(contactCloseBtn) contactCloseBtn.addEventListener('click', () => contactOverlay.classList.remove('active'));
    if(contactOverlay) contactOverlay.addEventListener('click', (e) => { if(e.target === contactOverlay) contactOverlay.classList.remove('active'); });

    if(contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const type = document.getElementById('contact-type').value;
                const detail = document.getElementById('contact-detail').value;
                
                // 件名
                const subject = encodeURIComponent(`【白鷺祭用語集】${type}`);
                
                // 本文作成
                // ポイント: モバイル対応のため、改行(\n)を \r\n に置換してからエンコードする
                let bodyText = `種別: ${type}\n\n詳細:\n${detail}\n\n----------------\n送信日: ${new Date().toLocaleDateString()}`;
                
                // 正規表現で \n を \r\n に置換
                const body = encodeURIComponent(bodyText.replace(/\n/g, "\r\n"));
                
                window.location.href = `mailto:sw23263n@st.omu.ac.jp?subject=${subject}&body=${body}`;
            });
        }
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
    
    const tagContainer = document.getElementById('tag-container');
    if(tagContainer) {
        tagContainer.classList.remove('expanded');
        // ボタン表記を戻す
        const expandBtn = document.getElementById('filter-expand-btn');
        if(expandBtn) expandBtn.querySelector('.btn-text').textContent = 'タグをすべて見る';
    }
    setTimeout(checkTagOverflow, 100);
    window.scrollTo(0, 0);
}

function goToHome() {
    if(homeInput) homeInput.value = '';
    if(resultInput) resultInput.value = '';
    selectedTags.clear();
    renderHomeFavorites();
    viewResults.classList.remove('active'); viewResults.classList.add('hidden');
    viewHome.classList.remove('hidden'); viewHome.classList.add('active');
}

// --- 4. 描画ロジック ---
function renderList() {
    listContainer.innerHTML = '';
    
    const filtered = termsData.filter(item => {
        let isTagMatch = true;
        if (selectedTags.size > 0) {
            const itemTags = item.tags || [];
            for (let tag of selectedTags) {
                if (tag === 'favorites') {
                    if (!favoriteIds.includes(item.id)) { isTagMatch = false; break; }
                } else {
                    if (!itemTags.includes(tag)) { isTagMatch = false; break; }
                }
            }
        }

        const q = currentQuery.toLowerCase().trim();

        // 小文字化して比較（ケースインセンシティブ）
        const term = (item.term || '').toLowerCase();
        const reading = (item.reading || '').toLowerCase();

        // keywords は配列になっている想定。文字列の場合も許容する。
        let keywordsJoined = '';
        if (Array.isArray(item.keywords)) {
            keywordsJoined = item.keywords.join(' ').toLowerCase();
        } else {
            keywordsJoined = String(item.keywords || '').toLowerCase();
        }
        // description を検索対象に含める
        const description = (item.description || '').toLowerCase();

        let isKeyInTag = (item.tags || []).some(t => String(t).toLowerCase().includes(q));

        const isTextMatch = !q || term.includes(q) || reading.includes(q) || keywordsJoined.includes(q) || description.includes(q) || isKeyInTag;
        return isTagMatch && isTextMatch;
    });

    if(resultCountSpan) resultCountSpan.textContent = filtered.length;
    noResultMsg.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach((item, i) => {
        const isFav = favoriteIds.includes(item.id);
        const badgesHtml = (item.tags || []).map(tag => 
            `<span class="category-badge" data-tag="${tag}" onclick="searchByTag(event, '${tag}')">${tag}</span>`
        ).join('');

        const li = document.createElement('li');
        li.className = 'item';
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

// --- ヘルパー ---
function checkTagOverflow() {
    const tagContainer = document.getElementById('tag-container');
    const expandBtn = document.getElementById('filter-expand-btn');
    if (!tagContainer || !expandBtn) return;
    
    // 一度閉じた状態で判定する
    const wasExpanded = tagContainer.classList.contains('expanded');
    tagContainer.classList.remove('expanded');
    
    // 1px余裕を見る
    const hasOverflow = tagContainer.scrollWidth > tagContainer.clientWidth + 1;
    
    if (hasOverflow) {
        expandBtn.style.display = 'flex';
        if (wasExpanded) tagContainer.classList.add('expanded');
    } else {
        expandBtn.style.display = 'none';
    }
}

window.searchByTag = function(e, tag) {
    e.stopPropagation();
    selectedTags.clear(); selectedTags.add(tag);
    currentQuery = ""; if(resultInput) resultInput.value = "";
    updateCategoryChips(); renderList(); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleFav = function(e, id) {
    e.stopPropagation();
    id = parseInt(id);
    if (favoriteIds.includes(id)) favoriteIds = favoriteIds.filter(f => f !== id);
    else favoriteIds.push(id);
    localStorage.setItem('shirasagi_favs', JSON.stringify(favoriteIds));
    if (selectedTags.has('favorites')) renderList(); else renderList();
    renderHomeFavorites();
};

function renderHomeFavorites() {
    if(!homeFavoritesList) return;
    homeFavoritesList.innerHTML = '';
    if(favoriteIds.length === 0) {
        homeFavoritesList.innerHTML = '<li class="no-fav-msg">まだお気に入りがありません</li>';
        return;
    }
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

function loadFavorites() {
    const saved = localStorage.getItem('shirasagi_favs');
    if (saved) favoriteIds = JSON.parse(saved);
}

function updateCategoryChips() {
    document.querySelectorAll('.categories-scroll .chip').forEach(chip => {
        const tag = chip.dataset.cat;
        if(tag === 'all') chip.classList.toggle('active', selectedTags.size === 0);
        else chip.classList.toggle('active', selectedTags.has(tag));
    });
}
function highlight(text, query) {
    if (!query || !text) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="highlight-text">$1</mark>');
}

function openModal(item) {
    document.getElementById('modal-term').textContent = item.term;
    document.getElementById('modal-description').innerHTML = item.description.replace(/\n/g, '<br>');
    document.getElementById('modal-badges').innerHTML = (item.tags || []).map(t => `<span class="category-badge" data-tag="${t}">${t}</span>`).join('');
    updateModalFavBtn(item.id);
    modalFavBtn.onclick = (e) => { toggleFav(e, item.id); updateModalFavBtn(item.id); };
    modalOverlay.classList.add('active');
}
function closeModal() { modalOverlay.classList.remove('active'); }
function updateModalFavBtn(id) {
    if (favoriteIds.includes(id)) { modalFavBtn.classList.add('active'); modalFavBtn.textContent = '★'; }
    else { modalFavBtn.classList.remove('active'); modalFavBtn.textContent = '☆'; }
}