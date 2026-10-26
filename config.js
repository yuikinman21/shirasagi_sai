/*
  表示用の設定（祭典名など）を読み込んで画面に反映します。
  本番では API が環境変数 SITE_CONFIG を反映した値を返し、
  API が使えないローカル環境では site.config.json をそのまま使います。
*/

const CONFIG_API_URL = "/api/config";
const CONFIG_FALLBACK_URL = "site.config.json";
const CONFIG_TIMEOUT_MS = 2000;

async function fetchSiteConfig() {
    for (const url of [CONFIG_API_URL, CONFIG_FALLBACK_URL]) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) return await res.json();
        } catch (e) {
            // 次の取得先を試す
        }
    }
    return null;
}

function applySiteConfig(config) {
    if (config) {
        // data-config="キー名" の要素に値を入れる（textContent なので HTML は解釈されない）
        document.querySelectorAll('[data-config]').forEach(el => {
            const value = config[el.dataset.config];
            if (typeof value === 'string' && value) el.textContent = value;
        });
        if (config.festivalName) document.title = `${config.festivalName}用語集`;
    }
    revealConfigTargets();
}

// 設定の反映前に既定値がちらつかないよう、反映後（またはタイムアウト後）に表示する
function revealConfigTargets() {
    document.querySelectorAll('.config-pending').forEach(el => el.classList.remove('config-pending'));
}

setTimeout(revealConfigTargets, CONFIG_TIMEOUT_MS);
window.siteConfigPromise = fetchSiteConfig().then(config => {
    applySiteConfig(config);
    return config;
});
