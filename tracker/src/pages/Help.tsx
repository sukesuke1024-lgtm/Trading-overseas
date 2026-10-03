import { marked } from 'marked';
import manual from '../../docs/MANUAL.md?raw';

// 手順書は docs/MANUAL.md を唯一の原本にして、画面にもそのまま表示する（自作の文書のみ）
const html = marked.parse(manual, { async: false }) as string;

export function Help() {
  return (
    <>
      <div className="page-head"><div><h1>使い方</h1><p>この画面の内容は <span className="mono">docs/MANUAL.md</span> と同じです。</p></div></div>
      <article className="card manual" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
