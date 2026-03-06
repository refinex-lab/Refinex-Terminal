import { forwardRef, useImperativeHandle, useRef, Suspense, lazy, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import Prism from 'prismjs';
import 'katex/dist/katex.min.css';
import 'prismjs/themes/prism-tomorrow.css';

// Import common language support
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-diff';

const MermaidBlock = lazy(() => import('./MermaidBlock').then(m => ({ default: m.MermaidBlock })));

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onScroll?: (scrollPercentage: number) => void;
}

export interface MarkdownPreviewRef {
  scrollToPercentage: (percentage: number) => void;
  getScrollPercentage: () => number;
}

export const MarkdownPreview = forwardRef<MarkdownPreviewRef, MarkdownPreviewProps>(
  ({ content, className = '', onScroll }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      scrollToPercentage: (percentage: number) => {
        if (!containerRef.current) return;
        const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
        containerRef.current.scrollTop = (maxScroll * percentage) / 100;
      },
      getScrollPercentage: () => {
        if (!containerRef.current) return 0;
        const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
        if (maxScroll === 0) return 0;
        return (containerRef.current.scrollTop / maxScroll) * 100;
      }
    }));

    const handleScroll = useCallback(() => {
      if (!containerRef.current || !onScroll) return;

      // Debounce scroll events for better performance
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = window.setTimeout(() => {
        if (!containerRef.current) return;
        const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
        if (maxScroll === 0) return;
        const percentage = (containerRef.current.scrollTop / maxScroll) * 100;
        onScroll(percentage);
      }, 50);
    }, [onScroll]);

    // Memoize markdown components to prevent recreation on every render
    const components = useMemo(() => ({
      code(props: any) {
        const { node, className, children, ...rest } = props;
        const match = /language-(\w+)/.exec(className || '');
        const lang = match?.[1];
        const isInline = !className;

        if (lang === 'mermaid' && !isInline) {
          return (
            <Suspense fallback={<div className="mermaid-loading">Loading diagram...</div>}>
              <MermaidBlock chart={String(children).replace(/\n$/, '')} />
            </Suspense>
          );
        }

        if (isInline) {
          return (
            <code className="inline-code" {...rest}>
              {children}
            </code>
          );
        }

        const code = String(children).replace(/\n$/, '');

        try {
          const grammar = (lang && Prism.languages[lang]) || Prism.languages.text;
          if (!grammar) {
            return (
              <pre className={`language-${lang || 'text'}`}>
                <code>{code}</code>
              </pre>
            );
          }
          const highlighted = Prism.highlight(code, grammar, lang || 'text');

          return (
            <pre className={`language-${lang || 'text'}`}>
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          );
        } catch {
          return (
            <pre className={`language-${lang || 'text'}`}>
              <code>{code}</code>
            </pre>
          );
        }
      }
    }), []);

    return (
      <div
        ref={containerRef}
        className={`markdown-preview ${className}`}
        onScroll={handleScroll}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={components}
        >
          {content || '*Start typing to see preview...*'}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownPreview.displayName = 'MarkdownPreview';
