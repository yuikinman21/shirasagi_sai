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
const sortMethodSelect = document.getElementById('sort-method-select');
const sortOrderSelect = document.getElementById('sort-order-select');

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

    // ソート選択の変化でリストを再描画
    if (sortMethodSelect) sortMethodSelect.addEventListener('change', () => renderList());
    if (sortOrderSelect) sortOrderSelect.addEventListener('change', () => renderList());
    // ソート方式に応じて右側のラベルを切り替える
    function updateSortOrderLabels() {
        if (!sortMethodSelect || !sortOrderSelect) return;
        const method = sortMethodSelect.value;
        // クリアして再設定（デフォルト値をリセットする）
        sortOrderSelect.options.length = 0;
        if (method === 'updated') {
            // 更新順: デフォルトは「新しい順（降順）」
            sortOrderSelect.add(new Option('新しい順', 'desc'));
            sortOrderSelect.add(new Option('古い順', 'asc'));
            sortOrderSelect.value = 'desc';
        } else {
            // タグ順・名前順: デフォルトは「昇順」
            sortOrderSelect.add(new Option('昇順', 'asc'));
            sortOrderSelect.add(new Option('降順', 'desc'));
            sortOrderSelect.value = 'asc';
        }
    }
    if (sortMethodSelect) sortMethodSelect.addEventListener('change', () => { updateSortOrderLabels(); renderList(); });
    // 初期ラベル更新
    updateSortOrderLabels();

    const showAllListBtn = document.getElementById('show-all-link');
    if(showAllListBtn) {
        showAllListBtn.addEventListener('click', () => {
            selectedTags.clear();
            goToResults(""); // クエリ空で検索結果画面へ
        });
    }

    // タグエリアの開閉ボタン
    const expandBtn = document.getElementById('filter-expand-btn');
    const closeBtn = document.getElementById('filter-close-btn');
    const tagContainer = document.getElementById('tag-container');
    const filterBar = document.querySelector('.filter-bar');
    
    const toggleExpanded = () => {
        tagContainer.classList.toggle('expanded');
        if(filterBar) filterBar.classList.toggle('expanded');
        
        // ボタンのテキストを切り替え
        const textSpan = expandBtn.querySelector('.btn-text');
        if(tagContainer.classList.contains('expanded')) {
            textSpan.textContent = '閉じる';
        } else {
            textSpan.textContent = 'タグをすべて見る';
        }

        // 展開状態を変えたらオーバーフロー判定を更新
        checkTagOverflow();
    };
    
    if(expandBtn && tagContainer) {
        expandBtn.addEventListener('click', toggleExpanded);
    }
    if(closeBtn && tagContainer) {
        closeBtn.addEventListener('click', toggleExpanded);
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

    // --- 地図関連のイベントリスナー ---
    const mapFabBtn = document.getElementById('map-fab-btn');
    
    // ホーム画面の「地図ボタン」で地図を開く
    if(mapFabBtn) mapFabBtn.addEventListener('click', () => {
        const mapInput = document.getElementById('map-search-input');
        if (mapInput) {
            mapInput.value = '';
        }
        goToMap();
    });
    
    // 新しい地図ロジックの初期化を実行
    // (地図内の検索ボタンや閉じるボタン、ドラッグ操作などはこの中で設定されます)
    if (typeof initMapLogic === 'function') {
        initMapLogic();
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
    window.scrollTo(0, 0);
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

    // --- ソート適用 ---
    let sorted = filtered.slice();
    const method = sortMethodSelect ? sortMethodSelect.value : 'tag';
    const order = sortOrderSelect ? sortOrderSelect.value : 'desc';
    if (window.sortItems) {
        if (method === 'tag') {
            const tagContainerEl = document.getElementById('tag-container');
            const chips = tagContainerEl ? Array.from(tagContainerEl.querySelectorAll('.chip')) : [];
            const tagOrderArray = chips.map(c => c.dataset.cat).filter(t => t && t !== 'all' && t !== 'favorites');
            sorted = window.sortItems(sorted, { method: 'tag', order, tagOrderArray });
        } else {
            sorted = window.sortItems(sorted, { method, order });
        }
    }

    if(resultCountSpan) resultCountSpan.textContent = sorted.length;
    noResultMsg.style.display = sorted.length === 0 ? 'block' : 'none';

    sorted.forEach((item, i) => {
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
    const filterBar = document.querySelector('.filter-bar');
    if (!tagContainer || !expandBtn || !filterBar) return;

    // PC では常に展開表示なのでスマホのみ判定
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
        filterBar.classList.remove('collapsed-overflow');
        return;
    }
    
    // 計測時はいったん閉じる
    const wasExpanded = tagContainer.classList.contains('expanded');
    tagContainer.classList.remove('expanded');
    
    // 1px 余裕を持ってオーバーフロー判定
    const hasOverflow = tagContainer.scrollWidth > tagContainer.clientWidth + 1;

    // オーバーフローしていて未展開なら、トグルを固定表示させるフラグを付与
    const shouldPinToggle = hasOverflow && !wasExpanded;
    filterBar.classList.toggle('collapsed-overflow', shouldPinToggle);
    
    if (hasOverflow) {
        expandBtn.style.display = 'flex';
    } else {
        expandBtn.style.display = 'none';
    }

    // 元の展開状態を復元
    if (wasExpanded) tagContainer.classList.add('expanded');
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
    // 1. まず、前回表示したボタンが残っていれば削除する（リセット）
    const existingBtn = document.getElementById('modal-map-btn');
    if(existingBtn) existingBtn.remove();

    // 2. 「場所」タグを持っている場合のみ、新しくボタンを作成して追加
    if ((item.tags || []).includes('場所')) {
        const btn = document.createElement('button');
        btn.id = 'modal-map-btn'; // IDを付与して後で探せるようにする
        btn.className = 'map-jump-btn'; // CSSは先ほどのを流用
        btn.innerHTML = '📍 地図で場所を確認';
        
        // モーダル用にスタイルを少し調整（中央揃えなど）
        btn.style.marginTop = '20px';
        btn.style.width = '100%';
        btn.style.justifyContent = 'center';
        btn.style.padding = '10px';
        btn.style.fontSize = '14px';

        // クリック時の動作
        btn.onclick = (e) => {
            closeModal(); // モーダルを閉じる
            window.openMapForPlace(e, item.term); // 地図へジャンプ
        };

        // modal-body の一番下に追加
        document.querySelector('.modal-body').appendChild(btn);
    }
    modalOverlay.classList.add('active');
}
function closeModal() { modalOverlay.classList.remove('active'); }
function updateModalFavBtn(id) {
    if (favoriteIds.includes(id)) { modalFavBtn.classList.add('active'); modalFavBtn.textContent = '★'; }
    else { modalFavBtn.classList.remove('active'); modalFavBtn.textContent = '☆'; }
}

// リストから地図へジャンプする関数
window.openMapForPlace = function(e, term) {
    e.stopPropagation(); // 親要素(li)のクリックイベント（詳細モーダルを開く）を止める
    
    // 地図の検索窓に用語をセットしておく（ユーザーが何を探しているか分かりやすくするため）
    const mapInput = document.getElementById('map-search-input');
    if (mapInput) {
        mapInput.value = term;
    }
    // 地図画面へ遷移
    goToMap();
};

// --- 新・地図機能ロジック (Google Map風操作) ---

const viewMap = document.getElementById('view-map');
const mapContainer = document.getElementById('map-container');
const mapContent = document.getElementById('map-content');
const mapImage = document.getElementById('map-image');
const mapPopup = document.getElementById('map-popup');
const mapPopupTerm = document.getElementById('map-popup-term');
const mapPopupSearchBtn = document.getElementById('map-popup-search-btn');
const mapPopupCloseBtn = document.getElementById('map-popup-close-btn');

// 状態管理
let mapState = {
    x: 0, // 初期位置X
    y: 0, // 初期位置Y
    scale: 1, // 初期スケール
    isDragging: false
};

// 設定
const MIN_SCALE = 0.2;
const MAX_SCALE = 4.0;

function goToMap() {
    viewHome.classList.remove('active'); viewHome.classList.add('hidden');
    viewResults.classList.remove('active'); viewResults.classList.add('hidden');
    viewMap.classList.remove('hidden'); viewMap.classList.add('active');

    const mapPopup = document.getElementById('map-popup');
    if (mapPopup) {
        mapPopup.classList.add('hidden');
    }

    // 初期表示時に位置合わせ（初回のみ画像ロード待ちが必要かも）
    if(mapImage.complete) centerMap();
    else mapImage.onload = centerMap;
}

function centerMap() {
    // 簡易的に中央あたりを表示
    if(!mapContainer || !mapImage) return;
    const cw = mapContainer.clientWidth;
    const ch = mapContainer.clientHeight;
    const iw = mapImage.naturalWidth || 1000;
    const ih = mapImage.naturalHeight || 1000;
    
    // 画像の中央を画面の中央に
    mapState.scale = 0.3; // 初期は少し引きで
    mapState.x = (cw - iw * mapState.scale) / 2;
    mapState.y = (ch - ih * mapState.scale) / 2;
    
    updateTransform();
    renderMapPins();
    const mapInput = document.getElementById('map-search-input');
    if (mapInput && mapInput.value.trim() !== '') {
        setTimeout(() => {
            executeMapSearch();
        }, 50); // ピンの描画完了を待つために少しだけ遅延させる
    }
}

// function updateTransform() {
//     if(!mapContent) return;
//     mapContent.style.transform = `translate(${mapState.x}px, ${mapState.y}px) scale(${mapState.scale})`;
//     const inverseScale = 1 / mapState.scale;
//     document.querySelectorAll('.map-pin').forEach(pin => {
//         pin.style.transform = `scale(${inverseScale})`;
//     });
// }

// 検索実行
// function executeMapSearch() {
//     const input = document.getElementById('map-search-input');
//     const query = input.value.trim();
//     if (query) {
//         // 地図を閉じて検索結果画面へ
//         viewMap.classList.remove('active'); viewMap.classList.add('hidden');
//         // 既存の検索関数を呼び出す
//         goToResults(query);
//         // 入力欄をクリアするかはお好みで
//         // input.value = '';
//     }
// }

// --- script.js の initMapLogic 関数を丸ごと書き換え ---

function initMapLogic() {
    if(!mapContainer) return;

    // --- 1. ヘッダー操作 ---
    const closeBtn = document.getElementById('map-close-btn');
    if(closeBtn) closeBtn.addEventListener('click', () => {
        viewMap.classList.remove('active'); viewMap.classList.add('hidden');
        viewHome.classList.remove('hidden'); viewHome.classList.add('active');
    });

    const searchSubmit = document.getElementById('map-search-submit');
    const searchInput = document.getElementById('map-search-input');
    
    if(searchSubmit) searchSubmit.addEventListener('click', executeMapSearch);
    if(searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') executeMapSearch();
        });
        // 入力中は地図操作イベントを止める
        searchInput.addEventListener('touchstart', (e) => e.stopPropagation());
        searchInput.addEventListener('touchmove', (e) => e.stopPropagation());
    }


    // --- 2. 地図操作 (Pointer Events + 慣性) ---
    let pointers = []; 
    let lastCenter = null;
    let lastDist = 0;

    // 慣性用の変数
    let velocityX = 0;
    let velocityY = 0;
    let inertiaRequestId = null;

    const getPointerCenter = (ptrList) => {
        let x = 0, y = 0;
        ptrList.forEach(p => { x += p.clientX; y += p.clientY; });
        return { x: x / ptrList.length, y: y / ptrList.length };
    };

    const getPointerDist = (p1, p2) => {
        return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    };

    // 慣性アニメーションを停止
    const stopInertia = () => {
        if(inertiaRequestId) {
            cancelAnimationFrame(inertiaRequestId);
            inertiaRequestId = null;
        }
    };

    // 慣性アニメーション処理
    const applyInertia = () => {
        // 速度が十分小さくなったら停止して境界チェック
        if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) {
            checkBoundaries();
            return;
        }

        // 減速（摩擦係数 0.92 くらいが自然です）
        velocityX *= 0.92;
        velocityY *= 0.92;

        mapState.x += velocityX;
        mapState.y += velocityY;

        updateTransform();

        // 次のフレームをリクエスト
        inertiaRequestId = requestAnimationFrame(applyInertia);
    };

    mapContainer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        stopInertia(); // 操作開始で慣性を止める
        
        mapContainer.setPointerCapture(e.pointerId);
        pointers.push(e);
        
        lastCenter = getPointerCenter(pointers);
        if (pointers.length === 2) {
            lastDist = getPointerDist(pointers[0], pointers[1]);
        }
        mapState.isDragging = true;
        mapContent.style.transition = 'none'; // 操作中はCSSアニメを切る
        
        // 速度リセット
        velocityX = 0;
        velocityY = 0;
    });

    mapContainer.addEventListener('pointermove', (e) => {
        if (!mapState.isDragging || pointers.length === 0) return;

        const index = pointers.findIndex(p => p.pointerId === e.pointerId);
        if (index !== -1) pointers[index] = e;

        const currentCenter = getPointerCenter(pointers);
        const dx = currentCenter.x - lastCenter.x;
        const dy = currentCenter.y - lastCenter.y;

        // 慣性のために直近の移動量を速度として記録
        velocityX = dx;
        velocityY = dy;

        // --- 移動 (Pan) ---
        mapState.x += dx;
        mapState.y += dy;

        // --- 拡大縮小 (Pinch) ---
        if (pointers.length === 2) {
            const currentDist = getPointerDist(pointers[0], pointers[1]);
            if (lastDist > 0) {
                const scaleDiff = currentDist / lastDist;
                const oldScale = mapState.scale;
                let newScale = oldScale * scaleDiff;
                newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
                
                // 中心ズーム補正
                const pointerOnImageX = (currentCenter.x - mapState.x);
                const pointerOnImageY = (currentCenter.y - mapState.y);
                
                mapState.x -= pointerOnImageX * (newScale / oldScale - 1);
                mapState.y -= pointerOnImageY * (newScale / oldScale - 1);

                mapState.scale = newScale;
                lastDist = currentDist;
                
                // ピンチ中は移動慣性を無効化しておく
                velocityX = 0;
                velocityY = 0;
            }
        }

        lastCenter = currentCenter;
        updateTransform();
    });

    const endDrag = (e) => {
        const index = pointers.findIndex(p => p.pointerId === e.pointerId);
        if (index !== -1) pointers.splice(index, 1);

        if (pointers.length === 0) {
            mapState.isDragging = false;
            
            // 指を離したら慣性アニメーション開始
            applyInertia();
            
        } else if (pointers.length === 1) {
            lastCenter = getPointerCenter(pointers);
            lastDist = 0;
            velocityX = 0; 
            velocityY = 0;
        }
    };

    mapContainer.addEventListener('pointerup', endDrag);
    mapContainer.addEventListener('pointercancel', endDrag);
    mapContainer.addEventListener('pointerleave', endDrag);
    
    // PC用ホイールズーム (変更なし)
    mapContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        stopInertia(); // ホイール操作時も慣性を止める
        
        const scaleDiff = e.deltaY > 0 ? 0.9 : 1.1;
        const oldScale = mapState.scale;
        let newScale = oldScale * scaleDiff;
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);

        const rect = mapContainer.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;
        
        const pointerOnImageX = pointerX - mapState.x;
        const pointerOnImageY = pointerY - mapState.y;

        mapState.x -= pointerOnImageX * (newScale / oldScale - 1);
        mapState.y -= pointerOnImageY * (newScale / oldScale - 1);
        
        mapState.scale = newScale;
        updateTransform();
        
        clearTimeout(window.wheelTimer);
        window.wheelTimer = setTimeout(checkBoundaries, 300);
    }, { passive: false });
}

