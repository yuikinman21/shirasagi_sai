/*
  Google スプレッドシート（CSV 出力）を取得して
  アプリで使う形にマッピングして `window.termsData` に入れるローダー

  期待する CSV ヘッダ: id, term, reading, keyword, tags_1, tags_2, tags_3, tags_4, description, image
  - `keyword` 列はセル内にカンマを含む可能性があるため、PapaParse を使用して安全にパースする。
  - 各 tags_* 列をまとめて `tags` 配列を作成。
*/


// 公開したスプレッドシートの CSV 出力 URL にしてください（例: pub?output=csv）
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAuYT97GP4G_GTiNJJtHl4loaNajahPjAH-MNVn48pfRME9sz7EyQ4yVmZaqli17NA_BOJgXDnBjEI/pub?output=csv";
// const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQMhpWQl0NnB0SV2CXmAL_aAHYohFhqlm5LnoVnpOMBJPLeHcLRhWY5fzHUSuM4jYXK6euB6X2LNUmz/pub?gid=232235237&single=true&output=csv";


async function loadSheetAsTerms(noCache = true) {
    try {
        const url = noCache ? CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + '_=' + Date.now() : CSV_URL;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
        const csvText = await res.text();

        // PapaParse を使用してヘッダ付きで安全にパース
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        // --- 必要ヘッダを検証する ---
        const requiredHeaders = ['term'];
        const foundHeaders = parsed.meta && parsed.meta.fields ? parsed.meta.fields : [];
        const missingHeaders = requiredHeaders.filter(h => !foundHeaders.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error('CSV is missing required header(s): ' + missingHeaders.join(', '));
        }

        const rows = parsed.data || [];

        // K列（11列目）に相当するヘッダ名があれば取得して更新日時に使う
        const headerFields = parsed.meta && parsed.meta.fields ? parsed.meta.fields : [];
        const updatedFieldKey = headerFields.length >= 11 ? headerFields[10] : null; // 0-based index

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
                keywords: keywordsArray, // キーワード列をカンマ区切りで配列化したもの
                tags: Array.from(new Set(tags)),
                description: (row.description || '').trim(),
                image: (row.image || '').trim(),
                // K列があれば updated プロパティとして保持する（Apps Script でタイムスタンプを書き込む想定）
                updated: updatedFieldKey ? (row[updatedFieldKey] || '').trim() : ''
            };
        }).filter(item => item.term); // 用語が必須

        // 最低限の重複 id 対策: 重複があれば連番に差し替える
        const seen = new Set();
        mapped.forEach((it, i) => {
           // idが不正または既に存在する場合に未使用の連番を割り当てる
            if (!it.id || seen.has(it.id)) {
                let candidate = 1;
                while (seen.has(candidate)) {
                    candidate++;
                }
                it.id = candidate;
            }
            seen.add(it.id);
        });

        window.termsData = mapped;
        console.log(`Loaded ${mapped.length} terms from CSV`);
        return mapped;
    } catch (err) {
        console.error('Failed to load sheet CSV:', err);
        // エラー時は window.termsData を空配列にしておく
        if (window.termsData && Array.isArray(window.termsData) && window.termsData.length > 0) {
            console.warn('window.termsData contained old data, but is being reset to an empty array due to load failure.');
        }
        window.termsData = [];
        return window.termsData;
    }
}

// 自動でロード（defer 属性で読み込まれることを想定）
// Promise を外部に公開して init() が待てるようにする
window.sheetPromise = loadSheetAsTerms();

// 手動再読み込みを行うための公開関数
window.reloadSheet = async function(noCache = true) {
    try {
        // 新しい Promise を発行して外部からも待てるようにする
        window.sheetPromise = loadSheetAsTerms(noCache);
        await window.sheetPromise;

        // 呼び出し元が UI を再描画できるように termsData はすでに更新されている
        if (window.termsData && Array.isArray(window.termsData)) {
            // 旧 API と互換性を保つためグローバル変数を上書き
            // 呼び出し側で renderList / renderHomeFavorites を呼ぶ
            console.log('sheet reloaded, items:', window.termsData.length);
        }
        return window.termsData;
    } catch (e) {
        console.error('reloadSheet failed:', e);
        return window.termsData || [];
    }

};
