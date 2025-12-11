/*
  Google スプレッドシート（CSV 出力）を取得して
  アプリで使う形にマッピングして `window.termsData` に入れるローダー

  期待する CSV ヘッダ: id, term, reading, keyword, tags_1, tags_2, tags_3, tags_4, description, image
  - `keyword` 列はセル内にカンマを含む可能性があるため、PapaParse を使用して安全にパースします。
  - 各 tags_* 列をまとめて `tags` 配列を作ります。
*/

// 公開したスプレッドシートの CSV 出力 URL にしてください（例: pub?output=csv）
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAuYT97GP4G_GTiNJJtHl4loaNajahPjAH-MNVn48pfRME9sz7EyQ4yVmZaqli17NA_BOJgXDnBjEI/pub?output=csv";

async function loadSheetAsTerms() {
    try {
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
        const csvText = await res.text();

        // PapaParse を使用してヘッダ付きで安全にパース
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const rows = parsed.data || [];

        const mapped = rows.map((row, idx) => {
            // --- 1. tags_* 列を統合して tags 配列を作成 ---
            const tags = [];
            for (let i = 1; i <= 4; i++) {
                const key = `tags_${i}`;
                if (row[key] && String(row[key]).trim()) tags.push(String(row[key]).trim());
            }

            // --- 2. keyword 列をカンマ区切りの配列に変換 ---
            const keywordString = (row.keyword || '').trim();
            // カンマで分割し、各要素の空白を削除し、空の要素を除外
            const keywordsArray = keywordString 
                ? keywordString.split(',').map(k => k.trim()).filter(k => k !== '')
                : [];
            
            // --- 3. 最終的なオブジェクトを返す ---
            return {
                id: row.id ? parseInt(row.id, 10) : (idx + 1),
                term: (row.term || '').trim(),
                reading: (row.reading || '').trim(),
                keywords: keywordsArray, // 🚨 ここを配列に修正
                tags: Array.from(new Set(tags)),
                description: (row.description || '').trim(),
                image: (row.image || '').trim()
            };
        }).filter(item => item.term); // 用語が必須

        // 最低限の重複 id 対策: 重複があれば連番に差し替える
        const seen = new Set();
        mapped.forEach((it, i) => {
            // idが不正または既に存在する場合に連番を割り当てる
            if (!it.id || seen.has(it.id)) {
                it.id = i + 1;
            }
            seen.add(it.id);
        });

        window.termsData = mapped;
        console.log(`Loaded ${mapped.length} terms from CSV`);
        return mapped;
    } catch (err) {
        console.error('Failed to load sheet CSV:', err);
        // エラー時は window.termsData を空配列にしておく
        window.termsData = window.termsData || [];
        return window.termsData;
    }
}

// 自動でロード（defer 属性で読み込まれることを想定）
// Promise を外部に公開して init() が待てるようにする
window.sheetPromise = loadSheetAsTerms();