function checkBoundaries() {
    // 画面からはみ出しすぎないように戻すアニメーション
    if(!mapContainer || !mapImage) return;
    
    const containerW = mapContainer.clientWidth;
    const containerH = mapContainer.clientHeight;
    
    // 現在の画像サイズ
    const currentW = (mapImage.naturalWidth || 1000) * mapState.scale;
    const currentH = (mapImage.naturalHeight || 1000) * mapState.scale;

    // 許容する余白（画面の半分くらいは外に出てもいい）
    const marginX = containerW * 0.8;
    const marginY = containerH * 0.8;

    let nextX = mapState.x;
    let nextY = mapState.y;

    // 右に行き過ぎ（左側に余白ができすぎ）
    if (nextX > marginX) nextX = marginX;
    // 左に行き過ぎ
    if (nextX + currentW < containerW - marginX) nextX = containerW - marginX - currentW;

    if (nextY > marginY) nextY = marginY;
    if (nextY + currentH < containerH - marginY) nextY = containerH - marginY - currentH;
    
    // 位置補正が必要ならアニメーションで戻す
    if (nextX !== mapState.x || nextY !== mapState.y) {
        mapState.x = nextX;
        mapState.y = nextY;
        mapContent.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        updateTransform();
    }
}

// ポップアップを閉じる処理
if (mapPopupCloseBtn) {
    mapPopupCloseBtn.addEventListener('click', () => {
        mapPopup.classList.add('hidden');

        document.querySelectorAll('.map-pin').forEach(pin => {
            pin.classList.remove('highlighted-pin');
            pin.style.opacity = "1";
            const inverseScale = 1 / mapState.scale;
            pin.style.transform = `scale(${inverseScale * 0.4})`; // 0.4倍の通常サイズ
            pin.style.filter = "drop-shadow(0px 8px 8px rgba(0,0,0,0.25))"; // 通常の影
            const originalY = parseFloat(pin.style.top) || 0;
            pin.style.zIndex = Math.round(originalY) + 50; // z-indexを元の高さ計算に戻す
        });
    });
}

