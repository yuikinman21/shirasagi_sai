// 変数初期化
const listContainer = document.getElementById('result-list');
const searchInput = document.getElementById('search-input');
const noResultMsg = document.getElementById('no-result');
const categoryChips = document.querySelectorAll('.chip');

let termsData = []; // データ格納用
let currentCategory = 'all';
let currentQuery = '';

// 初期化処理：JSONファイルを読み込む
async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        termsData = await response.json();
        
        // データ読み込み完了後に描画
        renderList();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        listContainer.innerHTML = '<li style="padding:20px; color:red;">データの読み込みに失敗しました。<br>ローカルサーバーを使用してください。</li>';
    }
}

// 描画関数
function renderList() {
    listContainer.innerHTML = ''; // リセット
    
    // フィルタリング処理
    const filtered = termsData.filter(item => {
        // カテゴリ判定
        const isCategoryMatch = (currentCategory === 'all') || (item.category === currentCategory);
        
        // 検索ワード判定 (小文字化して比較)
        const q = currentQuery.toLowerCase();
        const isTextMatch = 
            item.term.toLowerCase().includes(q) || 
            item.reading.includes(q) || 
            item.keywords.toLowerCase().includes(q);

        return isCategoryMatch && isTextMatch;
    });

    // HTML生成
    if (filtered.length === 0) {
        noResultMsg.style.display = 'block';
    } else {
        noResultMsg.style.display = 'none';
        filtered.forEach(item => {
            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
                <div class="item-header">
                    <span class="term">${highlight(item.term, currentQuery)}</span>
                    <span class="category-badge">${item.category}</span>
                </div>
                <div class="reading">${item.reading}</div>
                <div class="description">${highlight(item.description, currentQuery)}</div>
            `;
            // タップ時のアクション
            li.onclick = () => alert(`【詳細表示】\n${item.term}\n\n${item.description}\n\n(隠しKW: ${item.keywords})`);
            listContainer.appendChild(li);
        });
    }
}

// ハイライト関数
function highlight(text, query) {
    if (!query) return text;
    // 特殊文字のエスケープ処理などは簡易化しています
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span style="background:#fff3cd; font-weight:bold;">$1</span>');
}

// イベントリスナー登録

// 検索入力時
searchInput.addEventListener('input', (e) => {
    currentQuery = e.target.value;
    renderList();
});

// カテゴリクリック時
categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
        // UI更新
        document.querySelector('.chip.active').classList.remove('active');
        chip.classList.add('active');
        
        // データ更新
        currentCategory = chip.dataset.cat;
        renderList();
    });
});

// アプリ開始
init();