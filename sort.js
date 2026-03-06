/**
 * sort.js
 *
 * 仕様（要点）:
 * - 各要素のタグ情報はデフォルトで `tags` プロパティを参照。
 * - タグは配列またはカンマ区切りの文字列を想定。
 * - ソートキーは各要素の「最初のタグ」（最初の配列要素、またはカンマ区切りの先頭）を使う。
 * - 定義した `tagOrderArray` の先にあるタグほど優先される。
 * - `tagOrderArray` に含まれないタグはすべて最後尾にまとめる。
 * - 同順位の要素は `term` の二次ソート、さらに元の配列順を維持して安定ソートを実現する。
 *
 * @param {Array<Object>} itemsArray - ソート対象の要素配列（イミュータブルに扱う）
 * @param {Array<string>} tagOrderArray - 優先順を定義したタグ名配列（例: ['Urgent','Medium','Low']）
 * @param {string} [tagKey='tags'] - タグ情報を格納したプロパティ名
 * @returns {Array<Object>} ソート済みの新しい配列（元配列は変更しない）
 */

//タグ順ソーター。タグの優先順位を定義した配列をもとに、アイテムをソートする。
function sortByTagOrder(itemsArray, tagOrderArray, tagKey = 'tags') {
    //データが不正な場合は空配列を返す(エラー防止)
    if (!Array.isArray(itemsArray)) return [];
    if (!Array.isArray(tagOrderArray)) tagOrderArray = [];

    // 小文字化した順序マップを作成
    const orderMap = new Map();
    tagOrderArray.forEach((t, i) => {
        if (t != null) orderMap.set(String(t).trim().toLowerCase(), i);
    });

    // 元配列のインデックスを保持して安定ソートを実現
    const wrapped = itemsArray.map((item, idx) => ({ item, idx }));

    const getFirstTagNormalized = (it) => {
        const val = it && it[tagKey];
        // ケース1: タグが配列 [ 'A', 'B' ] の場合
        if (Array.isArray(val)) {
            for (const v of val) {
                // 空でない最初の文字を小文字にして返す
                if (v != null && String(v).trim() !== '') return String(v).trim().toLowerCase();
            }
            return '';
        }
        // ケース2: タグがカンマ区切りの文字列 "A, B" の場合
        if (typeof val === 'string') {
            // カンマ区切りの先頭を取る
            const first = val.split(',')[0] || '';
            return String(first).trim().toLowerCase();
        }
        return '';
    };
    // ソート実行
    wrapped.sort((a, b) => {
        const ta = getFirstTagNormalized(a.item);
        const tb = getFirstTagNormalized(b.item);

        //1. タグの優先順位でソート
        // orderMap にあるタグはその番号に、ないタグは Infinity として最後尾にまとめる
        const ia = orderMap.has(ta) ? orderMap.get(ta) : Infinity;
        const ib = orderMap.has(tb) ? orderMap.get(tb) : Infinity;
        
        // 番号が小さい方が前
        if (ia !== ib) return ia - ib;

        // 2.二次ソート: タグが同じなら term でソート（小文字化して比較）
        const termA = String(a.item && a.item.term || '').toLowerCase();
        const termB = String(b.item && b.item.term || '').toLowerCase();
        if (termA < termB) return -1;
        if (termA > termB) return 1;

        // 3.三次ソート: term が同じなら元のインデックス順を維持（安定ソート）
        return a.idx - b.idx;
    });

    // ソートされたアイテムだけの新しい配列を返す
    return wrapped.map(w => w.item);
}


/**
 * カタカナをひらがなに変換する（単純な Unicode オフセットを使用）
 */
function toHiragana(str) {
    if (!str) return '';
    return String(str).split('').map(ch => {
        const code = ch.charCodeAt(0);
        // Katakana range: U+30A1 - U+30F6
        if (code >= 0x30A1 && code <= 0x30F6) {
            return String.fromCharCode(code - 0x60);
        }
        return ch;
    }).join('');
}

// バラバラな日付キーに対応して有効な日付オブジェクトを作る
function parseDateFromItem(item) {
    const keys = ['updated', 'updated_at', 'updatedAt', 'modified', 'modified_at', 'date', 'timestamp'];
    for (const k of keys) {
        if (item[k]) return new Date(item[k]);
    }
    return null;
}

/**
 * 汎用ソーター。対応する並べ替えはタグ順、更新日時順、読み順。
 * options: { method: 'tag'|'updated'|'reading', order: 'asc'|'desc', tagOrderArray: [] }
 */
function sortItems(itemsArray, options = {}) {
    const method = options.method || 'tag'; // デフォルトはタグ順
    const order = (options.order || 'asc').toLowerCase(); // デフォルトは昇順
    const tagOrderArray = Array.isArray(options.tagOrderArray) ? options.tagOrderArray : []; 

    // 元の配列を変更しないようにコピーして使用
    const arr = Array.isArray(itemsArray) ? itemsArray.slice() : [];

    // ソート関数を定義
    const cmp = (a, b) => {
        if (method === 'tag') {
            // タグ順は外側で sortByTagOrder を使って処理するためここでは何もしない
            return 0; // 外側で処理される
        }
        if (method === 'updated') {
            const da = parseDateFromItem(a); 
            const db = parseDateFromItem(b);
            const na = da ? da.getTime() : -Infinity;
            const nb = db ? db.getTime() : -Infinity;
            return na - nb; // 昇順: 古いものが前
        }
        if (method === 'reading') {
            const ra = toHiragana(a.reading || '').toLowerCase();
            const rb = toHiragana(b.reading || '').toLowerCase();
            if (ra < rb) return -1; if (ra > rb) return 1; return 0;// 昇順: ひらがなで前に来るものが前
        }
        return 0;
    };

    // タグ順は sortByTagOrder を使って新しい配列を返す
    if (method === 'tag') {
        // タグ順は sortByTagOrder を使って新しい配列を返す
        let sorted = sortByTagOrder(arr, tagOrderArray, 'tags');
        if (order === 'desc') sorted = sorted.reverse();
        return sorted;
    }

    // タグ順以外は単純にソートして必要なら逆順にする
    arr.sort(cmp);
    if (order === 'desc') arr.reverse();
    return arr;
}

// ブラウザで使えるようにグローバルに公開
if (typeof window !== 'undefined') {
    window.sortByTagOrder = sortByTagOrder; //タグ順ソーター
    window.sortItems = sortItems; //汎用ソーター
}

// Node.js で使えるようにモジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sortByTagOrder, sortItems };
}