// ポップアップを表示する関数
function showMapPopup(item) {
    if(!mapPopup) return;
    mapPopupTerm.textContent = item.term;
    
    // 検索結果を見るボタンの動作
    mapPopupSearchBtn.onclick = () => {
        mapPopup.classList.add('hidden'); // ポップアップを閉じる
        
        // 地図を閉じて検索結果画面へ遷移
        const closeMapBtn = document.getElementById('map-close-btn');
        if (closeMapBtn) closeMapBtn.click();
        
        goToResults(item.term); // 用語で検索実行
    };
    
    mapPopup.classList.remove('hidden');
}

// マップ上にピンを描画する関数
function renderMapPins() {
    if (!mapContent) return;

    // 既存のピンを一旦すべて削除（初期化）
    document.querySelectorAll('.map-pin').forEach(p => p.remove());

    const inverseScale = 1 / mapState.scale;

    termsData.forEach(item => {
        if (item.map_x != null && item.map_y != null) {
            const pin = document.createElement('div');
            pin.className = 'map-pin';

            pin.dataset.termId = item.id;
            pin.dataset.termName = item.term;
            pin.dataset.mapY = item.map_y;
                        
            // パーセント指定で配置
            pin.style.left = `${item.map_x}%`;
            pin.style.top = `${item.map_y}%`;

            pin.style.zIndex = Math.round(item.map_y) + 50;

            // ベースサイズが2倍なので「0.4倍」にして標準サイズにする
            pin.style.transform = `scale(${inverseScale * 0.4})`;
            
            // 地図のドラッグ操作（pointerdown）をピン上でキャンセルする
            pin.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
            });

            // クリック時のポップアップ表示とカメラ移動
            pin.addEventListener('click', (e) => {
                e.stopPropagation();

                try {
                    // 1. 他のピンを薄くする
                    document.querySelectorAll('.map-pin').forEach(p => {
                        p.classList.remove('highlighted-pin');
                        // p.style.opacity = "0.5"; 
                        const invScale = 1 / mapState.scale;
                        p.style.transform = `scale(${invScale * 0.4})`;
                        p.style.filter = "drop-shadow(0px 8px 8px rgba(0,0,0,0.25))";
                        p.style.zIndex = Math.round(parseFloat(p.style.top) || 0) + 50;
                    });

                    // 2. クリックされたピンをハイライト
                    pin.classList.add('highlighted-pin');
                    pin.style.opacity = "1";
                    pin.style.filter = "drop-shadow(0px 0px 15px rgba(0, 86, 179, 0.8))";
                    pin.style.zIndex = 999;

                    const mapContainer = document.getElementById('map-container');
                    const mapImage = document.getElementById('map-image');
                    
                    if(mapContainer && mapImage) {
                        const cw = mapContainer.clientWidth;
                        const ch = mapContainer.clientHeight;
                        const iw = mapImage.naturalWidth || 1000;
                        const ih = mapImage.naturalHeight || 1000;
                        
                        const px = item.map_x / 100;
                        const py = item.map_y / 100;
                        
                        // ズームイン（すでに0.8倍以上拡大されている場合は、今の倍率を維持する）
                        mapState.scale = Math.max(mapState.scale, 0.8);
                        
                        // 画面中央にピンが来るように計算
                        mapState.x = (cw / 2) - (iw * px * mapState.scale);
                        mapState.y = (ch / 2) - (ih * py * mapState.scale);
                        
                        // アニメーションを有効にして滑らかに移動させる
                        mapContent.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                        
                        // updateTransformを呼ぶことでカメラ位置とピンのサイズ（0.75倍ハイライト）が再計算されます
                        updateTransform(); 
                        
                        // 移動が終わったら transition を元に戻す
                        setTimeout(() => {
                            mapContent.style.transition = 'none';
                        }, 400);
                    }

                } catch(error) {
                    console.error("ピン装飾・移動エラー:", error);
                }
                
                // ポップアップを表示
                showMapPopup(item);
            });

            mapContent.appendChild(pin);
        }
    });
}

