import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const csvUrl = process.env.CSV_URL;

  if (csvUrl) {
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
      const csvText = await response.text();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.status(200).send(csvText);
    } catch (err) {
      console.error("スプレッドシートの取得エラー:", err);
      return res.status(500).json({ error: "データの取得に失敗しました。" });
    }
  }

  try {
    const jsonPath = path.join(process.cwd(), 'sampledata.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(jsonData);
  } catch (err) {
    console.error("ローカルJSONの読み込みエラー:", err);
    return res.status(500).json({ error: "ダミーデータの読み込みに失敗しました。" });
  }
}