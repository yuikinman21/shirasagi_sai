const defaults = require('../site.config.json');

// 既定値（site.config.json）に、環境変数 SITE_CONFIG の JSON を重ねて返す
// 本番固有の表示名などはコードに書かず、SITE_CONFIG にだけ持たせる
function buildConfig() {
  const raw = process.env.SITE_CONFIG;
  if (!raw) return { ...defaults };

  let overrides;
  try {
    overrides = JSON.parse(raw);
  } catch (err) {
    console.error("SITE_CONFIG のJSONが不正です:", err.message);
    return { ...defaults };
  }

  // 既定値に存在するキーで、文字列のものだけを採用する
  const config = { ...defaults };
  Object.keys(defaults).forEach(key => {
    if (typeof overrides[key] === 'string' && overrides[key].trim()) {
      config[key] = overrides[key].trim();
    }
  });
  return config;
}

module.exports = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).send(JSON.stringify(buildConfig()));
};