// --- 地図の拡大縮小時にピンのサイズを再計算する処理 ---
function updateTransform() {
    if(!mapContent) return;
    mapContent.style.transform = `translate(${mapState.x}px, ${mapState.y}px) scale(${mapState.scale})`;

    const inverseScale = 1 / mapState.scale;
    document.querySelectorAll('.map-pin').forEach(pin => {
        if(!pin.classList.contains('highlighted-pin')){
            // 🌟 通常のピン
            pin.style.transform = `scale(${inverseScale * 0.4})`;
        } else {
            // 🌟 ハイライト中のピン
            pin.style.transform = `scale(${inverseScale * 0.5})`;
        }
    });
}

// --- 検索実行時、一致するピンがあればハイライト＆移動させる処理 ---
function executeMapSearch() {
    const input = document.getElementById('map-search-input');
    const query = input.value.trim();
    
    if (query) {
        let foundPin = false;
        let targetPin = null; 

        document.querySelectorAll('.map-pin').forEach(pin => {
            const termName = pin.dataset.termName || '';
            if(termName.includes(query)){
                // 検索に一致したピンをハイライト
                pin.classList.add('highlighted-pin');
                pin.style.opacity = "1";
                pin.style.filter = "drop-shadow(0px 0px 15px rgba(0, 86, 179, 0.8))";
                pin.style.zIndex = 999;
                
                foundPin = true;
                if(!targetPin) targetPin = pin; // 最初に見つかったピンを記録する
            } else {
                // 一致しないピンはハイライト解除して目立たなくする
                pin.classList.remove('highlighted-pin');
                pin.style.opacity = "1"; 
                pin.style.filter = "none";
                const originalY = parseFloat(pin.style.top) || 0;
                pin.style.zIndex = Math.round(originalY) + 50;
            }
        });
        
        if(foundPin && targetPin) {
            // 見つかったピンの位置へカメラを移動（パン）してズームする
            const mapContainer = document.getElementById('map-container');
            const mapImage = document.getElementById('map-image');
            const mapContent = document.getElementById('map-content');
            
            if(mapContainer && mapImage && mapContent) {
                const cw = mapContainer.clientWidth;
                const ch = mapContainer.clientHeight;
                const iw = mapImage.naturalWidth || 1000;
                const ih = mapImage.naturalHeight || 1000;
                
                const px = parseFloat(targetPin.style.left) / 100;
                const py = parseFloat(targetPin.style.top) / 100;
                
                // ズームインさせる
                mapState.scale = 0.8;
                
                // 画面中央にピンが来るように計算
                mapState.x = (cw / 2) - (iw * px * mapState.scale);
                mapState.y = (ch / 2) - (ih * py * mapState.scale);
                
                // アニメーションを有効にして滑らかに移動させる
                mapContent.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                
                updateTransform(); 
                
                // 移動が終わったら transition を元に戻す
                setTimeout(() => {
                    mapContent.style.transition = 'none';
                }, 400);
            }

            //カメラ移動と同時にポップアップも表示する
            const termId = parseInt(targetPin.dataset.termId, 10);
            const targetItem = termsData.find(item => item.id === termId);
            if(targetItem) {
                showMapPopup(targetItem);
            }

        } else if(!foundPin) {
            // ピンが見つからなかった場合はマップを閉じず、ピンのハイライトを解除して全体表示（初期状態）に戻す
            document.querySelectorAll('.map-pin').forEach(pin => {
                pin.classList.remove('highlighted-pin');
                pin.style.opacity = "1";
                pin.style.filter = "drop-shadow(0px 8px 8px rgba(0,0,0,0.25))";
                const originalY = parseFloat(pin.style.top) || 0;
                pin.style.zIndex = Math.round(originalY) + 50;
            });

            const mapContainer = document.getElementById('map-container');
            const mapImage = document.getElementById('map-image');
            const mapContent = document.getElementById('map-content');

            if(mapContainer && mapImage && mapContent) {
                const cw = mapContainer.clientWidth;
                const ch = mapContainer.clientHeight;
                const iw = mapImage.naturalWidth || 1000;
                const ih = mapImage.naturalHeight || 1000;
                
                // 初期のズーム倍率と位置に戻す
                mapState.scale = 0.3; 
                mapState.x = (cw - iw * mapState.scale) / 2;
                mapState.y = (ch - ih * mapState.scale) / 2;
                
                // アニメーション付きで移動
                mapContent.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                updateTransform(); 
                
                setTimeout(() => {
                    mapContent.style.transition = 'none';
                }, 400);
            }
        }
    } else {
        // 検索枠が空の場合は全てのピンを通常状態に戻す
        document.querySelectorAll('.map-pin').forEach(pin => {
            pin.classList.remove('highlighted-pin');
            pin.style.opacity = "1";
            pin.style.filter = "drop-shadow(0px 8px 8px rgba(0,0,0,0.25))";
            const originalY = parseFloat(pin.style.top) || 0;
            pin.style.zIndex = Math.round(originalY) + 50;
        });
        updateTransform(); 
    }
}