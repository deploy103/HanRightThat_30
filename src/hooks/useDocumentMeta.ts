import { useEffect } from 'react';

function upsertMeta(name: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * 페이지별 title/description/canonical만 갱신한다.
 * OG 태그는 index.html의 정적 기본값을 그대로 쓴다 — JS 실행 후에만 채워지는 OG에 의존하지 않기 위해서다.
 */
export function useDocumentMeta(title: string, description?: string, canonical?: string): void {
  useEffect(() => {
    document.title = title;
    if (description) upsertMeta('description', description);
    if (canonical) upsertCanonical(canonical);
  }, [title, description, canonical]);
}
