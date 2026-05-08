/*
  本番環境ではAPI経由でCSVを、サンプル/ローカル環境ではJSONを取得します。
*/

const API_URL = "/api/sheet";

async function loadSheetAsTerms(noCache = true) {
    try {
        const url = noCache ? API_URL + '?_=' + Date.now() : API_URL;
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);

        // APIが何を返してきたか（CSVかJSONか）を判定します
        const contentType = res.headers.get("content-type");

        // ▼ パターンA：サンプル/ローカル環境 (APIがダミーの JSON を返してきた場合)
        if (contentType && contentType.includes("application/json")) {
            console.log("JSONダミーデータを読み込みました (Sample/Local mode)");
<<<<<<< HEAD
=======
            
            const badge = document.getElementById('sample-mode-badge');
            if (badge) {
                badge.classList.remove('hidden');
            }

>>>>>>> parent of 5814166 (サンプルモードのバッジ表示処理を追加し、JSONデータの安全な解析とマッピングを実装)
            const jsonData = await res.json();
            window.termsData = jsonData;
            return jsonData;
        }

        // ▼ パターンB：本番環境 (APIがスプシの CSV を返してきた場合)
        console.log("スプレッドシートのCSVを読み込みました (Production mode)");
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
                updated: updatedFieldKey ? (row[updatedFieldKey] || '').trim() : '',
                map_x: row.map_x != null && String(row.map_x).trim() !== '' ? parseFloat(row.map_x) : null,
                map_y: row.map_y != null && String(row.map_y).trim() !== '' ? parseFloat(row.map_y) : null
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
        console.error('Failed to load data:', err);
        if (window.termsData && Array.isArray(window.termsData) && window.termsData.length > 0) {
            console.warn('Old data reset due to load failure.');
        }
        window.termsData = [];
        return window.termsData;
    }
}

// 自動でロード
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
