/**
 * sortTags.js
 *
 *
 * 仕様（要点）:
 * - 各要素のタグ情報はデフォルトで `tags` プロパティを参照。
 * - タグは配列またはカンマ区切りの文字列を想定。
 * - ソートキーは各要素の「最初のタグ」（最初の配列要素、またはカンマ区切りの先頭）を使う。
 * - 開発者が定義した `tagOrderArray` の先にあるタグほど優先される。
 * - `tagOrderArray` に含まれないタグはすべて最後尾にまとめる。
 * - 同順位の要素は `term` の二次ソート、さらに元の配列順を維持して安定ソートを実現する。
 *
 * @param {Array<Object>} itemsArray - ソート対象の要素配列（イミュータブルに扱う）
 * @param {Array<string>} tagOrderArray - 優先順を定義したタグ名配列（例: ['Urgent','Medium','Low']）
 * @param {string} [tagKey='tags'] - タグ情報を格納したプロパティ名
 * @returns {Array<Object>} ソート済みの新しい配列（元配列は変更しない）
 */
function sortByTagOrder(itemsArray, tagOrderArray, tagKey = 'tags') {
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
        if (Array.isArray(val)) {
            for (const v of val) {
                if (v != null && String(v).trim() !== '') return String(v).trim().toLowerCase();
            }
            return '';
        }
        if (typeof val === 'string') {
            // カンマ区切りの先頭を取る
            const first = val.split(',')[0] || '';
            return String(first).trim().toLowerCase();
        }
        return '';
    };

    wrapped.sort((a, b) => {
        const ta = getFirstTagNormalized(a.item);
        const tb = getFirstTagNormalized(b.item);

        const ia = orderMap.has(ta) ? orderMap.get(ta) : Infinity;
        const ib = orderMap.has(tb) ? orderMap.get(tb) : Infinity;

        if (ia !== ib) return ia - ib;

        // 二次ソート: term の文字列順
        const termA = String(a.item && a.item.term || '').toLowerCase();
        const termB = String(b.item && b.item.term || '').toLowerCase();
        if (termA < termB) return -1;
        if (termA > termB) return 1;

        // 最後に元の順序を保持（安定ソート）
        return a.idx - b.idx;
    });

    return wrapped.map(w => w.item);
}

// ブラウザで使えるようにグローバルに公開
if (typeof window !== 'undefined') {
    window.sortByTagOrder = sortByTagOrder;
}

// CommonJS/ESM でも使えるようにエクスポート（必要なら）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sortByTagOrder;
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

function parseDateFromItem(item) {
    const keys = ['updated', 'updated_at', 'updatedAt', 'modified', 'modified_at', 'date', 'timestamp'];
    for (const k of keys) {
        if (item[k]) return new Date(item[k]);
    }
    return null;
}

/**
 * 汎用ソーター。対応する並べ替えはタグ順、更新日時順、読み（reading）順。
 * options: { method: 'tag'|'updated'|'reading', order: 'asc'|'desc', tagOrderArray: [] }
 */
function sortItems(itemsArray, options = {}) {
    const method = options.method || 'tag';
    const order = (options.order || 'asc').toLowerCase();
    const tagOrderArray = Array.isArray(options.tagOrderArray) ? options.tagOrderArray : [];

    const arr = Array.isArray(itemsArray) ? itemsArray.slice() : [];

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
            return na - nb;
        }
        if (method === 'reading') {
            const ra = toHiragana(a.reading || '').toLowerCase();
            const rb = toHiragana(b.reading || '').toLowerCase();
            if (ra < rb) return -1; if (ra > rb) return 1; return 0;
        }
        return 0;
    };

    if (method === 'tag') {
        // タグ順は sortByTagOrder を使って新しい配列を返す
        let sorted = sortByTagOrder(arr, tagOrderArray, 'tags');
        if (order === 'desc') sorted = sorted.reverse();
        return sorted;
    }

    arr.sort(cmp);
    if (order === 'desc') arr.reverse();
    return arr;
}

if (typeof window !== 'undefined') window.sortItems = sortItems;

